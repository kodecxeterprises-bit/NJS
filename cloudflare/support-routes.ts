
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

async function requireAdmin(request: Request, env: SupportEnv) {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return { error: "Authentication required.", status: 401 as const };
  }

  const supabase = getDatabase(env);
  const token = authorization.slice(7).trim();

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { error: "Invalid or expired session.", status: 401 as const };
  }

  if (data.user.app_metadata?.role !== "admin") {
    return { error: "Administrator access required.", status: 403 as const };
  }

  return { supabase, user: data.user };
}

/**
 * PUBLIC: Create a support ticket.
 * POST /api/support/tickets
 */
export async function handleCreateSupportTicket(
  request: Request,
  env: SupportEnv
) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const name = String(body?.name ?? "").trim().slice(0, 120);
  const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 254);
  const company = String(body?.company ?? "").trim().slice(0, 160);
  const subject = String(body?.subject ?? "").trim().slice(0, 180);
  const requestedCategory = String(body?.category ?? "general")
    .trim()
    .toLowerCase();

  const category = (VALID_CATEGORIES as readonly string[]).includes(
    requestedCategory
  )
    ? requestedCategory
    : "general";

  const message = String(body?.message ?? "").trim().slice(0, 5000);

  if (name.length < 2 || !email || subject.length < 3 || message.length < 10) {
    return json({
      error:
        "Please provide your name, a valid email, a subject of at least 3 characters and a message of at least 10 characters.",
    }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }

  const supabase = getDatabase(env);

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      requester_name: name,
      requester_email: email,
      company: company || null,
      subject,
      category,
      priority: "normal",
      status: "open",
    })
    .select("id, ticket_number")
    .single();

  if (ticketError || !ticket) {
    console.error("Support ticket creation failed:", ticketError?.message);
    return json({ error: "Could not create your ticket. Please try again." }, 500);
  }

  const { error: replyError } = await supabase
    .from("support_replies")
    .insert({
      ticket_id: ticket.id,
      sender_id: null,
      sender_name: name,
      sender_email: email,
      is_admin: false,
      message,
    });

  if (replyError) {
    console.error("Initial support message failed:", replyError.message);
    await supabase.from("support_tickets").delete().eq("id", ticket.id);

    return json({
      error: "Your message could not be saved. Please try again.",
    }, 500);
  }

  await supabase
    .from("support_tickets")
    .update({
      last_reply_at: new Date().toISOString(),
    })
    .eq("id", ticket.id);

  return json({
    success: true,
    ticketNumber: ticket.ticket_number,
    message: "Your support ticket was submitted successfully.",
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

  if (status && status !== "all" &&
      !(VALID_STATUSES as readonly string[]).includes(status)) {
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
    const originalMessage = conversation.find(
      (reply) => !reply.is_admin
    );

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
    .order("last_reply_at", { ascending: false, nullsFirst: false })
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

  // Send an administrator reply.
  if (body.action === "reply") {
    const message = String(body.message ?? "").trim();

    if (!message || message.length > 5000) {
      return json({
        error: "Reply must contain between 1 and 5000 characters.",
      }, 400);
    }

    const { data: reply, error: replyError } = await auth.supabase
      .from("support_replies")
      .insert({
        ticket_id: ticketId,
        sender_id: auth.user.id,
        sender_name:
          auth.user.user_metadata?.full_name ||
          auth.user.user_metadata?.name ||
          auth.user.email ||
          "NJS Support",
        sender_email: auth.user.email ?? null,
        is_admin: true,
        message,
      })
      .select("*")
      .single();

    if (replyError) {
      console.error("Admin support reply failed:", replyError.message);
      return json({ error: "Could not send your reply." }, 500);
    }

    const { error: updateError } = await auth.supabase
      .from("support_tickets")
      .update({
        last_reply_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

  // Update ticket status and/or priority.
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

  if (updateError) {
    console.error("Ticket update failed:", updateError.message);
    return json({ error: "Could not update the ticket." }, 500);
  }

  return json({
    success: true,
    message: "Ticket updated successfully.",
    ticket: updatedTicket,
  });
}
