# NJS Cloudflare deployment setup

NJS deploys as a Cloudflare Worker with static assets from `dist/`. Do not deploy this project with Netlify CLI or require `netlify/functions`.

## GitHub Actions secrets

Configure these repository Actions secrets:

- `CLOUDFLARE_API_TOKEN`: API token with permission to edit Workers and deploy Workers Scripts for the target account.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.
- `VITE_SUPABASE_URL`: `https://nmdzcclvjtuwidzbxvua.supabase.co`.
- `VITE_SUPABASE_ANON_KEY`: the Supabase publishable/anon key used by the browser client.

The replacement workflow is included both at `.github/workflows/validate-njs.yml` and as the root-level `CLOUDFLARE-VALIDATE-WORKFLOW.yml`. It builds with the committed Bun lockfile, verifies the production bundle and Worker entrypoints, then deploys with Wrangler.

**Important for the current GitHub extraction workflow:** it explicitly excludes `.github/`, so extracting this ZIP will not replace the repository workflow. Copy the root-level `CLOUDFLARE-VALIDATE-WORKFLOW.yml` contents into `.github/workflows/validate-njs.yml` in GitHub before relying on CI; otherwise the old Netlify deploy workflow will still run. The repository extraction workflow cannot update workflow files itself with its current permissions.

## Cloudflare Worker secrets

Set these as Worker secrets (never put them in `wrangler.jsonc`, source files, or `VITE_` variables):

- `SUPABASE_SECRET_KEY`: the server-only Supabase secret/service-role key used by the Worker.
- `PAYSTACK_SECRET_KEY`: Paystack secret key. Keep Test Mode keys while testing.
- `PAYSTACK_WEBHOOK_SECRET`: configure if the webhook route uses a separate webhook verification secret.
- `GEMINI_API_KEY`: required for AI brief parsing, profile generation, description improvement and outreach drafting. Those endpoints return a clear 503 when it is not configured.

The Cloudflare dashboard can set Worker secrets under Workers & Pages → njs → Settings → Variables and Secrets. Also add `https://<your-worker-host>/verify-email` and `https://<your-worker-host>/reset-password` to Supabase Auth URL Configuration → Redirect URLs (along with your local development URLs if used). The GitHub deploy token and account ID are not substitutes for Worker runtime secrets.

## Database migration

`supabase/migrations/20261124041901_njs_app_api_tables.sql` creates the `saved_leads` and `outreach_drafts` tables with RLS and owner-scoped policies. It has already been applied to the connected NJS Supabase project and verified; do not apply it a second time.

## Current intentional limitation

NJS does not have an outbound email provider wired to `/api/outreach/send`. The endpoint deliberately returns HTTP 501 instead of claiming that a draft was emailed. Configure and verify an email provider before enabling real outreach delivery.
