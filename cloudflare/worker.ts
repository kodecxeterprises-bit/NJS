import { createClient } from "@supabase/supabase-js";

import {
  handleCreateSupportTicket,
  handleCustomerSupportTickets,
  handleCustomerSupportTicket,
  handleCustomerSupportReply,
  handleAdminSupportGet,
  handleAdminSupportPost,
} from "./support-routes";
import {
  handleAdminOverview,
  handleAdminUsersGet,
  handleAdminUsersPost,
  handleAdminBusinessesGet,
  handleAdminBusinessesPost,
} from "./admin-routes";
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

function getSupabase(env: Env) {
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

async function authenticate(request: Request, env: Env) {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return { error: "Not authenticated", status: 401 as const };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return { error: "Not authenticated", status: 401 as const };
  }

  const supabase = getSupabase(env);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user?.email) {
    return {
      error: "Invalid or expired session. Please sign in again.",
      status: 401 as const,
    };
  }

  return { supabase, user };
}

function mapBusiness(business: any) {
  if (!business) return null;

  return {
    id: business.id,
    userId: business.owner_id,
    businessName: business.business_name ?? "",
    businessType: business.business_type ?? "Service Provider",
    industry: business.industry ?? "",
    country: business.country ?? "",
    city: business.city ?? "",
    website: business.website ?? "",
    phone: business.phone ?? "",
    businessDescription: business.business_description ?? "",
    products: business.products ?? [],
    services: business.services ?? [],
    capabilities: business.capabilities ?? [],
    offers: business.offers ?? [],
    needs: business.needs ?? [],
    targetCustomers: business.target_customers ?? [],
    targetSuppliers: business.target_suppliers ?? [],
    targetManufacturers: business.target_manufacturers ?? [],
    targetPartners: business.target_partners ?? [],
    targetMarkets: business.target_markets ?? [],
    businessGoals: business.business_goals ?? [],
    businessKeywords: business.business_keywords ?? [],
    isVerified: business.is_verified ?? false,
    onboardingStep: business.onboarding_step ?? "",
    onboardingCompleted: business.onboarding_completed ?? false,
    createdAt: business.created_at,
    updatedAt: business.updated_at,
  };
}

function mapDiscoverBusiness(business: any) {
  return {
    id: business.id,
    businessName: business.business_name ?? "",
    businessType: business.business_type ?? "",
    industry: business.industry ?? "",
    country: business.country ?? "",
    city: business.city ?? "",
    businessDescription: business.business_description ?? "",
    products: business.products ?? [],
    services: business.services ?? [],
    capabilities: business.capabilities ?? [],
    offers: business.offers ?? [],
    needs: business.needs ?? [],
    targetMarkets: business.target_markets ?? [],
    isVerified: business.is_verified === true,
    createdAt: business.created_at,
  };
}

function searchableText(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(searchableText).join(" ");
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(searchableText)
      .join(" ");
  }

  return "";
}

async function handleAuthMe(request: Request, env: Env) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticate(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const { supabase, user } = auth;
  const email = user.email!.trim().toLowerCase();
  const metadata = user.user_metadata ?? {};

  const name = String(
    metadata.full_name ??
    metadata.name ??
    metadata.display_name ??
    email.split("@")[0]
  ).trim().slice(0, 120) || email.split("@")[0];

  const { data: existingProfile, error: profileReadError } =
    await supabase
      .from("profiles")
      .select("id, full_name, profile_image")
      .eq("id", user.id)
      .maybeSingle();

  if (profileReadError) {
    console.error("Profile lookup failed:", profileReadError.message);
    return json({ error: "Could not load your NJS profile" }, 500);
  }

  let profile = existingProfile;

  if (!profile) {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          full_name: name,
          profile_image:
            typeof metadata.avatar_url === "string"
              ? metadata.avatar_url
              : typeof metadata.picture === "string"
                ? metadata.picture
                : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("id, full_name, profile_image")
      .single();

    if (error || !data) {
      console.error("Profile creation failed:", error?.message);
      return json({ error: "Could not set up your NJS profile" }, 500);
    }

    profile = data;
  }

  const { data: business, error: businessError } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError) {
    console.error("Business lookup failed:", businessError.message);
    return json({ error: "Could not load your business profile" }, 500);
  }

  return json({
    user: {
      id: user.id,
      name: profile.full_name || name,
      email,
      isEmailVerified: Boolean(user.email_confirmed_at),
      businessProfileId: business?.id,
      createdAt: user.created_at,
    },
    businessProfile: mapBusiness(business),
    subscription: {
      plan: "free",
      creditsAvailable: 4850,
    },
  });
}

// END OF PART 1
// CONTINUE DIRECTLY WITH PART 2 BELOW
async function handleBusinessSave(request: Request, env: Env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticate(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const { supabase, user } = auth;

  let body: Record<string, any>;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON request body" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Invalid business profile data" }, 400);
  }

  if (typeof body.businessName !== "string" || !body.businessName.trim()) {
    return json({ error: "Business name is required" }, 400);
  }

  const now = new Date().toISOString();

  const businessData = {
    owner_id: user.id,
    business_name: body.businessName.trim().slice(0, 200),
    business_type: body.businessType ?? "Service Provider",
    industry: body.industry ?? "",
    country: body.country ?? "",
    city: body.city ?? "",
    website: body.website ?? "",
    phone: body.phone ?? "",
    business_description: body.businessDescription ?? "",
    products: body.products ?? [],
    services: body.services ?? [],
    capabilities: body.capabilities ?? [],
    offers: body.offers ?? [],
    needs: body.needs ?? [],
    target_customers: body.targetCustomers ?? [],
    target_suppliers: body.targetSuppliers ?? [],
    target_manufacturers: body.targetManufacturers ?? [],
    target_partners: body.targetPartners ?? [],
    target_markets: body.targetMarkets ?? [],
    business_goals: body.businessGoals ?? [],
    business_keywords: body.businessKeywords ?? [],
    onboarding_step: body.onboardingStep ?? "",
    onboarding_completed: body.onboardingCompleted === true,
    updated_at: now,
  };

  const { data: existing, error: lookupError } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (lookupError) {
    console.error("Business lookup failed:", lookupError.message);
    return json({ error: "Could not find your business profile" }, 500);
  }

  let savedBusiness;
  let saveError;

  if (existing) {
    const result = await supabase
      .from("business_profiles")
      .update(businessData)
      .eq("id", existing.id)
      .eq("owner_id", user.id)
      .select("*")
      .single();

    savedBusiness = result.data;
    saveError = result.error;
  } else {
    const result = await supabase
      .from("business_profiles")
      .insert(businessData)
      .select("*")
      .single();

    savedBusiness = result.data;
    saveError = result.error;
  }

  if (saveError || !savedBusiness) {
    console.error("Business save failed:", saveError?.message);
    return json({ error: "Could not save your business profile" }, 500);
  }

  return json({
    success: true,
    businessProfile: mapBusiness(savedBusiness),
  });
}

async function handleBusinessDiscover(request: Request, env: Env) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticate(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const { supabase, user } = auth;
  const url = new URL(request.url);

  const search = (
    url.searchParams.get("query") ??
    url.searchParams.get("search") ??
    ""
  ).trim().toLowerCase().slice(0, 100);

  const industry = (url.searchParams.get("industry") ?? "").trim().toLowerCase();
  const type = (url.searchParams.get("type") ?? "").trim().toLowerCase();
  const location = (url.searchParams.get("location") ?? "").trim().toLowerCase();
  const offering = (url.searchParams.get("offering") ?? "").trim().toLowerCase();
  const verification = (url.searchParams.get("verified") ?? "").trim().toLowerCase();
  const market = (url.searchParams.get("market") ?? "").trim().toLowerCase();

  const page = Math.max(1, Math.min(10000, Number(url.searchParams.get("page")) || 1));
  const pageSize = Math.max(1, Math.min(50, Number(url.searchParams.get("pageSize")) || 12));

  const { data, error } = await supabase
    .from("business_profiles")
    .select(
      "id, business_name, business_type, industry, country, city, business_description, products, services, capabilities, offers, needs, target_markets, is_verified, created_at"
    )
    .eq("onboarding_completed", true)
    .neq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Business discovery query failed:", error.message);
    return json({ error: "Could not load businesses right now." }, 500);
  }

  let businesses = (data ?? []).map(mapDiscoverBusiness);

  if (search) {
    businesses = businesses.filter((business: any) => {
      const haystack = searchableText([
        business.businessName,
        business.businessType,
        business.industry,
        business.country,
        business.city,
        business.businessDescription,
        business.products,
        business.services,
        business.capabilities,
        business.offers,
        business.needs,
        business.targetMarkets,
      ]).toLowerCase();

      return haystack.includes(search);
    });
  }

  if (industry) {
    businesses = businesses.filter((business: any) =>
      business.industry.toLowerCase().includes(industry)
    );
  }

  if (type) {
    businesses = businesses.filter((business: any) =>
      business.businessType.toLowerCase().includes(type)
    );
  }

  if (location && location !== "global") {
    businesses = businesses.filter((business: any) =>
      `${business.city} ${business.country}`.toLowerCase().includes(location)
    );
  }

  if (offering) {
    businesses = businesses.filter((business: any) =>
      searchableText([
        business.products,
        business.services,
        business.capabilities,
        business.offers,
      ]).toLowerCase().includes(offering)
    );
  }

  if (verification === "verified" || verification === "njs verified only") {
    businesses = businesses.filter((business: any) => business.isVerified);
  } else if (verification === "pending") {
    businesses = businesses.filter((business: any) => !business.isVerified);
  }

  if (market && market !== "all markets") {
    businesses = businesses.filter((business: any) =>
      searchableText(business.targetMarkets).toLowerCase().includes(market)
    );
  }

  const total = businesses.length;
  const start = (page - 1) * pageSize;

  return json({
    success: true,
    businesses: businesses.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

async function handleConnectionsList(request: Request, env: Env) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticate(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const { supabase, user } = auth;

  const { data: rows, error } = await supabase
    .from("connections")
    .select("*")
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Connections lookup failed:", error.message);
    return json({ error: "Could not load your connections." }, 500);
  }

  const connections = rows ?? [];
  const otherUserIds = [...new Set(
    connections.map((connection: any) =>
      connection.requester_id === user.id
        ? connection.recipient_id
        : connection.requester_id
    )
  )];

  const { data: profiles, error: profileError } = otherUserIds.length
    ? await supabase
        .from("business_profiles")
        .select(
          "id, owner_id, business_name, business_type, industry, country, city, business_description, products, services, capabilities, offers, needs, target_markets, is_verified, created_at"
        )
        .in("owner_id", otherUserIds)
    : { data: [], error: null };

  if (profileError) {
    console.error("Partner profile lookup failed:", profileError.message);
    return json({ error: "Could not load partner profiles." }, 500);
  }

  const profileByOwner = new Map(
    (profiles ?? []).map((profile: any) => [profile.owner_id, profile])
  );

  const result = connections.map((connection: any) => {
    const isInitiator = connection.requester_id === user.id;
    const otherUserId = isInitiator
      ? connection.recipient_id
      : connection.requester_id;
    const partner = profileByOwner.get(otherUserId);

    return {
      id: connection.id,
      requesterUserId: connection.requester_id,
      targetUserId: connection.recipient_id,
      requesterBusinessId: isInitiator ? null : partner?.id ?? null,
      targetBusinessId: isInitiator ? partner?.id ?? null : null,
      status: connection.status,
      message: connection.message ?? "",
      createdAt: connection.created_at,
      updatedAt: connection.updated_at,
      isInitiator,
      partnerBusiness: partner ? mapDiscoverBusiness(partner) : null,
    };
  });

  return json({ success: true, connections: result });
}

async function handleConnectionRequest(request: Request, env: Env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticate(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const { supabase, user } = auth;

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const targetBusinessId = String(body?.targetBusinessId ?? "").trim();
  const message = typeof body?.message === "string"
    ? body.message.trim().slice(0, 1000)
    : "";

  if (!targetBusinessId) {
    return json({ error: "A target business is required." }, 400);
  }

  const { data: myBusiness, error: myBusinessError } = await supabase
    .from("business_profiles")
    .select("id, owner_id, business_name")
    .eq("owner_id", user.id)
    .eq("onboarding_completed", true)
    .maybeSingle();

  if (myBusinessError || !myBusiness) {
    return json({
      error: "Complete your business profile before connecting.",
    }, 400);
  }

  const { data: targetBusiness, error: targetError } = await supabase
    .from("business_profiles")
    .select("id, owner_id, business_name")
    .eq("id", targetBusinessId)
    .eq("onboarding_completed", true)
    .maybeSingle();

  if (targetError || !targetBusiness) {
    return json({ error: "That business could not be found." }, 404);
  }

  if (targetBusiness.owner_id === user.id) {
    return json({ error: "You cannot connect with your own business." }, 400);
  }

  const { data: existing, error: existingError } = await supabase
    .from("connections")
    .select("id, status")
    .or(
      `and(requester_id.eq.${user.id},recipient_id.eq.${targetBusiness.owner_id}),and(requester_id.eq.${targetBusiness.owner_id},recipient_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existingError) {
    console.error("Existing connection lookup failed:", existingError.message);
    return json({ error: "Could not check existing connection." }, 500);
  }

  if (existing && ["pending", "accepted"].includes(existing.status)) {
    return json({
      error: existing.status === "pending"
        ? "A connection request already exists."
        : "You are already connected to this business.",
    }, 409);
  }

  let saved: any;
  let saveError: any;

  if (existing) {
    const result = await supabase
      .from("connections")
      .update({
        requester_id: user.id,
        recipient_id: targetBusiness.owner_id,
        message,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    saved = result.data;
    saveError = result.error;
  } else {
    const result = await supabase
      .from("connections")
      .insert({
        requester_id: user.id,
        recipient_id: targetBusiness.owner_id,
        message,
        status: "pending",
      })
      .select("*")
      .single();

    saved = result.data;
    saveError = result.error;
  }

  if (saveError || !saved) {
    console.error("Connection request failed:", saveError?.message);
    return json({
      error: "Could not send the connection request. Please try again.",
    }, 500);
  }

  const { error: notificationError } = await supabase
    .from("notifications")
    .insert({
      user_id: targetBusiness.owner_id,
      type: "connection_request",
      title: "New Connection Request",
      message: `${myBusiness.business_name} would like to connect with your business.`,
      link: "/connections",
    });

  if (notificationError) {
    console.error("Connection notification failed:", notificationError.message);
  }

  return json({
    success: true,
    connection: {
      id: saved.id,
      status: saved.status,
      createdAt: saved.created_at,
    },
  }, 201);
}

async function handleConnectionRespond(request: Request, env: Env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticate(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const { supabase, user } = auth;

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const connectionId = String(body?.connectionId ?? "").trim();
  const action = String(body?.action ?? "").trim();

  if (!connectionId || !["accept", "reject", "remove"].includes(action)) {
    return json({ error: "Invalid connection action." }, 400);
  }

  const { data: connection, error } = await supabase
    .from("connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();

  if (error || !connection) {
    return json({ error: "Connection request not found." }, 404);
  }

  const isRequester = connection.requester_id === user.id;
  const isRecipient = connection.recipient_id === user.id;

  if (!isRequester && !isRecipient) {
    return json({
      error: "You are not a participant in this connection.",
    }, 403);
  }

  if (action === "accept" || action === "reject") {
    if (!isRecipient) {
      return json({
        error: "Only the recipient can respond to this request.",
      }, 403);
    }

    if (connection.status !== "pending") {
      return json({ error: "This request is no longer pending." }, 409);
    }
  } else {
    const canRemove =
      (connection.status === "pending" && isRequester) ||
      connection.status === "accepted";

    if (!canRemove) {
      return json({ error: "You cannot remove this connection." }, 403);
    }
  }

  const nextStatus =
    action === "accept" ? "accepted" :
    action === "reject" ? "rejected" : "removed";

  const { data: updated, error: updateError } = await supabase
    .from("connections")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .eq("status", connection.status)
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    return json({
      error: "This request changed before your action could be saved. Refresh and try again.",
    }, 409);
  }

  if (action === "accept") {
    const { data: myBusiness } = await supabase
      .from("business_profiles")
      .select("business_name")
      .eq("owner_id", user.id)
      .maybeSingle();

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: connection.requester_id,
        type: "connection_accepted",
        title: "Connection Accepted",
        message: `${myBusiness?.business_name || "A business"} accepted your connection request.`,
        link: "/connections",
      });

    if (notificationError) {
      console.error("Acceptance notification failed:", notificationError.message);
    }
  }

  return json({ success: true, status: nextStatus });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health") {
        return json({ success: true, service: "NJS Worker" });
      }

      if (url.pathname === "/api/auth/me") {
        return await handleAuthMe(request, env);
      }

      if (url.pathname === "/api/business/save") {
        return await handleBusinessSave(request, env);
      }

      if (url.pathname === "/api/business/discover") {
        return await handleBusinessDiscover(request, env);
      }

      if (url.pathname === "/api/connections") {
        return await handleConnectionsList(request, env);
      }

      if (url.pathname === "/api/connections/request") {
        return await handleConnectionRequest(request, env);
      }

      if (url.pathname === "/api/connections/respond") {
        return await handleConnectionRespond(request, env);
      }

      // Customer Support Desk: ticket creation, inbox, conversation and replies.
      // Keep the collection route ahead of the parameterized ticket routes.
      if (url.pathname === "/api/support/tickets") {
        if (request.method === "POST") {
          return await handleCreateSupportTicket(request, env);
        }

        if (request.method === "GET") {
          return await handleCustomerSupportTickets(request, env);
        }

        return json({ error: "Method not allowed." }, 405);
      }

      const supportTicketMatch = url.pathname.match(
        /^\/api\/support\/tickets\/([^/]+)(\/replies)?$/
      );

      if (supportTicketMatch) {
        let ticketId: string;

        try {
          ticketId = decodeURIComponent(supportTicketMatch[1]);
        } catch {
          return json({ error: "Invalid ticket ID." }, 400);
        }

        if (supportTicketMatch[2]) {
          return await handleCustomerSupportReply(request, env, ticketId);
        }

        return await handleCustomerSupportTicket(request, env, ticketId);
      }
      // Admin dashboard overview
      if (url.pathname === "/api/admin/overview") {
        return await handleAdminOverview(request, env);
      }

      // Admin user management
      if (url.pathname === "/api/admin/users") {
        if (request.method === "GET") {
          return await handleAdminUsersGet(request, env);
        }

        if (request.method === "POST") {
          return await handleAdminUsersPost(request, env);
        }

        return json({ error: "Method not allowed." }, 405);
      }

      // Admin business management
      if (url.pathname === "/api/admin/businesses") {
        if (request.method === "GET") {
          return await handleAdminBusinessesGet(request, env);
        }

        if (request.method === "POST") {
          return await handleAdminBusinessesPost(request, env);
        }

        return json({ error: "Method not allowed." }, 405);
      }

      // Admin support inbox
      if (url.pathname === "/api/admin/support") {
        if (request.method === "GET") {
          return await handleAdminSupportGet(request, env);
        }

        if (request.method === "POST") {
          return await handleAdminSupportPost(request, env);
        }

        return json({ error: "Method not allowed" }, 405);
      }

      if (url.pathname.startsWith("/api/")) {
        return json({ error: "API route not found" }, 404);
      }

      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Worker request failed:", error);

      return json({
        error: "An unexpected server error occurred.",
      }, 500);
    }
  },
};