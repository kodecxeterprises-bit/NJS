
-- NJS Paystack Billing Foundation
-- Creates billing plans, subscriptions, payment transactions,
-- and private Paystack webhook event records.

create table if not exists public.billing_plans (
  code text primary key,
  name text not null,
  billing_interval text not null
    check (billing_interval in ('monthly', 'annually')),
  amount_kobo bigint not null check (amount_kobo >= 0),
  currency text not null default 'NGN',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.billing_plans(code),
  status text not null default 'pending'
    check (status in (
      'pending',
      'active',
      'non_renewing',
      'past_due',
      'cancelled',
      'expired',
      'failed'
    )),
  amount_kobo bigint not null,
  currency text not null default 'NGN',

  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_email_token text,
  paystack_authorization_signature text,

  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_code text not null references public.billing_plans(code),

  reference text not null unique,
  gateway text not null default 'paystack',
  gateway_transaction_id text unique,

  amount_kobo bigint not null,
  currency text not null default 'NGN',

  status text not null default 'pending'
    check (status in (
      'pending',
      'success',
      'failed',
      'abandoned',
      'reversed'
    )),

  paid_at timestamptz,
  gateway_response jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paystack_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  paystack_event_id text,
  signature_verified boolean not null default false,
  processed boolean not null default false,
  processing_error text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Seed the approved NJS subscription plans.
insert into public.billing_plans
  (code, name, billing_interval, amount_kobo, currency, is_active)
values
  ('pro_monthly', 'Pro', 'monthly', 1500000, 'NGN', true),
  ('pro_annual', 'Pro', 'annually', 15000000, 'NGN', true),
  ('enterprise_monthly', 'Enterprise', 'monthly', 5000000, 'NGN', true),
  ('enterprise_annual', 'Enterprise', 'annually', 50000000, 'NGN', true)
on conflict (code) do update set
  name = excluded.name,
  billing_interval = excluded.billing_interval,
  amount_kobo = excluded.amount_kobo,
  currency = excluded.currency,
  is_active = excluded.is_active,
  updated_at = now();

-- Enable Row Level Security.
alter table public.billing_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.paystack_webhook_events enable row level security;

-- Plans can be read by visitors and authenticated users.
create policy "Active billing plans are publicly readable"
on public.billing_plans
for select
to anon, authenticated
using (is_active = true);

-- Users can only read their own subscriptions.
create policy "Users can read their own subscriptions"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

-- Users can only read their own payment transactions.
create policy "Users can read their own payment transactions"
on public.payment_transactions
for select
to authenticated
using (auth.uid() = user_id);

-- No client-facing policies are created for webhook events.
-- Webhook processing is performed by trusted server-side code.

-- Remove client write access. Server-side service role handles writes.
revoke all on public.billing_plans from anon, authenticated;
grant select on public.billing_plans to anon, authenticated;

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

revoke all on public.payment_transactions from anon, authenticated;
grant select on public.payment_transactions to authenticated;

revoke all on public.paystack_webhook_events from anon, authenticated;

-- Service role performs trusted billing operations.
grant all on public.billing_plans to service_role;
grant all on public.subscriptions to service_role;
grant all on public.payment_transactions to service_role;
grant all on public.paystack_webhook_events to service_role;
