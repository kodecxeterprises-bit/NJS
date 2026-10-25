
import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  db, User, BusinessProfile, Connection, Message, Opportunity, SavedLead, OutreachDraft
} from './db';
import {
  parseSourcingBrief, generateProfileFromDescription, improveDescription,
  explainMatch, draftOutreachMessage, draftMessageAssistance
} from './ai';

export const apiRouter = Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

const requestUserIds = new WeakMap<Request, string>();

function getUserIdFromReq(req: Request): string | null {
  return requestUserIds.get(req) || null;
}

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    businessProfileId: user.businessProfileId,
    profileImage: user.profileImage,
    createdAt: user.createdAt
  };
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

apiRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  const accessToken = header.slice(7).trim();
  if (!accessToken || !supabase) {
    return res.status(503).json({
      error: 'Authentication service is not configured on the server.'
    });
  }

  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }

    const authUser = data.user;
    const email = authUser.email?.trim().toLowerCase();

    if (!email) {
      return res.status(401).json({ error: 'Your account needs a valid email address.' });
    }

    let user = db.findUserBySupabaseId(authUser.id);

    if (!user && authUser.email_confirmed_at) {
      user = db.findUserByEmail(email);
      if (user) {
        db.updateUser(user.id, {
          supabaseUserId: authUser.id,
          isEmailVerified: true
        });
        user = db.findUserById(user.id);
      }
    }

    if (!user) {
      const metadata = authUser.user_metadata || {};
      const nameValue =
        metadata.full_name || metadata.name || metadata.display_name ||
        email.split('@')[0];
      const imageValue = metadata.avatar_url || metadata.picture;
      const now = new Date().toISOString();

      const newUser: User = {
        id: newId('usr'),
        supabaseUserId: authUser.id,
        name: String(nameValue).trim().slice(0, 120) || email.split('@')[0],
        email,
        passwordHash: 'SUPABASE_AUTH_MANAGED',
        profileImage: typeof imageValue === 'string' ? imageValue : undefined,
        isEmailVerified: Boolean(authUser.email_confirmed_at),
        createdAt: now,
        updatedAt: now
      };

      db.createUser(newUser);
      user = newUser;
    } else {
      const metadata = authUser.user_metadata || {};
      const imageValue = metadata.avatar_url || metadata.picture;
      const updates: Partial<User> = {};

      if (user.supabaseUserId !== authUser.id) updates.supabaseUserId = authUser.id;
      if (user.email !== email) updates.email = email;
      if (authUser.email_confirmed_at && !user.isEmailVerified) {
        updates.isEmailVerified = true;
      }
      if (typeof imageValue === 'string' && !user.profileImage) {
        updates.profileImage = imageValue;
      }

      if (Object.keys(updates).length) {
        db.updateUser(user.id, updates);
        user = db.findUserById(user.id);
      }
    }

    if (!user) {
      return res.status(500).json({ error: 'Could not load your NJS account.' });
    }

    requestUserIds.set(req, user.id);
    return next();
  } catch (error) {
    console.error('Supabase token verification failed:', error);
    return res.status(401).json({ error: 'Could not verify your session.' });
  }
});

// AUTHENTICATION

function useSupabaseAuthMessage(_req: Request, res: Response) {
  return res.status(410).json({
    error: 'This authentication endpoint has been retired. Use Supabase Auth from the app.',
    code: 'USE_SUPABASE_AUTH'
  });
}

apiRouter.post('/auth/sign-up', useSupabaseAuthMessage);
apiRouter.post('/auth/sign-in', useSupabaseAuthMessage);
apiRouter.post('/auth/google-sign-in', useSupabaseAuthMessage);
apiRouter.post('/auth/resend-code', useSupabaseAuthMessage);
apiRouter.post('/auth/verify-email', useSupabaseAuthMessage);
apiRouter.post('/auth/forgot-password', useSupabaseAuthMessage);
apiRouter.post('/auth/reset-password', useSupabaseAuthMessage);

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const user = db.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const profile = db.getBusinessProfileByUserId(userId);
  const subscription = db.get().subscriptions.find(s => s.userId === userId);

  return res.json({
    user: publicUser(user),
    businessProfile: profile || null,
    subscription: subscription || { plan: 'free', creditsAvailable: 4850 }
  });
});

apiRouter.post('/auth/sign-out', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Sign out through Supabase Auth on the client.'
  });
});

// BUSINESS PROFILE & ONBOARDING

apiRouter.get('/business/me', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ businessProfile: db.getBusinessProfileByUserId(userId) || null });
});

apiRouter.post('/business/save', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const existing = db.getBusinessProfileByUserId(userId);
  const data = req.body || {};

  const profile: BusinessProfile = {
    id: existing?.id || newId('biz'),
    userId,
    businessName: data.businessName || existing?.businessName || '',
    businessType: data.businessType || existing?.businessType || 'Service Provider',
    industry: data.industry || existing?.industry || '',
    country: data.country || existing?.country || '',
    city: data.city || existing?.city || '',
    website: data.website || existing?.website || '',
    phone: data.phone || existing?.phone || '',
    businessDescription: data.businessDescription || existing?.businessDescription || '',
    products: data.products || existing?.products || [],
    services: data.services || existing?.services || [],
    capabilities: data.capabilities || existing?.capabilities || [],
    offers: data.offers || existing?.offers || [],
    needs: data.needs || existing?.needs || [],
    targetCustomers: data.targetCustomers || existing?.targetCustomers || [],
    targetSuppliers: data.targetSuppliers || existing?.targetSuppliers || [],
    targetManufacturers: data.targetManufacturers || existing?.targetManufacturers || [],
    targetPartners: data.targetPartners || existing?.targetPartners || [],
    targetMarkets: data.targetMarkets || existing?.targetMarkets || [],
    businessGoals: data.businessGoals || existing?.businessGoals || [],
    businessKeywords: data.businessKeywords || existing?.businessKeywords || [],
    isVerified: existing?.isVerified ?? true,
    reviewScore: existing?.reviewScore ?? 5,
    reviewCount: existing?.reviewCount ?? 0,
    onboardingStep: data.onboardingStep || existing?.onboardingStep || 'completed',
    onboardingCompleted: data.onboardingCompleted ?? existing?.onboardingCompleted ?? false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.upsertBusinessProfile(profile);
  return res.json({ success: true, businessProfile: profile });
});

apiRouter.get('/business/all', (req: Request, res: Response) => {
  const { query, industry, location, type } = req.query;
  let all = db.getAllPublicBusinesses();

  if (typeof query === 'string') {
    const q = query.toLowerCase();
    all = all.filter(b =>
      b.businessName.toLowerCase().includes(q) ||
      b.businessDescription.toLowerCase().includes(q) ||
      b.industry.toLowerCase().includes(q) ||
      b.businessKeywords.some(k => k.toLowerCase().includes(q))
    );
  }
  if (typeof industry === 'string' && industry !== 'All Industries') {
    all = all.filter(b => b.industry.toLowerCase().includes(industry.toLowerCase()));
  }
  if (typeof location === 'string' && location !== 'Global') {
    all = all.filter(b =>
      b.country.toLowerCase().includes(location.toLowerCase()) ||
      b.city.toLowerCase().includes(location.toLowerCase())
    );
  }
  if (typeof type === 'string' && type !== 'All Types') {
    all = all.filter(b => b.businessType.toLowerCase() === type.toLowerCase());
  }

  return res.json({ businesses: all });
});

apiRouter.get('/business/:id', (req: Request, res: Response) => {
  const business = db.getBusinessProfileById(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found' });
  return res.json({ business });
});

// AI SERVICES

apiRouter.post('/ai/parse-brief', async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  return res.json({ parsed: await parseSourcingBrief(prompt) });
});

apiRouter.post('/ai/build-profile', async (req: Request, res: Response) => {
  const { description } = req.body;
  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'Description is required' });
  }
  return res.json({ generated: await generateProfileFromDescription(description) });
});

apiRouter.post('/ai/improve-description', async (req: Request, res: Response) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });
  return res.json({ improved: await improveDescription(description) });
});

apiRouter.post('/ai/match', async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const { brief, category } = req.body;
  const currentBusiness = userId ? db.getBusinessProfileByUserId(userId) : null;
  const candidates = db.getAllPublicBusinesses().filter(b => b.userId !== userId);

  if (!candidates.length) return res.json({ matches: [], total: 0 });

  const matches: Array<{
    id: string;
    candidateBusiness: BusinessProfile;
    score: number;
    whyThisMatch: string;
    criteriaMatched: string[];
  }> = [];

  for (const candidate of candidates) {
    const analysis = await explainMatch(
      brief || '',
      currentBusiness || { businessName: 'Inquirer', industry: category || 'Commercial' },
      candidate
    );
    if (analysis.score >= 60) {
      matches.push({
        id: `match_${candidate.id}_${Date.now().toString(36)}`,
        candidateBusiness: candidate,
        score: analysis.score,
        whyThisMatch: analysis.whyThisMatch,
        criteriaMatched: analysis.criteriaMatched
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return res.json({ matches, total: matches.length });
});

apiRouter.post('/ai/draft-outreach', async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const { recipient, goal, tone } = req.body;
  const user = userId ? db.findUserById(userId) : null;
  const business = userId ? db.getBusinessProfileByUserId(userId) : null;

  const sender = {
    name: user?.name || 'Partner Representative',
    company: business?.businessName || 'NJS Enterprise Member',
    offer: business?.offers?.map(o => o.title).join(', ') || undefined
  };

  const draft = await draftOutreachMessage(
    recipient || { name: '', company: '' },
    goal || 'Intro & Discovery Call',
    tone || 'Professional & Direct',
    sender
  );
  return res.json({ draft });
});

apiRouter.post('/ai/message-assistant', async (req: Request, res: Response) => {
  const { promptType, context } = req.body;
  const drafted = await draftMessageAssistance(
    promptType,
    context || { senderName: 'Me', recipientName: 'Partner', businessName: 'Company' }
  );
  return res.json({ text: drafted });
});
