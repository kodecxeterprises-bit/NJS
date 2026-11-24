# NJS subscription update — installation notes

This archive is a full NJS source replacement based on the latest extracted NJS project supplied in the conversation. It includes the coordinated subscription backend, Cloudflare Worker routes, database migration, billing types, tests, and Pricing/Settings UI changes.

## What changed

- Keeps the approved prices: Pro ₦15,000 monthly / ₦150,000 annually; Enterprise ₦50,000 monthly / ₦500,000 annually.
- Adds scheduled plan and billing-interval changes at the end of the current paid period.
- Creates a replacement Paystack subscription using the saved, server-verified reusable authorization; it does not charge immediately.
- Prevents overlapping renewals by disabling the old Paystack renewal while preserving the existing paid entitlement through its recorded period end.
- Activates the replacement only after a successful payment has been verified server-side.
- Adds cancellation of a pending plan change and restores the original renewal.
- Saves authorization codes from verified payments and attempts a server-side verification backfill for existing Test Mode subscribers.
- Displays pending plan changes and recent payment history in Pricing and Settings.
- Leaves existing free-tier credit displays and current plan entitlement rules unchanged.

## Apply the database migration before deploying

This migration was already applied to the NJS Supabase project. Do not run it again; keep the file in source control so fresh environments can reproduce the schema:

`supabase/migrations/20261123100000_njs_scheduled_subscription_plan_changes.sql`

Use the Supabase SQL Editor with the complete contents of that file, or apply pending migrations using the project's established Supabase CLI workflow. Do not deploy the updated Worker before the migration exists, because the new routes read and write `scheduled_plan_changes`.

## Local verification on Windows PowerShell

From the extracted `NJS` project folder:

```powershell
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
```

Then deploy through the existing Cloudflare workflow. Keep the existing Worker secrets in Cloudflare; do not put secret values in this archive or source files. Paystack remains restricted to Test Mode (`sk_test_`) in this implementation.

## Important behavior

- A scheduled change takes effect at `current_period_end`.
- The current plan remains the effective plan until the paid period ends.
- The replacement plan does not become active until its first successful Paystack charge is verified.
- If an account's existing payment has no reusable authorization, the Worker attempts to recover it by verifying the latest successful transaction. If Paystack does not return a reusable authorization, it refuses the switch without changing the current plan.
- If a user already cancelled renewal, they must resume the current subscription before scheduling a plan switch.

## Renewal lifecycle safety correction in this build

Paystack's `subscription.disable` event now stops renewal without immediately changing an eligible paid subscription to `cancelled`. Active, past-due, and already non-renewing subscriptions remain `non_renewing`; the API derives `expired` only after `current_period_end`. A disabled pending replacement does not gain an entitlement. This protects both user-requested cancellation and scheduled plan changes from prematurely removing paid access.

## Verification performed for this archive

- ZIP integrity verified before extraction.
- TypeScript/TSX syntax transpilation check passed for all 49 source files.
- The dependency install did not complete in the build environment, so the full TypeScript typecheck, automated test suite, and Vite production build could not be run here. Do not treat this archive as a deployed release until the existing Cloudflare build succeeds.
