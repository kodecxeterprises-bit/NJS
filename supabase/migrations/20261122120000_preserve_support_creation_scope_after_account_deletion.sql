-- Keep support-ticket idempotency scoped to the original creator even after
-- auth.users deletion sets support_tickets.user_id to NULL.
-- A NULL creation_actor_id represents an unlinked/guest submission. Authenticated
-- submissions copy auth.uid() into this non-FK column, which survives account
-- deletion. Trusted service-role inserts without a user JWT may use user_id.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS creation_actor_id uuid;

-- Preserve the creator scope for all currently linked tickets. Existing
-- unlinked tickets remain in the shared guest/legacy-unlinked scope.
UPDATE public.support_tickets
   SET creation_actor_id = user_id
 WHERE creation_actor_id IS NULL
   AND user_id IS NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_constraint
     WHERE conrelid = 'public.support_tickets'::regclass
       AND conname = 'support_tickets_creation_actor_not_guest_sentinel_check'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_creation_actor_not_guest_sentinel_check
      CHECK (
        creation_actor_id IS DISTINCT FROM
        '00000000-0000-0000-0000-000000000000'::uuid
      );
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.set_support_ticket_creation_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Support ticket owner must match the authenticated user'
          USING ERRCODE = '42501';
      END IF;
      NEW.creation_actor_id := auth.uid();
    ELSE
      -- Anonymous rows share a guest scope. Trusted service-role inserts may
      -- supply user_id; ordinary anon inserts are constrained by RLS to NULL.
      NEW.creation_actor_id := NEW.user_id;
    END IF;
  ELSIF NEW.creation_actor_id IS DISTINCT FROM OLD.creation_actor_id THEN
    RAISE EXCEPTION 'Support ticket creation scope is immutable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.set_support_ticket_creation_actor()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS set_support_ticket_creation_actor
  ON public.support_tickets;

CREATE TRIGGER set_support_ticket_creation_actor
BEFORE INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_support_ticket_creation_actor();

-- Refuse to silently rewrite existing duplicate request identities. If this
-- raises, inspect duplicate ticket IDs before deciding how to reconcile them.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.support_tickets
     WHERE creation_idempotency_key IS NOT NULL
     GROUP BY
       coalesce(
         creation_actor_id,
         '00000000-0000-0000-0000-000000000000'::uuid
       ),
       creation_idempotency_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate support ticket idempotency keys exist within a creation scope; reconcile them before applying this migration';
  END IF;
END;
$migration$;

-- A single index covers authenticated and guest scopes. Unlike user_id, the
-- immutable creation_actor_id is not nulled by auth.users ON DELETE SET NULL.
CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_creation_actor_idempotency_uidx
  ON public.support_tickets (
    coalesce(
      creation_actor_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    ),
    creation_idempotency_key
  )
  WHERE creation_idempotency_key IS NOT NULL;

DROP INDEX IF EXISTS public.support_tickets_user_creation_idempotency_uidx;
DROP INDEX IF EXISTS public.support_tickets_anonymous_creation_idempotency_uidx;
