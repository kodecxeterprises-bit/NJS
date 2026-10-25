
import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  supabaseUserId?: string;
  name: string;
  email: string;
  passwordHash: string;
  profileImage?: string;
  isEmailVerified: boolean;
  verificationCode?: string;
  businessProfileId?: string;
  createdAt: string;
  updatedAt: string;
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
  businessType: 'Supplier' | 'Manufacturer' | 'Retailer' | 'Distributor' | 'Wholesaler' | 'Service Provider' | 'Enterprise B2B' | 'Startup' | 'Agency' | string;
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
  userBusinessId: string;
  matchedBusinessId: string;
  score: number;
  whyThisMatch: string;
  criteriaMatched: string[];
  requestId?: string;
  status: 'new' | 'viewed' | 'connected' | 'dismissed';
  createdAt: string;
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
  updatedAt: string;
}

export interface Conversation {
  id: string;
  participantUserIds: [string, string];
  participantBusinessIds: [string, string];
  lastMessageSnippet?: string;
  lastMessageAt?: string;
  createdAt: string;
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

export interface OpportunityResponse {
  id: string;
  opportunityId: string;
  userId: string;
  businessId: string;
  businessName: string;
  pitch: string;
  budgetQuote?: string;
  createdAt: string;
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

export interface LeadSearch {
  id: string;
  userId: string;
  query: string;
  industry?: string;
  location?: string;
  businessType?: string;
  leadCount: number;
  requirements?: string;
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
  type: 'connection_request' | 'connection_accepted' | 'new_message' | 'new_opportunity' | 'match_generated' | 'lead_generation_completed';
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: 'free' | 'pro' | 'business';
  status: 'active' | 'trial' | 'pending';
  creditsAvailable: number;
  updatedAt: string;
}

export interface AIRequestLog {
  id: string;
  userId: string;
  type: 'parse_brief' | 'match_explanation' | 'profile_builder' | 'outreach_draft' | 'message_assist';
  prompt: string;
  response: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: User[];
  business_profiles: BusinessProfile[];
  matches: BusinessMatch[];
  connections: Connection[];
  conversations: Conversation[];
  messages: Message[];
  opportunities: Opportunity[];
  opportunity_responses: OpportunityResponse[];
  saved_leads: SavedLead[];
  lead_searches: LeadSearch[];
  outreach_drafts: OutreachDraft[];
  notifications: Notification[];
  subscriptions: Subscription[];
  ai_requests: AIRequestLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

class DatabaseStore {
  private data: DatabaseSchema = {
    users: [],
    business_profiles: [],
    matches: [],
    connections: [],
    conversations: [],
    messages: [],
    opportunities: [],
    opportunity_responses: [],
    saved_leads: [],
    lead_searches: [],
    outreach_drafts: [],
    notifications: [],
    subscriptions: [],
    ai_requests: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.save();
      }
    } catch (e) {
      console.error('Failed to initialize database file:', e);
    }
  }

  private save() {
    try {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(this.data, null, 2),
        'utf-8'
      );
    } catch (e) {
      console.error('Failed to write database file:', e);
    }
  }

  public get(): DatabaseSchema {
    return this.data;
  }

  public update(fn: (db: DatabaseSchema) => void) {
    fn(this.data);
    this.save();
  }

  // Users
  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  // Find an existing NJS account linked to a Supabase user.
  public findUserBySupabaseId(
    supabaseUserId: string
  ): User | undefined {
    return this.data.users.find(
      u => u.supabaseUserId === supabaseUserId
    );
  }

  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(
      u => u.email.toLowerCase() === email.toLowerCase()
    );
  }

  public createUser(user: User): User {
    this.data.users.push(user);

    // Auto-create the free subscription with credits.
    this.data.subscriptions.push({
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      userId: user.id,
      plan: 'free',
      status: 'active',
      creditsAvailable: 4850,
      updatedAt: new Date().toISOString(),
    });

    this.save();
    return user;
  }

  public updateUser(
    id: string,
    updates: Partial<User>
  ): User | undefined {
    const user = this.findUserById(id);
    if (!user) return undefined;

    Object.assign(user, updates, {
      updatedAt: new Date().toISOString(),
    });

    this.save();
    return user;
  }

  // Business Profiles
  public getBusinessProfileByUserId(
    userId: string
  ): BusinessProfile | undefined {
    return this.data.business_profiles.find(
      p => p.userId === userId
    );
  }

  public getBusinessProfileById(
    id: string
  ): BusinessProfile | undefined {
    return this.data.business_profiles.find(p => p.id === id);
  }

  public getAllPublicBusinesses(): BusinessProfile[] {
    return this.data.business_profiles;
  }

  public upsertBusinessProfile(
    profile: BusinessProfile
  ): BusinessProfile {
    const idx = this.data.business_profiles.findIndex(
      p => p.id === profile.id || p.userId === profile.userId
    );

    if (idx >= 0) {
      this.data.business_profiles[idx] = {
        ...this.data.business_profiles[idx],
        ...profile,
        updatedAt: new Date().toISOString(),
      };
    } else {
      this.data.business_profiles.push(profile);
    }

    // Maintain the user-to-business-profile link.
    const user = this.findUserById(profile.userId);
    if (user && user.businessProfileId !== profile.id) {
      user.businessProfileId = profile.id;
    }

    this.save();
    return profile;
  }
}

export const db = new DatabaseStore();
