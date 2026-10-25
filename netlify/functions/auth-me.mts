
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Netlify.env.get("SUPABASE_URL");
const supabaseKey = Netlify.env.get("SUPABASE_SECRET_KEY");

export default async (request: Request) => {
  if (request.method !== "GET") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase server configuration");
    return Response.json(
      { error: "Authentication service is not configured" },
      { status: 503 }
    );
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return Response.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const accessToken = authorization.slice(7).trim();

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !authUser || !authUser.email) {
      return Response.json(
        { error: "Invalid or expired session. Please sign in again." },
        { status: 401 }
      );
    }

    const email = authUser.email.trim().toLowerCase();
    const metadata = authUser.user_metadata ?? {};
    const name =
      String(
        metadata.full_name ??
        metadata.name ??
        metadata.display_name ??
        email.split("@")[0]
      ).trim().slice(0, 120) || email.split("@")[0];

    // Ensure a persistent NJS profile exists for this Auth user.
    const { data: existingProfile, error: profileReadError } =
      await supabase
        .from("profiles")
        .select("id, full_name, profile_image")
        .eq("id", authUser.id)
        .maybeSingle();

    if (profileReadError) {
      console.error("Profile lookup failed:", profileReadError.message);
      return Response.json(
        { error: "Could not load your NJS profile" },
        { status: 500 }
      );
    }

    let profile = existingProfile;

    if (!profile) {
      const { data: createdProfile, error: createError } =
        await supabase
          .from("profiles")
          .upsert(
            {
              id: authUser.id,
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

      if (createError || !createdProfile) {
        console.error("Profile creation failed:", createError?.message);
        return Response.json(
          { error: "Could not set up your NJS profile" },
          { status: 500 }
        );
      }

      profile = createdProfile;
    }

    const { data: business, error: businessError } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("owner_id", authUser.id)
      .maybeSingle();

    if (businessError) {
      console.error("Business profile lookup failed:", businessError.message);
      return Response.json(
        { error: "Could not load your business profile" },
        { status: 500 }
      );
    }

    const businessProfile = business
      ? {
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
        }
      : null;

    return Response.json({
      user: {
        id: authUser.id,
        name: profile.full_name || name,
        email,
        isEmailVerified: Boolean(authUser.email_confirmed_at),
        businessProfileId: business?.id,
        createdAt: authUser.created_at,
      },
      businessProfile,
      // The current Supabase schema has no subscription table.
      // Keep the existing NJS free-plan defaults for now.
      subscription: {
        plan: "free",
        creditsAvailable: 4850,
      },
    });
  } catch (error) {
    console.error(
      "Unexpected profile endpoint error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return Response.json(
      { error: "Could not load your NJS profile" },
      { status: 500 }
    );
  }
};

export const config = {
  path: "/api/auth/me",
  method: ["GET"],
};
