import { createClient } from "@supabase/supabase-js";

interface SupportEnv {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
}

const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const VALID_CATEGORIES = [
  "general",
  "account",
  "business_profile",
  "connections",
  "messaging",
  "billing",
  "bug_report",
  "other",
] as const;

const VALID_STATUSES = [
  "open",
  "in_progress",
  "waiting_on_user",
  "resolved",
  "closed",
] as const;

const VALID_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getIdempotencyKey(request: Request) {
  const key = request.headers.get("Idempotency-Key")?.trim() ?? "";
  return UUID_PATTERN.test(key) ? key.toLowerCase() : null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function findTicketByCreationKey(userSupabase: ReturnType<typeof getDatabase>, userId: string, key: string) {
  return userSupabase.from("support_tickets")
    .select("id, user_id, ticket_number, subject, category, status, priority, created_at, updated_at, last_reply_at, creation_request_hash")
    .eq("user_id", userId)
    .eq("creation_idempotency_key", key)
    .maybeSingle();
}

async function findReplyByIdempotencyKey(
  userSupabase: ReturnType<typeof getDatabase>,
  ticketId: string,
  senderId: string,
  key: string,
) {
  return userSupabase.from("support_replies")
    .select("id, ticket_id, sender_id, sender_name, sender_email, is_admin, message, created_at, idempotency_key")
    .eq("ticket_id", ticketId)
    .eq("sender_id", senderId)
    .eq("idempotency_key", key)
    .maybeSingle();
}

async function createOrRecoverReply(
  userSupabase: ReturnType<typeof getDatabase>,
  input: {
    ticketId: string;
    senderId: string;
    senderName: string;
    senderEmail: string | null;
    isAdmin: boolean;
    message: string;
    idempotencyKey: string;
  },
) {
  let existing;
  try {
    existing = await findReplyByIdempotencyKey(userSupabase, input.ticketId, input.senderId, input.idempotencyKey);
  } catch (error) {
    return { reply: null, duplicate: false, conflict: false, uncertain: true, error };
  }
  if (existing.error) return { reply: null, duplicate: false, conflict: false, uncertain: true, error: existing.error };
  if (existing.data) {
    return {
      reply: existing.data,
      duplicate: true,
      conflict: existing.data.message !== input.message,
      uncertain: false,
      error: null,
    };
  }

  try {
    const inserted = await userSupabase.from("support_replies").insert({
      ticket_id: input.ticketId,
      sender_id: input.senderId,
      sender_name: input.senderName,
      sender_email: input.senderEmail,
      is_admin: input.isAdmin,
      message: input.message,
      idempotency_key: input.idempotencyKey,
    }).select("id, ticket_id, sender_id, sender_name, sender_email, is_admin, message, created_at, idempotency_key").single();

    if (!inserted.error && inserted.data) {
      return { reply: inserted.data, duplicate: false, conflict: false, uncertain: false, error: null };
    }

    // A unique violation means another concurrent request won. Re-read only
    // within the already-authorized ticket and authenticated sender scope.
    let recovered;
    try {
      recovered = await findReplyByIdempotencyKey(userSupabase, input.ticketId, input.senderId, input.idempotencyKey);
    } catch (error) {
      return { reply: null, duplicate: false, conflict: false, uncertain: true, error };
    }
    if (recovered.data) {
      return {
        reply: recovered.data,
        duplicate: true,
        conflict: recovered.data.message !== input.message,
        uncertain: false,
        error: null,
      };
    }
    return {
      reply: null,
      duplicate: false,
      conflict: false,
      uncertain: false,
      error: inserted.error ?? recovered.error,
    };
  } catch (error) {
    // The POST may have committed before the connection failed. Never tell the
    // caller to use a new key; retrying this key will recover the row.
    const recovered = await findReplyByIdempotencyKey(userSupabase, input.ticketId, input.senderId, input.idempotencyKey).catch(() => null);
    if (recovered?.data) {
      return {
        reply: recovered.data,
        duplicate: true,
        conflict: recovered.data.message !== input.message,
        uncertain: false,
        error: null,
      };
    }
    return { reply: null, duplicate: false, conflict: false, uncertain: true, error };
  }
}

async function finalizeReplyTimestamp(
  supabase: ReturnType<typeof getDatabase>,
  ticketId: string,
  replyCreatedAt: string,
  userId?: string,
  replyStatus?: "open" | "waiting_on_user",
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
    let ticketQuery = supabase.from("support_tickets")
      .select("updated_at, last_reply_at")
      .eq("id", ticketId);
    if (userId) ticketQuery = ticketQuery.eq("user_id", userId);
    const current = await ticketQuery.maybeSingle();
    if (current.error || !current.data) return false;

    const currentReplyAt = current.data.last_reply_at ? Date.parse(current.data.last_reply_at) : -Infinity;
    const createdAt = Date.parse(replyCreatedAt);
    if (!Number.isFinite(createdAt)) return false;

    // A later reply already owns the timestamp. Do not let an old duplicate
    // retry reorder the conversation or undo a later ticket status.
    if (currentReplyAt > createdAt) return true;

    const currentUpdatedAt = current.data.updated_at ? Date.parse(current.data.updated_at) : -Infinity;
    const shouldApplyStatus = replyStatus !== undefined && currentUpdatedAt <= createdAt;
    const patch: Record<string, string> = {
      last_reply_at: replyCreatedAt,
      updated_at: shouldApplyStatus || currentUpdatedAt <= createdAt
        ? new Date().toISOString()
        : current.data.updated_at,
    };
    if (shouldApplyStatus) patch.status = replyStatus;

    let update = supabase.from("support_tickets").update(patch)
      .eq("id", ticketId)
      .eq("updated_at", current.data.updated_at);
    if (userId) update = update.eq("user_id", userId);
    if (current.data.last_reply_at) update = update.lte("last_reply_at", replyCreatedAt);
    else update = update.is("last_reply_at", null);
    const result = await update.select("id").maybeSingle();
    if (result.error) return false;
    if (result.data) return true;
    } catch {
      return false;
    }
  }
  return false;
}

function getDatabase(env: SupportEnv) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing Supabase Worker configuration.");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function getUserDatabase(env: SupportEnv, accessToken: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing Supabase Worker configuration.");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

async function requireUser(request: Request, env: SupportEnv) {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return { error: "Please sign in to use NJS Support.", status: 401 as const };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return { error: "Please sign in to use NJS Support.", status: 401 as const };
  }

  const supabase = getDatabase(env);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user || !data.user.email) {
    return {
      error: "Your session is invalid or expired. Please sign in again.",
      status: 401 as const,
    };
  }

  return {
    supabase,
    userSupabase: getUserDatabase(env, token),
    user: data.user,
  };
}

async function requireAdmin(request: Request, env: SupportEnv) {
  const auth = await requireUser(request, env);

  if ("error" in auth) return auth;

  if (auth.user.app_metadata?.role !== "admin") {
    return {
      error: "Administrator access required.",
      status: 403 as const,
    };
  }

  return auth;
}

function getDisplayName(user: {
  email?: string;
  user_metadata?: Record<string, any>;
}) {
  const metadata = user.user_metadata ?? {};

  return String(
    metadata.full_name ??
    metadata.name ??
    metadata.display_name ??
    user.email?.split("@")[0] ??
    "NJS User"
  ).trim().slice(0, 120);
}

/**
 * CUSTOMER: Create a support ticket.
 * POST /api/support/tickets
 *
 * Requires an authenticated Supabase user.
 */
export async function handleCreateSupportTicket(
  request: Request,
  env: SupportEnv
) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await requireUser(request, env);

  if ("error" in auth) {
    return json({ error: auth.error }, auth.status);
  }

  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) {
    return json({ error: "A valid Idempotency-Key is required. Retry the same submission with the same key." }, 400);
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const subject = String(body?.subject ?? "").trim().slice(0, 180);
  const message = String(body?.message ?? "").trim().slice(0, 5000);
  const requestedCategory = String(body?.category ?? "general")
    .trim()
    .toLowerCase();

  const category = (
    VALID_CATEGORIES as readonly string[]
  ).includes(requestedCategory)
    ? requestedCategory
    : "general";

  if (subject.length < 3) {
    return json({
      error: "Please enter a subject of at least 3 characters.",
    }, 400);
  }

  if (message.length < 10) {
    return json({
      error: "Please describe your issue using at least 10 characters.",
    }, 400);
  }

  const { supabase, userSupabase, user } = auth;
  const requesterName = getDisplayName(user);
  const requesterEmail = user.email!.trim().toLowerCase();
  const requestHash = await sha256(JSON.stringify({ subject, category, message }));
  let ticketResult;
  try {
    ticketResult = await findTicketByCreationKey(userSupabase, user.id, idempotencyKey);
  } catch {
    return json({ error: "We could not confirm whether this ticket was created. Retry the same submission with the same Idempotency-Key." }, 503);
  }
  if (ticketResult.error) {
    return json({ error: "We could not confirm whether this ticket was created. Retry the same submission with the same Idempotency-Key." }, 503);
  }

  let ticket = ticketResult.data;
  let duplicateTicket = Boolean(ticket);
  if (ticket && ticket.creation_request_hash !== requestHash) {
    return json({ error: "This Idempotency-Key was already used for a different ticket submission." }, 409);
  }

  if (!ticket) {
    let insertionError: unknown = null;
    let insertionUncertain = false;
    try {
      const inserted = await userSupabase.from("support_tickets").insert({
        user_id: user.id,
        requester_name: requesterName,
        requester_email: requesterEmail,
        company: null,
        subject,
        category,
        priority: "normal",
        status: "open",
        last_reply_at: null,
        creation_idempotency_key: idempotencyKey,
        creation_request_hash: requestHash,
      }).select("id, user_id, ticket_number, subject, category, status, priority, created_at, updated_at, last_reply_at, creation_request_hash").single();
      if (!inserted.error && inserted.data) ticket = inserted.data;
      else insertionError = inserted.error;
    } catch (error) {
      insertionError = error;
      insertionUncertain = true;
    }

    if (!ticket) {
      // A concurrent request may have won the unique-index race, or the POST
      // may have committed before its response was interrupted.
      let recovered;
      try {
        recovered = await findTicketByCreationKey(userSupabase, user.id, idempotencyKey);
      } catch {
        return json({ error: "Ticket creation may have succeeded, but could not be confirmed. Retry the same submission with the same Idempotency-Key." }, 503);
      }
      if (recovered.error) {
        return json({ error: "Ticket creation may have succeeded, but could not be confirmed. Retry the same submission with the same Idempotency-Key." }, 503);
      }
      ticket = recovered.data;
      duplicateTicket = Boolean(ticket);
      if (!ticket) {
        console.error("Support ticket creation failed:", insertionError instanceof Error ? insertionError.message : "unknown error");
        return json({
          error: insertionUncertain
            ? "Ticket creation may have succeeded, but could not be confirmed. Retry the same submission with the same Idempotency-Key."
            : "Could not create the ticket. You can safely retry this submission with the same Idempotency-Key.",
        }, insertionUncertain ? 503 : 500);
      }
      if (ticket.creation_request_hash !== requestHash) {
        return json({ error: "This Idempotency-Key was already used for a different ticket submission." }, 409);
      }
    }
  }

  const initialReply = await createOrRecoverReply(userSupabase, {
    ticketId: ticket.id,
    senderId: user.id,
    senderName: requesterName,
    senderEmail: requesterEmail,
    isAdmin: false,
    message,
    idempotencyKey,
  });
  if (initialReply.conflict) {
    return json({ error: "This Idempotency-Key was already used for a different initial message." }, 409);
  }
  if (!initialReply.reply) {
    const messageText = initialReply.uncertain
      ? "Your ticket is saved, but the initial message result could not be confirmed. Retry the same submission with the same Idempotency-Key."
      : "Your ticket is saved, but its initial message still needs to be submitted. Retry the same submission with the same Idempotency-Key.";
    return json({
      success: true,
      ticketCreated: true,
      replySaved: initialReply.uncertain ? null : false,
      timestampSynced: false,
      idempotentReplay: duplicateTicket,
      message: messageText,
    }, 202);
  }

  const timestampSynced = await finalizeReplyTimestamp(
    supabase,
    ticket.id,
    initialReply.reply.created_at,
    user.id,
    "open",
  );
  const responseTicket = {
    id: ticket.id,
    ticket_number: ticket.ticket_number,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    priority: ticket.priority,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    last_reply_at: initialReply.reply.created_at,
  };
  if (!timestampSynced) {
    return json({
      success: true,
      ticket: responseTicket,
      ticketNumber: ticket.ticket_number,
      replySaved: true,
      timestampSynced: false,
      idempotentReplay: duplicateTicket || initialReply.duplicate,
      message: "Your ticket and initial message are saved. Ticket activity timestamp synchronization is still pending; retry with the same key to finish it.",
    }, 202);
  }

  return json({
    success: true,
    ticket: responseTicket,
    ticketNumber: ticket.ticket_number,
    replySaved: true,
    timestampSynced: true,
    idempotentReplay: duplicateTicket || initialReply.duplicate,
    message: "Your support ticket was submitted successfully.",
  }, duplicateTicket || initialReply.duplicate ? 200 : 201);
}

/**
 * CUSTOMER: List the signed-in user's tickets.
 * GET /api/support/tickets
 */
export async function handleCustomerSupportTickets(
  request: Request,
  env: SupportEnv
) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await requireUser(request, env);

  if ("error" in auth) {
    return json({ error: auth.error }, auth.status);
  }

  const { data: tickets, error } = await auth.supabase
    .from("support_tickets")
    .select("id, ticket_number, subject, category, priority, status, created_at, updated_at, last_reply_at")
    .eq("user_id", auth.user.id)
    .order("last_reply_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Customer support ticket lookup failed:", error.message);
    return json({ error: "Could not load your support tickets." }, 500);
  }

  return json({
    success: true,
    tickets: tickets ?? [],
  });
}

/**
 * CUSTOMER: Load one ticket and its conversation.
 * GET /api/support/tickets/:ticketId
 *
 * Ownership is checked against the authenticated user's ID.
 */
export async function handleCustomerSupportTicket(
  request: Request,
  env: SupportEnv,
  ticketId: string
) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await requireUser(request, env);

  if ("error" in auth) {
    return json({ error: auth.error }, auth.status);
  }

  if (!ticketId) {
    return json({ error: "Ticket ID is required." }, 400);
  }

  const { data: ticket, error: ticketError } = await auth.supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (ticketError || !ticket) {
    return json({ error: "Ticket not found." }, 404);
  }

  const { data: replies, error: repliesError } = await auth.supabase
    .from("support_replies")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (repliesError) {
    console.error("Customer support replies lookup failed:", repliesError.message);
    return json({ error: "Could not load this conversation." }, 500);
  }

  return json({
    success: true,
    ticket,
    replies: replies ?? [],
  });
}

/**
 * CUSTOMER: Reply to their own support ticket.
 * POST /api/support/tickets/:ticketId/replies
 */
export async function handleCustomerSupportReply(
  request: Request,
  env: SupportEnv,
  ticketId: string
) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await requireUser(request, env);

  if ("error" in auth) {
    return json({ error: auth.error }, auth.status);
  }

  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) {
    return json({ error: "A valid Idempotency-Key is required. Retry the same reply with the same key." }, 400);
  }

  if (!ticketId) {
    return json({ error: "Ticket ID is required." }, 400);
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const message = String(body?.message ?? "").trim();

  if (!message || message.length > 5000) {
    return json({
      error: "Your reply must contain between 1 and 5000 characters.",
    }, 400);
  }

  const { supabase, user } = auth;

  const { data: ticket, error: ticketError } = await auth.userSupabase
    .from("support_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (ticketError || !ticket) {
    return json({ error: "Ticket not found." }, 404);
  }

  if (["closed", "resolved"].includes(ticket.status)) {
    return json({
      error: "This ticket is closed. Please create a new ticket for further assistance.",
    }, 409);
  }

  const outcome = await createOrRecoverReply(auth.userSupabase, {
    ticketId,
    senderId: user.id,
    senderName: getDisplayName(user),
    senderEmail: user.email ?? null,
    isAdmin: false,
    message,
    idempotencyKey,
  });
  if (outcome.conflict) {
    return json({ error: "This Idempotency-Key was already used for a different reply." }, 409);
  }
  if (!outcome.reply) {
    console.error("Customer support reply could not be confirmed:", outcome.error instanceof Error ? outcome.error.message : "unknown error");
    return json({
      error: outcome.uncertain
        ? "The reply may have been saved, but the result could not be confirmed. Retry the same message with the same Idempotency-Key."
        : "Could not save the reply. You can safely retry the same message with the same Idempotency-Key.",
      replySaved: false,
      timestampSynced: false,
    }, outcome.uncertain ? 503 : 500);
  }

  const timestampSynced = await finalizeReplyTimestamp(
    supabase,
    ticketId,
    outcome.reply.created_at,
    user.id,
    "open",
  );
  if (!timestampSynced) {
    return json({
      success: true,
      reply: outcome.reply,
      idempotentReplay: outcome.duplicate,
      replySaved: true,
      timestampSynced: false,
      message: "Your reply is saved. Ticket activity timestamp synchronization is pending; retry this reply with the same key to finish it.",
    }, 202);
  }

  return json({
    success: true,
    message: outcome.duplicate ? "Your earlier reply was already saved." : "Your reply was sent successfully.",
    reply: outcome.reply,
    replySaved: true,
    timestampSynced: true,
    idempotentReplay: outcome.duplicate,
  }, outcome.duplicate ? 200 : 201);
}

/**
 * ADMIN: List tickets or load a ticket with its replies.
 * GET /api/admin/support
 * GET /api/admin/support?ticketId=UUID
 */
export async function handleAdminSupportGet(
  request: Request,
  env: SupportEnv
) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await requireAdmin(request, env);

  if ("error" in auth) {
    return json({ error: auth.error }, auth.status);
  }

  const url = new URL(request.url);
  const ticketId = url.searchParams.get("ticketId");
  const status = url.searchParams.get("status");

  if (
    status &&
    status !== "all" &&
    !(VALID_STATUSES as readonly string[]).includes(status)
  ) {
    return json({ error: "Invalid ticket status filter." }, 400);
  }

  if (ticketId) {
    const { data: ticket, error } = await auth.supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (error || !ticket) {
      return json({ error: "Ticket not found." }, 404);
    }

    const { data: replies, error: repliesError } = await auth.supabase
      .from("support_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (repliesError) {
      return json({ error: "Could not load ticket replies." }, 500);
    }

    const conversation = replies ?? [];
    const originalMessage = conversation.find((reply) => !reply.is_admin);

    return json({
      success: true,
      ticket: {
        ...ticket,
        message: originalMessage?.message ?? "",
      },
      replies: conversation,
    });
  }

  let query = auth.supabase
    .from("support_tickets")
    .select("*")
    .order("last_reply_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: tickets, error } = await query;

  if (error) {
    console.error("Support inbox query failed:", error.message);
    return json({ error: "Could not load the support inbox." }, 500);
  }

  return json({
    success: true,
    tickets: tickets ?? [],
    total: tickets?.length ?? 0,
  });
}

/**
 * ADMIN: Reply to a ticket or update its status/priority.
 * POST /api/admin/support
 */
export async function handleAdminSupportPost(
  request: Request,
  env: SupportEnv
) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await requireAdmin(request, env);

  if ("error" in auth) {
    return json({ error: auth.error }, auth.status);
  }

  const idempotencyKey = request.headers.has("Idempotency-Key")
    ? getIdempotencyKey(request)
    : null;

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const ticketId = String(body?.ticketId ?? "").trim();

  if (!ticketId) {
    return json({ error: "Ticket ID is required." }, 400);
  }

  const { data: ticket, error: ticketError } = await auth.supabase
    .from("support_tickets")
    .select("id, status, priority")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError || !ticket) {
    return json({ error: "Ticket not found." }, 404);
  }

  if (body.action === "reply") {
    if (!idempotencyKey) {
      return json({ error: "A valid Idempotency-Key is required. Retry the same reply with the same key." }, 400);
    }
    const message = String(body.message ?? "").trim();

    if (!message || message.length > 5000) {
      return json({
        error: "Reply must contain between 1 and 5000 characters.",
      }, 400);
    }

    const adminName = getDisplayName(auth.user) || "NJS Support";

    const outcome = await createOrRecoverReply(auth.userSupabase, {
      ticketId,
      senderId: auth.user.id,
      senderName: adminName,
      senderEmail: auth.user.email ?? null,
      isAdmin: true,
      message,
      idempotencyKey,
    });
    if (outcome.conflict) {
      return json({ error: "This Idempotency-Key was already used for a different reply." }, 409);
    }
    if (!outcome.reply) {
      console.error("Admin support reply could not be confirmed:", outcome.error instanceof Error ? outcome.error.message : "unknown error");
      return json({
        error: outcome.uncertain
          ? "The administrator reply may have been saved, but the result could not be confirmed. Retry the same message with the same Idempotency-Key."
          : "Could not save the reply. Retry the same message with the same Idempotency-Key.",
        replySaved: false,
        timestampSynced: false,
      }, outcome.uncertain ? 503 : 500);
    }

    const timestampSynced = await finalizeReplyTimestamp(
      auth.supabase,
      ticketId,
      outcome.reply.created_at,
      undefined,
      "waiting_on_user",
    );
    if (!timestampSynced) {
      return json({
        success: true,
        reply: outcome.reply,
        idempotentReplay: outcome.duplicate,
        replySaved: true,
        timestampSynced: false,
        message: "The reply is saved. Ticket activity timestamp synchronization is pending; retry this reply with the same key to finish it.",
      }, 202);
    }

    return json({
      success: true,
      message: outcome.duplicate ? "The earlier reply was already saved." : "Reply sent successfully.",
      reply: outcome.reply,
      replySaved: true,
      timestampSynced: true,
      idempotentReplay: outcome.duplicate,
    }, outcome.duplicate ? 200 : 201);
  }

  const updates: Record<string, string> = {};

  if (body.status !== undefined) {
    if (
      !(VALID_STATUSES as readonly string[]).includes(body.status)
    ) {
      return json({ error: "Invalid ticket status." }, 400);
    }

    updates.status = body.status;
  }

  if (body.priority !== undefined) {
    if (
      !(VALID_PRIORITIES as readonly string[]).includes(body.priority)
    ) {
      return json({ error: "Invalid ticket priority." }, 400);
    }

    updates.priority = body.priority;
  }

  if (Object.keys(updates).length === 0) {
    return json({
      error: "No valid status or priority update was provided.",
    }, 400);
  }

  updates.updated_at = new Date().toISOString();

  const { data: updatedTicket, error: updateError } = await auth.supabase
    .from("support_tickets")
    .update(updates)
    .eq("id", ticketId)
    .select("*")
    .single();

  if (updateError || !updatedTicket) {
    console.error("Ticket update failed:", updateError?.message);
    return json({ error: "Could not update the ticket." }, 500);
  }

  return json({
    success: true,
    message: "Ticket updated successfully.",
    ticket: updatedTicket,
  });
}
