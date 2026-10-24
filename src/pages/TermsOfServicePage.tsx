import React, { useState } from 'react';

interface TermsOfServicePageProps {
  onNavigate: (path: string) => void;
}

export const TermsOfServicePage: React.FC<TermsOfServicePageProps> = ({ onNavigate }) => {
  const [activeSection, setActiveSection] = useState('acceptance');

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
              Terms of Service
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
            <span className="material-symbols-outlined text-[16px]">gavel</span>
            <span>Commercial Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
            Terms of Service
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl mx-auto">
            These Terms govern your enterprise access to the NJS Platform B2B matchmaking network,
            AI brief tools, and commercial opportunities discovery.
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
              <span className="material-symbols-outlined text-[18px] text-primary">menu_book</span>
              Summary & Articles
            </h3>
            <nav className="space-y-1 text-xs">
              {[
                { id: 'acceptance', title: '1. Acceptance of Terms' },
                { id: 'eligibility', title: '2. Eligibility & Verification' },
                { id: 'accounts', title: '3. Accounts & Authentication' },
                { id: 'acceptable-use', title: '4. Zero Spam & Code of Conduct' },
                { id: 'ai-tools', title: '5. AI Matching & Brief Tools' },
                { id: 'subscriptions', title: '6. Billing & Subscriptions' },
                { id: 'intellectual-property', title: '7. Intellectual Property' },
                { id: 'disclaimers', title: '8. Warranties & Disclaimers' },
                { id: 'liability', title: '9. Limitation of Liability' },
                { id: 'termination', title: '10. Termination & Disputes' },
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
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  Verified Business Only
                </p>
                <p className="text-[11px] leading-relaxed">
                  Only authentic commercial organizations are allowed. Misrepresentation results in instant suspension.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Body */}
        <main className="lg:col-span-8 space-y-10 text-on-surface">
          {/* Section 1 */}
          <section id="acceptance" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">01.</span> Acceptance of Terms
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              By accessing, browsing, or creating an account on <strong>NJS Platform</strong> ("Platform", "we", "us", or "Service"), you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you are entering into this agreement on behalf of a company, corporation, or other legal entity, you represent and warrant that you possess the lawful authority to bind such entity to these Terms.
            </p>
          </section>

          {/* Section 2 */}
          <section id="eligibility" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">02.</span> Eligibility & Business Verification
            </h2>
            <div className="space-y-2 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              <p>To use NJS Platform, you must meet the following criteria:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>You must be at least 18 years of age and legally capable of forming binding contracts.</li>
                <li>You must represent a genuine, operating business, supplier, vendor, manufacturer, consultancy, or commercial entity.</li>
                <li>You must submit accurate, verifiable business information including valid company registration, corporate email, and corporate physical or principal office address.</li>
                <li>We reserve the unilateral right to request additional verification documents or decline access to any entity attempting to create synthetic, deceptive, or non-commercial accounts.</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section id="accounts" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">03.</span> Accounts, Security & Authentication
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              You are responsible for safeguarding your login credentials (passwords, multi-factor codes, or third-party authentication tokens). You agree to immediately notify NJS Platform at <code>security@njsplatform.com</code> if you detect any unauthorized access to your account. NJS Platform shall not be liable for losses arising from compromised user credentials.
            </p>
          </section>

          {/* Section 4 */}
          <section id="acceptable-use" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">04.</span> Zero Spam & Acceptable Use Policy
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              <p>NJS Platform is a professional matchmaking ecosystem. Users strictly agree <strong>NOT</strong> to:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/30">
                  <p className="font-semibold text-error flex items-center gap-1.5 text-xs mb-1">
                    <span className="material-symbols-outlined text-[16px]">block</span>
                    No Unsolicited Bulk Spam
                  </p>
                  <p className="text-[11px]">Sending mass repetitive cold pitches, automated bot outreach, or untargeted spam is strictly prohibited.</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/30">
                  <p className="font-semibold text-error flex items-center gap-1.5 text-xs mb-1">
                    <span className="material-symbols-outlined text-[16px]">screen_search_desktop</span>
                    No Unauthorized Scraping
                  </p>
                  <p className="text-[11px]">Using automated bots, crawlers, or scrapers to extract member business directories or leads is illegal.</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/30">
                  <p className="font-semibold text-error flex items-center gap-1.5 text-xs mb-1">
                    <span className="material-symbols-outlined text-[16px]">person_cancel</span>
                    No Deceptive Impersonation
                  </p>
                  <p className="text-[11px]">Claiming affiliation with brands, trademarks, or businesses you do not legally represent.</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/30">
                  <p className="font-semibold text-error flex items-center gap-1.5 text-xs mb-1">
                    <span className="material-symbols-outlined text-[16px]">security</span>
                    No Exploits or Vulnerability Probing
                  </p>
                  <p className="text-[11px]">Attempting to probe, scan, or breach platform infrastructure or rate limits.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section id="ai-tools" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">05.</span> AI Matchmaking & Brief Generation
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              NJS Platform provides artificial intelligence tools to assist businesses in formulating procurement briefs, identifying potential vendors, and computing compatibility scores.
            </p>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              <strong>Due Diligence Disclaimer:</strong> AI match recommendations and compatibility scores are advisory calculations based on user-supplied criteria. NJS Platform does not endorse, guarantee, or underwrite the creditworthiness, quality of service, or financial solvency of matched businesses. Parties must perform their own commercial, legal, and operational due diligence prior to signing commercial agreements.
            </p>
          </section>

          {/* Section 6 */}
          <section id="subscriptions" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">06.</span> Billing, Subscriptions & Cancellations
            </h2>
            <div className="space-y-2 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Subscription Plans:</strong> NJS Platform offers Starter, Professional, and Enterprise subscriptions billed either monthly or annually.</li>
                <li><strong>Automatic Renewal:</strong> Paid plans automatically renew at the conclusion of each billing period unless cancelled through Account Settings prior to the renewal date.</li>
                <li><strong>Refund Policy:</strong> Due to immediate provisioning of matchmaking compute resources, fees paid are non-refundable except where required by applicable local law.</li>
                <li><strong>Taxes:</strong> All listed fees are exclusive of applicable value-added, sales, or goods and services taxes.</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section id="intellectual-property" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">07.</span> Intellectual Property & Content Rights
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              <strong>Your Content:</strong> You retain full title, ownership, and intellectual property rights in and to all business profiles, logos, descriptions, and materials you upload to NJS Platform. You grant us a worldwide, non-exclusive license solely to host, display, and analyze your data to deliver the matchmaking services.
            </p>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              <strong>Platform Property:</strong> The NJS Platform software, user interface design, logos, matchmaking algorithms, and documentation are the exclusive proprietary property of NJS Platform.
            </p>
          </section>

          {/* Section 8 */}
          <section id="disclaimers" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">08.</span> Warranties & Disclaimers
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              THE PLATFORM AND SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT UNINTERRUPTED OR ERROR-FREE OPERATION.
            </p>
          </section>

          {/* Section 9 */}
          <section id="liability" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
              <span className="text-primary font-mono text-base">09.</span> Limitation of Liability
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL NJS PLATFORM OR ITS DIRECTORS, EMPLOYEES, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES (INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS GOODWILL) ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO OR USE OF THE PLATFORM. OUR AGGREGATE LIABILITY SHALL NOT EXCEED THE TOTAL AMOUNT PAID BY YOU TO NJS PLATFORM IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          {/* Section 10 */}
          <section id="termination" className="space-y-3 scroll-mt-24 pt-4 border-t border-outline-variant/30">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="text-primary font-mono text-base">10.</span> Termination & Governing Law
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              We reserve the right to suspend or terminate accounts that breach these Terms, with or without notice. These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which NJS Platform is incorporated, without regard to its conflict of law provisions.
            </p>
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
              <div>
                <p className="font-bold text-sm text-on-surface">Have legal questions regarding these Terms?</p>
                <p className="text-xs text-on-surface-variant">Our compliance counsel is available for commercial inquiries.</p>
                <p className="text-xs text-primary font-medium mt-1">legal@njsplatform.com</p>
              </div>
              <button
                onClick={() => onNavigate('contact')}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                Contact Legal
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
            <button onClick={() => onNavigate('privacy')} className="hover:text-primary transition-colors">
              Privacy Policy
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
