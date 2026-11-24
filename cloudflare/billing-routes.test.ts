/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
const originalFetch = globalThis.fetch;
let fetchImplementation: typeof fetch = originalFetch;
globalThis.fetch = (input, init) => fetchImplementation(input, init);

const {
  handlePaystackWebhook,
  hmacSha512Hex,
  effectiveSubscriptionStatus,
  cancelSubscription,
  cancelScheduledPlanChange,
  schedulePlanChange,
  checkoutVerificationOutcome,
  getBillingSubscription,
  initializeCheckout,
  isPlanCode,
  periodEnd,
  reconcileSubscriptionStatus,
  resumeSubscription,
  subscriptionStateTransition,
  verifyPaystackSignature,
  webhookEventKey,
} = await import("./billing-routes");

afterEach(() => { fetchImplementation = originalFetch; });

const checkoutPlans = [
  { planCode: "pro_monthly", interval: "monthly", amountKobo: 1_500_000, paystackCode: "PLN_zywosdp6f0zzf7c" },
  { planCode: "pro_annual", interval: "annual", amountKobo: 15_000_000, paystackCode: "PLN_xezcdn9iihl5tez" },
  { planCode: "enterprise_monthly", interval: "monthly", amountKobo: 5_000_000, paystackCode: "PLN_rvh1gflfoilesru" },
  { planCode: "enterprise_annual", interval: "annual", amountKobo: 50_000_000, paystackCode: "PLN_2w0l4q51l03918s" },
] as const;

function mockCheckoutDatabase(planCode: string, interval: string, amountKobo: number) {
  const createdRows: { resource: string; body: Record<string, unknown> }[] = [];
  let paystackInitialization: Record<string, unknown> | null = null;
  fetchImplementation = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (url.pathname === "/auth/v1/user") {
      return Response.json({ id: "user-from-verified-token", email: "buyer@example.test" });
    }
    if (url.pathname === "/rest/v1/billing_plans" && method === "GET") {
      return Response.json({
        code: planCode, name: planCode.startsWith("pro_") ? "pro" : "enterprise",
        billing_interval: interval, amount_kobo: amountKobo, currency: "NGN", is_active: true,
      });
    }
    if (url.pathname === "/rest/v1/subscriptions" && method === "GET") return Response.json([]);
    if (url.pathname === "/rest/v1/subscriptions" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      createdRows.push({ resource: "subscriptions", body });
      return Response.json({ id: "subscription-test-id" }, { status: 201 });
    }
    if (url.pathname === "/rest/v1/payment_transactions" && method === "POST") {
      createdRows.push({ resource: "payment_transactions", body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return new Response(null, { status: 201 });
    }
    if (url.hostname === "api.paystack.co" && url.pathname === "/transaction/initialize") {
      paystackInitialization = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ status: true, data: {
        reference: paystackInitialization.reference, authorization_url: "https://checkout.paystack.test/authorize",
      } });
    }
    throw new Error(`Unexpected checkout request: ${method} ${url.pathname}`);
  };
  return {
    createdRows,
    get paystackInitialization() { return paystackInitialization; },
  };
}

async function checkout(planCode: string, extraBody: Record<string, unknown> = {}) {
  return initializeCheckout(new Request("https://njs.test/api/billing/checkout", {
    method: "POST",
    headers: { Authorization: "Bearer verified-user-token", "Content-Type": "application/json" },
    body: JSON.stringify({ planCode, ...extraBody }),
  }), {
    SUPABASE_URL: "https://unit.supabase.co",
    SUPABASE_SECRET_KEY: "unit-service-secret",
    PAYSTACK_SECRET_KEY: "sk_test_unit",
  });
}

test("billing security migration converges both signature column names and limits column grants", () => {
  const sql = readFileSync("supabase/migrations/20261115000032_njs_protect_paystack_subscription_tokens.sql", "utf8");
  assert.match(sql, /paystack_authorization_signature to authorization_signature/i);
  assert.match(sql, /if has_legacy_signature and has_canonical_signature then[\s\S]*?raise exception/i);

  const revokedColumns = sql.match(/revoke select \(([\s\S]*?)\) on table public\.subscriptions from anon, authenticated;/i)?.[1]
    .split(",").map((column) => column.trim()).sort();
  assert.deepEqual(revokedColumns, [
    "amount_kobo", "authorization_signature", "cancel_at_period_end", "cancelled_at", "created_at",
    "current_period_end", "current_period_start", "currency", "id", "metadata", "paystack_customer_code",
    "paystack_email_token", "paystack_subscription_code", "plan_code", "status", "updated_at", "user_id",
  ].sort());

  const grantedColumns = sql.match(/grant select \(([\s\S]*?)\) on (?:table )?public\.subscriptions to authenticated;/i)?.[1]
    .split(",").map((column) => column.trim()).sort();
  assert.deepEqual(grantedColumns, [
    "amount_kobo", "cancel_at_period_end", "cancelled_at", "created_at", "current_period_end",
    "current_period_start", "currency", "id", "plan_code", "status", "updated_at", "user_id",
  ].sort());
  assert.match(sql, /where status in \('pending', 'active', 'non_renewing', 'past_due'\)/i);
});

test("synchronized support and connection migrations retain the intended security boundaries", () => {
  const migrationDir = "supabase/migrations/";
  const notifications = readFileSync(`${migrationDir}20261115000214_lock_down_njs_notification_trigger_functions.sql`, "utf8");
  const ticketStatus = readFileSync(`${migrationDir}20261121095634_restrict_support_ticket_status_updates_to_admins.sql`, "utf8");
  const ticketOwnership = readFileSync(`${migrationDir}20261121095940_restrict_public_support_ticket_ownership.sql`, "utf8");
  const connections = readFileSync(`${migrationDir}20261121100023_restrict_connection_updates_to_status.sql`, "utf8");
  const replies = readFileSync(`${migrationDir}20261121100526_protect_support_reply_sender_identity.sql`, "utf8");

  for (const functionName of ["create_njs_connection_notification", "create_njs_message_notification"]) {
    assert.match(notifications, new RegExp(`alter function public\\.${functionName}\\(\\)[\\s\\S]*?set search_path = ''`, "i"));
    assert.match(notifications, new RegExp(`revoke all privileges on function public\\.${functionName}\\(\\)[\\s\\S]*?from public, anon, authenticated`, "i"));
    assert.doesNotMatch(notifications, new RegExp(`revoke all privileges on function public\\.${functionName}\\(\\)[\\s\\S]*?from [^;]*service_role`, "i"));
  }

  assert.match(ticketStatus, /DROP POLICY IF EXISTS "Users can update their own ticket status only"/i);
  assert.match(ticketStatus, /Admins can manage all support tickets/);
  assert.match(ticketOwnership, /DROP POLICY IF EXISTS "Public can submit support tickets"/i);
  assert.match(ticketOwnership, /user_id is null\s+and char_length\(trim\(requester_name\)\) between 2 and 120/i);
  assert.match(ticketOwnership, /user_id is null or user_id = \(select auth\.uid\(\)\)/i);
  assert.match(ticketOwnership, /char_length\(trim\(requester_email\)\) between 5 and 254/i);

  assert.match(connections, /revoke update on table public\.connections from anon, authenticated/i);
  assert.match(connections, /grant update \(status\) on table public\.connections to authenticated/i);
  assert.doesNotMatch(connections, /drop trigger|drop policy/i);

  assert.match(replies, /security definer\s+set search_path = ''/i);
  assert.match(replies, /new\.sender_id := auth\.uid\(\)/i);
  assert.match(replies, /new\.is_admin := false/i);
  assert.match(replies, /from public, anon, authenticated/i);
  assert.match(replies, /before insert on public\.support_replies/i);
  assert.match(replies, /drop trigger if exists enforce_support_reply_sender_identity/i);
  assert.doesNotMatch(replies, /drop trigger[^;]*support_reply_touch_ticket/i);
});

test("accepts only the four configured internal plan keys", () => {
  assert.equal(isPlanCode("pro_monthly"), true);
  assert.equal(isPlanCode("enterprise_annual"), true);
  assert.equal(isPlanCode("PLN_zywosdp6f0zzf7c"), false);
  assert.equal(isPlanCode("pro_weekly"), false);
  assert.equal(isPlanCode(null), false);
});

for (const plan of checkoutPlans) {
  test(`${plan.planCode} checkout uses its database interval, approved amount, and Paystack plan`, async () => {
    const mock = mockCheckoutDatabase(plan.planCode, plan.interval, plan.amountKobo);
    const response = await checkout(plan.planCode);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      authorizationUrl: "https://checkout.paystack.test/authorize",
      reference: (mock.paystackInitialization as Record<string, unknown>).reference,
    });
    assert.equal(mock.createdRows.find((row) => row.resource === "subscriptions")?.body.plan_code, plan.planCode);
    assert.equal(mock.createdRows.find((row) => row.resource === "subscriptions")?.body.amount_kobo, plan.amountKobo);
    assert.equal(mock.createdRows.find((row) => row.resource === "payment_transactions")?.body.plan_code, plan.planCode);
    assert.equal(mock.createdRows.find((row) => row.resource === "payment_transactions")?.body.amount_kobo, plan.amountKobo);
    assert.equal((mock.paystackInitialization as Record<string, unknown>).plan, plan.paystackCode);
  });
}

test("rejects a database billing interval outside monthly and annual", async () => {
  const mock = mockCheckoutDatabase("pro_annual", "annually", 15_000_000);
  const response = await checkout("pro_annual");
  assert.equal(response.status, 409);
  assert.deepEqual(mock.createdRows, []);
  assert.equal(mock.paystackInitialization, null);
});

test("client-supplied prices cannot override the server-approved plan amount", async () => {
  const plan = checkoutPlans[0];
  const mock = mockCheckoutDatabase(plan.planCode, plan.interval, plan.amountKobo);
  const response = await checkout(plan.planCode, { amount: 1, amountKobo: 1, price: 0.01 });
  assert.equal(response.status, 200);
  assert.equal(mock.createdRows.find((row) => row.resource === "subscriptions")?.body.amount_kobo, plan.amountKobo);
  assert.equal(mock.createdRows.find((row) => row.resource === "payment_transactions")?.body.amount_kobo, plan.amountKobo);
  assert.equal((mock.paystackInitialization as Record<string, unknown>).plan, plan.paystackCode);
});

test("maps payment and subscription events to the intended lifecycle states", () => {
  assert.equal(subscriptionStateTransition("charge.success", "pending"), "active");
  assert.equal(subscriptionStateTransition("invoice.payment_success", "past_due"), "active");
  assert.equal(subscriptionStateTransition("charge.failed", "pending"), "failed");
  assert.equal(subscriptionStateTransition("charge.failed", "active"), null);
  assert.equal(subscriptionStateTransition("charge.failed", "past_due"), "past_due");
  assert.equal(subscriptionStateTransition("invoice.payment_failed", "active"), "past_due");
  assert.equal(subscriptionStateTransition("subscription.not_renew", "active"), "non_renewing");
  assert.equal(subscriptionStateTransition("subscription.disable", "active"), "non_renewing");
  assert.equal(subscriptionStateTransition("subscription.disable", "non_renewing"), "non_renewing");
  assert.equal(subscriptionStateTransition("subscription.disable", "past_due"), "non_renewing");
  assert.equal(subscriptionStateTransition("subscription.disable", "pending"), null);
  assert.equal(subscriptionStateTransition("subscription.expired", "non_renewing"), "expired");
  assert.equal(subscriptionStateTransition("customer.updated", "active"), null);
  assert.equal(reconcileSubscriptionStatus("non_renewing", "active"), "active");
  assert.equal(reconcileSubscriptionStatus("active", "non-renewing"), "non_renewing");
  assert.equal(reconcileSubscriptionStatus("active", "cancelled"), "non_renewing");
  assert.equal(reconcileSubscriptionStatus("pending", "cancelled"), null);
  assert.equal(reconcileSubscriptionStatus("active", "attention", false), "past_due");
  assert.equal(reconcileSubscriptionStatus("past_due", "active", false), null);
  assert.equal(reconcileSubscriptionStatus("expired", "active"), null);
  assert.equal(checkoutVerificationOutcome("success"), "paid");
  assert.equal(checkoutVerificationOutcome("abandoned"), "terminal");
  assert.equal(checkoutVerificationOutcome("reversed"), "terminal");
  assert.equal(checkoutVerificationOutcome("ongoing"), "pending");
});

test("expires past-due access only after the paid period ends", () => {
  const now = Date.parse("2026-11-14T12:00:00.000Z");
  assert.equal(effectiveSubscriptionStatus("past_due", "2026-11-14T11:59:59.000Z", now), "expired");
  assert.equal(effectiveSubscriptionStatus("past_due", "2026-11-14T12:00:01.000Z", now), "past_due");
  assert.equal(effectiveSubscriptionStatus("non_renewing", "2026-11-14T12:00:01.000Z", now), "non_renewing");
  assert.equal(effectiveSubscriptionStatus("non_renewing", "2026-11-14T11:59:59.000Z", now), "expired");
  assert.equal(effectiveSubscriptionStatus("active", null, now), "active");
});

test("calculates calendar renewal dates without overflowing month ends", () => {
  assert.equal(periodEnd(new Date("2026-01-31T12:30:00.000Z"), "monthly"), "2026-02-28T12:30:00.000Z");
  assert.equal(periodEnd(new Date("2026-06-15T12:30:00.000Z"), "annual"), "2027-06-15T12:30:00.000Z");
  assert.equal(periodEnd(new Date("2024-02-29T12:30:00.000Z"), "annual"), "2025-02-28T12:30:00.000Z");
});

test("rejects invalid checkout method and unauthenticated checkout", async () => {
  const env = { SUPABASE_URL: "https://unit.supabase.co", SUPABASE_SECRET_KEY: "test", PAYSTACK_SECRET_KEY: "sk_test_unit" };
  const wrongMethod = await initializeCheckout(new Request("https://njs.test/api/billing/checkout"), env);
  assert.equal(wrongMethod.status, 405);
  const missingAuth = await initializeCheckout(new Request("https://njs.test/api/billing/checkout", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planCode: "pro_monthly" }),
  }), env);
  assert.equal(missingAuth.status, 401);
});

test("requires authentication for subscription retrieval and management", async () => {
  const env = { SUPABASE_URL: "https://unit.supabase.co", SUPABASE_SECRET_KEY: "test", PAYSTACK_SECRET_KEY: "sk_test_unit" };
  const get = await getBillingSubscription(new Request("https://njs.test/api/billing/subscription"), env);
  const cancel = await cancelSubscription(new Request("https://njs.test/api/billing/cancel", { method: "POST" }), env);
  const resume = await resumeSubscription(new Request("https://njs.test/api/billing/resume", { method: "POST" }), env);
  const schedule = await schedulePlanChange(new Request("https://njs.test/api/billing/schedule-change", { method: "POST", body: JSON.stringify({ planCode: "pro_annual" }) }), env);
  const cancelSchedule = await cancelScheduledPlanChange(new Request("https://njs.test/api/billing/schedule-change/cancel", { method: "POST" }), env);
  assert.equal(get.status, 401);
  assert.equal(cancel.status, 401);
  assert.equal(resume.status, 401);
  assert.equal(schedule.status, 401);
  assert.equal(cancelSchedule.status, 401);
});

test("computes and compares Paystack SHA-512 signatures", async () => {
  const body = '{"event":"charge.success","data":{"id":42}}';
  const signature = await hmacSha512Hex("sk_test_unit", body);
  assert.equal(await hmacSha512Hex("sk_test_unit", new TextEncoder().encode(body)), signature);
  assert.equal(signature.length, 128);
  assert.equal(verifyPaystackSignature(signature, signature), true);
  assert.equal(verifyPaystackSignature(`${signature.slice(0, -1)}0`, signature), false);
  assert.equal(verifyPaystackSignature("not-a-signature", signature), false);
});

test("rejects oversized webhook bodies", async () => {
  const response = await handlePaystackWebhook(new Request("https://njs.test/api/billing/webhook", {
    method: "POST", body: "x".repeat(1_000_001),
  }), { SUPABASE_URL: "https://unit.supabase.co", SUPABASE_SECRET_KEY: "test", PAYSTACK_SECRET_KEY: "sk_test_unit" });
  assert.equal(response.status, 413);
});

test("rejects a webhook with an invalid signature before database access", async () => {
  fetchImplementation = async () => { throw new Error("Database must not be reached"); };
  const response = await handlePaystackWebhook(new Request("https://njs.test/api/billing/webhook", {
    method: "POST", headers: { "x-paystack-signature": "invalid" }, body: '{"event":"charge.success","data":{}}',
  }), { SUPABASE_URL: "https://unit.supabase.co", SUPABASE_SECRET_KEY: "test", PAYSTACK_SECRET_KEY: "sk_test_unit" });
  assert.equal(response.status, 401);
});

test("rejects a body tampered after its signature was calculated", async () => {
  fetchImplementation = async () => { throw new Error("Database must not be reached"); };
  const secret = "sk_test_unit";
  const signedBody = '{"event":"charge.success","data":{"reference":"njs-reference-1"}}';
  const signature = await hmacSha512Hex(secret, signedBody);
  const response = await handlePaystackWebhook(new Request("https://njs.test/api/billing/webhook", {
    method: "POST",
    headers: { "x-paystack-signature": signature },
    body: signedBody.replace("charge.success", "charge.failed"),
  }), { SUPABASE_URL: "https://unit.supabase.co", SUPABASE_SECRET_KEY: "test", PAYSTACK_SECRET_KEY: secret });
  assert.equal(response.status, 401);
});

test("records an event once and acknowledges a duplicate delivery", async () => {
  const rows = new Map<string, { id: string; processed: boolean }>();
  let insertCount = 0;
  fetchImplementation = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!url.pathname.endsWith("/rest/v1/paystack_webhook_events")) throw new Error(`Unexpected request: ${url.pathname}`);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (method === "POST") {
      insertCount++;
      const body = JSON.parse(String(init?.body));
      if (rows.has(body.event_key)) {
        return new Response(JSON.stringify({ code: "23505", message: "duplicate" }), { status: 409 });
      }
      rows.set(body.event_key, { id: "event-1", processed: false });
      return new Response(null, { status: 201 });
    }
    if (method === "GET") {
      const key = url.searchParams.get("event_key")?.slice(3);
      return key && rows.has(key) ? Response.json(rows.get(key)) : Response.json([]);
    }
    if (method === "PATCH") {
      const key = url.searchParams.get("event_key")?.slice(3);
      const row = key ? rows.get(key) : undefined;
      if (row) row.processed = JSON.parse(String(init?.body)).processed === true;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected method: ${method}`);
  };

  const secret = "sk_test_unit";
  const webhookSecret = "whsec_test_unit";
  const body = JSON.stringify({ event: "customer.updated", data: { id: 99, customer_code: "CUS_test" } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await hmacSha512Hex(webhookSecret, `${timestamp}.${body}`);
  const send = () => handlePaystackWebhook(new Request("https://njs.test/api/billing/webhook", {
    method: "POST", headers: { "paystack-signature": `t=${timestamp},v1=whk_test:${signature}` }, body,
  }), { SUPABASE_URL: "https://unit.supabase.co", SUPABASE_SECRET_KEY: "test", PAYSTACK_SECRET_KEY: secret, PAYSTACK_WEBHOOK_SECRET: webhookSecret });

  const first = await send();
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { success: true });
  const duplicate = await send();
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { success: true, duplicate: true });
  assert.equal(insertCount, 2);
  assert.equal(rows.size, 1);
  assert.equal([...rows.values()][0].processed, true);
});

test("a delayed failure event cannot overwrite a payment that concurrently became successful", async () => {
  let transactionReads = 0;
  let subscriptionUpdates = 0;
  fetchImplementation = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (url.pathname === "/rest/v1/paystack_webhook_events" && method === "POST") {
      return new Response(null, { status: 201 });
    }
    if (url.pathname === "/rest/v1/paystack_webhook_events" && method === "PATCH") {
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/payment_transactions" && method === "GET") {
      transactionReads++;
      return Response.json(transactionReads === 1
        ? { id: "payment-1", subscription_id: "subscription-1", plan_code: "pro_monthly", amount_kobo: 1_500_000, currency: "NGN", status: "pending" }
        : { status: "success" });
    }
    if (url.pathname === "/rest/v1/payment_transactions" && method === "PATCH") {
      assert.equal(url.searchParams.get("status"), "eq.pending", "failure update must compare against the pending state it read");
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/subscriptions") subscriptionUpdates++;
    throw new Error(`Unexpected failure-event request: ${method} ${url.pathname}`);
  };

  const secret = "sk_test_unit";
  const body = JSON.stringify({
    event: "charge.failed",
    data: { reference: "njs-payment-race-1", amount: 1_500_000, currency: "NGN" },
  });
  const response = await handlePaystackWebhook(new Request("https://njs.test/api/billing/webhook", {
    method: "POST",
    headers: { "x-paystack-signature": await hmacSha512Hex(secret, body) },
    body,
  }), { SUPABASE_URL: "https://unit.supabase.co", SUPABASE_SECRET_KEY: "test", PAYSTACK_SECRET_KEY: secret });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(transactionReads, 2);
  assert.equal(subscriptionUpdates, 0);
});

test("produces a stable idempotency key for identical deliveries", async () => {
  assert.equal(await webhookEventKey("body"), await webhookEventKey("body"));
  assert.notEqual(await webhookEventKey("body"), await webhookEventKey("different"));
});


test("scheduled plan-change migration is private and permits only one pending switch per user", () => {
  const sql = readFileSync("supabase/migrations/20261123100000_njs_scheduled_subscription_plan_changes.sql", "utf8");
  assert.match(sql, /create table if not exists public\.scheduled_plan_changes/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all privileges on table public\.scheduled_plan_changes from anon, authenticated/i);
  assert.match(sql, /grant all privileges on table public\.scheduled_plan_changes to service_role/i);
  assert.match(sql, /where status = 'scheduled'/i);
  assert.match(sql, /one_pending_per_user/i);
});

test("subscription renewal changes are exposed through authenticated worker routes only", () => {
  const worker = readFileSync("cloudflare/worker.ts", "utf8");
  const routes = readFileSync("cloudflare/billing-routes.ts", "utf8");
  assert.match(worker, /\/api\/billing\/schedule-change/);
  assert.match(worker, /\/api\/billing\/schedule-change\/cancel/);
  assert.match(routes, /authorization_signature: typeof verified\?\.authorization\?\.authorization_code/);
  assert.match(routes, /patch\.status = "non_renewing"/);
  assert.match(routes, /current paid access/);
});
test("accepts Paystack fees only when the total reconciles to the approved plan price", () => {
  const baseAmount = 15_000_000;

  assert.equal(verifiedPlanAmountMatches({
    amount: 15_200_000,
    requested_amount: baseAmount,
    fees: 200_000,
  }, baseAmount), true);

  assert.equal(verifiedPlanAmountMatches({
    amount: 15_000_000,
    requested_amount: baseAmount,
    fees: 0,
  }, baseAmount), true);

  assert.equal(verifiedPlanAmountMatches({
    amount: 15_200_000,
  }, baseAmount), false);

  assert.equal(verifiedPlanAmountMatches({
    amount: 15_200_000,
    requested_amount: baseAmount,
    fees: 100_000,
  }, baseAmount), false);

  assert.equal(verifiedPlanAmountMatches({
    amount: 15_200_000,
    requested_amount: baseAmount + 1,
    fees: 199_999,
  }, baseAmount), false);

  assert.equal(verifiedPlanAmountMatches({
    amount: 15_200_000,
    requested_amount: baseAmount,
    fees: -1,
  }, baseAmount), false);
});