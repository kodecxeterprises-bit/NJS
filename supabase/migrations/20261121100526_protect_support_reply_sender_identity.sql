-- Prevent ticket owners from presenting replies as NJS support staff.
-- The trigger derives ordinary-user identity from the authenticated account.
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
  v_is_admin :=
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);

  IF NOT v_is_admin THEN
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

    NEW.sender_id := auth.uid();
    NEW.is_admin := false;
    NEW.sender_name := coalesce(
      nullif(trim(v_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(v_user.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(v_user.raw_user_meta_data ->> 'display_name'), ''),
      'NJS User'
    );
    NEW.sender_email := v_user.email;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_support_reply_sender_identity
  ON public.support_replies;

CREATE TRIGGER enforce_support_reply_sender_identity
BEFORE INSERT ON public.support_replies
FOR EACH ROW
EXECUTE FUNCTION public.enforce_support_reply_sender_identity();

REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_support_reply_sender_identity()
  FROM PUBLIC, anon, authenticated;
