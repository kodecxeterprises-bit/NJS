import React from 'react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  unreadNotificationsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  unreadNotificationsCount = 0,
}) => {
  const { user, businessProfile } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: 'dashboard' },
    { id: 'discover', label: 'Discover', icon: 'explore' },
    { id: 'ai-matches', label: 'AI Matches', icon: 'auto_awesome' },
    { id: 'what-i-need', label: 'What I Need', icon: 'target' },
    { id: 'opportunities', label: 'Opportunities', icon: 'trending_up' },
    { id: 'connections', label: 'Connections', icon: 'handshake' },
    { id: 'messages', label: 'Messages', icon: 'chat' },
    { id: 'saved-leads', label: 'Saved Leads', icon: 'bookmark' },
    { id: 'ai-lead-generator', label: 'AI Lead Generator', icon: 'psychology' },
    { id: 'ai-outreach', label: 'AI Outreach', icon: 'bolt' },
  ];

  const bottomItems = [
    { id: 'notifications', label: 'Notifications', icon: 'notifications', badge: unreadNotificationsCount },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const handleItemClick = (id: string) => {
    onNavigate(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-surface-container-low z-50 flex flex-col pt-6 pb-6 transition-transform duration-200 ease-in-out border-r border-outline-variant/30 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="px-6 mb-8 flex items-center justify-between">
          <div
            onClick={() => handleItemClick('dashboard')}
            className="text-xl font-bold tracking-tight text-primary flex items-center gap-2 cursor-pointer select-none"
          >
            <span className="material-symbols-outlined text-primary text-[28px]">hub</span>
            <span>NJS Platform</span>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          )}
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPath === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center px-4 py-2.5 rounded-xl transition-all text-sm font-medium text-left ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined mr-3 text-[20px] shrink-0">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Menu */}
        <div className="px-4 pt-4 border-t border-outline-variant/30 space-y-1">
          {bottomItems.map((item) => {
            const isActive = currentPath === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all text-sm font-medium text-left ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <div className="flex items-center">
                  <span className="material-symbols-outlined mr-3 text-[20px] shrink-0">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          {/* Profile Button */}
          <button
            onClick={() => handleItemClick('profile')}
            className={`w-full flex items-center px-4 py-2.5 rounded-xl transition-all text-sm font-medium text-left ${
              currentPath === 'profile'
                ? 'bg-primary-container text-on-primary-container font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center mr-3 text-on-primary shrink-0 text-xs font-semibold">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate leading-tight font-medium text-on-surface">
                {businessProfile?.businessName || user?.name || 'Profile'}
              </span>
              <span className="text-[11px] text-on-surface-variant truncate">
                {user?.email || 'Settings & team'}
              </span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
};
