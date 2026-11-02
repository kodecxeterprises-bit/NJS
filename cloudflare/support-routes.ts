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

  return { supabase, user: data.user };
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

  const { supabase, user } = auth;
  const now = new Date().toISOString();
  const requesterName = getDisplayName(user);
  const requesterEmail = user.email!.trim().toLowerCase();

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      requester_name: requesterName,
      requester_email: requesterEmail,
      company: null,
      subject,
      category,
      priority: "normal",
      status: "open",
      last_reply_at: now,
      updated_at: now,
    })
    .select("id, ticket_number, subject, category, status, priority, created_at, updated_at, last_reply_at")
    .single();

  if (ticketError || !ticket) {
    console.error("Support ticket creation failed:", ticketError?.message);

    return json({
      error: "Could not create your ticket. Please try again.",
    }, 500);
  }

  const { error: replyError } = await supabase
    .from("support_replies")
    .insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_name: requesterName,
      sender_email: requesterEmail,
      is_admin: false,
      message,
    });

  if (replyError) {
    console.error("Initial support message failed:", replyError.message);

    await supabase
      .from("support_tickets")
      .delete()
      .eq("id", ticket.id)
      .eq("user_id", user.id);

    return json({
      error: "Your message could not be saved. Please try again.",
    }, 500);
  }

  return json({
    success: true,
    ticket,
    ticketNumber: ticket.ticket_number,
    message: "Your support ticket was submitted successfully.",
  }, 201);
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

  const { data: ticket, error: ticketError } = await supabase
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

  const now = new Date().toISOString();

  const { data: reply, error: replyError } = await supabase
    .from("support_replies")
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_name: getDisplayName(user),
      sender_email: user.email ?? null,
      is_admin: false,
      message,
    })
    .select("*")
    .single();

  if (replyError || !reply) {
    console.error("Customer support reply failed:", replyError?.message);
    return json({ error: "Could not send your reply." }, 500);
  }

  const { error: updateError } = await supabase
    .from("support_tickets")
    .update({
      last_reply_at: now,
      updated_at: now,
      status: "open",
    })
    .eq("id", ticketId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Ticket timestamp update failed:", updateError.message);
  }

  return json({
    success: true,
    message: "Your reply was sent successfully.",
    reply,
  }, 201);
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
    const message = String(body.message ?? "").trim();

    if (!message || message.length > 5000) {
      return json({
        error: "Reply must contain between 1 and 5000 characters.",
      }, 400);
    }

    const adminName = getDisplayName(auth.user) || "NJS Support";

    const { data: reply, error: replyError } = await auth.supabase
      .from("support_replies")
      .insert({
        ticket_id: ticketId,
        sender_id: auth.user.id,
        sender_name: adminName,
        sender_email: auth.user.email ?? null,
        is_admin: true,
        message,
      })
      .select("*")
      .single();

    if (replyError || !reply) {
      console.error("Admin support reply failed:", replyError?.message);
      return json({ error: "Could not send your reply." }, 500);
    }

    const now = new Date().toISOString();

    const { error: updateError } = await auth.supabase
      .from("support_tickets")
      .update({
        last_reply_at: now,
        updated_at: now,
        status: "waiting_on_user",
      })
      .eq("id", ticketId);

    if (updateError) {
      console.error("Ticket timestamp update failed:", updateError.message);
    }

    return json({
      success: true,
      message: "Reply sent successfully.",
      reply,
    }, 201);
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