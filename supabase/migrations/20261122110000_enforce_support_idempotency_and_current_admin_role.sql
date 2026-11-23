-- Require durable request keys for all new support rows while leaving
-- historical rows with NULL keys untouched.
CREATE OR REPLACE FUNCTION public.enforce_support_ticket_idempotency_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.creation_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'A support ticket idempotency key is required'
      USING ERRCODE = '23502';
  END IF;

  IF NEW.creation_request_hash IS NULL OR NEW.creation_request_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'A valid support ticket request hash is required'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_support_ticket_idempotency_key()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_support_ticket_idempotency_key
  ON public.support_tickets;

CREATE TRIGGER enforce_support_ticket_idempotency_key
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_support_ticket_idempotency_key();

CREATE OR REPLACE FUNCTION public.enforce_support_reply_idempotency_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.idempotency_key IS NULL THEN
    RAISE EXCEPTION 'A support reply idempotency key is required'
      USING ERRCODE = '23502';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_support_reply_idempotency_key()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_support_reply_idempotency_key
  ON public.support_replies;

CREATE TRIGGER enforce_support_reply_idempotency_key
BEFORE INSERT ON public.support_replies
FOR EACH ROW
EXECUTE FUNCTION public.enforce_support_reply_idempotency_key();

-- Anonymous tickets have user_id NULL, so a separate partial index gives
-- their keys a stable global scope. Authenticated ticket keys keep their
-- existing per-user scope. Both indexes preserve historical NULL keys.
CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_anonymous_creation_idempotency_uidx
  ON public.support_tickets (creation_idempotency_key)
  WHERE user_id IS NULL AND creation_idempotency_key IS NOT NULL;

-- Use the current Auth user record as the single admin-role source. The
-- helper accepts no user ID argument and reads only the caller identified by
-- auth.uid(), avoiding recursive RLS evaluation on public support tables.
CREATE OR REPLACE FUNCTION public.njs_current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT coalesce(
    (
      SELECT (u.raw_app_meta_data ->> 'role') = 'admin'
        FROM auth.users AS u
       WHERE u.id = auth.uid()
    ),
    false
  )
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.njs_current_user_is_admin()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.njs_current_user_is_admin()
  TO authenticated, service_role;

-- Replace JWT-snapshot policy checks with the authoritative current role.
DROP POLICY IF EXISTS "Admins can manage all support tickets"
  ON public.support_tickets;
CREATE POLICY "Admins can manage all support tickets"
  ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.njs_current_user_is_admin())
  WITH CHECK (public.njs_current_user_is_admin());

DROP POLICY IF EXISTS "Admins can manage all support replies"
  ON public.support_replies;
CREATE POLICY "Admins can manage all support replies"
  ON public.support_replies
  FOR ALL TO authenticated
  USING (public.njs_current_user_is_admin())
  WITH CHECK (public.njs_current_user_is_admin());

-- Derive reply classification from the same current-role helper used by RLS.
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

  v_is_admin := public.njs_current_user_is_admin();
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
