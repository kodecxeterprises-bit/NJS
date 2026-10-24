import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onSearch?: (query: string) => void;
  onOpenQuickAction: () => void;
  onToggleMobileMenu?: () => void;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  onOpenQuickAction,
  onToggleMobileMenu,
  onNavigate,
}) => {
  const { user, businessProfile, signOut } = useAuth();
  const [searchVal, setSearchVal] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchVal);
    }
  };

  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 z-30 flex items-center justify-between px-4 sm:px-8 transition-all">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container-high"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Global Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center bg-surface-container-low rounded-xl px-3.5 py-2 w-56 sm:w-80 md:w-96 gap-2 border border-transparent focus-within:border-primary/40 focus-within:bg-surface-container-lowest transition-all">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0">
            search
          </span>
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full text-on-surface placeholder:text-on-surface-variant/75"
            placeholder="Search matches, leads, or opportunities..."
          />
        </form>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Quick Action Button */}
        <button
          onClick={onOpenQuickAction}
          className="bg-primary-container text-on-primary-container px-3.5 sm:px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 sm:gap-2 hover:opacity-95 transition-opacity shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span className="hidden sm:inline">Quick Action</span>
        </button>

        {/* User Profile Avatar & Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow-xs hover:ring-2 hover:ring-primary/30 transition-all text-on-primary font-semibold text-sm"
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : (
              <span className="material-symbols-outlined text-[18px]">person</span>
            )}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 py-2 z-50 animate-in fade-in duration-100">
              <div className="px-4 py-3 border-b border-outline-variant/20">
                <p className="text-sm font-semibold text-on-surface truncate">
                  {user?.name || 'Account'}
                </p>
                <p className="text-xs text-on-surface-variant truncate">
                  {user?.email}
                </p>
                {businessProfile?.businessName && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-[10px] font-semibold">
                    {businessProfile.businessName}
                  </span>
                )}
              </div>

              <div className="py-1">
                <button
                  onClick={() => { onNavigate('profile'); setShowProfileMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2.5"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">person</span>
                  Business Profile
                </button>
                <button
                  onClick={() => { onNavigate('settings'); setShowProfileMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2.5"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">settings</span>
                  Settings & Billing
                </button>
                <button
                  onClick={() => { onNavigate('pricing'); setShowProfileMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2.5"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">credit_card</span>
                  Subscription Plans
                </button>
              </div>

              <div className="pt-1 border-t border-outline-variant/20">
                <button
                  onClick={() => { signOut(); setShowProfileMenu(false); onNavigate('sign-in'); }}
                  className="w-full text-left px-4 py-2 text-sm text-primary font-medium hover:bg-surface-container-low flex items-center gap-2.5"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
