import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { QuickActionModal } from '../common/QuickActionModal';

interface AppLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
  unreadNotificationsCount?: number;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentPath,
  onNavigate,
  children,
  unreadNotificationsCount = 0,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);

  return (
    <div className="bg-surface font-sans text-on-surface min-h-screen">
      {/* Sidebar */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Main Content Area shifted right by sidebar width */}
      <div className="lg:pl-72 min-h-screen flex flex-col">
        {/* Header */}
        <Header
          onNavigate={onNavigate}
          onOpenQuickAction={() => setIsQuickActionOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Page Content */}
        <main className="relative pt-16 bg-surface min-h-screen p-4 sm:p-6 lg:p-8 flex-1">
          {children}
        </main>
      </div>

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
