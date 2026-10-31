
import { createClient } from "@supabase/supabase-js";

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
    headers: {
      "Cache-Control": "no-store",
    },
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

async function handleAuthMe(request: Request, env: Env) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticate(request, env);

  if ("error" in auth) {
    return json({ error: auth.error }, auth.status);
  }

  const { supabase, user } = auth;
  const email = user.email!.trim().toLowerCase();
  const metadata = user.user_metadata ?? {};

  const name =
    String(
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

async function handleBusinessSave(request: Request, env: Env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticate(request, env);

  if ("error" in auth) {
    return json({ error: auth.error }, auth.status);
  }

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

  if (
    typeof body.businessName !== "string" ||
    !body.businessName.trim()
  ) {
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

  // Update an existing business belonging to this authenticated user.
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

      if (url.pathname.startsWith("/api/")) {
        return json({ error: "API endpoint not found" }, 404);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(
        "Worker error:",
        error instanceof Error ? error.message : "Unknown error"
      );

      return json({ error: "Internal server error" }, 500);
    }
  },
};
