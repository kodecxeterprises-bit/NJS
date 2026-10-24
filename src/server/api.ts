import { Router, Request, Response } from 'express';
import { db, User, BusinessProfile, BusinessMatch, Connection, Message, Conversation, Opportunity, SavedLead, OutreachDraft, Notification } from './db';
import { parseSourcingBrief, generateProfileFromDescription, improveDescription, explainMatch, draftOutreachMessage, draftMessageAssistance } from './ai';

export const apiRouter = Router();

// Simple in-memory session token store (or cookie/header based)
const sessionStore = new Map<string, string>(); // token -> userId

function getUserIdFromReq(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return sessionStore.get(token) || null;
  }
  return null;
}

function createSession(userId: string): string {
  const token = 'njs_tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  sessionStore.set(token, userId);
  return token;
}

// ----------------------------------------------------
// AUTHENTICATION
// ----------------------------------------------------

apiRouter.post('/auth/sign-up', (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const existing = db.findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const userId = 'usr_' + Math.random().toString(36).substring(2, 10);
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  const newUser: User = {
    id: userId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: password, // In production use bcrypt
    isEmailVerified: false,
    verificationCode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createUser(newUser);
  const token = createSession(newUser.id);

  return res.json({
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      isEmailVerified: newUser.isEmailVerified,
      businessProfileId: newUser.businessProfileId,
    },
    verificationCodeSent: verificationCode, // Returned for UI testing / verification simulation
  });
});

apiRouter.post('/auth/sign-in', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.findUserByEmail(email);
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = createSession(user.id);
  const profile = user.businessProfileId ? db.getBusinessProfileById(user.businessProfileId) : db.getBusinessProfileByUserId(user.id);

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      businessProfileId: user.businessProfileId,
    },
    businessProfile: profile || null,
  });
});

apiRouter.post('/auth/google-sign-in', (req: Request, res: Response) => {
  const { email, name, profileImage, googleUid } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required for Google Sign-In' });
  }

  const cleanEmail = email.trim().toLowerCase();
  let user = db.findUserByEmail(cleanEmail);
  let isNew = false;

  if (!user) {
    isNew = true;
    const userId = 'usr_' + Math.random().toString(36).substring(2, 10);
    user = {
      id: userId,
      name: (name || cleanEmail.split('@')[0]).trim(),
      email: cleanEmail,
      passwordHash: 'GOOGLE_OAUTH_' + (googleUid || Math.random().toString(36)),
      profileImage: profileImage || undefined,
      isEmailVerified: true, // Google accounts have verified email
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.createUser(user);
  } else {
    // If existing user, mark email verified as they proved Google ownership
    db.updateUser(user.id, {
      isEmailVerified: true,
      profileImage: profileImage || user.profileImage,
    });
    user = db.findUserById(user.id)!;
  }

  const token = createSession(user.id);
  const profile = user.businessProfileId ? db.getBusinessProfileById(user.businessProfileId) : db.getBusinessProfileByUserId(user.id);

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      businessProfileId: user.businessProfileId,
      profileImage: user.profileImage,
    },
    businessProfile: profile || null,
    isNewUser: isNew,
  });
});

apiRouter.post('/auth/resend-code', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const { email } = req.body;

  let user: User | undefined;
  if (userId) {
    user = db.findUserById(userId);
  } else if (email) {
    user = db.findUserByEmail(email.trim().toLowerCase());
  }

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const newCode = Math.floor(100000 + Math.random() * 900000).toString();
  db.updateUser(user.id, { verificationCode: newCode });

  return res.json({
    success: true,
    verificationCode: newCode,
    email: user.email,
    name: user.name,
  });
});

apiRouter.post('/auth/verify-email', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const { code } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = db.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // If code matches or user entered the 6-digit code
  if (user.verificationCode && user.verificationCode === code.trim()) {
    db.updateUser(userId, { isEmailVerified: true });
    return res.json({ success: true, message: 'Email verified successfully' });
  }

  return res.status(400).json({ error: 'Invalid verification code' });
});

apiRouter.post('/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  const user = db.findUserByEmail(email);
  if (!user) {
    return res.json({ message: 'If an account exists with that email, a reset code was dispatched.' });
  }
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  db.updateUser(user.id, { verificationCode: resetCode });
  return res.json({
    message: 'If an account exists with that email, a reset code was dispatched.',
    debugCode: resetCode,
  });
});

apiRouter.post('/auth/reset-password', (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;
  const user = db.findUserByEmail(email);
  if (!user || user.verificationCode !== code) {
    return res.status(400).json({ error: 'Invalid reset code or email' });
  }
  db.updateUser(user.id, { passwordHash: newPassword });
  return res.json({ success: true, message: 'Password reset successfully' });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const user = db.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const profile = db.getBusinessProfileByUserId(userId);
  const subscription = db.get().subscriptions.find(s => s.userId === userId);

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      businessProfileId: user.businessProfileId,
      createdAt: user.createdAt,
    },
    businessProfile: profile || null,
    subscription: subscription || { plan: 'free', creditsAvailable: 4850 },
  });
});

apiRouter.post('/auth/sign-out', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    sessionStore.delete(authHeader.substring(7));
  }
  return res.json({ success: true });
});

// ----------------------------------------------------
// BUSINESS PROFILE & ONBOARDING
// ----------------------------------------------------

apiRouter.get('/business/me', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const profile = db.getBusinessProfileByUserId(userId);
  return res.json({ businessProfile: profile || null });
});

apiRouter.post('/business/save', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const existing = db.getBusinessProfileByUserId(userId);
  const data = req.body;

  const profile: BusinessProfile = {
    id: existing?.id || 'biz_' + Math.random().toString(36).substring(2, 10),
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
    reviewScore: existing?.reviewScore ?? 5.0,
    reviewCount: existing?.reviewCount ?? 0,
    onboardingStep: data.onboardingStep || existing?.onboardingStep || 'completed',
    onboardingCompleted: data.onboardingCompleted ?? existing?.onboardingCompleted ?? false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.upsertBusinessProfile(profile);

  // Trigger match checks if user profile has needs or offers
  return res.json({ success: true, businessProfile: profile });
});

apiRouter.get('/business/all', (req: Request, res: Response) => {
  const { query, industry, location, type } = req.query;
  let all = db.getAllPublicBusinesses();

  if (query && typeof query === 'string') {
    const q = query.toLowerCase();
    all = all.filter(b =>
      b.businessName.toLowerCase().includes(q) ||
      b.businessDescription.toLowerCase().includes(q) ||
      b.industry.toLowerCase().includes(q) ||
      b.businessKeywords.some(k => k.toLowerCase().includes(q))
    );
  }
  if (industry && typeof industry === 'string' && industry !== 'All Industries') {
    all = all.filter(b => b.industry.toLowerCase().includes(industry.toLowerCase()));
  }
  if (location && typeof location === 'string' && location !== 'Global') {
    all = all.filter(b => b.country.toLowerCase().includes(location.toLowerCase()) || b.city.toLowerCase().includes(location.toLowerCase()));
  }
  if (type && typeof type === 'string' && type !== 'All Types') {
    all = all.filter(b => b.businessType.toLowerCase() === type.toLowerCase());
  }

  return res.json({ businesses: all });
});

apiRouter.get('/business/:id', (req: Request, res: Response) => {
  const b = db.getBusinessProfileById(req.params.id);
  if (!b) return res.status(404).json({ error: 'Business not found' });
  return res.json({ business: b });
});

// ----------------------------------------------------
// AI SERVICES (GEMINI 3.8 FLASH)
// ----------------------------------------------------

apiRouter.post('/ai/parse-brief', async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const parsed = await parseSourcingBrief(prompt);
  return res.json({ parsed });
});

apiRouter.post('/ai/build-profile', async (req: Request, res: Response) => {
  const { description } = req.body;
  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'Description is required' });
  }

  const generated = await generateProfileFromDescription(description);
  return res.json({ generated });
});

apiRouter.post('/ai/improve-description', async (req: Request, res: Response) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });
  const improved = await improveDescription(description);
  return res.json({ improved });
});

apiRouter.post('/ai/match', async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const { brief, category, targetLocation } = req.body;

  const currentBusiness = userId ? db.getBusinessProfileByUserId(userId) : null;
  const allBusinesses = db.getAllPublicBusinesses().filter(b => b.userId !== userId);

  // If there are no candidate businesses in the DB, return empty list!
  if (allBusinesses.length === 0) {
    return res.json({ matches: [], total: 0 });
  }

  // Real matching algorithm: evaluate each registered business with Gemini
  const matches = [];
  for (const candidate of allBusinesses) {
    const analysis = await explainMatch(
      brief || '',
      currentBusiness || { businessName: 'Inquirer', industry: category || 'Commercial' },
      candidate
    );

    // If score > 60%, count as match
    if (analysis.score >= 60) {
      matches.push({
        id: 'match_' + candidate.id + '_' + Date.now().toString(36),
        candidateBusiness: candidate,
        score: analysis.score,
        whyThisMatch: analysis.whyThisMatch,
        criteriaMatched: analysis.criteriaMatched,
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
  const userBiz = userId ? db.getBusinessProfileByUserId(userId) : null;

  const sender = {
    name: user?.name || 'Partner Representative',
    company: userBiz?.businessName || 'NJS Enterprise Member',
    offer: userBiz?.offers?.map(o => o.title).join(', ') || undefined,
  };

  const draft = await draftOutreachMessage(recipient || { name: '', company: '' }, goal || 'Intro & Discovery Call', tone || 'Professional & Direct', sender);
  return res.json({ draft });
});

apiRouter.post('/ai/message-assistant', async (req: Request, res: Response) => {
  const { promptType, context } = req.body;
  const drafted = await draftMessageAssistance(promptType, context || { senderName: 'Me', recipientName: 'Partner', businessName: 'Company' });
  return res.json({ text: drafted });
});

// ----------------------------------------------------
// CONNECTIONS
// ----------------------------------------------------

apiRouter.get('/connections', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const connections = db.get().connections.filter(c => c.requesterUserId === userId || c.targetUserId === userId);

  // Hydrate businesses
  const hydrated = connections.map(conn => {
    const otherUserId = conn.requesterUserId === userId ? conn.targetUserId : conn.requesterUserId;
    const otherBizId = conn.requesterUserId === userId ? conn.targetBusinessId : conn.requesterBusinessId;
    const business = db.getBusinessProfileById(otherBizId) || db.getBusinessProfileByUserId(otherUserId);
    return {
      ...conn,
      isInitiator: conn.requesterUserId === userId,
      partnerBusiness: business,
    };
  });

  return res.json({ connections: hydrated });
});

apiRouter.post('/connections/request', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { targetBusinessId, message } = req.body;
  const myBiz = db.getBusinessProfileByUserId(userId);
  const targetBiz = db.getBusinessProfileById(targetBusinessId);

  if (!myBiz) {
    return res.status(400).json({ error: 'You must set up your business profile before connecting' });
  }
  if (!targetBiz) {
    return res.status(404).json({ error: 'Target business not found' });
  }

  // Check if existing
  const existing = db.get().connections.find(c =>
    (c.requesterBusinessId === myBiz.id && c.targetBusinessId === targetBiz.id) ||
    (c.requesterBusinessId === targetBiz.id && c.targetBusinessId === myBiz.id)
  );

  if (existing) {
    return res.status(400).json({ error: 'A connection request already exists with this business' });
  }

  const conn: Connection = {
    id: 'conn_' + Math.random().toString(36).substring(2, 10),
    requesterUserId: userId,
    requesterBusinessId: myBiz.id,
    targetUserId: targetBiz.userId,
    targetBusinessId: targetBiz.id,
    status: 'pending',
    message: message || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.update(d => {
    d.connections.push(conn);
    d.notifications.push({
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      userId: targetBiz.userId,
      type: 'connection_request',
      title: 'New Connection Request',
      message: `${myBiz.businessName} would like to connect with your business.`,
      link: '/connections',
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  });

  return res.json({ success: true, connection: conn });
});

apiRouter.post('/connections/respond', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { connectionId, action } = req.body; // action: 'accept' | 'reject' | 'remove'
  const conn = db.get().connections.find(c => c.id === connectionId);

  if (!conn) return res.status(404).json({ error: 'Connection not found' });
  if (conn.targetUserId !== userId && conn.requesterUserId !== userId) {
    return res.status(403).json({ error: 'Not permitted' });
  }

  db.update(d => {
    const c = d.connections.find(x => x.id === connectionId);
    if (!c) return;
    if (action === 'accept') {
      c.status = 'accepted';
      c.updatedAt = new Date().toISOString();
      // create conversation if none
      const existingConv = d.conversations.find(conv =>
        conv.participantUserIds.includes(c.requesterUserId) && conv.participantUserIds.includes(c.targetUserId)
      );
      if (!existingConv) {
        d.conversations.push({
          id: 'conv_' + Math.random().toString(36).substring(2, 10),
          participantUserIds: [c.requesterUserId, c.targetUserId],
          participantBusinessIds: [c.requesterBusinessId, c.targetBusinessId],
          createdAt: new Date().toISOString(),
        });
      }
      d.notifications.push({
        id: 'notif_' + Math.random().toString(36).substring(2, 9),
        userId: c.requesterUserId,
        type: 'connection_accepted',
        title: 'Connection Accepted',
        message: 'Your connection request was accepted! You can now exchange direct messages.',
        link: '/messages',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    } else if (action === 'reject') {
      c.status = 'rejected';
      c.updatedAt = new Date().toISOString();
    } else if (action === 'remove') {
      c.status = 'removed';
      c.updatedAt = new Date().toISOString();
    }
  });

  return res.json({ success: true });
});

// ----------------------------------------------------
// MESSAGING
// ----------------------------------------------------

apiRouter.get('/messages/conversations', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const conversations = db.get().conversations.filter(c => c.participantUserIds.includes(userId));

  const hydrated = conversations.map(c => {
    const otherUserId = c.participantUserIds.find(id => id !== userId) || '';
    const otherBizId = c.participantBusinessIds.find((_, idx) => c.participantUserIds[idx] !== userId) || '';
    const otherBiz = db.getBusinessProfileById(otherBizId) || db.getBusinessProfileByUserId(otherUserId);
    const otherUser = db.findUserById(otherUserId);
    const unreadCount = db.get().messages.filter(m => m.conversationId === c.id && m.recipientUserId === userId && !m.isRead).length;

    return {
      ...c,
      partnerUser: { id: otherUser?.id, name: otherUser?.name },
      partnerBusiness: otherBiz,
      unreadCount,
    };
  });

  return res.json({ conversations: hydrated });
});

apiRouter.get('/messages/:conversationId', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { conversationId } = req.params;
  const conversation = db.get().conversations.find(c => c.id === conversationId);
  if (!conversation || !conversation.participantUserIds.includes(userId)) {
    return res.status(403).json({ error: 'Conversation not accessible' });
  }

  // Mark messages as read
  db.update(d => {
    d.messages.forEach(m => {
      if (m.conversationId === conversationId && m.recipientUserId === userId) {
        m.isRead = true;
      }
    });
  });

  const messages = db.get().messages.filter(m => m.conversationId === conversationId);
  return res.json({ messages });
});

apiRouter.post('/messages/send', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { conversationId, content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content cannot be empty' });
  }

  const conversation = db.get().conversations.find(c => c.id === conversationId);
  if (!conversation || !conversation.participantUserIds.includes(userId)) {
    return res.status(403).json({ error: 'Not allowed to message in this conversation' });
  }

  const recipientUserId = conversation.participantUserIds.find(id => id !== userId)!;
  const myBiz = db.getBusinessProfileByUserId(userId);

  const message: Message = {
    id: 'msg_' + Math.random().toString(36).substring(2, 10),
    conversationId,
    senderUserId: userId,
    senderBusinessId: myBiz?.id || '',
    recipientUserId,
    content: content.trim(),
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  db.update(d => {
    d.messages.push(message);
    const conv = d.conversations.find(c => c.id === conversationId);
    if (conv) {
      conv.lastMessageSnippet = content.trim().substring(0, 60);
      conv.lastMessageAt = new Date().toISOString();
    }
    d.notifications.push({
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      userId: recipientUserId,
      type: 'new_message',
      title: 'New Message',
      message: `${myBiz?.businessName || 'A connection'} sent you a message.`,
      link: '/messages',
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  });

  return res.json({ success: true, message });
});

// ----------------------------------------------------
// OPPORTUNITIES
// ----------------------------------------------------

apiRouter.get('/opportunities', (req: Request, res: Response) => {
  const list = db.get().opportunities;
  return res.json({ opportunities: list });
});

apiRouter.post('/opportunities', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const myBiz = db.getBusinessProfileByUserId(userId);
  const { title, category, description, whatTheyNeed, location, quantity, budget, timeline, requirements } = req.body;

  if (!title || !category || !description) {
    return res.status(400).json({ error: 'Title, category, and description are required' });
  }

  const opp: Opportunity = {
    id: 'opp_' + Math.random().toString(36).substring(2, 10),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.update(d => {
    d.opportunities.unshift(opp);
  });

  return res.json({ success: true, opportunity: opp });
});

apiRouter.delete('/opportunities/:id', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const opp = db.get().opportunities.find(o => o.id === id);
  if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
  if (opp.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  db.update(d => {
    d.opportunities = d.opportunities.filter(o => o.id !== id);
  });

  return res.json({ success: true });
});

apiRouter.post('/opportunities/:id/respond', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { pitch, budgetQuote } = req.body;
  const opp = db.get().opportunities.find(o => o.id === id);
  if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

  const myBiz = db.getBusinessProfileByUserId(userId);

  db.update(d => {
    d.opportunity_responses.push({
      id: 'resp_' + Math.random().toString(36).substring(2, 10),
      opportunityId: id,
      userId,
      businessId: myBiz?.id || '',
      businessName: myBiz?.businessName || 'Enterprise Partner',
      pitch: pitch || '',
      budgetQuote: budgetQuote || '',
      createdAt: new Date().toISOString(),
    });
    const targetOpp = d.opportunities.find(o => o.id === id);
    if (targetOpp) {
      targetOpp.responsesCount += 1;
    }
    d.notifications.push({
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      userId: opp.userId,
      type: 'new_opportunity',
      title: 'New Opportunity Response',
      message: `${myBiz?.businessName || 'A business'} responded to your opportunity "${opp.title}".`,
      link: '/opportunities',
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  });

  return res.json({ success: true, message: 'Response submitted successfully' });
});

// ----------------------------------------------------
// SAVED LEADS & AI LEAD GENERATOR
// ----------------------------------------------------

apiRouter.get('/leads/saved', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const leads = db.get().saved_leads.filter(l => l.userId === userId);
  return res.json({ leads });
});

apiRouter.post('/leads/save', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { companyName, domain, contactName, contactRole, location, industry, score, targetBusinessId } = req.body;
  if (!companyName) return res.status(400).json({ error: 'Company name is required' });

  const lead: SavedLead = {
    id: 'lead_' + Math.random().toString(36).substring(2, 10),
    userId,
    targetBusinessId,
    companyName,
    domain,
    contactName,
    contactRole,
    location,
    industry,
    score: score || '95%',
    createdAt: new Date().toISOString(),
  };

  db.update(d => {
    d.saved_leads.push(lead);
  });

  return res.json({ success: true, lead });
});

apiRouter.delete('/leads/saved/:id', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  db.update(d => {
    d.saved_leads = d.saved_leads.filter(l => l.id !== id || l.userId !== userId);
  });
  return res.json({ success: true });
});

apiRouter.post('/leads/generate', async (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const { query, industry, location, businessType, count } = req.body;

  // Search actual registered businesses in NJS
  const allBusinesses = db.getAllPublicBusinesses().filter(b => b.userId !== userId);

  let filtered = allBusinesses;
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(b =>
      b.businessName.toLowerCase().includes(q) ||
      b.businessDescription.toLowerCase().includes(q) ||
      b.industry.toLowerCase().includes(q)
    );
  }
  if (industry) {
    filtered = filtered.filter(b => b.industry.toLowerCase().includes(industry.toLowerCase()));
  }

  // Real data: if none found, return empty per NO FAKE DATA specification!
  return res.json({ leads: filtered, total: filtered.length });
});

// ----------------------------------------------------
// OUTREACH DRAFTS
// ----------------------------------------------------

apiRouter.get('/outreach/drafts', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const drafts = db.get().outreach_drafts.filter(d => d.userId === userId);
  return res.json({ drafts });
});

apiRouter.post('/outreach/save-draft', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { leadName, goal, tone, content } = req.body;
  const draft: OutreachDraft = {
    id: 'draft_' + Math.random().toString(36).substring(2, 10),
    userId,
    leadName: leadName || 'Target Business',
    goal: goal || 'Intro & Discovery Call',
    tone: tone || 'Professional & Direct',
    content: content || '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.update(d => {
    d.outreach_drafts.unshift(draft);
  });

  return res.json({ success: true, draft });
});

apiRouter.post('/outreach/send', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { draftId, confirmedByHuman } = req.body;
  if (!confirmedByHuman) {
    return res.status(400).json({ error: 'Human review and approval is required before dispatching' });
  }

  db.update(d => {
    const dr = d.outreach_drafts.find(x => x.id === draftId && x.userId === userId);
    if (dr) {
      dr.status = 'sent';
      dr.updatedAt = new Date().toISOString();
    }
  });

  return res.json({ success: true, message: 'Outreach campaign successfully dispatched' });
});

// ----------------------------------------------------
// NOTIFICATIONS
// ----------------------------------------------------

apiRouter.get('/notifications', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const notifs = db.get().notifications.filter(n => n.userId === userId);
  return res.json({ notifications: notifs });
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

// ----------------------------------------------------
// DASHBOARD STATS
// ----------------------------------------------------

apiRouter.get('/dashboard/stats', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.json({
      matchesCount: 0,
      activeConnectionsCount: 0,
      savedLeadsCount: 0,
      openOpportunitiesCount: 0,
    });
  }

  const myBiz = db.getBusinessProfileByUserId(userId);
  const connectionsCount = db.get().connections.filter(c =>
    (c.requesterUserId === userId || c.targetUserId === userId) && c.status === 'accepted'
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
    openOpportunitiesCount,
  });
});
