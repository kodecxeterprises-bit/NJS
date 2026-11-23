-- Durable request identity for retry-safe support ticket and reply creation.
-- Nullable keys preserve all existing rows and clients that do not use the
-- authenticated Worker endpoints.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS creation_idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS creation_request_hash text;

ALTER TABLE public.support_replies
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

-- Make the identity used by the unique reply key authoritative for both
-- customers and administrators. The existing trigger remains attached; only
-- its function body is strengthened to derive sender fields from auth.users.
CREATE OR REPLACE FUNCTION public.enforce_support_reply_sender_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user auth.users%ROWTYPE;
  v_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit a support reply'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_user
    FROM auth.users
   WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated user record not found'
      USING ERRCODE = '42501';
  END IF;

  v_is_admin := coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
  NEW.sender_id := auth.uid();
  NEW.is_admin := v_is_admin;
  NEW.sender_name := coalesce(
    nullif(trim(v_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(v_user.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(v_user.raw_user_meta_data ->> 'display_name'), ''),
    'NJS User'
  );
  NEW.sender_email := v_user.email;
  RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_support_reply_sender_identity()
  FROM PUBLIC, anon, authenticated;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_constraint
     WHERE conrelid = 'public.support_tickets'::regclass
       AND conname = 'support_tickets_creation_idempotency_pair_check'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_creation_idempotency_pair_check
      CHECK ((creation_idempotency_key IS NULL) = (creation_request_hash IS NULL));
  END IF;
END;
$migration$;

-- One create operation per authenticated user and client-generated request key.
CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_user_creation_idempotency_uidx
  ON public.support_tickets (user_id, creation_idempotency_key)
  WHERE user_id IS NOT NULL AND creation_idempotency_key IS NOT NULL;

-- The reply identity is derived by the Worker and, for ordinary users, also
-- overwritten by the existing sender identity trigger. NULL keys keep legacy
-- replies unaffected. Unique enforcement serializes concurrent retries.
CREATE UNIQUE INDEX IF NOT EXISTS support_replies_ticket_sender_idempotency_uidx
  ON public.support_replies (ticket_id, sender_id, idempotency_key)
  WHERE sender_id IS NOT NULL AND idempotency_key IS NOT NULL;
