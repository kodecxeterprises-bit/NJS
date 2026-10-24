import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SavedLead } from '../types';

interface SavedLeadsPageProps {
  onNavigate: (path: string, state?: any) => void;
}

export const SavedLeadsPage: React.FC<SavedLeadsPageProps> = ({ onNavigate }) => {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<SavedLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/leads/saved');
      setLeads(data.leads || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleRemove = async (id: string) => {
    try {
      await apiFetch(`/api/leads/saved/${id}`, { method: 'DELETE' });
      setLeads(leads.filter(l => l.id !== id));
      showToast('Lead removed from saved list.', 'info');
    } catch (e: any) {
      showToast(e.message || 'Failed to remove lead.', 'error');
    }
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-1 block">
            Prospect Pipeline
          </span>
          <h1 className="text-3xl font-bold text-on-surface">Saved Leads</h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-1 leading-relaxed">
            Your private repository of bookmarked enterprise prospects, supplier profiles, and outreach targets.
          </p>
        </div>

        <button
          onClick={() => onNavigate('discover')}
          className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 shadow-xs cursor-pointer flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">explore</span>
          Discover Businesses
        </button>
      </div>

      {leads.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 flex flex-col items-center justify-center max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">bookmark</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">No saved leads yet.</h3>
          <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
            Save promising leads during your discovery searches to review and contact them later.
          </p>
          <button
            onClick={() => onNavigate('discover')}
            className="bg-primary-container text-on-primary-container px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
            Discover Businesses
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold">
                    {lead.score || '95% Fit'}
                  </span>
                  <button
                    onClick={() => handleRemove(lead.id)}
                    className="text-xs text-on-surface-variant hover:text-error transition-colors"
                  >
                    Remove
                  </button>
                </div>

                <h3 className="text-lg font-bold text-on-surface mb-1">{lead.companyName}</h3>
                <p className="text-xs text-on-surface-variant mb-3">
                  {lead.industry || 'B2B'} • {lead.location || 'Global'}
                </p>

                {lead.domain && (
                  <p className="text-xs text-primary font-medium mb-4 truncate">
                    🌐 {lead.domain}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-outline-variant/20">
                <button
                  onClick={() => onNavigate('ai-outreach')}
                  className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  Draft Outreach
                </button>
                <button
                  onClick={() => onNavigate('discover')}
                  className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-medium"
                >
                  Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
