import React from 'react';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 px-6 lg:px-16 py-4 flex items-center justify-between">
        <div
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold text-lg shadow-xs">
            NJS
          </div>
          <span className="text-xl font-bold tracking-tight text-on-surface">NJS Platform</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-on-surface-variant">
          <button onClick={() => onNavigate('how-it-works')} className="hover:text-primary transition-colors cursor-pointer">
            How It Works
          </button>
          <button onClick={() => onNavigate('pricing')} className="hover:text-primary transition-colors cursor-pointer">
            Pricing
          </button>
          <button onClick={() => onNavigate('contact')} className="hover:text-primary transition-colors cursor-pointer">
            Contact
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('sign-in')}
            className="px-4 py-2 text-sm font-medium text-on-surface hover:text-primary transition-colors cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => onNavigate('sign-up')}
            className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-surface pt-16 pb-24 px-6 lg:px-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-6 flex flex-col items-start space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-low text-primary text-xs font-semibold shadow-xs">
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              <span>Next-Gen B2B Intelligence</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-on-surface tracking-tight leading-tight">
              Find the Right Business. <span className="text-primary">Faster.</span>
            </h1>

            <p className="text-base sm:text-lg text-on-surface-variant max-w-xl leading-relaxed">
              AI-powered business matchmaking that helps you discover customers, suppliers, partners, manufacturers and opportunities.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => onNavigate('sign-up')}
                className="px-7 py-3.5 rounded-xl bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 transition-all shadow-md cursor-pointer"
              >
                Get Started
              </button>
              <button
                onClick={() => onNavigate('how-it-works')}
                className="px-7 py-3.5 rounded-xl bg-surface-container-low text-on-surface text-sm font-semibold hover:bg-surface-container transition-all border border-outline-variant/30 cursor-pointer"
              >
                See How NJS Works
              </button>
            </div>

            <div className="flex items-center gap-6 pt-4 text-xs sm:text-sm text-outline">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                <span>Verified profiles only</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                <span>Instant AI matching</span>
              </div>
            </div>
          </div>

          {/* Interactive Network Graph Graphic */}
          <div className="lg:col-span-6 relative">
            <div className="relative w-full h-[400px] sm:h-[440px] bg-surface-container-low rounded-3xl p-8 flex items-center justify-center shadow-xl overflow-hidden border border-outline-variant/30">
              <div className="absolute inset-0 bg-gradient-to-br from-surface-container via-transparent to-primary/10" />

              <div className="relative z-10 w-full h-full flex items-center justify-center">
                {/* Central Pulse */}
                <div className="absolute w-36 h-36 rounded-full bg-primary-container/20 animate-ping" />
                <div className="w-24 h-24 rounded-2xl bg-primary text-on-primary shadow-xl flex flex-col items-center justify-center z-20">
                  <span className="material-symbols-outlined text-[32px]">hub</span>
                  <span className="text-xs font-bold mt-1">NJS Core</span>
                </div>

                {/* Floating Node 1: Customer */}
                <div className="absolute -top-2 left-4 sm:left-8 bg-surface-container-lowest p-3.5 rounded-2xl shadow-md flex items-center gap-3 border border-outline-variant/20 animate-bounce" style={{ animationDuration: '4s' }}>
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">Customer</p>
                    <p className="text-[11px] text-on-surface-variant">High intent buyer</p>
                  </div>
                </div>

                {/* Floating Node 2: Supplier */}
                <div className="absolute top-10 -right-2 sm:right-0 bg-surface-container-lowest p-3.5 rounded-2xl shadow-md flex items-center gap-3 border border-outline-variant/20 animate-bounce" style={{ animationDuration: '5s' }}>
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">Supplier</p>
                    <p className="text-[11px] text-on-surface-variant">Global logistics</p>
                  </div>
                </div>

                {/* Floating Node 3: Manufacturer */}
                <div className="absolute -bottom-4 left-6 sm:left-12 bg-surface-container-lowest p-3.5 rounded-2xl shadow-md flex items-center gap-3 border border-outline-variant/20 animate-bounce" style={{ animationDuration: '6s' }}>
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[20px]">factory</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">Manufacturer</p>
                    <p className="text-[11px] text-on-surface-variant">OEM &amp; ODM</p>
                  </div>
                </div>

                {/* Floating Node 4: Partner */}
                <div className="absolute bottom-6 -right-2 sm:right-2 bg-surface-container-lowest p-3.5 rounded-2xl shadow-md flex items-center gap-3 border border-outline-variant/20 animate-bounce" style={{ animationDuration: '4.5s' }}>
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[20px]">handshake</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">Partner</p>
                    <p className="text-[11px] text-on-surface-variant">Strategic alliance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: One platform for business discovery */}
      <section className="py-20 px-6 lg:px-16 bg-surface-container-low border-y border-outline-variant/30">
        <div className="max-w-7xl mx-auto space-y-14">
          <div className="flex flex-col items-center text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs text-primary uppercase tracking-widest font-bold">
              Comprehensive Discovery
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-on-surface">
              One platform for business discovery
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant">
              Access a unified ecosystem built to connect every tier of the modern commercial supply chain and partnership network.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-6 border border-outline-variant/30">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">group</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-on-surface">Find Customers</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Identify enterprise accounts and active buyers searching for your exact solutions.
                </p>
              </div>
              <button
                onClick={() => onNavigate('discover')}
                className="inline-flex items-center text-sm font-semibold text-primary hover:gap-2 transition-all cursor-pointer"
              >
                Explore customers <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
              </button>
            </div>

            {/* Card 2 */}
            <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-6 border border-outline-variant/30">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">inventory_2</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-on-surface">Find Suppliers</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Source dependable raw materials, components, and wholesale inventory sources worldwide.
                </p>
              </div>
              <button
                onClick={() => onNavigate('discover')}
                className="inline-flex items-center text-sm font-semibold text-primary hover:gap-2 transition-all cursor-pointer"
              >
                Explore suppliers <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
              </button>
            </div>

            {/* Card 3 */}
            <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-6 border border-outline-variant/30">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">precision_manufacturing</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-on-surface">Find Manufacturers</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Connect directly with certified factories and production plants for custom product fabrication.
                </p>
              </div>
              <button
                onClick={() => onNavigate('discover')}
                className="inline-flex items-center text-sm font-semibold text-primary hover:gap-2 transition-all cursor-pointer"
              >
                Explore manufacturers <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
              </button>
            </div>

            {/* Card 4 */}
            <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-6 border border-outline-variant/30">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">storefront</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-on-surface">Find Retailers</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Expand distribution channels by partnering with established retail chains and storefronts.
                </p>
              </div>
              <button
                onClick={() => onNavigate('discover')}
                className="inline-flex items-center text-sm font-semibold text-primary hover:gap-2 transition-all cursor-pointer"
              >
                Explore retailers <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
              </button>
            </div>

            {/* Card 5 */}
            <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-6 border border-outline-variant/30">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">diversity_3</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-on-surface">Find Partners</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Forge strategic joint ventures, channel partnerships, and collaborative alliances.
                </p>
              </div>
              <button
                onClick={() => onNavigate('discover')}
                className="inline-flex items-center text-sm font-semibold text-primary hover:gap-2 transition-all cursor-pointer"
              >
                Explore partners <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
              </button>
            </div>

            {/* Card 6 */}
            <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-6 border border-outline-variant/30">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">trending_up</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-on-surface">Generate Leads</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Deploy autonomous AI agents to build high-converting prospect lists tailored to your criteria.
                </p>
              </div>
              <button
                onClick={() => onNavigate('ai-lead-generator')}
                className="inline-flex items-center text-sm font-semibold text-primary hover:gap-2 transition-all cursor-pointer"
              >
                Explore lead generation <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: How NJS works */}
      <section className="py-20 px-6 lg:px-16 bg-surface">
        <div className="max-w-7xl mx-auto space-y-14">
          <div className="flex flex-col items-center text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs text-primary uppercase tracking-widest font-bold">
              Workflow
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-on-surface">
              How NJS works
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant">
              Five simple steps to transform how your organization discovers and establishes valuable commercial relationships.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col space-y-3 border border-outline-variant/20">
              <div className="text-xs text-primary font-bold">01</div>
              <h3 className="text-lg font-bold text-on-surface">Profile</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Complete your verified corporate profile with core capabilities and certifications.
              </p>
            </div>

            <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col space-y-3 border border-outline-variant/20">
              <div className="text-xs text-primary font-bold">02</div>
              <h3 className="text-lg font-bold text-on-surface">Offers</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Publish what you sell, supply, or manufacture with precise technical parameters.
              </p>
            </div>

            <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col space-y-3 border border-outline-variant/20">
              <div className="text-xs text-primary font-bold">03</div>
              <h3 className="text-lg font-bold text-on-surface">Needs</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Define what your business requires right now to scale operations or fill gaps.
              </p>
            </div>

            <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col space-y-3 border border-outline-variant/20">
              <div className="text-xs text-primary font-bold">04</div>
              <h3 className="text-lg font-bold text-on-surface">AI Discovery</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Let our proprietary matching engine scan and filter global commercial networks.
              </p>
            </div>

            <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col space-y-3 border border-outline-variant/20">
              <div className="text-xs text-primary font-bold">05</div>
              <h3 className="text-lg font-bold text-on-surface">Connect</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Initiate secure outreach and establish direct communication with verified decision-makers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Search less. Match smarter. */}
      <section className="py-20 px-6 lg:px-16 bg-surface-container-low border-y border-outline-variant/30">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs text-primary uppercase tracking-widest font-bold">
              Intelligence Engine
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-on-surface">
              Search less. Match smarter.
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
              Traditional directories and search engines waste hundreds of hours filtering outdated data. NJS uses deep contextual AI understanding to map intent, operational scale, and fulfillment capabilities in real-time.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">Real-Time Intent Analysis</h4>
                  <p className="text-xs sm:text-sm text-on-surface-variant">
                    Detects active procurement cycles and partnership readiness instantly.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">Verified Enterprise Data</h4>
                  <p className="text-xs sm:text-sm text-on-surface-variant">
                    Every company entity is cross-referenced against global registries.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-surface-container-lowest p-8 rounded-3xl shadow-sm space-y-6 border border-outline-variant/30">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
              <span className="text-sm font-bold text-on-surface">AI Match Confidence Score</span>
              <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold">
                98.4% Match
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-on-surface-variant">Operational Compatibility</span>
                  <span className="text-on-surface font-semibold">High</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '95%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-on-surface-variant">Supply Chain Alignment</span>
                  <span className="text-on-surface font-semibold">Optimal</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '90%' }} />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low text-xs sm:text-sm text-on-surface-variant border border-outline-variant/20 italic">
              "NJS reduced our supplier onboarding timeline from 4 weeks to 3 days using automated AI matchmaking."
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Built for every type of business */}
      <section className="py-20 px-6 lg:px-16 bg-surface">
        <div className="max-w-7xl mx-auto space-y-14">
          <div className="flex flex-col items-center text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs text-primary uppercase tracking-widest font-bold">
              Versatility
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-on-surface">
              Built for every type of business
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant">
              Scalable matchmaking tailored to the unique operational demands of your industry sector.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Manufacturers', icon: 'factory' },
              { label: 'Retailers', icon: 'storefront' },
              { label: 'Distributors', icon: 'local_shipping' },
              { label: 'Agencies', icon: 'support_agent' },
              { label: 'Service Businesses', icon: 'business_center' },
              { label: 'Wholesalers', icon: 'inventory' },
              { label: 'Startups', icon: 'rocket_launch' },
              { label: 'Enterprises', icon: 'apartment' },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-surface-container-low p-6 rounded-2xl flex flex-col items-center text-center space-y-3 border border-outline-variant/20 hover:border-primary transition-all"
              >
                <span className="material-symbols-outlined text-[32px] text-primary">{item.icon}</span>
                <h3 className="text-sm font-bold text-on-surface">{item.label}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6 lg:px-16 bg-surface-container-low">
        <div className="max-w-5xl mx-auto bg-primary-container text-on-primary-container rounded-3xl p-10 sm:p-14 text-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary to-transparent opacity-30 pointer-events-none" />
          <div className="relative z-10 space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Ready to find your next business opportunity?
            </h2>
            <p className="text-sm sm:text-base opacity-90 leading-relaxed">
              Join thousands of companies leveraging AI matchmaking to discover high-value partners and customers today.
            </p>
          </div>
          <div className="relative z-10 flex justify-center pt-2">
            <button
              onClick={() => onNavigate('sign-up')}
              className="px-8 py-4 rounded-xl bg-surface-container-lowest text-on-surface text-sm font-bold hover:opacity-90 transition-all shadow-md cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-container-low py-14 px-6 lg:px-16 border-t border-outline-variant/30">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-primary">
              <span className="material-symbols-outlined text-[26px]">hub</span>
              <span>NJS Platform</span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              AI-powered B2B business matchmaking and opportunity discovery platform.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold text-on-surface tracking-wider">Platform</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-on-surface-variant">
              <li><button onClick={() => onNavigate('dashboard')} className="hover:text-primary">Overview</button></li>
              <li><button onClick={() => onNavigate('discover')} className="hover:text-primary">Discover</button></li>
              <li><button onClick={() => onNavigate('ai-matches')} className="hover:text-primary">AI Matches</button></li>
              <li><button onClick={() => onNavigate('opportunities')} className="hover:text-primary">Opportunities</button></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold text-on-surface tracking-wider">Solutions</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-on-surface-variant">
              <li><button onClick={() => onNavigate('discover')} className="hover:text-primary">For Manufacturers</button></li>
              <li><button onClick={() => onNavigate('discover')} className="hover:text-primary">For Suppliers</button></li>
              <li><button onClick={() => onNavigate('discover')} className="hover:text-primary">For Retailers</button></li>
              <li><button onClick={() => onNavigate('discover')} className="hover:text-primary">Enterprise</button></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold text-on-surface tracking-wider">Company</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-on-surface-variant">
              <li><button onClick={() => onNavigate('how-it-works')} className="hover:text-primary">About Us</button></li>
              <li><button onClick={() => onNavigate('contact')} className="hover:text-primary">Contact</button></li>
              <li><button onClick={() => onNavigate('privacy')} className="hover:text-primary font-medium">Privacy Policy</button></li>
              <li><button onClick={() => onNavigate('terms')} className="hover:text-primary font-medium">Terms of Service</button></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-outline-variant/20 flex flex-col md:flex-row items-center justify-between text-xs text-outline">
          <p>© 2025 NJS Platform. All rights reserved.</p>
          <div className="flex items-center gap-6 mt-3 md:mt-0">
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              All systems operational
            </span>
            <button onClick={() => onNavigate('privacy')} className="hover:text-primary">Security & Compliance</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
