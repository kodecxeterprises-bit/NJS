
import { createClient } from '@supabase/supabase-js';
import { generateOpenAIText } from './openai';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  GEMINI_API_KEY?: string;
};

const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

const client = (env: Env) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

async function identity(request: Request, env: Env) {
  const token = request.headers
    .get('Authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();

  if (!token) {
    return { error: reply({ error: 'Not authenticated' }, 401) } as const;
  }

  const db = client(env);
  const { data, error } = await db.auth.getUser(token);

  if (error || !data.user) {
    return {
      error: reply({ error: 'Invalid or expired session' }, 401),
    } as const;
  }

  return { db, user: data.user } as const;
}

const parseBody = async (request: Request) => {
  try {
    const body = await request.json();

    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, any>)
      : null;
  } catch {
    return null;
  }
};

const businessFor = async (db: any, userId: string) =>
  db.from('business_profiles').select('*').eq('owner_id', userId).maybeSingle();

const mapBusiness = (b: any) =>
  b
    ? {
        id: b.id,
        userId: b.owner_id,
        businessName: b.business_name,
        businessType: b.business_type,
        industry: b.industry,
        country: b.country,
        city: b.city,
        website: b.website,
        phone: b.phone,
        businessDescription: b.business_description,
        products: b.products ?? [],
        services: b.services ?? [],
        capabilities: b.capabilities ?? [],
        offers: b.offers ?? [],
        needs: b.needs ?? [],
        targetCustomers: b.target_customers ?? [],
        targetSuppliers: b.target_suppliers ?? [],
        targetManufacturers: b.target_manufacturers ?? [],
        targetPartners: b.target_partners ?? [],
        targetMarkets: b.target_markets ?? [],
        businessGoals: b.business_goals ?? [],
        businessKeywords: b.business_keywords ?? [],
        isVerified: b.is_verified,
        onboardingStep: b.onboarding_step,
        onboardingCompleted: b.onboarding_completed,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      }
    : null;

const mapPublicBusiness = (b: any) =>
  b
    ? {
        id: b.id,
        businessName: b.business_name,
        businessType: b.business_type,
        industry: b.industry,
        country: b.country,
        city: b.city,
        website: b.website,
        businessDescription: b.business_description,
        products: b.products ?? [],
        services: b.services ?? [],
        capabilities: b.capabilities ?? [],
        offers: b.offers ?? [],
        needs: b.needs ?? [],
        targetMarkets: b.target_markets ?? [],
        isVerified: b.is_verified === true,
        createdAt: b.created_at,
      }
    : null;

const mapOpportunity = (o: any, business?: any) => ({
  id: o.id,
  userId: o.owner_id,
  businessId: business?.id ?? '',
  businessName: business?.business_name ?? '',
  title: o.title,
  category: o.category,
  description: o.description,
  whatTheyNeed: o.what_they_need,
  location: [o.city, o.country].filter(Boolean).join(', '),
  quantity: o.quantity,
  budget: o.budget,
  timeline: o.timeline,
  requirements: o.requirements,
  status: o.status,
  responsesCount: 0,
  createdAt: o.created_at,
  updatedAt: o.updated_at,
});

async function ai(env: Env, prompt: string): Promise<string | null> {
  if (env.OPENAI_API_KEY?.trim()) {
    try {
      return await generateOpenAIText(env, prompt);
    } catch (openAIError) {
      if (!env.GEMINI_API_KEY?.trim()) {
        throw openAIError;
      }
    }
  }

  if (!env.GEMINI_API_KEY?.trim()) {
    return null;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35 },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`AI provider returned ${response.status}`);
  }

  const data: any = await response.json();

  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text ?? '')
      .join('')
      .trim() ?? ''
  );
}

function safeJson(text: string, fallback: any) {
  try {
    const clean = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');

    return JSON.parse(clean);
  } catch {
    return fallback;
  }
}

export async function handleAppApi(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (!path.startsWith('/api/')) return null;

  const auth = await identity(request, env);

  if ('error' in auth) return auth.error;

  const { db, user } = auth;

  const body =
    method === 'GET' || method === 'HEAD'
      ? {}
      : await parseBody(request);

  if (method !== 'GET' && method !== 'HEAD' && !body) {
    return reply({ error: 'Invalid JSON body' }, 400);
  }

  if (path === '/api/business/me' && method === 'GET') {
    const { data, error } = await businessFor(db, user.id);

    if (error) {
      return reply({ error: 'Could not load business profile' }, 500);
    }

    return reply({ businessProfile: mapBusiness(data) });
  }

  if (path === '/api/business/all' && method === 'GET') {
    let q = db
      .from('business_profiles')
      .select('*')
      .eq('onboarding_completed', true)
      .neq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    const industry = url.searchParams.get('industry');
    const location = url.searchParams.get('location');
    const type = url.searchParams.get('type');
    const search = (url.searchParams.get('query') ?? '').trim();

    if (industry && industry !== 'All Industries') {
      q = q.ilike('industry', `%${industry}%`);
    }

    if (type && type !== 'All Types') {
      q = q.ilike('business_type', `%${type}%`);
    }

    if (location && location !== 'Global') {
      q = q.or(
        `country.ilike.%${location}%,city.ilike.%${location}%`,
      );
    }

    const { data, error } = await q;

    if (error) {
      return reply({ error: 'Could not discover businesses' }, 500);
    }

    const rows = (data ?? []).filter(
      (b: any) =>
        !search ||
        [
          b.business_name,
          b.business_description,
          b.industry,
          ...(b.business_keywords ?? []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase()),
    );

    return reply({ businesses: rows.map(mapPublicBusiness) });
  }

  if (path === '/api/dashboard/stats' && method === 'GET') {
    const [
      business,
      connections,
      opportunities,
      notifications,
      leads,
    ] = await Promise.all([
      businessFor(db, user.id),
      db
        .from('connections')
        .select('id,status', { count: 'exact' })
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`),
      db
        .from('opportunities')
        .select('id', { count: 'exact' })
        .eq('owner_id', user.id),
      db
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_read', false),
      db
        .from('saved_leads')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id),
    ]);

    if (
      [business, connections, opportunities, notifications, leads].some(
        (result: any) => result.error,
      )
    ) {
      return reply({ error: 'Could not load dashboard statistics' }, 500);
    }

    return reply({
      matchesCount: 0,
      activeConnectionsCount: (connections.data ?? []).filter(
        (item: any) => item.status === 'accepted',
      ).length,
      savedLeadsCount: leads.count ?? 0,
      openOpportunitiesCount: opportunities.count ?? 0,
    });
  }

  if (path === '/api/opportunities' && method === 'GET') {
    const { data, error } = await db
      .from('opportunities')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return reply({ error: 'Could not load opportunities' }, 500);
    }

    const ids = [
      ...new Set((data ?? []).map((item: any) => item.owner_id)),
    ];

    const { data: businesses } = ids.length
      ? await db
          .from('business_profiles')
          .select('id,owner_id,business_name')
          .in('owner_id', ids)
      : { data: [] };

    const byOwner = new Map(
      (businesses ?? []).map((business: any) => [
        business.owner_id,
        business,
      ]),
    );

    return reply({
      opportunities: (data ?? []).map((opportunity: any) =>
        mapOpportunity(opportunity, byOwner.get(opportunity.owner_id)),
      ),
    });
  }

  if (path === '/api/opportunities' && method === 'POST') {
    const { data: business } = await businessFor(db, user.id);

    if (!business) {
      return reply(
        { error: 'Complete your business profile before posting an opportunity' },
        409,
      );
    }

    const title = String(body!.title ?? '').trim();

    if (!title) {
      return reply({ error: 'Opportunity title is required' }, 400);
    }

    const { data, error } = await db
      .from('opportunities')
      .insert({
        owner_id: user.id,
        title: title.slice(0, 180),
        category: String(body!.category ?? ''),
        description: String(body!.description ?? ''),
        what_they_need: String(
          body!.whatTheyNeed ?? body!.description ?? '',
        ),
        country: String(body!.location ?? '').includes(',')
          ? String(body!.location).split(',').slice(1).join(',').trim()
          : business.country,
        city: String(body!.location ?? '').includes(',')
          ? String(body!.location).split(',')[0].trim()
          : body!.location && body!.location !== 'Global'
            ? String(body!.location)
            : business.city,
        quantity: body!.quantity ?? null,
        budget: body!.budget ?? null,
        timeline: body!.timeline ?? null,
        requirements: body!.requirements ?? null,
      })
      .select('*')
      .single();

    if (error) {
      return reply({ error: 'Could not create opportunity' }, 500);
    }

    return reply(
      { success: true, opportunity: mapOpportunity(data, business) },
      201,
    );
  }

  const opportunityMatch = path.match(
    /^\/api\/opportunities\/([^/]+)(?:\/(respond))?$/,
  );

  if (
    opportunityMatch &&
    method === 'DELETE' &&
    !opportunityMatch[2]
  ) {
    const { data, error } = await db
      .from('opportunities')
      .delete()
      .eq('id', opportunityMatch[1])
      .eq('owner_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return reply({ error: 'Could not delete opportunity' }, 500);
    }

    if (!data) {
      return reply({ error: 'Opportunity not found' }, 404);
    }

    return reply({ success: true });
  }

  if (
    opportunityMatch &&
    method === 'POST' &&
    opportunityMatch[2]
  ) {
    const pitch = String(body!.pitch ?? '').trim();

    if (!pitch) {
      return reply({ error: 'A response message is required' }, 400);
    }

    const { data: target } = await db
      .from('opportunities')
      .select('id,owner_id,status')
      .eq('id', opportunityMatch[1])
      .maybeSingle();

    if (!target || target.status !== 'open') {
      return reply({ error: 'This opportunity is no longer available' }, 404);
    }

    if (target.owner_id === user.id) {
      return reply(
        { error: 'You cannot respond to your own opportunity' },
        403,
      );
    }

    const { data, error } = await db
      .from('opportunity_responses')
      .insert({
        opportunity_id: opportunityMatch[1],
        responder_id: user.id,
        pitch,
        budget_quote: body!.budgetQuote ?? null,
      })
      .select('id')
      .single();

    if (error) {
      return reply(
        {
          error:
            error.code === '23505'
              ? 'You have already responded to this opportunity'
              : 'Could not submit response',
        },
        error.code === '23505' ? 409 : 500,
      );
    }

    return reply({ success: true, response: data }, 201);
  }

  if (path === '/api/leads/saved' && method === 'GET') {
    const { data, error } = await db
      .from('saved_leads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return reply({ error: 'Could not load saved leads' }, 500);
    }

    return reply({
      leads: (data ?? []).map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        targetBusinessId: item.target_business_id,
        companyName: item.company_name,
        domain: item.domain,
        contactName: item.contact_name,
        contactRole: item.contact_role,
        location: item.location,
        industry: item.industry,
        score: item.score,
        notes: item.notes,
        tags: item.tags ?? [],
        createdAt: item.created_at,
      })),
    });
  }

  if (path === '/api/leads/save' && method === 'POST') {
    const name = String(
      body!.companyName ?? body!.lead?.companyName ?? '',
    ).trim();

    if (!name) {
      return reply({ error: 'Company name is required' }, 400);
    }

    const targetId = body!.targetBusinessId ?? null;
    let saved: any = null;

    if (targetId) {
      const existing = await db
        .from('saved_leads')
        .select('id')
        .eq('user_id', user.id)
        .eq('target_business_id', targetId)
        .maybeSingle();

      if (existing.error) {
        return reply({ error: 'Could not check saved lead' }, 500);
      }

      if (existing.data) {
        const updated = await db
          .from('saved_leads')
          .update({
            company_name: name,
            domain: body!.domain ?? null,
            contact_name: body!.contactName ?? null,
            contact_role: body!.contactRole ?? null,
            location: body!.location ?? null,
            industry: body!.industry ?? null,
            score: body!.score ?? null,
            notes: body!.notes ?? null,
            tags: body!.tags ?? [],
          })
          .eq('id', existing.data.id)
          .eq('user_id', user.id)
          .select('*')
          .single();

        if (updated.error) {
          return reply({ error: 'Could not update saved lead' }, 500);
        }

        saved = updated.data;
      }
    }

    if (!saved) {
      const inserted = await db
        .from('saved_leads')
        .insert({
          user_id: user.id,
          target_business_id: targetId,
          company_name: name,
          domain: body!.domain ?? null,
          contact_name: body!.contactName ?? null,
          contact_role: body!.contactRole ?? null,
          location: body!.location ?? null,
          industry: body!.industry ?? null,
          score: body!.score ?? null,
          notes: body!.notes ?? null,
          tags: body!.tags ?? [],
        })
        .select('*')
        .single();

      if (inserted.error) {
        return reply({ error: 'Could not save lead' }, 500);
      }

      saved = inserted.data;
    }

    return reply({ success: true, lead: saved }, 201);
  }

  const savedMatch = path.match(/^\/api\/leads\/saved\/([^/]+)$/);

  if (savedMatch && method === 'DELETE') {
    const { data, error } = await db
      .from('saved_leads')
      .delete()
      .eq('id', savedMatch[1])
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return reply({ error: 'Could not remove saved lead' }, 500);
    }

    if (!data) {
      return reply({ error: 'Saved lead not found' }, 404);
    }

    return reply({ success: true });
  }

  if (path === '/api/leads/generate' && method === 'POST') {
    const query = [
      body!.query,
      body!.industry,
      body!.location,
      body!.businessType,
      body!.requirements,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!query) {
      return reply({ error: 'Describe the leads you need' }, 400);
    }

    const { data, error } = await db
      .from('business_profiles')
      .select('*')
      .eq('onboarding_completed', true)
      .neq('owner_id', user.id)
      .limit(30);

    if (error) {
      return reply({ error: 'Lead search failed' }, 500);
    }

    const terms = query
      .toLowerCase()
      .split(/\W+/)
      .filter((term: string) => term.length > 2);

    const matches = (data ?? [])
      .map((business: any) => ({
        business,
        score: terms.filter((term: string) =>
          [
            business.business_name,
            business.industry,
            business.business_description,
            ...(business.products ?? []),
            ...(business.services ?? []),
          ]
            .join(' ')
            .toLowerCase()
            .includes(term),
        ).length,
      }))
      .filter((item: any) => item.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 20);

    return reply({
      leads: matches.map((item: any) => ({
        id: item.business.id,
        businessName: item.business.business_name,
        website: item.business.website,
        industry: item.business.industry,
        city: item.business.city,
        country: item.business.country,
        score: `${Math.min(99, 65 + item.score * 8)}%`,
        businessProfile: mapPublicBusiness(item.business),
      })),
      total: matches.length,
    });
  }

  if (path === '/api/notifications' && method === 'GET') {
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return reply({ error: 'Could not load notifications' }, 500);
    }

    return reply({ notifications: data ?? [] });
  }

  if (path === '/api/notifications/mark-read' && method === 'POST') {
    let q = db
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);

    if (Array.isArray(body!.ids) && body!.ids.length) {
      q = q.in('id', body!.ids);
    } else if (body!.id) {
      q = q.eq('id', body!.id);
    }

    const { error } = await q;

    if (error) {
      return reply({ error: 'Could not update notifications' }, 500);
    }

    return reply({ success: true });
  }

  if (path === '/api/ai/parse-brief' && method === 'POST') {
    const prompt = String(body!.prompt ?? '').trim();

    if (!prompt) {
      return reply({ error: 'Prompt is required' }, 400);
    }

    try {
      const text = await ai(
        env,
        `Extract B2B sourcing fields from this request. Return only JSON with category,targetLocation,quantity,targetBudget,timeline,requirements,intentSummary. Do not invent details.\n${prompt}`,
      );

      return text
        ? reply({
            parsed: safeJson(text, {
              category: 'General B2B',
              targetLocation: 'Global',
              intentSummary: prompt.slice(0, 120),
            }),
          })
        : reply({ error: 'AI service is not configured' }, 503);
    } catch {
      return reply(
        { error: 'AI service is temporarily unavailable' },
        502,
      );
    }
  }

  if (path === '/api/ai/build-profile' && method === 'POST') {
    const description = String(body!.description ?? '').trim();

    if (!description) {
      return reply({ error: 'Description is required' }, 400);
    }

    try {
      const text = await ai(
        env,
        `Turn this factual business description into JSON fields businessSummary,industry,businessType,products,services,capabilities,offers,needs,targetCustomers,targetBusinessTypes,markets,keywords. Do not invent.\n${description}`,
      );

      return text
        ? reply({
            generated: safeJson(text, {
              businessSummary: description,
              industry: '',
              businessType: 'Service Provider',
              products: [],
              services: [],
              capabilities: [],
              offers: [],
              needs: [],
              targetCustomers: [],
              targetBusinessTypes: [],
              markets: [],
              keywords: [],
            }),
          })
        : reply({ error: 'AI service is not configured' }, 503);
    } catch {
      return reply(
        { error: 'AI service is temporarily unavailable' },
        502,
      );
    }
  }

  if (path === '/api/ai/improve-description' && method === 'POST') {
    const description = String(body!.description ?? '').trim();

    if (!description) {
      return reply({ error: 'Description is required' }, 400);
    }

    try {
      const improved = await ai(
        env,
        `Improve this B2B business description. Preserve facts; do not invent claims. Return only the improved text.\n${description}`,
      );

      return improved
        ? reply({ improved })
        : reply({ error: 'AI service is not configured' }, 503);
    } catch {
      return reply(
        { error: 'AI service is temporarily unavailable' },
        502,
      );
    }
  }

  if (path === '/api/ai/match' && method === 'POST') {
    const brief = String(body!.brief ?? body!.prompt ?? '').toLowerCase();

    const { data: own } = await businessFor(db, user.id);

    const { data, error } = await db
      .from('business_profiles')
      .select('*')
      .eq('onboarding_completed', true)
      .neq('owner_id', user.id)
      .limit(100);

    if (error) {
      return reply({ error: 'Could not find matching businesses' }, 500);
    }

    const terms = [
      ...brief.split(/\W+/),
      ...(own?.business_keywords ?? []).map((item: string) =>
        item.toLowerCase(),
      ),
      ...(own?.needs ?? []).map((item: any) =>
        String(item.title ?? item).toLowerCase(),
      ),
    ].filter((term: string) => term.length > 2);

    const matches = (data ?? [])
      .map((business: any) => {
        const text = [
          business.business_name,
          business.industry,
          business.business_description,
          business.business_type,
          ...(business.products ?? []),
          ...(business.services ?? []),
          ...(business.offers ?? []),
          ...(business.capabilities ?? []),
        ]
          .join(' ')
          .toLowerCase();

        const matched = [
          ...new Set(terms.filter((term: string) => text.includes(term))),
        ];

        return {
          candidateBusiness: mapPublicBusiness(business),
          score: Math.min(98, Math.round(50 + matched.length * 8)),
          whyThisMatch: matched.length
            ? `Relevant overlap: ${matched.slice(0, 4).join(', ')}.`
            : 'Potential industry and capability fit; review the profile for details.',
          criteriaMatched: matched.slice(0, 5),
        };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 20);

    return reply({ matches, total: matches.length });
  }

  if (path === '/api/ai/draft-outreach' && method === 'POST') {
    const recipient = body!.recipient ?? {};
    const goal = String(
      body!.goal ?? 'Introduce a business collaboration',
    );
    const tone = String(body!.tone ?? 'professional');

    const { data: profile } = await businessFor(db, user.id);

    const prompt = `Write a concise, factual B2B outreach message. Sender ${profile?.business_name ?? 'our business'}. Recipient ${recipient.name ?? 'Business contact'} at ${recipient.company ?? 'their company'}. Goal ${goal}. Tone ${tone}. Never invent specifics.`;

    try {
      const content = await ai(env, prompt);

      return content
        ? reply({ draft: content, content })
        : reply({ error: 'AI service is not configured' }, 503);
    } catch {
      return reply(
        { error: 'AI service is temporarily unavailable' },
        502,
      );
    }
  }

  if (path === '/api/outreach/drafts' && method === 'GET') {
    const { data, error } = await db
      .from('outreach_drafts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return reply({ error: 'Could not load outreach drafts' }, 500);
    }

    return reply({ drafts: data ?? [] });
  }

  if (path === '/api/outreach/save-draft' && method === 'POST') {
    const { data, error } = await db
      .from('outreach_drafts')
      .insert({
        user_id: user.id,
        lead_id: body!.leadId ?? null,
        lead_name: String(body!.leadName ?? 'Business contact'),
        goal: String(body!.goal ?? ''),
        tone: String(body!.tone ?? 'professional'),
        content: String(body!.content ?? ''),
        status: 'draft',
      })
      .select('*')
      .single();

    if (error) {
      return reply({ error: 'Could not save outreach draft' }, 500);
    }

    return reply({ success: true, draft: data }, 201);
  }

  if (path === '/api/outreach/send' && method === 'POST') {
    return reply(
      {
        error: 'No outbound email provider is configured. Your draft has not been sent.',
      },
      501,
    );
  }

  if (path === '/api/messages/conversations' && method === 'GET') {
    const { data, error } = await db
      .from('conversations')
      .select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (error) {
      return reply({ error: 'Could not load conversations' }, 500);
    }

    return reply({ conversations: data ?? [] });
  }

  const messageMatch = path.match(/^\/api\/messages\/([^/]+)$/);

  if (messageMatch && method === 'GET') {
    const { data: conversation, error: conversationError } = await db
      .from('conversations')
      .select('*')
      .eq('id', messageMatch[1])
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .maybeSingle();

    if (conversationError || !conversation) {
      return reply({ error: 'Conversation not found' }, 404);
    }

    const { data, error } = await db
      .from('messages')
      .select('*')
      .eq('conversation_id', messageMatch[1])
      .order('created_at', { ascending: true });

    if (error) {
      return reply({ error: 'Could not load messages' }, 500);
    }

    return reply({ messages: data ?? [] });
  }

  if (path === '/api/messages/send' && method === 'POST') {
    const conversationId = String(body!.conversationId ?? '');
    const content = String(body!.content ?? '').trim();

    if (!conversationId || !content) {
      return reply(
        { error: 'Conversation and message are required' },
        400,
      );
    }

    const { data: conversation } = await db
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .maybeSingle();

    if (!conversation) {
      return reply({ error: 'Conversation not found' }, 404);
    }

    const { data, error } = await db
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
      })
      .select('*')
      .single();

    if (error) {
      return reply({ error: 'Could not send message' }, 500);
    }

    await db
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return reply({ success: true, message: data }, 201);
  }

  return null;
}
