
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

// CONNECTIONS

apiRouter.get('/connections', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const connections = db.get().connections.filter(
    c => c.requesterUserId === userId || c.targetUserId === userId
  );

  const hydrated = connections.map(conn => {
    const otherUserId = conn.requesterUserId === userId ? conn.targetUserId : conn.requesterUserId;
    const otherBizId = conn.requesterUserId === userId ? conn.targetBusinessId : conn.requesterBusinessId;
    const business = db.getBusinessProfileById(otherBizId) || db.getBusinessProfileByUserId(otherUserId);
    return { ...conn, isInitiator: conn.requesterUserId === userId, partnerBusiness: business };
  });

  return res.json({ connections: hydrated });
});

apiRouter.post('/connections/request', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { targetBusinessId, message } = req.body;
  const myBiz = db.getBusinessProfileByUserId(userId);
  const targetBiz = db.getBusinessProfileById(targetBusinessId);

  if (!myBiz) return res.status(400).json({ error: 'You must set up your business profile before connecting' });
  if (!targetBiz) return res.status(404).json({ error: 'Target business not found' });

  const existing = db.get().connections.find(c =>
    (c.requesterBusinessId === myBiz.id && c.targetBusinessId === targetBiz.id) ||
    (c.requesterBusinessId === targetBiz.id && c.targetBusinessId === myBiz.id)
  );
  if (existing) return res.status(400).json({ error: 'A connection request already exists with this business' });

  const conn: Connection = {
    id: newId('conn'),
    requesterUserId: userId,
    requesterBusinessId: myBiz.id,
    targetUserId: targetBiz.userId,
    targetBusinessId: targetBiz.id,
    status: 'pending',
    message: message || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.update(d => {
    d.connections.push(conn);
    d.notifications.push({
      id: newId('notif'),
      userId: targetBiz.userId,
      type: 'connection_request',
      title: 'New Connection Request',
      message: `${myBiz.businessName} would like to connect with your business.`,
      link: '/connections',
      isRead: false,
      createdAt: new Date().toISOString()
    });
  });
  return res.json({ success: true, connection: conn });
});

apiRouter.post('/connections/respond', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { connectionId, action } = req.body;
  const conn = db.get().connections.find(c => c.id === connectionId);
  if (!conn) return res.status(404).json({ error: 'Connection not found' });
  if (conn.targetUserId !== userId && conn.requesterUserId !== userId) {
    return res.status(403).json({ error: 'Not permitted' });
  }
  if (!['accept', 'reject', 'remove'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  if (action === 'accept' && conn.targetUserId !== userId) {
    return res.status(403).json({ error: 'Only the recipient can accept a connection request' });
  }

  db.update(d => {
    const c = d.connections.find(x => x.id === connectionId);
    if (!c) return;

    if (action === 'accept') {
      c.status = 'accepted';
      c.updatedAt = new Date().toISOString();

      const existingConv = d.conversations.find(conv =>
        conv.participantUserIds.includes(c.requesterUserId) &&
        conv.participantUserIds.includes(c.targetUserId)
      );
      if (!existingConv) {
        d.conversations.push({
          id: newId('conv'),
          participantUserIds: [c.requesterUserId, c.targetUserId],
          participantBusinessIds: [c.requesterBusinessId, c.targetBusinessId],
          createdAt: new Date().toISOString()
        });
      }
      d.notifications.push({
        id: newId('notif'),
        userId: c.requesterUserId,
        type: 'connection_accepted',
        title: 'Connection Accepted',
        message: 'Your connection request was accepted! You can now exchange direct messages.',
        link: '/messages',
        isRead: false,
        createdAt: new Date().toISOString()
      });
    } else {
      c.status = action === 'reject' ? 'rejected' : 'removed';
      c.updatedAt = new Date().toISOString();
    }
  });

  return res.json({ success: true });
});

// MESSAGING

apiRouter.get('/messages/conversations', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const conversations = db.get().conversations.filter(c => c.participantUserIds.includes(userId));
  const hydrated = conversations.map(c => {
    const otherUserId = c.participantUserIds.find(id => id !== userId) || '';
    const otherBizId = c.participantBusinessIds.find((_, i) => c.participantUserIds[i] !== userId) || '';
    const otherBiz = db.getBusinessProfileById(otherBizId) || db.getBusinessProfileByUserId(otherUserId);
    const otherUser = db.findUserById(otherUserId);
    const unreadCount = db.get().messages.filter(
      m => m.conversationId === c.id && m.recipientUserId === userId && !m.isRead
    ).length;

    return {
      ...c,
      partnerUser: { id: otherUser?.id, name: otherUser?.name },
      partnerBusiness: otherBiz,
      unreadCount
    };
  });

  return res.json({ conversations: hydrated });
});

apiRouter.get('/messages/:conversationId', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const conversation = db.get().conversations.find(c => c.id === req.params.conversationId);
  if (!conversation || !conversation.participantUserIds.includes(userId)) {
    return res.status(403).json({ error: 'Conversation not accessible' });
  }

  db.update(d => {
    d.messages.forEach(m => {
      if (m.conversationId === conversation.id && m.recipientUserId === userId) m.isRead = true;
    });
  });

  return res.json({
    messages: db.get().messages.filter(m => m.conversationId === conversation.id)
  });
});

apiRouter.post('/messages/send', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { conversationId, content } = req.body;
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Message content cannot be empty' });
  }

  const conversation = db.get().conversations.find(c => c.id === conversationId);
  if (!conversation || !conversation.participantUserIds.includes(userId)) {
    return res.status(403).json({ error: 'Not allowed to message in this conversation' });
  }

  const recipientUserId = conversation.participantUserIds.find(id => id !== userId);
  if (!recipientUserId) return res.status(400).json({ error: 'Invalid conversation participants' });

  const myBiz = db.getBusinessProfileByUserId(userId);
  const message: Message = {
    id: newId('msg'),
    conversationId,
    senderUserId: userId,
    senderBusinessId: myBiz?.id || '',
    recipientUserId,
    content: content.trim(),
    isRead: false,
    createdAt: new Date().toISOString()
  };

  db.update(d => {
    d.messages.push(message);
    const conv = d.conversations.find(c => c.id === conversationId);
    if (conv) {
      conv.lastMessageSnippet = content.trim().substring(0, 60);
      conv.lastMessageAt = new Date().toISOString();
    }
    d.notifications.push({
      id: newId('notif'),
      userId: recipientUserId,
      type: 'new_message',
      title: 'New Message',
      message: `${myBiz?.businessName || 'A connection'} sent you a message.`,
      link: '/messages',
      isRead: false,
      createdAt: new Date().toISOString()
    });
  });

  return res.json({ success: true, message });
});

// OPPORTUNITIES

apiRouter.get('/opportunities', (_req: Request, res: Response) => {
  return res.json({ opportunities: db.get().opportunities });
});

apiRouter.post('/opportunities', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const myBiz = db.getBusinessProfileByUserId(userId);
  const { title, category, description, whatTheyNeed, location, quantity, budget, timeline, requirements } = req.body;
  if (!title || !category || !description) {
    return res.status(400).json({ error: 'Title, category, and description are required' });
  }

  const now = new Date().toISOString();
  const opp: Opportunity = {
    id: newId('opp'),
    userId,
    businessId: myBiz?.id || '',
    businessName: myBiz?.businessName || 'Verified Enterprise',
    title: title.trim(),
    category,
    description: description.trim(),
    whatTheyNeed: whatTheyNeed || '',
    location: location || myBiz?.city || 'Global',
    quantity: quantity || '',
    budget: budget || '',
    timeline: timeline || '',
    requirements: requirements || '',
    status: 'open',
    responsesCount: 0,
    createdAt: now,
    updatedAt: now
  };

  db.update(d => d.opportunities.unshift(opp));
  return res.json({ success: true, opportunity: opp });
});

apiRouter.delete('/opportunities/:id', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const opp = db.get().opportunities.find(o => o.id === req.params.id);
  if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
  if (opp.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  db.update(d => {
    d.opportunities = d.opportunities.filter(o => o.id !== req.params.id);
  });
  return res.json({ success: true });
});

apiRouter.post('/opportunities/:id/respond', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const opp = db.get().opportunities.find(o => o.id === req.params.id);
  if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

  const { pitch, budgetQuote } = req.body;
  const myBiz = db.getBusinessProfileByUserId(userId);

  db.update(d => {
    d.opportunity_responses.push({
      id: newId('resp'),
      opportunityId: opp.id,
      userId,
      businessId: myBiz?.id || '',
      businessName: myBiz?.businessName || 'Enterprise Partner',
      pitch: pitch || '',
      budgetQuote: budgetQuote || '',
      createdAt: new Date().toISOString()
    });

    const target = d.opportunities.find(o => o.id === opp.id);
    if (target) target.responsesCount += 1;

    d.notifications.push({
      id: newId('notif'),
      userId: opp.userId,
      type: 'new_opportunity',
      title: 'New Opportunity Response',
      message: `${myBiz?.businessName || 'A business'} responded to your opportunity "${opp.title}".`,
      link: '/opportunities',
      isRead: false,
      createdAt: new Date().toISOString()
    });
  });

  return res.json({ success: true, message: 'Response submitted successfully' });
});

// SAVED LEADS & LEAD GENERATOR

apiRouter.get('/leads/saved', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ leads: db.get().saved_leads.filter(l => l.userId === userId) });
});

apiRouter.post('/leads/save', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { companyName, domain, contactName, contactRole, location, industry, score, targetBusinessId } = req.body;
  if (!companyName) return res.status(400).json({ error: 'Company name is required' });

  const lead: SavedLead = {
    id: newId('lead'),
    userId,
    targetBusinessId,
    companyName,
    domain,
    contactName,
    contactRole,
    location,
    industry,
    score: score || '95%',
    createdAt: new Date().toISOString()
  };

  db.update(d => d.saved_leads.push(lead));
  return res.json({ success: true, lead });
});

apiRouter.delete('/leads/saved/:id', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  db.update(d => {
    d.saved_leads = d.saved_leads.filter(l => l.id !== req.params.id || l.userId !== userId);
  });
  return res.json({ success: true });
});

apiRouter.post('/leads/generate', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { query, industry } = req.body;
  let filtered = db.getAllPublicBusinesses().filter(b => b.userId !== userId);

  if (typeof query === 'string' && query.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter(b =>
      b.businessName.toLowerCase().includes(q) ||
      b.businessDescription.toLowerCase().includes(q) ||
      b.industry.toLowerCase().includes(q)
    );
  }
  if (typeof industry === 'string' && industry.trim()) {
    filtered = filtered.filter(b => b.industry.toLowerCase().includes(industry.toLowerCase()));
  }

  return res.json({ leads: filtered, total: filtered.length });
});

// OUTREACH DRAFTS

apiRouter.get('/outreach/drafts', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ drafts: db.get().outreach_drafts.filter(d => d.userId === userId) });
});

apiRouter.post('/outreach/save-draft', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { leadName, goal, tone, content } = req.body;
  const now = new Date().toISOString();
  const draft: OutreachDraft = {
    id: newId('draft'),
    userId,
    leadName: leadName || 'Target Business',
    goal: goal || 'Intro & Discovery Call',
    tone: tone || 'Professional & Direct',
    content: content || '',
    status: 'draft',
    createdAt: now,
    updatedAt: now
  };

  db.update(d => d.outreach_drafts.unshift(draft));
  return res.json({ success: true, draft });
});

apiRouter.post('/outreach/send', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { draftId, confirmedByHuman } = req.body;
  if (!confirmedByHuman) {
    return res.status(400).json({ error: 'Human review and approval is required before dispatching' });
  }

  const draft = db.get().outreach_drafts.find(d => d.id === draftId && d.userId === userId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  db.update(d => {
    const target = d.outreach_drafts.find(x => x.id === draftId && x.userId === userId);
    if (target) {
      target.status = 'sent';
      target.updatedAt = new Date().toISOString();
    }
  });

  return res.json({ success: true, message: 'Outreach draft marked as sent.' });
});

// NOTIFICATIONS

apiRouter.get('/notifications', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ notifications: db.get().notifications.filter(n => n.userId === userId) });
});

apiRouter.post('/notifications/mark-read', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  db.update(d => {
    d.notifications.forEach(n => {
      if (n.userId === userId) n.isRead = true;
    });
  });
  return res.json({ success: true });
});

// DASHBOARD STATS

apiRouter.get('/dashboard/stats', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.json({
      matchesCount: 0,
      activeConnectionsCount: 0,
      savedLeadsCount: 0,
      openOpportunitiesCount: 0
    });
  }

  const myBiz = db.getBusinessProfileByUserId(userId);
  const connectionsCount = db.get().connections.filter(
    c => (c.requesterUserId === userId || c.targetUserId === userId) && c.status === 'accepted'
  ).length;
  const savedLeadsCount = db.get().saved_leads.filter(l => l.userId === userId).length;
  const openOpportunitiesCount = db.get().opportunities.filter(o => o.status === 'open').length;
  const matchesCount = myBiz
    ? db.get().matches.filter(m => m.userBusinessId === myBiz.id).length
    : 0;

  return res.json({
    matchesCount,
    activeConnectionsCount: connectionsCount,
    savedLeadsCount,
    openOpportunitiesCount
  });
});
