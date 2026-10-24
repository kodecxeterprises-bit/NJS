export interface User {
  id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  businessProfileId?: string;
  createdAt?: string;
}

export interface BusinessProduct {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

export interface BusinessService {
  id: string;
  name: string;
  description?: string;
}

export interface BusinessNeed {
  id: string;
  title: string;
  category: string;
  details?: string;
  budget?: string;
  urgency?: 'immediate' | 'medium' | 'flexible';
}

export interface BusinessOffer {
  id: string;
  title: string;
  category: string;
  details?: string;
  capacity?: string;
}

export interface BusinessProfile {
  id: string;
  userId: string;
  businessName: string;
  businessType: string;
  industry: string;
  country: string;
  city: string;
  website: string;
  phone: string;
  businessDescription: string;
  products: BusinessProduct[];
  services: BusinessService[];
  capabilities: string[];
  offers: BusinessOffer[];
  needs: BusinessNeed[];
  targetCustomers: string[];
  targetSuppliers: string[];
  targetManufacturers: string[];
  targetPartners: string[];
  targetMarkets: string[];
  businessGoals: string[];
  businessKeywords: string[];
  isVerified?: boolean;
  reviewScore?: number;
  reviewCount?: number;
  onboardingStep?: string;
  onboardingCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessMatch {
  id: string;
  candidateBusiness: BusinessProfile;
  score: number;
  whyThisMatch: string;
  criteriaMatched: string[];
}

export interface Connection {
  id: string;
  requesterUserId: string;
  requesterBusinessId: string;
  targetUserId: string;
  targetBusinessId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'removed';
  message?: string;
  createdAt: string;
  isInitiator?: boolean;
  partnerBusiness?: BusinessProfile;
}

export interface Conversation {
  id: string;
  participantUserIds: [string, string];
  participantBusinessIds: [string, string];
  lastMessageSnippet?: string;
  lastMessageAt?: string;
  createdAt: string;
  partnerUser?: { id?: string; name?: string };
  partnerBusiness?: BusinessProfile;
  unreadCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderBusinessId: string;
  recipientUserId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Opportunity {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  title: string;
  category: string;
  description: string;
  whatTheyNeed: string;
  location: string;
  quantity?: string;
  budget?: string;
  timeline?: string;
  requirements?: string;
  status: 'open' | 'in_progress' | 'closed';
  responsesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedLead {
  id: string;
  userId: string;
  targetBusinessId?: string;
  companyName: string;
  domain?: string;
  contactName?: string;
  contactRole?: string;
  location?: string;
  industry?: string;
  score?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

export interface OutreachDraft {
  id: string;
  userId: string;
  leadId?: string;
  leadName: string;
  goal: string;
  tone: string;
  content: string;
  status: 'draft' | 'approved' | 'sent';
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Subscription {
  plan: 'free' | 'pro' | 'business';
  creditsAvailable: number;
}
