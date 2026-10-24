import React from 'react';

interface PricingPageProps {
  onNavigate: (path: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 px-6 lg:px-16 py-4 flex items-center justify-between">
        <div onClick={() => onNavigate('landing')} className="flex items-center gap-2 cursor-pointer select-none">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold text-lg">
            NJS
          </div>
          <span className="text-xl font-bold tracking-tight text-on-surface">NJS Platform</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('sign-in')} className="text-sm font-medium hover:text-primary">
            Sign In
          </button>
          <button onClick={() => onNavigate('sign-up')} className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 shadow-xs">
            Get Started
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 flex-1">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Transparent Pricing</span>
          <h1 className="text-4xl sm:text-5xl font-bold text-on-surface">Scalable plans for every enterprise</h1>
          <p className="text-sm sm:text-base text-on-surface-variant">
            Connect directly with verified partners. Structure your subscription around high-intent procurement and precision matchmaking.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Free Tier */}
          <div className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/30 shadow-xs flex flex-col justify-between">
            <div>
              <span className="px-3 py-1 rounded-full bg-surface-container text-xs font-bold uppercase text-on-surface-variant">
                Free Forever
              </span>
              <h2 className="text-2xl font-bold text-on-surface mt-4">Starter Discovery</h2>
              <p className="text-xs text-on-surface-variant mt-1">Explore verified suppliers and directories.</p>
              <div className="my-6">
                <span className="text-4xl font-extrabold text-on-surface">$0</span>
                <span className="text-xs text-on-surface-variant ml-1">/ month</span>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-on-surface">
                <li className="flex items-center gap-2">✓ Verified Corporate Profile</li>
                <li className="flex items-center gap-2">✓ Directory Search &amp; Filters</li>
                <li className="flex items-center gap-2">✓ 5 AI Brief Parses / month</li>
                <li className="flex items-center gap-2">✓ Direct Messaging on Connect</li>
              </ul>
            </div>
            <button
              onClick={() => onNavigate('sign-up')}
              className="mt-8 w-full py-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-sm font-semibold text-on-surface transition-colors cursor-pointer"
            >
              Get Started Free
            </button>
          </div>

          {/* Pro Tier */}
          <div className="bg-surface-container-lowest rounded-3xl p-8 border-2 border-primary shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-primary text-on-primary text-[10px] uppercase font-bold px-2.5 py-1 rounded-full">
              Recommended
            </div>
            <div>
              <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold uppercase">
                Pro Sourcing
              </span>
              <h2 className="text-2xl font-bold text-on-surface mt-4">Active Procurement</h2>
              <p className="text-xs text-on-surface-variant mt-1">For businesses actively sourcing suppliers.</p>
              <div className="my-6">
                <span className="text-2xl font-bold text-primary">Coming Soon</span>
                <span className="text-xs text-on-surface-variant block mt-1">Tiered enterprise subscription</span>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-on-surface">
                <li className="flex items-center gap-2">✓ Priority Neural Match Engine</li>
                <li className="flex items-center gap-2">✓ Unlimited AI Brief Interpretations</li>
                <li className="flex items-center gap-2">✓ Automated Lead Generator &amp; Crawler</li>
                <li className="flex items-center gap-2">✓ Multi-Channel AI Outreach Studio</li>
                <li className="flex items-center gap-2">✓ Priority RFP Placement</li>
              </ul>
            </div>
            <button
              disabled
              className="mt-8 w-full py-3 rounded-xl bg-primary-container text-on-primary-container text-sm font-semibold opacity-75 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>

          {/* Enterprise Tier */}
          <div className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/30 shadow-xs flex flex-col justify-between">
            <div>
              <span className="px-3 py-1 rounded-full bg-surface-container text-xs font-bold uppercase text-on-surface-variant">
                Enterprise Custom
              </span>
              <h2 className="text-2xl font-bold text-on-surface mt-4">Custom Pipeline</h2>
              <p className="text-xs text-on-surface-variant mt-1">Dedicated supply-chain matching and API access.</p>
              <div className="my-6">
                <span className="text-2xl font-bold text-on-surface">Coming Soon</span>
                <span className="text-xs text-on-surface-variant block mt-1">Custom SLA &amp; dedicated agents</span>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-on-surface">
                <li className="flex items-center gap-2">✓ Bespoke ERP &amp; API Integration</li>
                <li className="flex items-center gap-2">✓ Dedicated Sourcing Director</li>
                <li className="flex items-center gap-2">✓ Custom SOC2 &amp; Compliance Audits</li>
                <li className="flex items-center gap-2">✓ Global Supplier Onboarding Support</li>
              </ul>
            </div>
            <button
              onClick={() => onNavigate('contact')}
              className="mt-8 w-full py-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-sm font-semibold text-on-surface transition-colors cursor-pointer"
            >
              Contact Enterprise Sales
            </button>
          </div>
        </div>
      </main>

      <footer className="bg-surface-container-low py-8 px-6 text-center text-xs text-on-surface-variant border-t border-outline-variant/30">
        © 2025 NJS Platform. All rights reserved.
      </footer>
    </div>
  );
};
