import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BusinessProfile } from '../types';

interface AiMatchesPageProps {
  onNavigate: (path: string, state?: any) => void;
  initialBrief?: string;
}

export const AiMatchesPage: React.FC<AiMatchesPageProps> = ({ onNavigate, initialBrief }) => {
  const { apiFetch, businessProfile } = useAuth();

  const [aiPrompt, setAiPrompt] = useState(initialBrief || '');
  const [category, setCategory] = useState('apparel');
  const [location, setLocation] = useState('Western Europe');
  const [quantity, setQuantity] = useState('1,000 units');
  const [budget, setBudget] = useState('$15,000 USD');
  const [timeline, setTimeline] = useState('Deliveries by Q3 2025');

  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Sourcing activity history
  const [recentBriefs, setRecentBriefs] = useState<any[]>([
    {
      id: 'brief_1',
      title: 'Organic Cotton T-Shirts Brief',
      subtitle: 'Parsed 2 hours ago • 1,000 units',
      status: 'Active Matching',
      icon: 'inventory_2',
    },
    {
      id: 'brief_2',
      title: 'Biodegradable Mailer Bags',
      subtitle: 'Completed yesterday • 5 vendors connected',
      status: 'Closed',
      icon: 'bolt',
    },
  ]);

  useEffect(() => {
    if (initialBrief) {
      handleParsePrompt(initialBrief);
    }
  }, [initialBrief]);

  const populateExample = () => {
    setAiPrompt('I need a sustainable apparel manufacturer for 1,000 custom organic cotton shirts with delivery by Q3 in Western Europe.');
    setCategory('apparel');
    setLocation('Western Europe');
    setQuantity('1,000 units');
    setBudget('$15,000 USD');
    setTimeline('Q3 2025');
  };

  const handleParsePrompt = async (textToParse?: string) => {
    const text = textToParse || aiPrompt;
    if (!text.trim()) {
      setFeedbackMessage('Please enter a sourcing requirement first.');
      setTimeout(() => setFeedbackMessage(null), 3500);
      return;
    }

    setIsParsing(true);
    try {
      const res = await apiFetch('/api/ai/parse-brief', {
        method: 'POST',
        body: JSON.stringify({ prompt: text }),
      });

      const p = res.parsed;
      if (p) {
        if (p.category) setCategory(p.category.toLowerCase().includes('text') ? 'apparel' : p.category);
        if (p.targetLocation) setLocation(p.targetLocation);
        if (p.quantity) setQuantity(p.quantity);
        if (p.targetBudget) setBudget(p.targetBudget);
        if (p.timeline) setTimeline(p.timeline);
      }
    } catch (e) {
      console.error('Parse error:', e);
    } finally {
      setIsParsing(false);
    }
  };

  const handleTriggerMatches = async () => {
    setIsSearching(true);
    setHasSearched(true);
    setFeedbackMessage(null);

    try {
      const res = await apiFetch('/api/ai/match', {
        method: 'POST',
        body: JSON.stringify({
          brief: aiPrompt || `${quantity} of ${category} in ${location}`,
          category,
          targetLocation: location,
        }),
      });

      setMatches(res.matches || []);

      // Add to recent sourcing history
      if (aiPrompt) {
        setRecentBriefs(prev => [
          {
            id: 'brief_' + Date.now(),
            title: aiPrompt.slice(0, 35) + '...',
            subtitle: `Parsed just now • ${quantity || 'Custom inquiry'}`,
            status: 'Active Matching',
            icon: 'inventory_2',
          },
          ...prev.slice(0, 4),
        ]);
      }
    } catch (e) {
      console.error('Match search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResetBuilder = () => {
    setAiPrompt('');
    setCategory('apparel');
    setLocation('');
    setQuantity('');
    setBudget('');
    setTimeline('');
    setHasSearched(false);
    setMatches([]);
  };

  const handleConnect = async (business: BusinessProfile) => {
    try {
      await apiFetch('/api/connections/request', {
        method: 'POST',
        body: JSON.stringify({
          targetBusinessId: business.id,
          message: `Inquiring regarding our sourcing brief: ${aiPrompt || category}`,
        }),
      });
      setFeedbackMessage(`Connection request sent to ${business.businessName}!`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage(err.message || 'Unable to connect.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Banner / Editorial Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs uppercase tracking-wider font-semibold">
              AI Intelligence Engine
            </span>
            <span className="text-on-surface-variant text-xs">/ Real-time Supplier Matching</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-on-surface tracking-tight">
            AI Matches &amp; Request Builder
          </h1>
          <p className="text-on-surface-variant text-base sm:text-lg max-w-2xl mt-1 leading-relaxed">
            Describe your exact sourcing requirement in plain English. Our neural engine parses parameters, matches verified enterprise vendors, and initiates high-intent connections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const el = document.getElementById('recent-activity-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-5 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-sm font-medium hover:bg-surface-container-highest transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            Past Briefs
          </button>
          <button
            onClick={handleResetBuilder}
            className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            New Brief
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-800 text-sm flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
        {/* Left Column: Conversational AI Request Builder (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs relative overflow-hidden flex flex-col justify-between border border-outline-variant/30">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container">
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  </div>
                  <span className="font-bold text-on-surface text-base">What are you looking for?</span>
                </div>
                <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full">
                  NLP Active
                </span>
              </div>

              {/* Conversational Prompt Input */}
              <div className="relative mb-6">
                <textarea
                  id="aiPromptInput"
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., I need a sustainable apparel manufacturer for 1,000 custom organic cotton shirts with delivery by Q3 in Western Europe..."
                  className="w-full bg-surface-container-low text-on-surface p-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-container resize-none transition-all placeholder:text-on-surface-variant/60"
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={populateExample}
                    className="text-xs text-primary hover:underline bg-surface-container-lowest px-2 py-1 rounded shadow-xs cursor-pointer"
                  >
                    Try Example
                  </button>
                  <button
                    type="button"
                    onClick={() => handleParsePrompt()}
                    disabled={isParsing}
                    className="bg-primary text-on-primary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    {isParsing ? (
                      <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[14px]">bolt</span>
                    )}
                    <span>{isParsing ? 'Parsing...' : 'Parse'}</span>
                  </button>
                </div>
              </div>

              {/* Structured Requirement Fields */}
              <div className="space-y-4">
                <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Structured Parameters
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-surface-container-low text-on-surface p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    >
                      <option value="apparel">Apparel &amp; Textiles</option>
                      <option value="electronics">Electronics &amp; Hardware</option>
                      <option value="packaging">Sustainable Packaging</option>
                      <option value="industrial">Industrial Machinery</option>
                      <option value="software">Software &amp; Cloud</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">Target Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Global, EU, USA"
                      className="w-full bg-surface-container-low text-on-surface p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">Quantity</label>
                    <input
                      type="text"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="e.g., 1,000 units"
                      className="w-full bg-surface-container-low text-on-surface p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">Target Budget</label>
                    <input
                      type="text"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="e.g., $15,000 USD"
                      className="w-full bg-surface-container-low text-on-surface p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Timeline &amp; Deadline</label>
                  <input
                    type="text"
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="e.g., Deliveries by Q3 2025"
                    className="w-full bg-surface-container-low text-on-surface p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                type="button"
                onClick={handleTriggerMatches}
                disabled={isSearching}
                className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                    <span>Analyzing Sourcing Network...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    <span>Tell NJS What You Need</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick AI Tips Box */}
          <div className="bg-surface-container-high rounded-2xl p-4 text-on-surface flex items-start gap-3 border border-outline-variant/30">
            <span className="material-symbols-outlined text-primary text-[24px]">lightbulb</span>
            <div>
              <div className="text-sm font-semibold mb-1">Pro-Tip for Precision Matching</div>
              <p className="text-on-surface-variant text-xs leading-relaxed">
                Include certifications (e.g., ISO 9001, OEKO-TEX) or specific material tolerances in your prompt to instantly narrow down verified tier-1 suppliers.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: AI Matches View & Empty State (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col items-center justify-center min-h-[520px] relative overflow-hidden border border-outline-variant/30">
            <div className="absolute inset-0 bg-[radial-gradient(#ff5c14_1px,transparent_1px)] [background-size:24px_24px] opacity-5 pointer-events-none" />

            {/* EMPTY STATE (Default or no matches found) */}
            {(!hasSearched || matches.length === 0) && (
              <div className="flex flex-col items-center max-w-md mx-auto py-12 text-center">
                <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center text-primary mb-6 shadow-inner">
                  <span className="material-symbols-outlined text-[40px]">radar</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-on-surface mb-2">
                  No AI matches yet.
                </h2>
                <p className="text-on-surface-variant text-sm sm:text-base mb-8 leading-relaxed">
                  Submit your requirements using the request builder on the left or click below to broadcast your brief to our verified vendor network.
                </p>
                <button
                  type="button"
                  onClick={handleTriggerMatches}
                  className="px-6 py-3 bg-primary-container text-on-primary-container rounded-xl font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add_task</span>
                  <span>Tell NJS What You Need</span>
                </button>
              </div>
            )}

            {/* POPULATED MATCHES STATE */}
            {hasSearched && matches.length > 0 && (
              <div className="w-full text-left flex flex-col gap-6 animate-in fade-in">
                <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
                  <div>
                    <span className="text-xs text-primary uppercase font-bold tracking-wider">
                      AI Synthesis Complete
                    </span>
                    <h3 className="text-xl font-bold text-on-surface">
                      {matches.length} High-Confidence Supplier Matches
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface text-xs font-semibold">
                      Match Accuracy: 98.4%
                    </span>
                  </div>
                </div>

                {/* Match Cards */}
                <div className="space-y-4">
                  {matches.map((item) => {
                    const b = item.candidateBusiness;
                    const initials = b.businessName
                      ? b.businessName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                      : 'NX';

                    return (
                      <div
                        key={item.id}
                        className="bg-surface-container-low rounded-2xl p-5 hover:bg-surface-container transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-outline-variant/30"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-on-surface text-base">
                                {b.businessName}
                              </h4>
                              <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed text-xs font-semibold">
                                {item.score}% Match
                              </span>
                            </div>

                            <p className="text-on-surface-variant text-xs sm:text-sm mt-0.5 leading-relaxed">
                              {b.businessDescription || 'Verified enterprise provider.'}
                            </p>

                            {/* Why this match */}
                            {item.whyThisMatch && (
                              <p className="text-primary text-xs mt-1.5 font-medium bg-primary-fixed/30 px-2 py-1 rounded-lg">
                                💡 Why this match: {item.whyThisMatch}
                              </p>
                            )}

                            <div className="flex items-center gap-3 mt-2 text-xs text-on-surface-variant flex-wrap">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">location_on</span>
                                {b.city ? `${b.city}, ` : ''}{b.country}
                              </span>
                              <span className="flex items-center gap-1 text-primary">
                                <span className="material-symbols-outlined text-[14px]">verified</span>
                                NJS Verified Tier-1
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
                          <button
                            onClick={() => onNavigate('discover')}
                            className="px-4 py-2 bg-surface-container-lowest text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-bright transition-all border border-outline-variant/30 cursor-pointer"
                          >
                            View Profile
                          </button>
                          <button
                            onClick={() => handleConnect(b)}
                            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Secondary Feed / Recent Activity */}
          <div id="recent-activity-section" className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-on-surface text-base">Recent Sourcing Activity</h3>
              <span
                onClick={() => handleResetBuilder()}
                className="text-xs text-primary cursor-pointer hover:underline font-semibold"
              >
                Clear History
              </span>
            </div>

            <div className="space-y-3">
              {recentBriefs.map((brief) => (
                <div
                  key={brief.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px]">{brief.icon}</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-on-surface">{brief.title}</div>
                      <div className="text-xs text-on-surface-variant">{brief.subtitle}</div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      brief.status === 'Active Matching'
                        ? 'bg-primary-fixed text-on-primary-fixed font-semibold'
                        : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {brief.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
