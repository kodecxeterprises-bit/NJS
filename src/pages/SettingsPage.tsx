import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface SettingsPageProps {
  onNavigate: (path: string) => void;
  initialTab?: string;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate, initialTab = 'account' }) => {
  const { user, businessProfile, subscription, signOut, hasGoogleAuth, signInWithGoogle, apiFetch, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [userName, setUserName] = useState(user?.name || '');
  const [userEmail, setUserEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleStatusMsg, setGoogleStatusMsg] = useState<string | null>(null);
  const [billingDetails, setBillingDetails] = useState<any>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'billing' || !user) return;
    let cancelled = false;
    apiFetch('/api/billing/subscription')
      .then((result) => { if (!cancelled) setBillingDetails(result.subscription ?? null); })
      .catch((error) => { if (!cancelled) setBillingError(error instanceof Error ? error.message : 'Could not load billing details.'); });
    return () => { cancelled = true; };
  }, [activeTab, apiFetch, user]);

  const manageBilling = async (action: 'cancel' | 'resume') => {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const result = await apiFetch(`/api/billing/${action}`, { method: 'POST' });
      setBillingDetails((current: any) => current ? { ...current, ...result.subscription } : current);
      await refreshUser();
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Could not update your subscription.');
    } finally {
      setBillingBusy(false);
    }
  };

  const cancelScheduledPlanChange = async () => {
    setBillingBusy(true); setBillingError(null);
    try {
      await apiFetch('/api/billing/schedule-change/cancel', { method: 'POST' });
      const refreshed = await apiFetch('/api/billing/subscription');
      setBillingDetails(refreshed.subscription ?? null);
      await refreshUser();
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Could not cancel the scheduled plan change.');
    } finally { setBillingBusy(false); }
  };

  const handleConnectGoogle = async () => {
    setGoogleConnecting(true);
    setGoogleStatusMsg(null);
    try {
      const res = await signInWithGoogle();
      if (res.success) {
        setGoogleStatusMsg('Google account successfully connected with Gmail send permissions!');
      } else {
        setGoogleStatusMsg(res.error || 'Failed to connect Google account.');
      }
    } catch (err: any) {
      setGoogleStatusMsg(err.message || 'Google authorization cancelled.');
    } finally {
      setGoogleConnecting(false);
    }
  };

  // AI Preferences
  const [aiCreativity, setAiCreativity] = useState('Standard Intent');
  const [autoVerifySourcing, setAutoVerifySourcing] = useState(true);

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: 'person' },
    { id: 'business', label: 'Business Profile', icon: 'storefront' },
    { id: 'ai', label: 'AI Preferences', icon: 'psychology' },
    { id: 'billing', label: 'Billing & Plans', icon: 'credit_card' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'security', label: 'Security & Privacy', icon: 'shield' },
    { id: 'connected', label: 'Connected Accounts', icon: 'link' },
  ];

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto">
      {savedSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-800 text-sm flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>Settings successfully saved.</span>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-on-surface">Settings</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Manage your account preferences, autonomous AI parameters, and corporate visibility.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar (3 cols) */}
        <div className="md:col-span-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-2 shadow-xs space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'business') {
                    onNavigate('profile');
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
                className={`w-full flex items-center px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all text-left ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined mr-3 text-[18px]">
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="pt-2 border-t border-outline-variant/20 mt-2">
            <button
              onClick={() => {
                signOut();
                onNavigate('sign-in');
              }}
              className="w-full flex items-center px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-primary hover:bg-surface-container text-left"
            >
              <span className="material-symbols-outlined mr-3 text-[18px]">logout</span>
              Sign Out
            </button>
          </div>
        </div>

        {/* Content Pane (8 cols) */}
        <div className="md:col-span-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 sm:p-8 shadow-xs">
          {activeTab === 'account' && (
            <form onSubmit={handleSaveAccount} className="space-y-6">
              <h2 className="text-xl font-bold text-on-surface">Account Credentials</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Full Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Email Address</label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                  />
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-primary font-medium">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    <span>{user?.isEmailVerified ? 'Email Verified' : 'Email Pending Verification'}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-outline-variant/20">
                  <h3 className="text-sm font-bold text-on-surface mb-3">Change Password</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-outline-variant/20">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-on-surface">AI Engine &amp; Intelligence Controls</h2>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                NJS uses server-side Gemini 3.8 Flash to interpret intent and match verified enterprises with zero hallucinated profiles.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                  <label className="block text-xs font-bold text-on-surface mb-1">Matching Rigor</label>
                  <select
                    value={aiCreativity}
                    onChange={(e) => setAiCreativity(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-surface border border-outline-variant text-xs sm:text-sm text-on-surface outline-none"
                  >
                    <option>Standard Intent (Highest supply-chain precision)</option>
                    <option>Broad Discovery (Include adjacent industries)</option>
                    <option>Strict Compliance (Requires certified tier-1 standards)</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                  <div>
                    <strong className="block text-xs font-bold text-on-surface">Autonomous Signal Extraction</strong>
                    <span className="text-xs text-on-surface-variant">Automatically parse locations and certifications from plain English briefs.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoVerifySourcing}
                    onChange={(e) => setAutoVerifySourcing(e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                </div>
              </div>

              <button
                onClick={() => showToast('AI preferences updated successfully.', 'success')}
                className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 shadow-xs cursor-pointer"
              >
                Update AI Preferences
              </button>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-on-surface">Subscription Plans &amp; Usage</h2>
                <p className="text-xs sm:text-sm text-on-surface-variant">
                  Current plan: <strong className="text-primary uppercase font-bold">{subscription?.plan === 'business' ? 'Enterprise' : subscription?.plan ?? 'free'}</strong>
                  {` · ${subscription?.creditsAvailable ?? 4850} credits remaining`}
                </p>
              </div>

              {billingError && <p role="alert" className="rounded-xl bg-error-container p-4 text-sm text-on-error-container">{billingError}</p>}
              <div className="rounded-2xl border border-outline-variant/30 bg-surface p-5 space-y-3">
                <h3 className="font-bold text-on-surface">Billing status</h3>
                <p className="text-sm text-on-surface-variant">
                  {billingDetails ? `${billingDetails.plan === 'business' ? 'Enterprise' : billingDetails.plan} · ${billingDetails.status.replace('_', ' ')}` : 'Free plan'}
                  {billingDetails?.billingInterval ? ` · ${billingDetails.billingInterval}` : ''}
                  {billingDetails?.amountKobo ? ` · ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: billingDetails.currency || 'NGN', maximumFractionDigits: 0 }).format(billingDetails.amountKobo / 100)}` : ''}
                </p>
                {billingDetails?.currentPeriodEnd && <p className="text-sm text-on-surface-variant">{billingDetails.cancelAtPeriodEnd ? 'Access ends' : 'Next renewal'}: {new Date(billingDetails.currentPeriodEnd).toLocaleDateString()}</p>}
                {billingDetails?.scheduledChange && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                  <p className="text-sm font-bold text-on-surface">Upcoming plan: {billingDetails.scheduledChange.plan === 'enterprise' ? 'Enterprise' : 'Pro'} · {billingDetails.scheduledChange.billingInterval}</p>
                  <p className="text-xs text-on-surface-variant">Starts {new Date(billingDetails.scheduledChange.effectiveAt).toLocaleDateString()}. Your current paid access remains active until then. No charge is taken now.</p>
                  <button onClick={() => void cancelScheduledPlanChange()} disabled={billingBusy} className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold disabled:opacity-50">Cancel scheduled change</button>
                </div>}
                {billingDetails?.paymentHistory?.length > 0 && <div className="space-y-2">
                  <h4 className="text-sm font-bold text-on-surface">Payment history</h4>
                  <div className="divide-y divide-outline-variant/30 rounded-xl border border-outline-variant/30">
                    {billingDetails.paymentHistory.map((payment: any) => <div key={payment.reference} className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs">
                      <div><p className="font-semibold text-on-surface">{new Intl.NumberFormat('en-NG', { style: 'currency', currency: payment.currency || 'NGN', maximumFractionDigits: 0 }).format(payment.amountKobo / 100)}</p><p className="text-on-surface-variant">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : new Date(payment.createdAt).toLocaleDateString()} · {payment.reference}</p></div>
                      <span className="capitalize text-on-surface-variant">{payment.status}</span>
                    </div>)}
                  </div>
                </div>}
                {(billingDetails?.status === 'active' || billingDetails?.status === 'non_renewing' || billingDetails?.status === 'past_due') && <button onClick={() => void manageBilling(billingDetails.cancelAtPeriodEnd ? 'resume' : 'cancel')} disabled={billingBusy} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold disabled:opacity-60">
                  {billingBusy ? 'Updating…' : billingDetails.cancelAtPeriodEnd ? 'Resume subscription' : 'Cancel at period end'}
                </button>}
                {!billingDetails && <p className="text-xs text-on-surface-variant">Your existing free-tier credit display is preserved. Paid-plan entitlements are not applied by this billing setup.</p>}
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => onNavigate('pricing')} className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold">View plans</button>
                <button onClick={() => void apiFetch('/api/billing/subscription').then((result) => setBillingDetails(result.subscription ?? null)).catch((error) => setBillingError(error.message))} className="px-5 py-2.5 rounded-xl bg-surface-container-high text-sm font-semibold">Refresh billing</button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-on-surface">Notification Preferences</h2>
              <div className="space-y-3">
                {[
                  { title: 'Connection Requests', desc: 'Notify when another business requests direct collaboration' },
                  { title: 'New RFPs in My Sector', desc: 'Notify when a high-intent opportunity matches my capabilities' },
                  { title: 'Direct Messages', desc: 'Receive instant alerts on incoming partner communications' },
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-surface border border-outline-variant/20 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-on-surface">{item.title}</div>
                      <div className="text-xs text-on-surface-variant">{item.desc}</div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-on-surface">Security &amp; Data Sovereignty</h2>
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs sm:text-sm text-on-surface leading-relaxed space-y-2">
                <p><strong>Private Data Isolation:</strong> Your private drafts, messages, and saved lead pipelines are strictly isolated to your verified account ID.</p>
                <p><strong>Zero Public Hallucination:</strong> NJS never shares non-public procurement details or exposes unapproved outreach drafts to external networks.</p>
              </div>
            </div>
          )}

          {activeTab === 'connected' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-on-surface">Connected Accounts &amp; Integrations</h2>

              {googleStatusMsg && (
                <div className="p-3 rounded-xl bg-orange-50 border border-primary/30 text-primary text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  <span>{googleStatusMsg}</span>
                </div>
              )}

              <div className="p-4 rounded-xl bg-surface border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center font-bold text-sm text-primary shadow-xs">
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-on-surface">Google Workspace &amp; Gmail</span>
                      {hasGoogleAuth ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 text-[10px] font-bold">
                          Connected
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-medium">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      Powers instant Single Sign-On and dispatches verification codes directly through official Gmail APIs.
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleConnectGoogle}
                  disabled={googleConnecting}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs cursor-pointer shrink-0 disabled:opacity-60"
                >
                  {googleConnecting ? 'Authorizing...' : hasGoogleAuth ? 'Reconnect Google' : 'Connect with Google'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
