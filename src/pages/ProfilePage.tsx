import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BusinessProfile } from '../types';

interface ProfilePageProps {
  onNavigate: (path: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { businessProfile, updateBusinessProfile, apiFetch } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<BusinessProfile>>(businessProfile || {});
  const [isSaving, setIsSaving] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const res = await updateBusinessProfile(formData);
    setIsSaving(false);
    if (res.success) {
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleAiPolish = async () => {
    if (!formData.businessDescription) return;
    setIsPolishing(true);
    try {
      const res = await apiFetch('/api/ai/improve-description', {
        method: 'POST',
        body: JSON.stringify({ description: formData.businessDescription }),
      });
      if (res.improved) {
        setFormData(prev => ({ ...prev, businessDescription: res.improved }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPolishing(false);
    }
  };

  const b = businessProfile;

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto">
      {saveSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-800 text-sm flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>Business profile successfully updated!</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-1 block">
            Public Enterprise Identity
          </span>
          <h1 className="text-3xl font-bold text-on-surface">
            {b?.businessName || 'Business Profile'}
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {b?.businessType} • {b?.industry} • {b?.city ? `${b.city}, ` : ''}{b?.country || 'Global'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('settings')}
            className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-sm font-medium hover:bg-surface-dim transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Settings
          </button>
          {!isEditing ? (
            <button
              onClick={() => {
                setFormData(businessProfile || {});
                setIsEditing(true);
              }}
              className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Edit Profile
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2.5 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {!isEditing ? (
        <div className="space-y-6">
          {/* Overview Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-xs border border-outline-variant/30 relative overflow-hidden">
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-outline-variant/20 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold text-2xl shadow-xs">
                  {b?.businessName ? b.businessName.charAt(0) : 'N'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-on-surface">{b?.businessName || 'Your Business'}</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      NJS Verified
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
                    {b?.website && <a href={b.website} target="_blank" rel="noreferrer" className="text-primary hover:underline mr-3">🌐 {b.website}</a>}
                    {b?.phone && <span>📞 {b.phone}</span>}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-on-surface-variant block uppercase font-medium">Platform Rating</span>
                <span className="text-sm font-bold text-primary flex items-center gap-1 justify-end">
                  <span className="material-symbols-outlined text-[18px]">star</span>
                  5.0 (New Verified Member)
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">About the Company</h3>
              <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
                {b?.businessDescription || 'No description added yet. Click "Edit Profile" to complete your corporate bio.'}
              </p>
            </div>

            {/* Offerings & Needs Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 mt-6 border-t border-outline-variant/20">
              <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                  What We Offer ({b?.offers?.length || 0})
                </h4>
                {b?.offers && b.offers.length > 0 ? (
                  <ul className="space-y-2">
                    {b.offers.map((off, idx) => (
                      <li key={idx} className="text-xs sm:text-sm text-on-surface flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{off.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-on-surface-variant italic">No offerings published yet.</p>
                )}
              </div>

              <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">target</span>
                  What We Need ({b?.needs?.length || 0})
                </h4>
                {b?.needs && b.needs.length > 0 ? (
                  <ul className="space-y-2">
                    {b.needs.map((need, idx) => (
                      <li key={idx} className="text-xs sm:text-sm text-on-surface flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{need.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-on-surface-variant italic">No procurement needs listed yet.</p>
                )}
              </div>
            </div>

            {/* Tags & Markets */}
            <div className="pt-6 mt-6 border-t border-outline-variant/20 flex flex-wrap gap-2">
              {b?.businessKeywords?.map((kw, i) => (
                <span key={i} className="px-3 py-1 rounded-lg bg-surface-container text-xs text-on-surface font-medium">
                  #{kw}
                </span>
              ))}
              {b?.targetMarkets?.map((m, i) => (
                <span key={i} className="px-3 py-1 rounded-lg bg-primary-fixed text-on-primary-fixed text-xs font-semibold">
                  Market: {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Edit Mode */
        <form onSubmit={handleSave} className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-xs border border-outline-variant/30 space-y-6">
          <h2 className="text-xl font-bold text-on-surface">Edit Business Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Business Name</label>
              <input
                type="text"
                value={formData.businessName || ''}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Business Type</label>
              <select
                value={formData.businessType || 'Supplier'}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
              >
                <option>Manufacturer</option>
                <option>Supplier</option>
                <option>Retailer</option>
                <option>Distributor</option>
                <option>Wholesaler</option>
                <option>Service Provider</option>
                <option>Enterprise B2B</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Industry</label>
              <input
                type="text"
                value={formData.industry || ''}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Country</label>
              <input
                type="text"
                value={formData.country || ''}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">City</label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Website</label>
              <input
                type="url"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-on-surface">Company Description</label>
              <button
                type="button"
                onClick={handleAiPolish}
                disabled={isPolishing}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                {isPolishing ? 'Polishing...' : 'Polish with AI'}
              </button>
            </div>
            <textarea
              rows={5}
              value={formData.businessDescription || ''}
              onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
              className="w-full p-3.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface resize-none leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-medium hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 shadow-xs disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
