
-- NJS billing foundation: Paystack recurring subscriptions (NGN).
create table if not exists public.billing_plans (
  code text primary key,
  name text not null,
  billing_interval text not null check (billing_interval in ('monthly','annual')),
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, billing_interval)
);

insert into public.billing_plans (code, name, billing_interval, amount_kobo, currency, is_active)
values
  ('pro_monthly', 'pro', 'monthly', 1500000, 'NGN', true),
  ('pro_annual', 'pro', 'annual', 15000000, 'NGN', true),
  ('enterprise_monthly', 'enterprise', 'monthly', 5000000, 'NGN', true),
  ('enterprise_annual', 'enterprise', 'annual', 50000000, 'NGN', true)
on conflict (code) do update set
  name = excluded.name,
  billing_interval = excluded.billing_interval,
  amount_kobo = excluded.amount_kobo,
  currency = excluded.currency,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.billing_plans(code),
  status text not null default 'pending'
    check (status in ('pending','active','non_renewing','past_due','cancelled','expired','failed')),
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  paystack_customer_code text,
  paystack_subscription_code text unique,
  paystack_email_token text,
  authorization_signature text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_created_idx
  on public.subscriptions (user_id, created_at desc);
create index if not exists subscriptions_status_period_idx
  on public.subscriptions (status, current_period_end);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_code text references public.billing_plans(code),
  reference text not null unique,
  gateway text not null default 'paystack' check (gateway = 'paystack'),
  gateway_transaction_id text unique,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending'
    check (status in ('pending','success','failed','abandoned','reversed')),
  paid_at timestamptz,
  gateway_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_transactions_user_created_idx
  on public.payment_transactions (user_id, created_at desc);
create index if not exists payment_transactions_subscription_idx
  on public.payment_transactions (subscription_id);

-- Private-to-clients webhook inbox. The Worker/service role alone may access it.
create table if not exists public.paystack_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  paystack_event_id text,
  signature_verified boolean not null default false,
  processed boolean not null default false,
  processing_error text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists paystack_webhook_events_unprocessed_idx
  on public.paystack_webhook_events (received_at)
  where processed = false;

alter table public.billing_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.paystack_webhook_events enable row level security;

drop policy if exists "Anyone can view active billing plans" on public.billing_plans;
create policy "Anyone can view active billing plans"
  on public.billing_plans for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Users can view their own subscriptions" on public.subscriptions;
create policy "Users can view their own subscriptions"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own payment transactions" on public.payment_transactions;
create policy "Users can view their own payment transactions"
  on public.payment_transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No client policies for writes or webhook events. Privileged Worker operations
-- use the Supabase secret/service key, which bypasses RLS.
revoke all on public.billing_plans from anon, authenticated;
grant select on public.billing_plans to anon, authenticated;

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

revoke all on public.payment_transactions from anon, authenticated;
grant select on public.payment_transactions to authenticated;

revoke all on public.paystack_webhook_events from anon, authenticated;

grant all on public.billing_plans to service_role;
grant all on public.subscriptions to service_role;
grant all on public.payment_transactions to service_role;
grant all on public.paystack_webhook_events to service_role;
