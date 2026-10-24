import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Opportunity } from '../types';

interface OpportunitiesPageProps {
  onNavigate: (path: string, state?: any) => void;
  openCreateModalInitially?: boolean;
}

export const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({ onNavigate, openCreateModalInitially }) => {
  const { user, businessProfile, apiFetch } = useAuth();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(openCreateModalInitially || false);
  const [respondingToOpp, setRespondingToOpp] = useState<Opportunity | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Apparel & Textiles');
  const [description, setDescription] = useState('');
  const [whatTheyNeed, setWhatTheyNeed] = useState('');
  const [location, setLocation] = useState('Global');
  const [quantity, setQuantity] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [requirements, setRequirements] = useState('');

  // Response fields
  const [pitch, setPitch] = useState('');
  const [budgetQuote, setBudgetQuote] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchOpportunities = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/opportunities');
      setOpportunities(data.opportunities || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handlePostOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    try {
      await apiFetch('/api/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          description,
          whatTheyNeed,
          location,
          quantity,
          budget,
          timeline,
          requirements,
        }),
      });
      setShowPostModal(false);
      setTitle('');
      setDescription('');
      setWhatTheyNeed('');
      setQuantity('');
      setBudget('');
      setTimeline('');
      setRequirements('');
      setToastMsg('Opportunity posted to NJS network!');
      setTimeout(() => setToastMsg(null), 3500);
      fetchOpportunities();
    } catch (err: any) {
      setToastMsg(err.message || 'Failed to post opportunity.');
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingToOpp || !pitch) return;

    try {
      await apiFetch(`/api/opportunities/${respondingToOpp.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ pitch, budgetQuote }),
      });
      setRespondingToOpp(null);
      setPitch('');
      setBudgetQuote('');
      setToastMsg('Your commercial proposal was submitted to the poster!');
      setTimeout(() => setToastMsg(null), 3500);
      fetchOpportunities();
    } catch (err: any) {
      setToastMsg(err.message || 'Failed to submit response.');
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handleDeleteOpp = async (id: string) => {
    try {
      await apiFetch(`/api/opportunities/${id}`, { method: 'DELETE' });
      setOpportunities(opportunities.filter(o => o.id !== id));
      setToastMsg('Opportunity deleted.');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err: any) {
      setToastMsg(err.message || 'Failed to delete.');
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  return (
    <div className="flex flex-col w-full relative">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-on-surface text-surface text-sm font-medium shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-1 block">
            Commercial Exchange
          </span>
          <h1 className="text-3xl font-bold text-on-surface">Opportunities &amp; RFPs</h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-1 leading-relaxed">
            Browse verified commercial contracts or publish your own requirements to solicit qualified enterprise proposals.
          </p>
        </div>

        <button
          onClick={() => setShowPostModal(true)}
          className="bg-primary-container text-on-primary-container px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Post an Opportunity
        </button>
      </div>

      {/* Content */}
      {opportunities.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 flex flex-col items-center justify-center max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">trending_up</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">No opportunities yet.</h3>
          <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
            Browse open requests or post your own business opportunity to attract qualified partners.
          </p>
          <button
            onClick={() => setShowPostModal(true)}
            className="bg-primary-container text-on-primary-container px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Post an Opportunity
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {opportunities.map((opp) => {
            const isOwner = user?.id === opp.userId;

            return (
              <div
                key={opp.id}
                className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-xs border border-outline-variant/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold">
                      {opp.category}
                    </span>
                    <span className="text-xs text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      {opp.location}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-on-surface mb-1">{opp.title}</h3>
                  <p className="text-xs font-semibold text-primary mb-3">
                    Posted by: {opp.businessName}
                  </p>

                  <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                    {opp.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs text-on-surface-variant p-3 rounded-xl bg-surface-container-low mb-4">
                    <div>
                      <span className="font-semibold block text-on-surface">Target Volume:</span>
                      <span>{opp.quantity || 'Negotiable'}</span>
                    </div>
                    <div>
                      <span className="font-semibold block text-on-surface">Budget:</span>
                      <span>{opp.budget || 'Competitive'}</span>
                    </div>
                    <div>
                      <span className="font-semibold block text-on-surface">Timeline:</span>
                      <span>{opp.timeline || 'Flexible'}</span>
                    </div>
                    <div>
                      <span className="font-semibold block text-on-surface">Responses:</span>
                      <span className="text-primary font-bold">{opp.responsesCount} bids</span>
                    </div>
                  </div>

                  {opp.requirements && (
                    <p className="text-xs text-on-surface-variant mb-4">
                      <strong>Requirements:</strong> {opp.requirements}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
                  {isOwner ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-primary font-semibold">Your Published Opportunity</span>
                      <button
                        onClick={() => handleDeleteOpp(opp.id)}
                        className="text-xs text-error font-medium hover:underline cursor-pointer"
                      >
                        Delete Opportunity
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRespondingToOpp(opp)}
                      className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      Respond to Opportunity
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-outline-variant/30">
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between sticky top-0 bg-surface-container-lowest z-10">
              <h3 className="font-bold text-lg text-on-surface">Post a Business Opportunity / RFP</h3>
              <button
                onClick={() => setShowPostModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handlePostOpportunity} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sourcing 10,000 Custom Biodegradable Mailer Bags"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-xs sm:text-sm text-on-surface"
                  >
                    <option>Apparel &amp; Textiles</option>
                    <option>Electronics &amp; Hardware</option>
                    <option>Packaging &amp; Paper</option>
                    <option>Industrial Machinery</option>
                    <option>Software &amp; Cloud</option>
                    <option>Logistics &amp; Freight</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Target Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Europe, USA, Global"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-xs sm:text-sm text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Description *</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed breakdown of your project, scope of work, and partner requirements..."
                  className="w-full p-3 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Quantity</label>
                  <input
                    type="text"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 5,000 units"
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant outline-none text-xs text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Budget</label>
                  <input
                    type="text"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. $20k - $30k"
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant outline-none text-xs text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Timeline</label>
                  <input
                    type="text"
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="e.g. Q3 2025"
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant outline-none text-xs text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Requirements &amp; Certifications</label>
                <input
                  type="text"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="e.g. ISO 9001, GOTS certified, strict QC reports"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface border border-outline-variant outline-none text-xs sm:text-sm text-on-surface"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 shadow-xs"
                >
                  Publish Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Respond Modal */}
      {respondingToOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg shadow-2xl border border-outline-variant/30">
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-on-surface">Respond to Opportunity</h3>
                <p className="text-xs text-on-surface-variant truncate max-w-xs">{respondingToOpp.title}</p>
              </div>
              <button
                onClick={() => setRespondingToOpp(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleRespond} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Your Commercial Pitch *</label>
                <textarea
                  rows={4}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="Outline your capability, lead time, and how your business fulfills these specifications..."
                  className="w-full p-3 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Estimated Quote or Pricing Model</label>
                <input
                  type="text"
                  value={budgetQuote}
                  onChange={(e) => setBudgetQuote(e.target.value)}
                  placeholder="e.g. $18,500 all inclusive of freight"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant outline-none text-sm text-on-surface"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setRespondingToOpp(null)}
                  className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 shadow-xs"
                >
                  Submit Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
