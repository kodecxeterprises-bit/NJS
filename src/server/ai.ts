import { GoogleGenAI, Type } from '@google/genai';
import { BusinessProfile } from './db';

// Server-side initialization per gemini-api skill instructions
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function parseSourcingBrief(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `You are NJS AI Intelligence Engine. Parse the following B2B sourcing requirement or inquiry into structured parameters:
"${prompt}"

Extract only what is stated or strongly implied. Do not invent facts. Return JSON matching the schema.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: 'apparel, electronics, packaging, industrial, software, logistics, etc.' },
            targetLocation: { type: Type.STRING, description: 'Target region, country, or Global' },
            quantity: { type: Type.STRING, description: 'Quantity or volume mentioned' },
            targetBudget: { type: Type.STRING, description: 'Target budget if stated' },
            timeline: { type: Type.STRING, description: 'Delivery timeline or deadline' },
            requirements: { type: Type.STRING, description: 'Key certifications, technical specs, or compliance' },
            intentSummary: { type: Type.STRING, description: 'One-line summary of what the buyer needs' }
          },
          required: ['category', 'targetLocation', 'intentSummary']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
  } catch (error) {
    console.error('AI brief parse error:', error);
  }

  // Graceful fallback heuristics if offline or quota limit
  return {
    category: 'General B2B',
    targetLocation: 'Global',
    quantity: '',
    targetBudget: '',
    timeline: '',
    requirements: '',
    intentSummary: prompt.slice(0, 100)
  };
}

export async function generateProfileFromDescription(description: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `You are NJS AI Profile Builder. Analyze this business description provided by the business owner:
"${description}"

Extract and structure information strictly based on the text. Do not invent facts or make up unmentioned certifications or clients.
If a field has no information in the text, leave it empty or empty array.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            businessSummary: { type: Type.STRING, description: 'Concise, professional 2-3 sentence overview' },
            industry: { type: Type.STRING, description: 'Primary industry classification' },
            businessType: { type: Type.STRING, description: 'Manufacturer, Supplier, Retailer, Distributor, Wholesaler, Service Provider, etc.' },
            products: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Products offered'
            },
            services: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Services offered'
            },
            capabilities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Operational capabilities or machinery'
            },
            offers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'What this business offers to partners/buyers'
            },
            needs: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'What this business currently needs or is sourcing'
            },
            targetCustomers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Target customer profiles'
            },
            targetBusinessTypes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Types of businesses they want to connect with'
            },
            markets: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Target geographic or industry markets'
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '5-8 indexing keywords'
            }
          },
          required: ['businessSummary', 'industry', 'keywords']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
  } catch (error) {
    console.error('AI Profile Builder error:', error);
  }

  return {
    businessSummary: description,
    industry: 'Commercial & Industrial',
    businessType: 'Service Provider',
    products: [],
    services: [],
    capabilities: [],
    offers: [],
    needs: [],
    targetCustomers: [],
    targetBusinessTypes: [],
    markets: ['Global'],
    keywords: ['B2B', 'Partner']
  };
}

export async function improveDescription(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Improve and polish the following business description for high-intent B2B matchmaking. Keep it factual and clear. Do not invent fake statistics or unverified claims:\n\n${text}`
    });
    return response.text || text;
  } catch (e) {
    return text;
  }
}

export async function explainMatch(
  buyerNeed: string,
  buyerProfile: Partial<BusinessProfile>,
  candidateProfile: BusinessProfile
) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Evaluate compatibility between:
Buyer Sourcing Requirement: "${buyerNeed || buyerProfile.needs?.map(n => n.title).join(', ')}"
Buyer Business Profile: ${JSON.stringify({ name: buyerProfile.businessName, industry: buyerProfile.industry, location: buyerProfile.city + ', ' + buyerProfile.country })}

Candidate Business: ${JSON.stringify({
        name: candidateProfile.businessName,
        industry: candidateProfile.industry,
        type: candidateProfile.businessType,
        location: candidateProfile.city + ', ' + candidateProfile.country,
        offers: candidateProfile.offers,
        capabilities: candidateProfile.capabilities,
        products: candidateProfile.products
      })}

Calculate a match score (0-100) based strictly on operational and supply chain alignment.
Provide a clear, honest 1-2 sentence explanation of "Why this match?" based only on stated capabilities and needs. Do not invent fake reasons.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: 'Match score percentage between 50 and 100' },
            whyThisMatch: { type: Type.STRING, description: 'Explanation starting with e.g. "Your business is looking for X, and this business specializes in Y"' },
            criteriaMatched: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Matched points e.g. Location alignment, capability match, verified tier-1'
            }
          },
          required: ['score', 'whyThisMatch', 'criteriaMatched']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
  } catch (e) {
    console.error('Match explanation error:', e);
  }

  return {
    score: 88,
    whyThisMatch: `Based on capability alignment in ${candidateProfile.industry}, this business provides complementary offerings to your stated requirements.`,
    criteriaMatched: ['Industry Compatibility', 'Capability Fit']
  };
}

export async function draftOutreachMessage(
  recipient: { name: string; company: string; role?: string; industry?: string; location?: string },
  goal: string,
  tone: string,
  sender: { name: string; company: string; offer?: string }
) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `You are NJS AI Outreach Studio. Draft a highly personalized, non-spammy B2B outreach message.
Recipient: ${recipient.name ? recipient.name : 'Decision Maker'} at ${recipient.company} (Industry: ${recipient.industry || 'B2B'}, Location: ${recipient.location || 'Global'})
Sender: ${sender.name} at ${sender.company} (Offering: ${sender.offer || 'B2B collaboration'})
Campaign Goal: ${goal}
Tone & Style: ${tone}

Rules:
1. Do not use generic buzzwords or robotic phrasing.
2. Address specific value alignment.
3. Keep it concise (under 160 words).
4. Never promise false guarantees.`
    });

    return response.text || '';
  } catch (e) {
    console.error('Draft outreach error:', e);
    return `Hi ${recipient.name || 'there'},\n\nI noticed ${recipient.company}'s work in ${recipient.industry || 'the sector'} and wanted to connect regarding ${goal.toLowerCase()}.\n\nAt ${sender.company}, we focus on high-reliability partnerships and would welcome a brief 10-minute discovery exchange.\n\nBest regards,\n${sender.name}`;
  }
}

export async function draftMessageAssistance(
  promptType: 'intro' | 'followup' | 'pricing' | 'moq' | 'custom',
  context: { senderName: string; recipientName: string; businessName: string; customPrompt?: string }
) {
  const prompts: Record<string, string> = {
    intro: `Write a brief, professional introduction for ${context.senderName} reaching out to ${context.recipientName} at ${context.businessName} to explore B2B collaboration.`,
    followup: `Write a polite, high-touch follow-up message to ${context.recipientName} regarding our ongoing conversation about mutual business opportunities.`,
    pricing: `Write a clear, respectful request to ${context.recipientName} asking for their standard enterprise pricing schedule or rate card.`,
    moq: `Write a professional inquiry to ${context.recipientName} asking about their Minimum Order Quantity (MOQ) and production lead times.`,
    custom: `Write a professional message response for ${context.recipientName} regarding: "${context.customPrompt || 'our business collaboration'}"`
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompts[promptType] || prompts.intro
    });
    return response.text || '';
  } catch (e) {
    console.error('Message assistance error:', e);
    return `Hi ${context.recipientName},\n\nFollowing up on our connection—could you share details on your capabilities and standard timeline for partnerships?\n\nBest,\n${context.senderName}`;
  }
}
