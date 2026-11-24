# NJS subscription renewal update

This full-source replacement is based on the latest Library archive `NJS-subscription-renewal-update.zip` (version 2, November 23, 2026).

## Included

- Pro: ₦15,000 monthly / ₦150,000 annually.
- Enterprise: ₦50,000 monthly / ₦500,000 annually.
- Annual billing reflects 10 months charged (2 months free).
- Paystack recurring subscriptions and verified payment activation.
- Scheduled plan/interval changes at the end of the current paid period.
- Cancellation of a pending plan change and restoration of the original renewal.
- Pricing and Settings billing status, pending change, and payment history UI.
- Supabase migration and generated database types for scheduled changes.

## Renewal lifecycle correction

`subscription.disable` now means renewal is disabled, not that already-paid access should immediately be revoked. Eligible subscriptions remain `non_renewing` until `current_period_end`; only then does the effective status become `expired`. A disabled pending replacement does not become an entitled subscription.

## Database note

Migration `20261123100000_njs_scheduled_subscription_plan_changes.sql` is included for reproducibility and has already been applied to the connected NJS Supabase project. Do not apply it again to that project.

## Verification status

All 49 TypeScript/TSX files passed a syntax transpilation check. Dependency installation timed out in this environment, so full lint, automated tests, and production build remain to be run by the existing Cloudflare build pipeline. This archive has not been deployed.

## Production build import repair (2026-11-24)

- Corrected the Google authentication imports in `ForgotPasswordPage.tsx` and `VerifyEmailPage.tsx` to reference the existing implementation at `src/lib/googleAuth.ts`.
- The previous imports pointed to a non-existent `src/services/googleAuth` path and caused the Vite production build to fail with unresolved imports.
- Dependency installation timed out in the repair environment, so a full Vite production build could not be rerun here. Re-run the GitHub Actions production build after committing this archive.
