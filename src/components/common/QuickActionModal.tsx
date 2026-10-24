import React from 'react';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({ isOpen, onClose, onNavigate }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-5 border-b border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">bolt</span>
            <h3 className="font-semibold text-lg text-on-surface">Quick Actions</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => { onNavigate('ai-matches'); onClose(); }}
            className="flex flex-col items-start p-4 rounded-xl border border-outline-variant/30 hover:border-primary hover:bg-surface-container-low transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <span className="font-semibold text-on-surface text-sm mb-1">Tell NJS What I Need</span>
            <span className="text-body-sm text-on-surface-variant">Parse procurement brief and trigger instant supplier matching.</span>
          </button>

          <button
            onClick={() => { onNavigate('opportunities'); onClose(); }}
            className="flex flex-col items-start p-4 rounded-xl border border-outline-variant/30 hover:border-primary hover:bg-surface-container-low transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">add_task</span>
            </div>
            <span className="font-semibold text-on-surface text-sm mb-1">Post Opportunity</span>
            <span className="text-body-sm text-on-surface-variant">Publish a live requirement to attract verified bids.</span>
          </button>

          <button
            onClick={() => { onNavigate('discover'); onClose(); }}
            className="flex flex-col items-start p-4 rounded-xl border border-outline-variant/30 hover:border-primary hover:bg-surface-container-low transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-surface-container text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">explore</span>
            </div>
            <span className="font-semibold text-on-surface text-sm mb-1">Discover Businesses</span>
            <span className="text-body-sm text-on-surface-variant">Browse verified enterprise catalog with multi-axis filters.</span>
          </button>

          <button
            onClick={() => { onNavigate('ai-lead-generator'); onClose(); }}
            className="flex flex-col items-start p-4 rounded-xl border border-outline-variant/30 hover:border-primary hover:bg-surface-container-low transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">psychology</span>
            </div>
            <span className="font-semibold text-on-surface text-sm mb-1">AI Lead Generator</span>
            <span className="text-body-sm text-on-surface-variant">Automated prospect crawler and custom outreach sequencer.</span>
          </button>
        </div>

        <div className="px-6 py-3.5 bg-surface-container-low border-t border-outline-variant/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
