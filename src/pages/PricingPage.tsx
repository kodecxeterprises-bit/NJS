import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CreditCard, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PricingPageProps {
  onNavigate: (path: string) => void;
}

interface BillingSubscription {
  id: string;
  plan: 'pro' | 'enterprise' | 'free';
  planCode: string;
  billingInterval: 'monthly' | 'annually';
  status: string;
  amountKobo: number;
  currency: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const naira = (amount: number) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
}).format(amount);

const plans = [
  {
    code: 'pro',
    name: 'Pro',
    description: 'For businesses actively sourcing suppliers.',
    monthly: 15_000,
    annual: 150_000,
    featured: true,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'For teams coordinating complex procurement.',
    monthly: 50_000,
    annual: 500_000,
    featured: false,
  },
] as const;

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const { user, apiFetch } = useAuth();
  const [interval, setInterval] = useState<'monthly' | 'annually'>('monthly');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      return;
    }
    let active = true;
    setLoadingSubscription(true);
    apiFetch('/api/billing/subscription')
      .then((result) => {
        if (active) setSubscription(result.subscription ?? null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load your current plan.');
      })
      .finally(() => {
        if (active) setLoadingSubscription(false);
      });
    return () => { active = false; };
  }, [user, apiFetch]);

  const currentPlanLabel = useMemo(() => {
    if (!subscription) return null;
    return subscription.plan === 'enterprise' ? 'Enterprise' : subscription.plan === 'pro' ? 'Pro' : 'Free';
  }, [subscription]);

  const checkout = async (planCode: string) => {
    if (!user) {
      onNavigate('sign-in');
      return;
    }
    setBusyPlan(planCode);
    setError(null);
    try {
      const result = await apiFetch('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ planCode }),
      });
      if (typeof result.authorizationUrl !== 'string') throw new Error('Checkout could not be opened.');
      window.location.assign(result.authorizationUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout could not be opened.');
      setBusyPlan(null);
    }
  };

  const activeSubscription = subscription && ['active', 'non_renewing', 'past_due'].includes(subscription.status);

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface font-sans">
      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface/90 px-6 py-4 backdrop-blur-xl lg:px-16">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button onClick={() => onNavigate('landing')} className="flex cursor-pointer select-none items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-on-primary">NJS</span>
            <span className="text-xl font-bold tracking-tight">NJS Platform</span>
          </button>
          <div className="flex items-center gap-3">
            {user ? (
              <button onClick={() => onNavigate('settings')} className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-container">Account settings</button>
            ) : <>
              <button onClick={() => onNavigate('sign-in')} className="px-3 py-2 text-sm font-semibold hover:text-primary">Sign in</button>
              <button onClick={() => onNavigate('sign-up')} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition hover:opacity-90">Get started</button>
            </>}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-14 sm:px-8 lg:py-20">
        <section className="mx-auto mb-12 max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <Sparkles size={14} /> Straightforward plans
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">Make your next move <span className="text-primary">with NJS.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-on-surface-variant sm:text-lg">Choose the billing schedule that works for your business. No surprises—your selected price and billing interval are shown before payment.</p>
        </section>

        <section className="mb-10 flex flex-col items-center gap-4" aria-label="Choose billing interval">
          <div className="inline-flex rounded-2xl border border-outline-variant/60 bg-surface-container-low p-1.5 shadow-sm" role="group" aria-label="Billing interval">
            <button onClick={() => setInterval('monthly')} aria-pressed={interval === 'monthly'} className={`rounded-xl px-5 py-3 text-sm font-bold transition sm:px-7 ${interval === 'monthly' ? 'bg-surface-container-highest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>Monthly</button>
            <button onClick={() => setInterval('annually')} aria-pressed={interval === 'annually'} className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition sm:px-7 ${interval === 'annually' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>Yearly <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${interval === 'annually' ? 'bg-on-primary/15 text-on-primary' : 'bg-primary/10 text-primary'}`}>2 months free</span></button>
          </div>
          <p className="text-xs text-on-surface-variant">Annual billing is equivalent to paying for 10 months.</p>
        </section>

        {error && <div role="alert" className="mx-auto mb-7 max-w-3xl rounded-2xl border border-error/20 bg-error-container px-5 py-4 text-sm text-on-error-container">{error}</div>}

        {activeSubscription && <div className="mx-auto mb-8 flex max-w-4xl flex-col items-start justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-primary/10 p-2.5 text-primary"><CreditCard size={20} /></span>
            <div>
              <p className="font-bold">You're currently on {currentPlanLabel}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{subscription?.status === 'non_renewing' || subscription?.cancelAtPeriodEnd ? 'Your plan is set to end' : 'Your subscription is active'}{subscription?.currentPeriodEnd ? ` on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}` : ''}. Manage your billing in account settings.</p>
            </div>
          </div>
          <button onClick={() => onNavigate('settings')} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition hover:opacity-90">Manage billing <ArrowRight size={16} /></button>
        </div>}

        <div className="mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 lg:grid-cols-3 lg:gap-7">
          <article className="flex flex-col rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-7 shadow-sm sm:p-8">
            <div className="mb-6">
              <span className="inline-flex rounded-full bg-surface-container px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">Starter</span>
              <h2 className="mt-5 text-2xl font-extrabold">Free</h2>
              <p className="mt-2 min-h-10 text-sm leading-6 text-on-surface-variant">A simple way to get started with NJS.</p>
              <div className="mt-6 flex items-end gap-2"><span className="text-4xl font-extrabold tracking-tight">₦0</span><span className="pb-1 text-sm text-on-surface-variant">forever</span></div>
            </div>
            <div className="mb-7 h-px bg-outline-variant/40" />
            <ul className="flex-1 space-y-4 text-sm text-on-surface">
              {['Business profile', 'Directory search and filters', 'AI brief parsing', 'Direct messaging on connect'].map((item) => <li key={item} className="flex items-start gap-3"><Check size={17} className="mt-0.5 shrink-0 text-primary" /><span>{item}</span></li>)}
            </ul>
            <button onClick={() => onNavigate(user ? 'dashboard' : 'sign-up')} className="mt-9 w-full rounded-xl border border-outline-variant px-5 py-3.5 text-sm font-bold transition hover:bg-surface-container">{user && (!activeSubscription || subscription?.plan === 'free') ? 'Continue with Free' : 'Get started free'}</button>
          </article>

          {plans.map((plan) => {
            const price = interval === 'monthly' ? plan.monthly : plan.annual;
            const planCode = `${plan.code}_${interval === 'monthly' ? 'monthly' : 'annual'}`;
            const annualSaving = plan.monthly * 12 - plan.annual;
            const isCurrentPlan = activeSubscription && subscription?.plan === plan.code && subscription?.billingInterval === interval;
            return <article key={plan.code} className={`relative flex flex-col rounded-3xl p-7 sm:p-8 ${plan.featured ? 'border-2 border-primary bg-surface-container-lowest shadow-xl shadow-primary/10' : 'border border-outline-variant/50 bg-surface-container-lowest shadow-sm'}`}>
              {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-on-primary">Popular choice</div>}
              <div className="mb-6">
                <div className="flex items-center justify-between gap-2"><span className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider ${plan.featured ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>{plan.name}</span>{isCurrentPlan && <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Current plan</span>}</div>
                <h2 className="mt-5 text-2xl font-extrabold">{plan.name}</h2>
                <p className="mt-2 min-h-10 text-sm leading-6 text-on-surface-variant">{plan.description}</p>
                <div className="mt-6 flex flex-wrap items-end gap-x-2 gap-y-1"><span className="text-4xl font-extrabold tracking-tight text-primary">{naira(price)}</span><span className="pb-1 text-sm text-on-surface-variant">/ {interval === 'monthly' ? 'month' : 'year'}</span></div>
                {interval === 'annually' ? <p className="mt-2 text-xs font-semibold text-primary">Save {naira(annualSaving)} compared with monthly billing</p> : <p className="mt-2 text-xs text-on-surface-variant">Billed monthly. Cancel at period end.</p>}
              </div>
              <div className="mb-6 h-px bg-outline-variant/40" />
              <div className="mb-7 flex-1 rounded-2xl bg-surface-container-low p-4">
                <div className="flex items-center gap-2 text-sm font-bold"><Wallet size={17} className="text-primary" /> Subscription billing</div>
                <p className="mt-2 text-xs leading-5 text-on-surface-variant">Secure checkout powered by Paystack. Your billing interval and amount are confirmed before payment.</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant"><ShieldCheck size={15} className="text-primary" /> Payment details handled by Paystack</div>
              </div>
              <button onClick={() => void checkout(planCode)} disabled={busyPlan !== null || loadingSubscription || Boolean(activeSubscription)} className={`w-full rounded-xl px-5 py-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${plan.featured ? 'bg-primary text-on-primary hover:opacity-90' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}>
                {busyPlan === planCode ? 'Opening secure checkout…' : isCurrentPlan ? 'Current plan' : activeSubscription ? 'Manage current plan' : user ? `Choose ${plan.name}` : 'Sign in to subscribe'}
              </button>
              {activeSubscription && <p className="mt-3 text-center text-xs text-on-surface-variant">Review your current subscription and renewal options in account settings.</p>}
            </article>;
          })}
        </div>

        <p className="mx-auto mt-9 max-w-3xl text-center text-xs leading-5 text-on-surface-variant">Plan prices shown are the approved subscription charges. Specific feature limits and paid-plan entitlements will be displayed here once those product rules are finalized.</p>
      </main>

      <footer className="border-t border-outline-variant/30 bg-surface-container-low px-6 py-8 text-center text-xs text-on-surface-variant">© 2026 NJS Platform. All rights reserved.</footer>
    </div>
  );
};
