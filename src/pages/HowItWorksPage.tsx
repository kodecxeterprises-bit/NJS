import React from 'react';

interface HowItWorksPageProps {
  onNavigate: (path: string) => void;
}

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onNavigate }) => {
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

      <main className="max-w-5xl mx-auto px-6 py-16 flex-1 space-y-16">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Architecture &amp; Process</span>
          <h1 className="text-4xl sm:text-5xl font-bold text-on-surface">How NJS Matchmaking Works</h1>
          <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
            NJS is not simply a directory. It is an AI-powered B2B intelligence engine designed to map intent, capacity, and supply-chain compatibility in real time.
          </p>
        </div>

        {/* 5-Step Process */}
        <div className="space-y-8">
          {[
            {
              step: '01',
              title: 'Business Profile Creation & Verification',
              desc: 'You specify verified company facts: what you offer, what you need, capabilities, and geographic reach. Our AI Profile Builder analyzes your natural language input without hallucinating fake claims.',
              icon: 'domain',
            },
            {
              step: '02',
              title: 'Intent & Requirement Parsing',
              desc: 'Instead of complex Boolean search syntax, write what you need in plain English: "I need 1,000 custom organic cotton shirts with delivery by Q3 in Western Europe." Gemini parses category, volume, timeline, and compliance.',
              icon: 'psychology',
            },
            {
              step: '03',
              title: 'Neural Cross-Compatibility Engine',
              desc: 'NJS cross-references what Business A offers with what Business B needs, while checking reverse synergies, location viability, and verified credentials.',
              icon: 'hub',
            },
            {
              step: '04',
              title: 'Transparent "Why This Match?" Insights',
              desc: 'Every match includes an explainable breakdown based on real data points. We never assign arbitrary random percentages or populate fake listings.',
              icon: 'auto_awesome',
            },
            {
              step: '05',
              title: 'Direct Connection & Assisted Outreach',
              desc: 'Send connection requests, draft high-intent communications with our AI assistant, and review every message before dispatching. Human approval is strictly maintained.',
              icon: 'handshake',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/30 shadow-xs flex flex-col md:flex-row items-start md:items-center gap-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-surface-container-low text-primary flex items-center justify-center font-extrabold text-2xl shrink-0 shadow-xs">
                {item.step}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-on-surface mb-2">{item.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center pt-8">
          <button
            onClick={() => onNavigate('sign-up')}
            className="px-8 py-4 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm shadow-md hover:opacity-90 cursor-pointer"
          >
            Create Your Enterprise Account
          </button>
        </div>
      </main>

      <footer className="bg-surface-container-low py-8 px-6 text-center text-xs text-on-surface-variant border-t border-outline-variant/30">
        © 2025 NJS Platform. All rights reserved.
      </footer>
    </div>
  );
};
