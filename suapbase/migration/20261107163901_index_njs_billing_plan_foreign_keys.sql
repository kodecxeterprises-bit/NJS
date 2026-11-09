
-- NJS Billing Indexes
-- Improves lookup performance for subscriptions,
-- payment history, and webhook processing.

create index if not exists idx_subscriptions_user_created
on public.subscriptions (user_id, created_at desc);

create index if not exists idx_subscriptions_status_period
on public.subscriptions (status, current_period_end);

create index if not exists idx_subscriptions_plan_code
on public.subscriptions (plan_code);

create index if not exists idx_payment_transactions_user_created
on public.payment_transactions (user_id, created_at desc);

create index if not exists idx_payment_transactions_subscription
on public.payment_transactions (subscription_id);

create index if not exists idx_payment_transactions_plan_code
on public.payment_transactions (plan_code);

create index if not exists idx_paystack_webhook_events_unprocessed
on public.paystack_webhook_events (received_at)
where processed = false;
