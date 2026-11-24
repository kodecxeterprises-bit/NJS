# NJS frontend and Cloudflare API repair

- Added the missing shared frontend model types in `src/types.ts`.
- Repaired the Express development server import to point at the existing `src/lib/api.ts` module.
- Replaced the legacy six-digit password-reset and email-verification UI with Supabase Auth's confirmation-link and password-recovery flows.
- Added Cloudflare Worker API handlers for dashboard statistics, opportunities, saved leads, lead discovery, notifications, AI brief/profile/description/outreach functions, and outreach draft storage.
- Kept protected routes behind Supabase access-token verification; database access runs server-side using the Worker secret.
- Added owner-scoped RLS tables for saved leads and outreach drafts. The migration was applied and RLS/service-role grants were verified in the connected Supabase project.
- Replaced the Netlify CI/deploy workflow with a Cloudflare Wrangler build/deploy workflow. The repository's existing extraction workflow excludes `.github`; the replacement workflow is also provided at the project root as `CLOUDFLARE-VALIDATE-WORKFLOW.yml` and must be copied into `.github/workflows/validate-njs.yml` in GitHub before the next push-triggered CI run.
- Replaced the Vite `__dirname` alias usage with `import.meta.dirname`.
- Added Worker API authorization smoke tests.

## Verification limits

- 52 TypeScript/TSX files passed TypeScript transpilation with zero syntax diagnostics.
- Supabase confirmed both new tables exist, have RLS enabled, and grant the Worker service role select/insert access.
- Full dependency-backed `tsc`, unit tests, and Vite production build could not be run in this environment because `npm install` timed out. The Cloudflare GitHub workflow is configured to run those build checks on the next commit.
- No GitHub commit or Cloudflare deployment was made by this repair.
