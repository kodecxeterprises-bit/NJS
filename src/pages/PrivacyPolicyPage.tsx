import React, { useState } from 'react';

interface PrivacyPolicyPageProps {
  onNavigate: (path: string) => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ onNavigate }) => {
  const [activeSection, setActiveSection] = useState('overview');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col text-on-surface">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-2 text-primary font-bold text-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[20px]">hub</span>
              </div>
              <span className="text-[#2B2B2B]">NJS Platform</span>
            </button>
            <span className="text-outline-variant">/</span>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Privacy Policy
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('landing')}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-on-surface-variant hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Home
            </button>
            <button
              onClick={() => onNavigate('sign-in')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-on-surface hover:text-primary transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigate('sign-up')}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-gradient-to-b from-primary-fixed/20 to-surface py-12 px-4 sm:px-6 lg:px-8 border-b border-outline-variant/20">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span>Legal & Privacy Compliance</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl mx-auto">
            At NJS Platform, your business data confidentiality and sovereign privacy are paramount.
            Learn how we collect, protect, and handle your information across our B2B matchmaking network.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-outline font-medium pt-2">
            <span>Effective Date: October 5, 2025</span>
            <span>•</span>
            <span>Last Updated: October 2025</span>
            <span>•</span>
            <span>Version 2.1</span>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sticky Table of Contents Sidebar */}
        <aside className="lg:col-span-4 hidden lg:block">
          <div className="sticky top-24 p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">toc</span>
              Table of Contents
            </h3>
            <nav className="space-y-1 text-xs">
              {[
                { id: 'overview', title: '1. Overview & Commitment' },
                { id: 'collection', title: '2. Information We Collect' },
                { id: 'google-data', title: '3. Google API & User Data Policy' },
                { id: 'usage', title: '4. How We Use Your Information' },
                { id: 'ai-processing', title: '5. AI Processing & Matching' },
                { id: 'data-sharing', title: '6. Data Sharing & Disclosure' },
                { id: 'security', title: '7. Data Security & Storage' },
                { id: 'user-rights', title: '8. Your Rights (GDPR & CCPA)' },
                { id: 'retention', title: '9. Data Retention & Deletion' },
                { id: 'contact', title: '10. Contact Privacy Officer' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                    activeSection === item.id
                      ? 'bg-primary text-white font-semibold shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <span>{item.title}</span>
                  {activeSection === item.id && (
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="pt-4 border-t border-outline-variant/30">
              <div className="p-3 rounded-xl bg-orange-50 border border-primary/20 text-xs text-on-surface-variant space-y-1">
                <p className="font-semibold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">shield</span>
                  Enterprise Guarantee
                </p>
                <p className="text-[11px] leading-relaxed">
                  We never sell, rent, or monetize your company's proprietary data to third-party advertisers.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Body */}
        <main className="lg:col-span-8 space-y-10 text-on-surface">
          {/* Section 1 */}
          <section id="overview" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">01.</span> Overview & Scope
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              This Privacy Policy explains how <strong>NJS Platform</strong> ("we", "us", or "our") collects, uses, protects, and discloses personal and commercial information when you access or use our web applications, SaaS platform, B2B matchmaking directory, and related discovery services (collectively, the "Platform").
            </p>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              NJS Platform operates as a verified B2B collaboration ecosystem designed to empower businesses, suppliers, manufacturers, and buyers to discover strategic partnerships through intelligent AI matchmaking.
            </p>
          </section>

          {/* Section 2 */}
          <section id="collection" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">02.</span> Information We Collect
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              <p>We collect information in the following categories:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-on-surface">Account Credentials:</strong> Full name, professional work email address, encrypted password, and authentication tokens.
                </li>
                <li>
                  <strong className="text-on-surface">Business & Organization Profile:</strong> Company name, verified business address, operating industry, company size, website URL, target capabilities, products offered, and specific sourcing requirements.
                </li>
                <li>
                  <strong className="text-on-surface">Matchmaking Briefs & Requirements:</strong> Sourcing requests, commercial criteria, procurement budgets, and timeline parameters entered to generate match candidates.
                </li>
                <li>
                  <strong className="text-on-surface">Platform Communications:</strong> Direct messages, connection requests, and collaboration inquiries exchanged with verified peers on the network.
                </li>
                <li>
                  <strong className="text-on-surface">Technical & Usage Logs:</strong> IP address, browser type, operating system, and session timestamps used solely for security auditing and abuse prevention.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 - Google Specific Compliance */}
          <section id="google-data" className="space-y-4 scroll-mt-24 p-5 rounded-2xl bg-orange-50/60 border border-primary/20">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-primary/20 pb-2">
              <span className="text-primary font-mono text-base">03.</span> Google API & User Data Policy
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              When you opt to sign in with Google or authorize Google Workspace integrations (such as Gmail verification dispatch):
            </p>
            <div className="space-y-2 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              <p>
                <strong>Google Limited Use Disclosure:</strong> NJS Platform’s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                >
                  Google API Services User Data Policy
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
                , including the Limited Use requirements.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 pt-1">
                <li>
                  <strong>Human Oversight:</strong> We do not allow humans to read your private Google email messages or data, except with your explicit confirmation for security troubleshooting.
                </li>
                <li>
                  <strong>No Advertising Use:</strong> Information accessed through Google APIs is never used to serve targeted advertisements.
                </li>
                <li>
                  <strong>AI Training Prohibition:</strong> Data retrieved from Google APIs is never used to train generalized artificial intelligence or machine learning models.
                </li>
                <li>
                  <strong>Minimal Scopes:</strong> We strictly request only the scopes necessary to authenticate your identity (Email, Profile) and, when explicitly initiated by you, send verification authentication codes.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="usage" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">04.</span> How We Use Your Information
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              We process your data strictly to execute our core platform services:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                { icon: 'handshake', title: 'B2B Matchmaking', desc: 'Calculate compatibility scores between your business offerings and buyer sourcing requirements.' },
                { icon: 'verified', title: 'Business Verification', desc: 'Confirm enterprise legitimacy and prevent fraudulent actors from entering the directory.' },
                { icon: 'mail', title: 'System Notifications', desc: 'Deliver essential security alerts, connection responses, and transactional updates.' },
                { icon: 'analytics', title: 'Readiness Scoring', desc: 'Compute real-time profile completion indicators to optimize your inbound partner inquiries.' },
              ].map((card, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-1">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                    <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
                    <span>{card.title}</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5 */}
          <section id="ai-processing" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">05.</span> AI Processing & Data Sovereignty
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              NJS Platform leverages state-of-the-art AI technology to assist users in structuring commercial briefs, summarizing sourcing requirements, and finding relevant suppliers.
            </p>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              All AI interactions are processed through secured, zero-retention enterprise API endpoints. Your commercial trade secrets, private pricing negotiations, and customer data are never retained in training datasets.
            </p>
          </section>

          {/* Section 6 */}
          <section id="data-sharing" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">06.</span> Data Sharing & Disclosure
            </h2>
            <div className="space-y-2 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              <p>We do not sell, rent, or trade your data. Data is only shared in the following bounded contexts:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Public/Member Directory:</strong> Details you explicitly choose to include in your public business profile (e.g. company name, industry, service tags).</li>
                <li><strong>Mutual Connections:</strong> When both parties agree to connect, contact information is exchanged to facilitate commercial negotiations.</li>
                <li><strong>Infrastructure Service Providers:</strong> Encrypted hosting, cloud database providers, and payment processors bound by strict Data Processing Agreements (DPAs).</li>
                <li><strong>Legal Compliance:</strong> When required by enforceable court order or subpoena.</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section id="security" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">07.</span> Data Security & Storage
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              We employ bank-grade security protocols, including AES-256 encryption at rest, TLS 1.3 encryption in transit, strict role-based access control (RBAC), and automated vulnerability audits. All user passwords are cryptographic one-way salted hashes and cannot be read by platform personnel.
            </p>
          </section>

          {/* Section 8 */}
          <section id="user-rights" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">08.</span> Your Rights (GDPR & CCPA)
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Regardless of your geographic location, NJS Platform grants you the following statutory rights:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-on-surface-variant pt-1">
              <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/20">
                <p className="font-semibold text-on-surface mb-0.5">Right of Access & Portability</p>
                <p className="text-[11px]">Request an export of all personal and commercial data stored on your account.</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/20">
                <p className="font-semibold text-on-surface mb-0.5">Right to Erasure ("To Be Forgotten")</p>
                <p className="text-[11px]">Request permanent deletion of your profile, listings, and message history.</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/20">
                <p className="font-semibold text-on-surface mb-0.5">Right to Rectification</p>
                <p className="text-[11px]">Correct any inaccurate or incomplete organizational information at any time.</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/20">
                <p className="font-semibold text-on-surface mb-0.5">Right to Restrict Processing</p>
                <p className="text-[11px]">Withdraw consent for matchmaking algorithms or directory visibility.</p>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section id="retention" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">09.</span> Data Retention & Account Deletion
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              We retain account data for as long as your account remains active. Upon closing your account via Account Settings or by written request to our Data Protection Officer, your personal identifying records and company listings are permanently purged from active production systems within 30 days.
            </p>
          </section>

          {/* Section 10 */}
          <section id="contact" className="space-y-3 scroll-mt-24 pt-4 border-t border-outline-variant/30">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="text-primary font-mono text-base">10.</span> Contact Privacy Officer
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              For any questions, data subject requests, or privacy concerns, please contact our designated Data Protection Officer:
            </p>
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-sm text-on-surface">NJS Platform Legal & Privacy Team</p>
                <p className="text-xs text-on-surface-variant">Attn: Data Protection Officer</p>
                <p className="text-xs text-primary font-medium mt-1">privacy@njsplatform.com</p>
              </div>
              <button
                onClick={() => onNavigate('contact')}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                Open Support Ticket
              </button>
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-outline-variant/20 py-8 bg-surface-container-low text-xs text-on-surface-variant mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2025 NJS Platform. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <button onClick={() => onNavigate('terms')} className="hover:text-primary transition-colors">
              Terms of Service
            </button>
            <button onClick={() => onNavigate('contact')} className="hover:text-primary transition-colors">
              Contact Us
            </button>
            <button onClick={() => onNavigate('landing')} className="hover:text-primary transition-colors">
              Home
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
