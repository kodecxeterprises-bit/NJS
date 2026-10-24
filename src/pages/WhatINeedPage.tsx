import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BusinessNeed } from '../types';

interface WhatINeedPageProps {
  onNavigate: (path: string, state?: any) => void;
}

export const WhatINeedPage: React.FC<WhatINeedPageProps> = ({ onNavigate }) => {
  const { businessProfile, updateBusinessProfile, apiFetch } = useAuth();

  const [needs, setNeeds] = useState<BusinessNeed[]>(businessProfile?.needs || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Procurement');
  const [details, setDetails] = useState('');
  const [budget, setBudget] = useState('');
  const [urgency, setUrgency] = useState<'immediate' | 'medium' | 'flexible'>('medium');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhanceWithAi = async () => {
    if (!title && !details) return;
    setIsEnhancing(true);
    try {
      const res = await apiFetch('/api/ai/parse-brief', {
        method: 'POST',
        body: JSON.stringify({ prompt: `${title} - ${details}` }),
      });
      if (res.parsed) {
        setTitle(res.parsed.intentSummary || title);
        setCategory(res.parsed.category || category);
        setDetails(`Requirements: ${res.parsed.requirements || 'Standard enterprise quality'}. Location: ${res.parsed.targetLocation || 'Global'}.`);
        if (res.parsed.targetBudget) setBudget(res.parsed.targetBudget);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSaveNeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newNeed: BusinessNeed = {
      id: 'need_' + Date.now(),
      title: title.trim(),
      category,
      details: details.trim(),
      budget: budget.trim(),
      urgency,
    };

    const updated = [...needs, newNeed];
    setNeeds(updated);
    await updateBusinessProfile({ needs: updated });
    setShowAddModal(false);
    setTitle('');
    setDetails('');
    setBudget('');
  };

  const handleDeleteNeed = async (id: string) => {
    const updated = needs.filter(n => n.id !== id);
    setNeeds(updated);
    await updateBusinessProfile({ needs: updated });
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-1 block">
            Procurement &amp; Sourcing Matrix
          </span>
          <h1 className="text-3xl font-bold text-on-surface">What I Need</h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-1">
            Specify live sourcing requirements. The NJS AI Matching Engine uses this data to connect you with verified suppliers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('ai-matches')}
            className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-sm font-medium hover:bg-surface-dim transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            AI Request Builder
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Sourcing Need
          </button>
        </div>
      </div>

      {needs.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 flex flex-col items-center justify-center max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">target</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">No active sourcing needs specified.</h3>
          <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
            Tell NJS what your business currently requires to trigger autonomous supplier discovery across our global network.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-primary-container text-on-primary-container rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-xs cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add My First Need
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {needs.map((item) => (
            <div
              key={item.id}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold">
                    {item.category}
                  </span>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${
                    item.urgency === 'immediate' ? 'text-error' : 'text-primary'
                  }`}>
                    {item.urgency} Priority
                  </span>
                </div>
                <h4 className="font-bold text-base text-on-surface mb-2">{item.title}</h4>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed mb-4">
                  {item.details || 'No additional specifications provided.'}
                </p>
                {item.budget && (
                  <p className="text-xs font-semibold text-on-surface mb-3">
                    Target Budget: <span className="text-primary">{item.budget}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
                <button
                  onClick={() => onNavigate('ai-matches', { initialBrief: item.title })}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  Find Matches
                </button>
                <button
                  onClick={() => handleDeleteNeed(item.id)}
                  className="text-xs text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Need Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-outline-variant/30">
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="font-bold text-lg text-on-surface">Add Sourcing Requirement</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveNeed} className="p-6 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-on-surface">Requirement Title *</label>
                  <button
                    type="button"
                    onClick={handleEnhanceWithAi}
                    disabled={isEnhancing || !title}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    {isEnhancing ? 'Enhancing...' : 'AI Enhance Spec'}
                  </button>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 5,000 Custom Embroidered Organic Hoodies"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Apparel, Hardware"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-xs sm:text-sm text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Urgency</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-xs sm:text-sm text-on-surface"
                  >
                    <option value="immediate">Immediate (ASAP)</option>
                    <option value="medium">Medium (Next 1-3 months)</option>
                    <option value="flexible">Flexible Timeline</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Target Budget</label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. $25,000 USD"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-xs sm:text-sm text-on-surface"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Detailed Specifications</label>
                <textarea
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Include technical specs, delivery location, GOTS / ISO certifications..."
                  className="w-full p-3 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-xs sm:text-sm text-on-surface resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 shadow-xs"
                >
                  Save Sourcing Need
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
