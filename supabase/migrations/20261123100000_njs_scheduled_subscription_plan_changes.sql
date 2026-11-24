-- Schedule Paystack plan/interval switches at the paid-through boundary.
-- Only the trusted Cloudflare Worker (service role) can read or mutate this table.
create table if not exists public.scheduled_plan_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  replacement_subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  target_plan_code text not null references public.billing_plans(code),
  effective_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_plan_changes_distinct_subscriptions
    check (current_subscription_id <> replacement_subscription_id)
);

create unique index if not exists scheduled_plan_changes_one_pending_per_user
  on public.scheduled_plan_changes (user_id) where status = 'scheduled';
create index if not exists scheduled_plan_changes_effective_idx
  on public.scheduled_plan_changes (effective_at) where status = 'scheduled';

alter table public.scheduled_plan_changes enable row level security;
revoke all privileges on table public.scheduled_plan_changes from anon, authenticated;
grant all privileges on table public.scheduled_plan_changes to service_role;

comment on table public.scheduled_plan_changes is
  'Private Paystack renewal switches. The existing paid subscription remains entitled through effective_at; replacement access begins only after verified payment.';
