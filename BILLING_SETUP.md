# NJS Paystack billing setup

The billing Worker uses the existing Supabase tables created by the migrations in `supabase/migrations/`. This is the standard migration location read by the Supabase CLI. Checkout and webhook code is restricted to Paystack Test Mode until the code is deliberately changed to support live credentials.

## Cloudflare configuration

The following configuration is required:

- `SUPABASE_URL`: existing non-secret Worker variable in `wrangler.jsonc`.
- `SUPABASE_SECRET_KEY`: Cloudflare Worker secret containing the Supabase server-side secret/service-role key used by this project.
- `PAYSTACK_SECRET_KEY`: Cloudflare Worker secret containing a Paystack **Test Mode** secret key. The Worker rejects keys that do not use the `sk_test_` prefix.
- `PAYSTACK_WEBHOOK_SECRET`: optional Cloudflare Worker secret for Paystack's timestamped `Paystack-Signature` header (`whsec_...`). Configure it if that newer signing header is enabled for the webhook endpoint. The Worker also supports `x-paystack-signature` with `PAYSTACK_SECRET_KEY` for existing Test Mode webhook configurations.

Set the required secrets from a terminal without adding their values to repository files:

```sh
wrangler secret put SUPABASE_SECRET_KEY
wrangler secret put PAYSTACK_SECRET_KEY
```

If the dashboard sends the newer timestamped signature header, also set `PAYSTACK_WEBHOOK_SECRET`:

```sh
wrangler secret put PAYSTACK_WEBHOOK_SECRET
```

The Worker derives the checkout callback origin from the request URL. No frontend Paystack credential or extra callback URL secret is required. The four Test Mode Paystack plan codes are mapped in `cloudflare/billing-routes.ts` to the internal `billing_plans.code` values.

## Paystack dashboard setup

Configure the Paystack webhook URL as:

```text
https://<your-worker-host>/api/billing/webhook
```

Enable subscription creation, non-renewal and disable events, successful charges, and failed invoice payments. The Worker validates either Paystack's timestamped `Paystack-Signature` header or the legacy `x-paystack-signature` HMAC SHA-512 header against the exact raw request body before parsing or recording events.

## Checkout return

The checkout callback returns the customer to `/billing?checkout=complete`. That page loads subscription/payment status from the Worker. A browser redirect does not activate an account; only a signed webhook followed by a server-side Paystack transaction verification can mark a payment successful.

## Local checks

The repository currently has a Bun lockfile. Install using the matching package manager (`bun install --frozen-lockfile`) and run the project build, TypeScript check, and billing unit tests. Migration `supabase/migrations/20261115000032_njs_protect_paystack_subscription_tokens.sql` withholds Paystack management credentials from authenticated Data API users and adds a unique index that prevents multiple open subscriptions per user. Check for duplicate open subscriptions before applying it; the index will fail without changing data if duplicates exist. The Worker service credential retains access.
