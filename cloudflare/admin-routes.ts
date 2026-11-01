
import { createClient } from "@supabase/supabase-js";

interface AdminEnv {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
}

const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

function database(env: AdminEnv) {
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

async function authorize(request: Request, env: AdminEnv) {
  const header = request.headers.get("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return { error: "Authentication required.", status: 401 as const };
  }

  const supabase = database(env);
  const { data, error } = await supabase.auth.getUser(
    header.slice(7).trim()
  );

  if (error || !data.user) {
    return { error: "Invalid or expired session.", status: 401 as const };
  }

  if (data.user.app_metadata?.role !== "admin") {
    return { error: "Administrator access required.", status: 403 as const };
  }

  return { supabase, user: data.user };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/overview
 */
export async function handleAdminOverview(
  request: Request,
  env: AdminEnv
) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await authorize(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const db = auth.supabase;

  const [
    users,
    businesses,
    verified,
    connections,
    conversations,
    messages,
    tickets,
    openTickets,
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }),
    db.from("business_profiles").select("*", { count: "exact", head: true }),
    db.from("business_profiles").select("*", { count: "exact", head: true }).eq("is_verified", true),
    db.from("connections").select("*", { count: "exact", head: true }),
    db.from("conversations").select("*", { count: "exact", head: true }),
    db.from("messages").select("*", { count: "exact", head: true }),
    db.from("support_tickets").select("*", { count: "exact", head: true }),
    db.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting_on_user"]),
  ]);

  const errors = [
    users.error,
    businesses.error,
    verified.error,
    connections.error,
    conversations.error,
    messages.error,
    tickets.error,
    openTickets.error,
  ].filter(Boolean);

  if (errors.length) {
    console.error("Admin overview query failed:", errors);
    return json({ error: "Could not load dashboard statistics." }, 500);
  }

  return json({
    success: true,
    stats: {
      users: users.count ?? 0,
      businesses: businesses.count ?? 0,
      verifiedBusinesses: verified.count ?? 0,
      unverifiedBusinesses: (businesses.count ?? 0) - (verified.count ?? 0),
      connections: connections.count ?? 0,
      conversations: conversations.count ?? 0,
      messages: messages.count ?? 0,
      supportTickets: tickets.count ?? 0,
      activeSupportTickets: openTickets.count ?? 0,
    },
  });
}

/**
 * GET /api/admin/users?search=&page=1&limit=20
 */
export async function handleAdminUsersGet(
  request: Request,
  env: AdminEnv
) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await authorize(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));

  const { data, error } = await auth.supabase.auth.admin.listUsers({
    page,
    perPage: limit,
  });

  if (error) {
    console.error("Admin user listing failed:", error.message);
    return json({ error: "Could not load users." }, 500);
  }

  const authUsers = data.users ?? [];
  const ids = authUsers.map((user) => user.id);

  const { data: profiles, error: profileError } = ids.length
    ? await auth.supabase
        .from("profiles")
        .select("id, full_name, profile_image, created_at")
        .in("id", ids)
    : { data: [], error: null };

  if (profileError) {
    return json({ error: "Could not load user profiles." }, 500);
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  let users = authUsers.map((user) => {
    const profile = profileMap.get(user.id);

    return {
      id: user.id,
      email: user.email ?? "",
      name:
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "",
      avatar: profile?.profile_image ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      emailConfirmed: Boolean(user.email_confirmed_at),
      bannedUntil: user.banned_until ?? null,
      suspended: Boolean(
        user.banned_until &&
        new Date(user.banned_until).getTime() > Date.now()
      ),
      isAdmin: user.app_metadata?.role === "admin",
    };
  });

  if (search) {
    users = users.filter((user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(search)
    );
  }

  return json({
    success: true,
    users,
    page,
    limit,
    totalOnPage: users.length,
  });
}

/**
 * POST /api/admin/users
 * Actions: suspend, restore
 */
export async function handleAdminUsersPost(
  request: Request,
  env: AdminEnv
) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await authorize(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const userId = String(body?.userId ?? "");
  const action = String(body?.action ?? "");
  const duration = String(body?.duration ?? "72h");

  if (!uuidPattern.test(userId)) {
    return json({ error: "Invalid user ID." }, 400);
  }

  if (userId === auth.user.id) {
    return json({ error: "You cannot suspend your own administrator account." }, 400);
  }

  if (!["suspend", "restore"].includes(action)) {
    return json({ error: "Invalid user action." }, 400);
  }

  if (action === "suspend" && auth.user.app_metadata?.role === "admin") {
    // The target's role is checked below before suspension.
  }

  const { data: targetResult, error: targetError } =
    await auth.supabase.auth.admin.getUserById(userId);

  if (targetError || !targetResult.user) {
    return json({ error: "User not found." }, 404);
  }

  const target = targetResult.user;

  if (target.app_metadata?.role === "admin") {
    return json({ error: "Administrator accounts cannot be suspended here." }, 403);
  }

  const allowedDurations: Record<string, string> = {
    "24h": "24h",
    "72h": "72h",
    "168h": "168h",
  };

  const banDuration =
    action === "restore"
      ? "none"
      : allowedDurations[duration];

  if (!banDuration) {
    return json({ error: "Choose a valid suspension duration." }, 400);
  }

  const { error } = await auth.supabase.auth.admin.updateUserById(
    userId,
    { ban_duration: banDuration }
  );

  if (error) {
    console.error("User suspension update failed:", error.message);
    return json({ error: "Could not update this user's suspension." }, 500);
  }

  return json({
    success: true,
    message:
      action === "restore"
        ? "User access restored."
        : `User suspended for ${duration}.`,
  });
}

/**
 * GET /api/admin/businesses?search=&page=1
 */
export async function handleAdminBusinessesGet(
  request: Request,
  env: AdminEnv
) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await authorize(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const from = (page - 1) * limit;

  let query = auth.supabase
    .from("business_profiles")
    .select(
      "id, owner_id, business_name, business_type, industry, country, city, website, phone, business_description, onboarding_completed, is_verified, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (search) {
    const safeSearch = search.replace(/[,%()]/g, " ").trim();
    if (safeSearch) {
      query = query.or(
        `business_name.ilike.%${safeSearch}%,industry.ilike.%${safeSearch}%,city.ilike.%${safeSearch}%,country.ilike.%${safeSearch}%`
      );
    }
  }

  const { data: businesses, error, count } = await query;

  if (error) {
    console.error("Admin business listing failed:", error.message);
    return json({ error: "Could not load businesses." }, 500);
  }

  const ownerIds = (businesses ?? []).map((business) => business.owner_id);

  const { data: profiles } = ownerIds.length
    ? await auth.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  return json({
    success: true,
    businesses: (businesses ?? []).map((business) => ({
      ...business,
      ownerName: profileMap.get(business.owner_id)?.full_name ?? "",
    })),
    page,
    limit,
    total: count ?? 0,
  });
}

/**
 * POST /api/admin/businesses
 * Action: verify, unverify
 */
export async function handleAdminBusinessesPost(
  request: Request,
  env: AdminEnv
) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const auth = await authorize(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const businessId = String(body?.businessId ?? "");
  const action = String(body?.action ?? "");

  if (!uuidPattern.test(businessId)) {
    return json({ error: "Invalid business ID." }, 400);
  }

  if (!["verify", "unverify"].includes(action)) {
    return json({ error: "Invalid business action." }, 400);
  }

  const { data, error } = await auth.supabase
    .from("business_profiles")
    .update({
      is_verified: action === "verify",
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId)
    .select("id, business_name, is_verified")
    .maybeSingle();

  if (error || !data) {
    console.error("Business verification failed:", error?.message);
    return json({ error: "Could not update business verification." }, 500);
  }

  return json({
    success: true,
    business: data,
    message: action === "verify"
      ? "Business verified."
      : "Business verification removed.",
  });
}
