import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import type { SupportReplyDrafts } from "../src/lib/supportIdempotency";
import worker from "./worker";

const originalFetch = globalThis.fetch;
type MockUser = {
  id: string;
  email: string;
  user_metadata: Record<string, string>;
  app_metadata: Record<string, string>;
};
type CapturedRequest = {
  url: string;
  path: string;
  method: string;
  authorization: string | null;
  apiKey: string | null;
  idempotencyKey: string | null;
  body: Record<string, unknown> | null;
  query: URLSearchParams;
};

const env = { SUPABASE_URL: "https://support-unit.supabase.co", SUPABASE_SECRET_KEY: "support-test-service-key" };
const workerEnv = {
  ...env,
  PAYSTACK_SECRET_KEY: "sk_test_unit",
  ASSETS: { fetch: async () => new Response("not found", { status: 404 }) },
};
const customer: MockUser = {
  id: "customer-user-id",
  email: "customer@example.test",
  user_metadata: { full_name: "Customer Name" },
  app_metadata: {},
};
const admin: MockUser = {
  id: "admin-user-id",
  email: "admin@example.test",
  user_metadata: { full_name: "Admin Name" },
  app_metadata: { role: "admin" },
};
const KEY_1 = "11111111-1111-4111-8111-111111111111";
const KEY_2 = "22222222-2222-4222-8222-222222222222";

const {
  handleAdminSupportPost,
  handleCreateSupportTicket,
  handleCustomerSupportReply,
} = await import("./support-routes");
const {
  buildAdminSupportReplyPayload,
  canApplyTicketResponse,
  clearSupportIdempotencyKey,
  getSupportIdempotencyKey,
  updateSupportReplyDraft,
} = await import("../src/lib/supportIdempotency");

afterEach(() => { globalThis.fetch = originalFetch; });

function setupSupportFetch(options: {
  user?: MockUser;
  authValid?: boolean;
  ownerTicket?: boolean;
  replyInsertFails?: boolean;
  replyInsertFailureCount?: number;
  ticketInsertFailureCount?: number;
  timestampFailures?: number;
  dropReplyResponseAfterCommit?: boolean;
  dropTicketResponseAfterCommit?: boolean;
} = {}) {
  const requests: CapturedRequest[] = [];
  const user = options.user ?? customer;
  const tickets = new Map<string, Record<string, unknown>>();
  const replies = new Map<string, Record<string, unknown>>();
  const timestampFailures = { remaining: options.timestampFailures ?? 0 };
  const replyFailures = { remaining: options.replyInsertFailureCount ?? (options.replyInsertFails ? 1 : 0) };
  const ticketFailures = { remaining: options.ticketInsertFailureCount ?? 0 };
  const networkDrop = { reply: options.dropReplyResponseAfterCommit ?? false, ticket: options.dropTicketResponseAfterCommit ?? false };
  const ownerTicket = options.ownerTicket === false ? null : {
    id: "ticket-123",
    user_id: user.id,
    ticket_number: 123,
    subject: "Account help",
    category: "account",
    status: "open",
    priority: "normal",
    created_at: "2026-11-21T10:00:00.000Z",
    updated_at: "2026-11-21T10:00:00.000Z",
    last_reply_at: "2026-11-21T10:00:00.000Z",
    creation_idempotency_key: null,
    creation_request_hash: null,
  };
  if (ownerTicket) tickets.set(String(ownerTicket.id), ownerTicket);

  const sendRows = (rows: Record<string, unknown>[]) => Response.json(rows);
  const matchSingle = (rows: Record<string, unknown>[]) => sendRows(rows);

  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const rawBody = init?.body;
    const body = typeof rawBody === "string" ? JSON.parse(rawBody) as Record<string, unknown> : null;
    requests.push({
      url: url.toString(),
      path: url.pathname,
      method,
      authorization: headers.get("authorization"),
      apiKey: headers.get("apikey"),
      idempotencyKey: headers.get("idempotency-key"),
      body,
      query: url.searchParams,
    });

    if (url.pathname === "/auth/v1/user" && method === "GET") {
      return options.authValid === false
        ? Response.json({ message: "Invalid token" }, { status: 401 })
        : Response.json(user);
    }

    if (url.pathname === "/rest/v1/support_tickets" && method === "GET") {
      let rows = [...tickets.values()];
      for (const [column, rawFilter] of url.searchParams) {
        if (!rawFilter.startsWith("eq.")) continue;
        const expected = rawFilter.slice(3);
        rows = rows.filter((row) => String(row[column] ?? "") === expected);
      }
      if (options.ownerTicket === false && url.searchParams.has("id")) rows = [];
      return matchSingle(rows);
    }

    if (url.pathname === "/rest/v1/support_tickets" && method === "POST") {
      if (ticketFailures.remaining > 0) {
        ticketFailures.remaining -= 1;
        return Response.json({ code: "XX001", message: "simulated ticket insert failure" }, { status: 500 });
      }
      const inputRow = body ?? {};
      const existing = [...tickets.values()].find((row) =>
        row.user_id === inputRow.user_id
        && row.creation_idempotency_key === inputRow.creation_idempotency_key
        && inputRow.creation_idempotency_key != null);
      if (existing) return Response.json({ code: "23505", message: "duplicate ticket key" }, { status: 409 });
      const row = {
        id: "ticket-123",
        ticket_number: 123,
        status: "open",
        priority: "normal",
        created_at: "2026-11-21T10:00:00.000Z",
        updated_at: "2026-11-21T10:00:00.000Z",
        last_reply_at: null,
        ...inputRow,
      };
      tickets.set(String(row.id), row);
      if (networkDrop.ticket) {
        networkDrop.ticket = false;
        throw new TypeError("simulated connection loss after ticket commit");
      }
      return Response.json(row, { status: 201 });
    }

    if (url.pathname === "/rest/v1/support_tickets" && method === "PATCH") {
      if (timestampFailures.remaining > 0) {
        timestampFailures.remaining -= 1;
        return Response.json({ code: "XX002", message: "simulated timestamp update failure" }, { status: 500 });
      }
      const id = url.searchParams.get("id")?.slice(3);
      const row = id ? tickets.get(id) : undefined;
      if (!row) return sendRows([]);
      const expectedUpdated = url.searchParams.get("updated_at")?.slice(3);
      if (expectedUpdated && row.updated_at !== expectedUpdated) return sendRows([]);
      const expectedLast = url.searchParams.get("last_reply_at")?.slice(3);
      if (expectedLast && row.last_reply_at && Date.parse(String(row.last_reply_at)) > Date.parse(expectedLast)) return sendRows([]);
      Object.assign(row, body);
      return sendRows([{ id: row.id }]);
    }

    if (url.pathname === "/rest/v1/support_tickets" && method === "DELETE") {
      const id = url.searchParams.get("id")?.slice(3);
      if (id) tickets.delete(id);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/rest/v1/support_replies" && method === "GET") {
      let rows = [...replies.values()];
      for (const [column, rawFilter] of url.searchParams) {
        if (!rawFilter.startsWith("eq.")) continue;
        const expected = rawFilter.slice(3);
        rows = rows.filter((row) => String(row[column] ?? "") === expected);
      }
      return matchSingle(rows);
    }

    if (url.pathname === "/rest/v1/support_replies" && method === "POST") {
      if (replyFailures.remaining > 0) {
        replyFailures.remaining -= 1;
        return Response.json({ code: "42501", message: "row-level security policy violation" }, { status: 403 });
      }
      const inputRow = body ?? {};
      const key = `${inputRow.ticket_id}:${inputRow.sender_id}:${inputRow.idempotency_key}`;
      if (inputRow.idempotency_key && replies.has(key)) {
        return Response.json({ code: "23505", message: "duplicate reply key" }, { status: 409 });
      }
      const reply = {
        id: `reply-${replies.size + 1}`,
        created_at: "2026-11-21T12:00:00.000Z",
        ...inputRow,
        sender_id: user.id,
        sender_name: user.user_metadata.full_name,
        sender_email: user.email,
        is_admin: user.app_metadata.role === "admin" ? inputRow.is_admin : false,
      };
      replies.set(key, reply);
      if (networkDrop.reply) {
        networkDrop.reply = false;
        throw new TypeError("simulated connection loss after reply commit");
      }
      return Response.json(reply, { status: 201 });
    }

    throw new Error(`Unexpected support request: ${method} ${url.pathname}`);
  };

  return { requests, tickets, replies };
}

function makeRequest(
  url: string,
  token: string | null,
  body: Record<string, unknown>,
  method = "POST",
  idempotencyKey: string | null = KEY_1,
) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

function assertServiceKeyAndBearer(request: CapturedRequest, bearer: string) {
  assert.equal(request.authorization, `Bearer ${bearer}`);
  assert.equal(request.apiKey, env.SUPABASE_SECRET_KEY);
}

function customerReply(message: string, key = KEY_1) {
  return makeRequest("https://njs.test/api/support/tickets/ticket-123/replies", "customer-jwt", { message }, "POST", key);
}

function adminReply(message: string, key = KEY_1) {
  return makeRequest("https://njs.test/api/admin/support", "admin-jwt", {
    action: "reply", ticketId: "ticket-123", message,
  }, "POST", key);
}

test("customer ticket creation stores an initial reply and protects both request keys", async () => {
  const mock = setupSupportFetch({ user: customer });
  const response = await handleCreateSupportTicket(makeRequest("https://njs.test/api/support/tickets", "customer-jwt", {
    subject: "Account help",
    message: "Please help with my account access.",
    user_id: "victim-user-id",
    sender_id: "victim-user-id",
    sender_email: "spoof@example.test",
    sender_name: "Spoofed Name",
    is_admin: true,
  }), env);

  assert.equal(response.status, 201);
  const ticketInsert = mock.requests.find((request) => request.path === "/rest/v1/support_tickets" && request.method === "POST");
  const replyInsert = mock.requests.find((request) => request.path === "/rest/v1/support_replies" && request.method === "POST");
  assert.ok(ticketInsert);
  assertServiceKeyAndBearer(ticketInsert, "customer-jwt");
  assert.equal(ticketInsert.body?.user_id, customer.id);
  assert.equal(ticketInsert.body?.creation_idempotency_key, KEY_1);
  assert.equal(typeof ticketInsert.body?.creation_request_hash, "string");
  assert.ok(replyInsert);
  assertServiceKeyAndBearer(replyInsert, "customer-jwt");
  assert.equal(replyInsert.body?.idempotency_key, KEY_1);
  assert.deepEqual({
    sender_id: replyInsert.body?.sender_id,
    sender_name: replyInsert.body?.sender_name,
    sender_email: replyInsert.body?.sender_email,
    is_admin: replyInsert.body?.is_admin,
  }, {
    sender_id: customer.id,
    sender_name: "Customer Name",
    sender_email: customer.email,
    is_admin: false,
  });
  const timestampUpdate = mock.requests.find((request) => request.path === "/rest/v1/support_tickets" && request.method === "PATCH");
  assert.ok(timestampUpdate);
  assertServiceKeyAndBearer(timestampUpdate, env.SUPABASE_SECRET_KEY);
  assert.equal(timestampUpdate.query.get("id"), "eq.ticket-123");
  assert.equal(timestampUpdate.query.get("user_id"), `eq.${customer.id}`);
});

test("normal customer reply uses verified identity and updates only the customer's ticket", async () => {
  const mock = setupSupportFetch({ user: customer });
  const response = await worker.fetch(customerReply("Here is additional information for support."), workerEnv);
  assert.equal(response.status, 201);
  const replyInsert = mock.requests.find((request) => request.path === "/rest/v1/support_replies" && request.method === "POST");
  assert.ok(replyInsert);
  assert.equal(new URL(replyInsert.url).origin, env.SUPABASE_URL);
  assert.equal(new URL(replyInsert.url).pathname, "/rest/v1/support_replies");
  assertServiceKeyAndBearer(replyInsert, "customer-jwt");
  assert.equal(replyInsert.body?.idempotency_key, KEY_1);
  assert.equal(replyInsert.body?.sender_id, customer.id);
  assert.equal(replyInsert.body?.is_admin, false);
  const timestampUpdate = mock.requests.find((request) => request.path === "/rest/v1/support_tickets" && request.method === "PATCH");
  assert.ok(timestampUpdate);
  assertServiceKeyAndBearer(timestampUpdate, env.SUPABASE_SECRET_KEY);
  assert.equal(timestampUpdate.query.get("id"), "eq.ticket-123");
  assert.equal(timestampUpdate.query.get("user_id"), `eq.${customer.id}`);
});

test("normal administrator reply uses the verified administrator JWT", async () => {
  const mock = setupSupportFetch({ user: admin });
  const response = await worker.fetch(adminReply("Official response."), workerEnv);
  assert.equal(response.status, 201);
  const insert = mock.requests.find((request) => request.path === "/rest/v1/support_replies" && request.method === "POST");
  assert.ok(insert);
  assertServiceKeyAndBearer(insert, "admin-jwt");
  assert.equal(insert.body?.idempotency_key, KEY_1);
  assert.equal(insert.body?.sender_id, admin.id);
  assert.equal(insert.body?.is_admin, true);
  const patch = mock.requests.find((request) => request.path === "/rest/v1/support_tickets" && request.method === "PATCH");
  assert.ok(patch);
  assert.equal(patch.body?.status, "waiting_on_user");
});

test("same-key customer retry returns the existing reply without inserting another", async () => {
  const mock = setupSupportFetch({ user: customer });
  const first = await handleCustomerSupportReply(customerReply("A valid customer reply."), env, "ticket-123");
  const second = await handleCustomerSupportReply(customerReply("A valid customer reply."), env, "ticket-123");
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(mock.requests.filter((request) => request.path === "/rest/v1/support_replies" && request.method === "POST").length, 1);
  assert.equal(mock.replies.size, 1);
  assert.equal((await second.json()).idempotentReplay, true);
});

test("same-key administrator retry returns its existing reply", async () => {
  const mock = setupSupportFetch({ user: admin });
  const first = await handleAdminSupportPost(adminReply("Official response."), env);
  const second = await handleAdminSupportPost(adminReply("Official response."), env);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(mock.replies.size, 1);
  assert.equal(mock.requests.filter((request) => request.path === "/rest/v1/support_replies" && request.method === "POST").length, 1);
});

test("customer and administrator recover committed replies after the POST response is interrupted", async () => {
  const customerMock = setupSupportFetch({ user: customer, dropReplyResponseAfterCommit: true });
  const customerResponse = await handleCustomerSupportReply(customerReply("Customer response recovered."), env, "ticket-123");
  assert.equal(customerResponse.status, 200);
  assert.equal(customerMock.replies.size, 1);
  assert.equal(customerMock.requests.filter((entry) => entry.path === "/rest/v1/support_replies" && entry.method === "POST").length, 1);

  const adminMock = setupSupportFetch({ user: admin, dropReplyResponseAfterCommit: true });
  const adminResponse = await handleAdminSupportPost(adminReply("Administrator response recovered."), env);
  assert.equal(adminResponse.status, 200);
  assert.equal(adminMock.replies.size, 1);
  assert.equal(adminMock.requests.filter((entry) => entry.path === "/rest/v1/support_replies" && entry.method === "POST").length, 1);
});

test("concurrent same-key customer requests are deduplicated by the simulated unique index", async () => {
  const mock = setupSupportFetch({ user: customer });
  const responses = await Promise.all([
    handleCustomerSupportReply(customerReply("One logical reply."), env, "ticket-123"),
    handleCustomerSupportReply(customerReply("One logical reply."), env, "ticket-123"),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
  assert.equal(mock.replies.size, 1);
  assert.equal(mock.requests.filter((request) => request.path === "/rest/v1/support_replies" && request.method === "POST").length, 2);
});

test("concurrent same-key administrator requests are deduplicated by the sender-scoped index", async () => {
  const mock = setupSupportFetch({ user: admin });
  const responses = await Promise.all([
    handleAdminSupportPost(adminReply("One administrator reply."), env),
    handleAdminSupportPost(adminReply("One administrator reply."), env),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
  assert.equal(mock.replies.size, 1);
  assert.equal(mock.requests.filter((request) => request.path === "/rest/v1/support_replies" && request.method === "POST").length, 2);
});

test("reusing a reply key with different content is rejected", async () => {
  const mock = setupSupportFetch({ user: customer });
  await handleCustomerSupportReply(customerReply("Original text."), env, "ticket-123");
  const replay = await handleCustomerSupportReply(customerReply("Different text.", KEY_1), env, "ticket-123");
  assert.equal(replay.status, 409);
  assert.equal(mock.replies.size, 1);
  assert.equal(mock.requests.filter((request) => request.path === "/rest/v1/support_tickets" && request.method === "PATCH").length, 1);
});

test("saved reply with failed timestamp update returns 202 and retry repairs without a second insert", async () => {
  const mock = setupSupportFetch({ user: customer, timestampFailures: 1 });
  const first = await handleCustomerSupportReply(customerReply("Saved before timestamp failure."), env, "ticket-123");
  const firstBody = await first.json();
  assert.equal(first.status, 202);
  assert.equal(firstBody.replySaved, true);
  assert.equal(firstBody.timestampSynced, false);
  const retry = await handleCustomerSupportReply(customerReply("Saved before timestamp failure."), env, "ticket-123");
  assert.equal(retry.status, 200);
  assert.equal(mock.replies.size, 1);
  assert.equal(mock.requests.filter((request) => request.path === "/rest/v1/support_replies" && request.method === "POST").length, 1);
  assert.equal(mock.requests.filter((request) => request.path === "/rest/v1/support_tickets" && request.method === "PATCH").length, 2);
});

test("initial ticket timestamp failure leaves the saved ticket and reply recoverable", async () => {
  const mock = setupSupportFetch({ user: customer, timestampFailures: 1 });
  const request = () => makeRequest("https://njs.test/api/support/tickets", "customer-jwt", {
    subject: "Account help", category: "account", message: "Please help with my account access.",
  });
  const first = await handleCreateSupportTicket(request(), env);
  assert.equal(first.status, 202);
  assert.equal((await first.json()).replySaved, true);
  const retry = await handleCreateSupportTicket(request(), env);
  assert.equal(retry.status, 200);
  assert.equal(mock.tickets.size, 1);
  assert.equal(mock.replies.size, 1);
  assert.equal(mock.requests.filter((entry) => entry.path === "/rest/v1/support_tickets" && entry.method === "POST").length, 1);
  assert.equal(mock.requests.filter((entry) => entry.path === "/rest/v1/support_replies" && entry.method === "POST").length, 1);
});

test("repeated timestamp failures continue to report saved reply and pending synchronization", async () => {
  const mock = setupSupportFetch({ user: customer, timestampFailures: 2 });
  const first = await handleCustomerSupportReply(customerReply("Reply remains saved."), env, "ticket-123");
  const second = await handleCustomerSupportReply(customerReply("Reply remains saved."), env, "ticket-123");
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  assert.equal((await second.json()).replySaved, true);
  assert.equal(mock.replies.size, 1);
});

test("failed reply insert does not update ticket timestamps", async () => {
  const mock = setupSupportFetch({ user: customer, replyInsertFails: true });
  const response = await handleCustomerSupportReply(customerReply("This insert will be rejected by RLS."), env, "ticket-123");
  assert.equal(response.status, 500);
  assert.equal(mock.requests.some((request) => request.path === "/rest/v1/support_tickets" && request.method === "PATCH"), false);
});

test("initial reply failure keeps the keyed ticket and retry completes it without cleanup deletion", async () => {
  const mock = setupSupportFetch({ user: customer, replyInsertFailureCount: 1 });
  const request = () => makeRequest("https://njs.test/api/support/tickets", "customer-jwt", {
    subject: "Account help", category: "account", message: "Please help with my account access.",
  });
  const first = await handleCreateSupportTicket(request(), env);
  assert.equal(first.status, 202);
  const firstBody = await first.json();
  assert.equal(firstBody.ticketCreated, true);
  assert.equal(firstBody.replySaved, false);
  assert.equal(mock.tickets.size, 1);
  assert.equal(mock.requests.some((entry) => entry.method === "DELETE"), false);

  const retry = await handleCreateSupportTicket(request(), env);
  assert.equal(retry.status, 200);
  assert.equal(mock.tickets.size, 1);
  assert.equal(mock.replies.size, 1);
  assert.equal(mock.requests.filter((entry) => entry.path === "/rest/v1/support_tickets" && entry.method === "POST").length, 1);
});

test("ticket insert response loss is recovered by the same creation key", async () => {
  const mock = setupSupportFetch({ user: customer, dropTicketResponseAfterCommit: true });
  const response = await handleCreateSupportTicket(makeRequest("https://njs.test/api/support/tickets", "customer-jwt", {
    subject: "Account help", category: "account", message: "Please help with my account access.",
  }), env);
  assert.equal(response.status, 200);
  assert.equal(mock.tickets.size, 1);
  assert.equal(mock.replies.size, 1);
  assert.equal(mock.requests.filter((entry) => entry.path === "/rest/v1/support_tickets" && entry.method === "POST").length, 1);
});

test("initial reply response loss is recovered without duplicating its ticket or reply", async () => {
  const mock = setupSupportFetch({ user: customer, dropReplyResponseAfterCommit: true });
  const response = await handleCreateSupportTicket(makeRequest("https://njs.test/api/support/tickets", "customer-jwt", {
    subject: "Account help", category: "account", message: "Please help with my account access.",
  }), env);
  assert.equal(response.status, 200);
  assert.equal(mock.tickets.size, 1);
  assert.equal(mock.replies.size, 1);
  assert.equal(mock.requests.filter((entry) => entry.path === "/rest/v1/support_tickets" && entry.method === "POST").length, 1);
  assert.equal(mock.requests.filter((entry) => entry.path === "/rest/v1/support_replies" && entry.method === "POST").length, 1);
});

test("same initial-ticket key with changed content is rejected and creates no second ticket", async () => {
  const mock = setupSupportFetch({ user: customer });
  const makeCreate = (message: string) => makeRequest("https://njs.test/api/support/tickets", "customer-jwt", {
    subject: "Account help", category: "account", message,
  });
  assert.equal((await handleCreateSupportTicket(makeCreate("Please help with my account access."), env)).status, 201);
  const changed = await handleCreateSupportTicket(makeCreate("Please help with another account issue."), env);
  assert.equal(changed.status, 409);
  assert.equal(mock.tickets.size, 1);
});

test("same reply key cannot retrieve another sender's reply", async () => {
  const mock = setupSupportFetch({ user: customer, ownerTicket: false });
  const response = await handleCustomerSupportReply(customerReply("Attempt to reuse another user's key."), env, "ticket-123");
  assert.equal(response.status, 404);
  assert.equal(mock.requests.some((entry) => entry.path === "/rest/v1/support_replies"), false);
});

test("concurrent duplicate initial-ticket requests create one ticket and one initial reply", async () => {
  const mock = setupSupportFetch({ user: customer });
  const request = () => makeRequest("https://njs.test/api/support/tickets", "customer-jwt", {
    subject: "Account help", category: "account", message: "Please help with my account access.",
  });
  const responses = await Promise.all([
    handleCreateSupportTicket(request(), env),
    handleCreateSupportTicket(request(), env),
  ]);
  assert.ok(responses.every((response) => response.status === 200 || response.status === 201));
  assert.equal(mock.tickets.size, 1);
  assert.equal(mock.replies.size, 1);
});

test("missing or invalid idempotency key is rejected", async () => {
  setupSupportFetch({ user: customer });
  const missing = await handleCustomerSupportReply(
    makeRequest("https://njs.test/api/support/tickets/ticket-123/replies", "customer-jwt", { message: "A valid reply." }, "POST", null),
    env,
    "ticket-123",
  );
  assert.equal(missing.status, 400);
  const invalid = await handleCustomerSupportReply(
    makeRequest("https://njs.test/api/support/tickets/ticket-123/replies", "customer-jwt", { message: "A valid reply." }, "POST", "not-a-uuid"),
    env,
    "ticket-123",
  );
  assert.equal(invalid.status, 400);
});

test("missing and invalid bearer tokens are rejected before support writes", async () => {
  const missingRequests = setupSupportFetch();
  const missing = await handleCreateSupportTicket(makeRequest("https://njs.test/api/support/tickets", null, {
    subject: "Account help", message: "Please help with my account access.",
  }), env);
  assert.equal(missing.status, 401);
  assert.equal(missingRequests.requests.length, 0);

  const invalidRequests = setupSupportFetch({ authValid: false });
  const invalid = await handleCreateSupportTicket(makeRequest("https://njs.test/api/support/tickets", "invalid-jwt", {
    subject: "Account help", message: "Please help with my account access.",
  }), env);
  assert.equal(invalid.status, 401);
  assert.equal(invalidRequests.requests.some((request) => request.path.startsWith("/rest/v1/")), false);
});

test("customer cannot invoke administrator reply functionality", async () => {
  const mock = setupSupportFetch({ user: customer });
  const response = await handleAdminSupportPost(adminReply("Unauthorized admin action."), env);
  assert.equal(response.status, 403);
  assert.equal(mock.requests.some((request) => request.path === "/rest/v1/support_tickets"), false);
  assert.equal(mock.requests.some((request) => request.path === "/rest/v1/support_replies"), false);
});

test("sender identity fields and admin marker remain server-derived", async () => {
  const mock = setupSupportFetch({ user: customer });
  const response = await handleCustomerSupportReply(makeRequest(
    "https://njs.test/api/support/tickets/ticket-123/replies",
    "customer-jwt",
    { message: "A valid customer reply.", sender_id: "victim", sender_email: "spoof@test", sender_name: "Spoof", is_admin: true },
  ), env, "ticket-123");
  assert.equal(response.status, 201);
  const insert = mock.requests.find((entry) => entry.path === "/rest/v1/support_replies" && entry.method === "POST");
  assert.equal(insert?.body?.sender_id, customer.id);
  assert.equal(insert?.body?.sender_email, customer.email);
  assert.equal(insert?.body?.sender_name, customer.user_metadata.full_name);
  assert.equal(insert?.body?.is_admin, false);
});

test("guest ticket policy stays unlinked and the Worker create route remains authenticated", async () => {
  const migration = readFileSync("supabase/migrations/20261121095940_restrict_public_support_ticket_ownership.sql", "utf8");
  assert.match(migration, /CREATE POLICY "Guests can submit unlinked support tickets"[\s\S]*?TO anon[\s\S]*?user_id IS NULL/i);
  assert.match(migration, /char_length\(trim\(requester_name\)\) BETWEEN 2 AND 120/i);
  assert.match(migration, /char_length\(trim\(requester_email\)\) BETWEEN 5 AND 254/i);

  const mock = setupSupportFetch();
  const response = await handleCreateSupportTicket(makeRequest("https://njs.test/api/support/tickets", null, {
    subject: "Guest request", message: "A guest cannot attach this ticket to an account.",
  }), env);
  assert.equal(response.status, 401);
  assert.equal(mock.requests.some((entry) => entry.path === "/rest/v1/support_tickets" && entry.method === "POST"), false);
});

test("support timestamp migration preserves the secure trigger and updates only NEW.ticket_id", () => {
  const migration = readFileSync("supabase/migrations/20261121120957_secure_support_ticket_reply_timestamps.sql", "utf8");
  assert.match(migration, /SECURITY DEFINER\s+SET search_path = ''/i);
  assert.match(migration, /UPDATE public\.support_tickets[\s\S]*WHERE id = NEW\.ticket_id/i);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON FUNCTION public\.touch_support_ticket\(\)[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.touch_support_ticket\(\) TO service_role/i);
  assert.doesNotMatch(migration, /DROP TRIGGER|CREATE TRIGGER/i);
});

test("idempotency migration adds nullable UUID keys and unique scoped indexes", () => {
  const migration = readFileSync("supabase/migrations/20261122100000_support_submission_idempotency.sql", "utf8");
  assert.match(migration, /creation_idempotency_key uuid/i);
  assert.match(migration, /creation_request_hash text/i);
  assert.match(migration, /idempotency_key uuid/i);
  assert.match(migration, /ON public\.support_tickets \(user_id, creation_idempotency_key\)[\s\S]*WHERE user_id IS NOT NULL AND creation_idempotency_key IS NOT NULL/i);
  assert.match(migration, /ON public\.support_replies \(ticket_id, sender_id, idempotency_key\)[\s\S]*WHERE sender_id IS NOT NULL AND idempotency_key IS NOT NULL/i);
  assert.match(migration, /CHECK \(\(creation_idempotency_key IS NULL\) = \(creation_request_hash IS NULL\)\)/i);
  assert.match(migration, /NEW\.sender_id := auth\.uid\(\)/i);
  assert.match(migration, /NEW\.is_admin := v_is_admin/i);
  assert.match(migration, /SECURITY DEFINER\s+SET search_path = ''/i);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON FUNCTION public\.enforce_support_reply_sender_identity\(\)[\s\S]*FROM PUBLIC, anon, authenticated/i);
});

test("new database inserts require keys while historical null keys remain allowed", () => {
  const migration = readFileSync("supabase/migrations/20261122110000_enforce_support_idempotency_and_current_admin_role.sql", "utf8");
  const columns = readFileSync("supabase/migrations/20261122100000_support_submission_idempotency.sql", "utf8");
  assert.match(columns, /creation_idempotency_key uuid,/i);
  assert.match(columns, /idempotency_key uuid;/i);
  assert.doesNotMatch(migration, /UPDATE\s+public\.support_(tickets|replies)/i);
  assert.match(migration, /BEFORE INSERT ON public\.support_tickets/i);
  assert.match(migration, /NEW\.creation_idempotency_key IS NULL/i);
  assert.match(migration, /NEW\.creation_request_hash IS NULL/i);
  assert.match(migration, /BEFORE INSERT ON public\.support_replies/i);
  assert.match(migration, /NEW\.idempotency_key IS NULL/i);
  assert.match(migration, /support_tickets_anonymous_creation_idempotency_uidx[\s\S]*ON public\.support_tickets \(creation_idempotency_key\)[\s\S]*WHERE user_id IS NULL AND creation_idempotency_key IS NOT NULL/i);
  assert.match(columns, /support_replies_ticket_sender_idempotency_uidx[\s\S]*ON public\.support_replies \(ticket_id, sender_id, idempotency_key\)[\s\S]*WHERE sender_id IS NOT NULL AND idempotency_key IS NOT NULL/i);
  assert.match(migration, /SECURITY DEFINER\s+SET search_path = ''/i);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON FUNCTION public\.enforce_support_ticket_idempotency_key\(\)[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON FUNCTION public\.enforce_support_reply_idempotency_key\(\)[\s\S]*FROM PUBLIC, anon, authenticated/i);
});

test("support ticket idempotency scope survives account deletion", () => {
  const migration = readFileSync("supabase/migrations/20261122120000_preserve_support_creation_scope_after_account_deletion.sql", "utf8");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS creation_actor_id uuid/i);
  assert.match(migration, /SET creation_actor_id = user_id[\s\S]*WHERE creation_actor_id IS NULL[\s\S]*AND user_id IS NOT NULL/i);
  assert.match(migration, /NEW\.creation_actor_id := auth\.uid\(\)/i);
  assert.match(migration, /NEW\.creation_actor_id := NEW\.user_id/i);
  assert.match(migration, /NEW\.creation_actor_id IS DISTINCT FROM OLD\.creation_actor_id/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_creation_actor_idempotency_uidx[\s\S]*coalesce\([\s\S]*creation_actor_id[\s\S]*creation_idempotency_key/i);
  assert.match(migration, /DROP INDEX IF EXISTS public\.support_tickets_user_creation_idempotency_uidx/i);
  assert.match(migration, /DROP INDEX IF EXISTS public\.support_tickets_anonymous_creation_idempotency_uidx/i);
  assert.doesNotMatch(migration, /WHERE user_id IS NULL AND creation_idempotency_key IS NOT NULL/i);
});

test("admin authorization uses current Auth app metadata in trigger and RLS policies", () => {
  const migration = readFileSync("supabase/migrations/20261122110000_enforce_support_idempotency_and_current_admin_role.sql", "utf8");
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.njs_current_user_is_admin\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*u\.raw_app_meta_data ->> 'role'[\s\S]*WHERE u\.id = auth\.uid\(\)/i);
  assert.match(migration, /CREATE POLICY "Admins can manage all support tickets"[\s\S]*USING \(public\.njs_current_user_is_admin\(\)\)[\s\S]*WITH CHECK \(public\.njs_current_user_is_admin\(\)\)/i);
  assert.match(migration, /CREATE POLICY "Admins can manage all support replies"[\s\S]*USING \(public\.njs_current_user_is_admin\(\)\)[\s\S]*WITH CHECK \(public\.njs_current_user_is_admin\(\)\)/i);
  assert.match(migration, /v_is_admin := public\.njs_current_user_is_admin\(\)/i);
  assert.doesNotMatch(migration, /auth\.jwt\(\)\s*->\s*'app_metadata'/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.njs_current_user_is_admin\(\)\s+TO authenticated, service_role/i);
});

test("frontend idempotency keys persist per draft and change for a new logical submission", async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  });
  try {
    const sameFirst = await getSupportIdempotencyKey("test-scope", "same logical submission");
    const different = await getSupportIdempotencyKey("test-scope", "a new logical submission");
    const sameRetry = await getSupportIdempotencyKey("test-scope", "same logical submission");
    assert.equal(sameRetry, sameFirst);
    assert.notEqual(different, sameFirst);
    clearSupportIdempotencyKey("test-scope", sameFirst);
    const newLogicalSubmission = await getSupportIdempotencyKey("test-scope", "same logical submission");
    assert.notEqual(newLogicalSubmission, sameFirst);
  } finally {
    if (prior) Object.defineProperty(globalThis, "sessionStorage", prior);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});

test("admin reply drafts and retries remain isolated by ticket and ignore stale responses", async () => {
  const ticketA = "ticket-a";
  const ticketB = "ticket-b";
  const payloadA = buildAdminSupportReplyPayload(ticketA, "  reply for A  ");
  const payloadB = buildAdminSupportReplyPayload(ticketB, "reply for B");
  assert.deepEqual(payloadA, { action: "reply", ticketId: ticketA, message: "reply for A" });

  let drafts: SupportReplyDrafts = {};
  drafts = updateSupportReplyDraft(drafts, ticketA, { message: payloadA.message, timestampPending: true });
  drafts = updateSupportReplyDraft(drafts, ticketB, { message: payloadB.message, timestampPending: false });
  assert.equal(drafts[ticketA]?.message, "reply for A");
  assert.equal(drafts[ticketB]?.message, "reply for B");

  const scopeA = "njs-support:admin-reply:admin-1:ticket-a";
  const scopeB = "njs-support:admin-reply:admin-1:ticket-b";
  const keyA = await getSupportIdempotencyKey(scopeA, JSON.stringify(payloadA));
  assert.equal(await getSupportIdempotencyKey(scopeA, JSON.stringify(payloadA)), keyA);
  assert.notEqual(await getSupportIdempotencyKey(scopeB, JSON.stringify(payloadB)), keyA);

  const failedRetryPayload = buildAdminSupportReplyPayload(ticketA, drafts[ticketA]!.message);
  assert.deepEqual(failedRetryPayload, payloadA);
  assert.equal(canApplyTicketResponse(ticketA, ticketB, true), false);
  assert.equal(canApplyTicketResponse(ticketB, ticketB, true), true);
  assert.equal(canApplyTicketResponse(ticketB, ticketB, false), false);

  drafts = updateSupportReplyDraft(drafts, ticketA, null);
  assert.equal(drafts[ticketA], undefined);
  assert.equal(drafts[ticketB]?.message, "reply for B");
});
