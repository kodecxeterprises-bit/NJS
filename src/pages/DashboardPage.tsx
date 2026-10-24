import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface DashboardPageProps {
  onNavigate: (path: string, state?: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, apiFetch } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [stats, setStats] = useState({
    matchesCount: 0,
    activeConnectionsCount: 0,
    savedLeadsCount: 0,
    openOpportunitiesCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await apiFetch('/api/dashboard/stats');
        setStats(data);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  const handleAskNjs = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onNavigate('ai-matches', { initialBrief: searchInput.trim() });
    } else {
      onNavigate('ai-matches');
    }
  };

  return (
    <div className="flex flex-col w-full relative">
      {/* Top decorative background blur / glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-primary-container/10 via-surface-container/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Hero Section */}
      <section className="flex flex-col pt-4 sm:pt-8 pb-10 max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low text-primary text-xs font-semibold mb-6 w-fit shadow-xs">
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          <span>AI-Powered B2B Platform</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-on-surface tracking-tight mb-3">
          Welcome to NJS
        </h1>

        <p className="text-base sm:text-lg text-on-surface-variant max-w-2xl mb-8">
          Let's find the right business opportunities for you. Use our intelligent search below or get started with your empty workspace.
        </p>

        {/* Main AI Search Bar Component */}
        <form
          onSubmit={handleAskNjs}
          className="bg-surface-container-lowest p-3 rounded-2xl shadow-xl shadow-on-surface/5 flex flex-col md:flex-row items-center gap-3 border border-outline-variant/30"
        >
          <div className="flex items-center gap-3 px-3 w-full flex-1">
            <span className="material-symbols-outlined text-primary text-[24px]">psychology</span>
            <div className="flex flex-col w-full">
              <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                What are you looking for?
              </label>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Find manufacturers for my clothing business..."
                className="bg-transparent border-none outline-none text-base text-on-surface placeholder:text-on-surface-variant/40 w-full py-1"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full md:w-auto bg-primary-container text-on-primary-container px-6 py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity shrink-0 shadow-sm cursor-pointer"
          >
            <span>Ask NJS</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </form>
      </section>

      {/* Metrics / Quick Status Bar */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs flex flex-col border border-outline-variant/30">
          <span className="text-xs text-on-surface-variant mb-1 font-medium">AI Matches</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-on-surface">{stats.matchesCount}</span>
            <span className="text-xs text-primary font-medium">Pending prompt</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs flex flex-col border border-outline-variant/30">
          <span className="text-xs text-on-surface-variant mb-1 font-medium">Active Connections</span>
          <span className="text-2xl font-bold text-on-surface">{stats.activeConnectionsCount}</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs flex flex-col border border-outline-variant/30">
          <span className="text-xs text-on-surface-variant mb-1 font-medium">Saved Leads</span>
          <span className="text-2xl font-bold text-on-surface">{stats.savedLeadsCount}</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs flex flex-col border border-outline-variant/30">
          <span className="text-xs text-on-surface-variant mb-1 font-medium">Open Opportunities</span>
          <span className="text-2xl font-bold text-on-surface">{stats.openOpportunitiesCount}</span>
        </div>
      </section>

      {/* Empty States Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* 1. AI Matches */}
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow border border-outline-variant/30">
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-primary-container/10 rounded-full blur-2xl group-hover:bg-primary-container/20 transition-all pointer-events-none" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-surface-container-low text-primary flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">No matches yet.</h3>
            <p className="text-sm text-on-surface-variant mb-8 max-w-md leading-relaxed">
              Tell NJS what you're looking for and we'll help you discover relevant businesses.
            </p>
          </div>
          <div>
            <button
              onClick={() => onNavigate('ai-matches')}
              className="bg-primary-container text-on-primary-container px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Tell NJS What I Need
            </button>
          </div>
        </div>

        {/* 2. Connections */}
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow border border-outline-variant/30">
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-primary-container/10 rounded-full blur-2xl group-hover:bg-primary-container/20 transition-all pointer-events-none" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-surface-container-low text-primary flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[24px]">handshake</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">No connections yet.</h3>
            <p className="text-sm text-on-surface-variant mb-8 max-w-md leading-relaxed">
              Discover and connect with relevant businesses to scale your enterprise operations.
            </p>
          </div>
          <div>
            <button
              onClick={() => onNavigate('discover')}
              className="bg-primary-container text-on-primary-container px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">explore</span>
              Discover Businesses
            </button>
          </div>
        </div>

        {/* 3. Saved Leads */}
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow border border-outline-variant/30">
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-primary-container/10 rounded-full blur-2xl group-hover:bg-primary-container/20 transition-all pointer-events-none" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-surface-container-low text-primary flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[24px]">bookmark</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">No saved leads yet.</h3>
            <p className="text-sm text-on-surface-variant mb-8 max-w-md leading-relaxed">
              Save promising leads during your discovery searches to review and contact them later.
            </p>
          </div>
          <div>
            <button
              onClick={() => onNavigate('discover')}
              className="bg-primary-container text-on-primary-container px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">explore</span>
              Discover Businesses
            </button>
          </div>
        </div>

        {/* 4. Opportunities */}
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xs flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow border border-outline-variant/30">
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-primary-container/10 rounded-full blur-2xl group-hover:bg-primary-container/20 transition-all pointer-events-none" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-surface-container-low text-primary flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[24px]">trending_up</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">No opportunities yet.</h3>
            <p className="text-sm text-on-surface-variant mb-8 max-w-md leading-relaxed">
              Browse open requests or post your own business opportunity to attract qualified partners.
            </p>
          </div>
          <div>
            <button
              onClick={() => onNavigate('opportunities')}
              className="bg-primary-container text-on-primary-container px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Post an Opportunity
            </button>
          </div>
        </div>
      </section>

      {/* Getting Started Guide / Tip Card */}
      <section className="bg-surface-container-low p-6 sm:p-8 rounded-2xl mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-outline-variant/30">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 mt-1">
            <span className="material-symbols-outlined text-[20px]">lightbulb</span>
          </div>
          <div>
            <h4 className="text-lg font-bold text-on-surface mb-1">Pro-Tip: Get better AI results</h4>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Be as specific as possible when describing your requirements. Mention location, scale, and compliance standards to let our AI match you instantly.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('how-it-works')}
          className="whitespace-nowrap px-4 py-2.5 rounded-xl bg-surface-container-lowest text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
        >
          Learn More
        </button>
      </section>
    </div>
  );
};
