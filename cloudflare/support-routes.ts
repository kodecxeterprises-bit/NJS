
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
  const category = String(body?.category ?? "General Support").trim().slice(0, 80);
  const message = String(body?.message ?? "").trim().slice(0, 5000);

  if (!name || !email || !subject || message.length < 10) {
    return json({
      error: "Please provide your name, a valid email, subject and a message of at least 10 characters.",
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
      requester_company: company || null,
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
    // Remove the incomplete ticket rather than leave an empty support request.
    await supabase.from("support_tickets").delete().eq("id", ticket.id);
    return json({ error: "Your message could not be saved. Please try again." }, 500);
  }

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
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const url = new URL(request.url);
  const ticketId = url.searchParams.get("ticketId");
  const status = url.searchParams.get("status");

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

    return json({ success: true, ticket, replies: replies ?? [] });
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
  if ("error" in auth) return json({ error: auth.error }, auth.status);

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
    .select("id, requester_name, requester_email")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError || !ticket) {
    return json({ error: "Ticket not found." }, 404);
  }

  if (body.action === "reply") {
    const message = String(body.message ?? "").trim().slice(0, 5000);

    if (!message) {
      return json({ error: "Reply message cannot be empty." }, 400);
    }

    const senderName = String(
      auth.user.user_metadata?.full_name ??
      auth.user.user_metadata?.name ??
      auth.user.email ??
      "NJS Support"
    ).slice(0, 120);

    const { error } = await auth.supabase
      .from("support_replies")
      .insert({
        ticket_id: ticketId,
        sender_id: auth.user.id,
        sender_name: senderName,
        sender_email: auth.user.email,
        is_admin: true,
        message,
      });

    if (error) {
      console.error("Support reply failed:", error.message);
      return json({ error: "Could not send your reply." }, 500);
    }

    await auth.supabase
      .from("support_tickets")
      .update({ status: "in_progress" })
      .eq("id", ticketId);

    return json({ success: true, message: "Reply sent." });
  }

  const updates: Record<string, string> = {};

  if (["open", "in_progress", "resolved", "closed"].includes(body.status)) {
    updates.status = body.status;
  }

  if (["low", "normal", "high", "urgent"].includes(body.priority)) {
    updates.priority = body.priority;
  }

  if (Object.keys(updates).length === 0) {
    return json({ error: "No valid ticket update was supplied." }, 400);
  }

  const { error } = await auth.supabase
    .from("support_tickets")
    .update(updates)
    .eq("id", ticketId);

  if (error) {
    console.error("Support ticket update failed:", error.message);
    return json({ error: "Could not update the ticket." }, 500);
  }

  return json({ success: true, message: "Ticket updated." });
}
