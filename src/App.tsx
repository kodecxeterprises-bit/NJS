import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';

// Public Pages
import { LandingPage } from './pages/LandingPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { PricingPage } from './pages/PricingPage';
import { ContactPage } from './pages/ContactPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';

// Auth Pages
import { SignUpPage } from './pages/auth/SignUpPage';
import { SignInPage } from './pages/auth/SignInPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';

// Onboarding
import { OnboardingFlow } from './pages/onboarding/OnboardingFlow';

// Application Pages
import { DashboardPage } from './pages/DashboardPage';
import { AiMatchesPage } from './pages/AiMatchesPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { AiLeadGeneratorPage } from './pages/AiLeadGeneratorPage';
import { WhatINeedPage } from './pages/WhatINeedPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { MessagesPage } from './pages/MessagesPage';
import { SavedLeadsPage } from './pages/SavedLeadsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

function normalizePath(pathname: string): string {
  const clean = pathname.replace(/^\//, '').split('?')[0].trim();
  if (!clean) return 'landing';
  return clean;
}

const MainAppContent: React.FC = () => {
  const { user, businessProfile, isLoading } = useAuth();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    return normalizePath(window.location.pathname);
  });
  const [navigationState, setNavigationState] = useState<any>(null);
  const [verificationCodePreview, setVerificationCodePreview] = useState<string | undefined>();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Sync with browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string, state?: any) => {
    const formatted = path.replace(/^\//, '');
    setCurrentPath(formatted);
    setNavigationState(state || null);
    window.history.pushState({}, '', `/${formatted === 'landing' ? '' : formatted}`);
  };

  // Loading splash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-on-primary font-bold text-xl shadow-md animate-pulse">
          NJS
        </div>
        <p className="text-xs text-on-surface-variant mt-4 font-semibold">
          Loading NJS Platform...
        </p>
      </div>
    );
  }

  // Routing Logic
  // 1. Public Routes
  if (currentPath === 'landing' || currentPath === '') {
    return <LandingPage onNavigate={navigate} />;
  }
  if (currentPath === 'how-it-works') {
    return <HowItWorksPage onNavigate={navigate} />;
  }
  if (currentPath === 'pricing') {
    return <PricingPage onNavigate={navigate} />;
  }
  if (currentPath === 'contact') {
    return <ContactPage onNavigate={navigate} />;
  }
  if (currentPath === 'privacy' || currentPath === 'privacy-policy') {
    return <PrivacyPolicyPage onNavigate={navigate} />;
  }
  if (currentPath === 'terms' || currentPath === 'terms-of-service') {
    return <TermsOfServicePage onNavigate={navigate} />;
  }

  // 2. Auth Routes
  if (currentPath === 'sign-up') {
    return (
      <SignUpPage
        onNavigate={navigate}
        onRegistered={(code) => {
          setVerificationCodePreview(code);
          navigate('verify-email');
        }}
      />
    );
  }
  if (currentPath === 'sign-in') {
    return (
      <SignInPage
        onNavigate={navigate}
        onSignedIn={() => {
          if (!businessProfile || !businessProfile.onboardingCompleted) {
            navigate('onboarding');
          } else {
            navigate('dashboard');
          }
        }}
      />
    );
  }
  if (currentPath === 'verify-email') {
    return (
      <VerifyEmailPage
        onNavigate={navigate}
        onVerified={() => navigate('onboarding')}
        initialCode={verificationCodePreview}
      />
    );
  }
  if (currentPath === 'forgot-password' || currentPath === 'reset-password') {
    return <ForgotPasswordPage onNavigate={navigate} />;
  }

  // 3. Onboarding Routes
  if (currentPath.startsWith('onboarding')) {
    return (
      <OnboardingFlow
        onComplete={() => navigate('dashboard')}
        onNavigate={navigate}
      />
    );
  }

  // 4. Authenticated Application Routes (Protected via AppLayout)
  const isAuthRoute = [
    'dashboard',
    'discover',
    'ai-matches',
    'what-i-need',
    'opportunities',
    'connections',
    'messages',
    'saved-leads',
    'ai-lead-generator',
    'ai-outreach',
    'notifications',
    'profile',
    'settings',
    'billing',
  ].includes(currentPath);

  // If user is not authenticated and attempts to enter an app screen, redirect to sign-in or permit demo view
  if (isAuthRoute && !user) {
    return (
      <SignInPage
        onNavigate={navigate}
        onSignedIn={() => navigate(currentPath || 'dashboard')}
      />
    );
  }

  return (
    <AppLayout
      currentPath={currentPath}
      onNavigate={navigate}
      unreadNotificationsCount={unreadNotifications}
    >
      {currentPath === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {currentPath === 'ai-matches' && (
        <AiMatchesPage
          onNavigate={navigate}
          initialBrief={navigationState?.initialBrief}
        />
      )}
      {currentPath === 'discover' && <DiscoverPage onNavigate={navigate} />}
      {currentPath === 'what-i-need' && <WhatINeedPage onNavigate={navigate} />}
      {currentPath === 'opportunities' && (
        <OpportunitiesPage
          onNavigate={navigate}
          openCreateModalInitially={navigationState?.create}
        />
      )}
      {currentPath === 'connections' && <ConnectionsPage onNavigate={navigate} />}
      {currentPath === 'messages' && <MessagesPage onNavigate={navigate} />}
      {currentPath === 'saved-leads' && <SavedLeadsPage onNavigate={navigate} />}
      {currentPath === 'ai-lead-generator' && <AiLeadGeneratorPage onNavigate={navigate} />}
      {currentPath === 'ai-outreach' && <AiLeadGeneratorPage onNavigate={navigate} />}
      {currentPath === 'notifications' && <NotificationsPage onNavigate={navigate} />}
      {currentPath === 'profile' && <ProfilePage onNavigate={navigate} />}
      {currentPath === 'settings' && <SettingsPage onNavigate={navigate} />}
      {currentPath === 'billing' && <SettingsPage onNavigate={navigate} initialTab="billing" />}
    </AppLayout>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
