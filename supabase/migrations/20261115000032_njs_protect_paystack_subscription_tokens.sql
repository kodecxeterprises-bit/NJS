-- Keep subscription reads available through RLS while withholding Paystack
-- management credentials and internal metadata from Data API clients.
-- Grants can exist at both table and column level; remove both explicitly
-- before restoring the limited authenticated read set.
-- The original migration used a different name for the authorization signature
-- column. Normalize that legacy schema here so fresh and existing projects
-- converge on the live column name without rewriting migration history.
do $migration$
declare
  has_legacy_signature boolean;
  has_canonical_signature boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'paystack_authorization_signature'
  ) into has_legacy_signature;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'authorization_signature'
  ) into has_canonical_signature;

  if has_legacy_signature and has_canonical_signature then
    raise exception 'Both authorization signature columns exist; reconcile them before applying this migration.';
  elsif has_legacy_signature then
    alter table public.subscriptions
      rename column paystack_authorization_signature to authorization_signature;
  elsif not has_canonical_signature then
    raise exception 'Neither supported authorization signature column exists on public.subscriptions.';
  end if;
end
$migration$;

revoke all privileges on table public.subscriptions from anon, authenticated;
revoke select (
  id,
  user_id,
  plan_code,
  status,
  amount_kobo,
  currency,
  paystack_customer_code,
  paystack_subscription_code,
  paystack_email_token,
  authorization_signature,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  cancelled_at,
  metadata,
  created_at,
  updated_at
) on table public.subscriptions from anon, authenticated;

grant select (
  id,
  user_id,
  plan_code,
  status,
  amount_kobo,
  currency,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  cancelled_at,
  created_at,
  updated_at
) on public.subscriptions to authenticated;

-- The billing API allows only one pending or entitled subscription per user.
-- This closes the race between its read-before-insert checks.
-- If legacy duplicates exist, this index fails safely; resolve them before applying.
create unique index if not exists idx_subscriptions_one_open_per_user
on public.subscriptions (user_id)
where status in ('pending', 'active', 'non_renewing', 'past_due');
