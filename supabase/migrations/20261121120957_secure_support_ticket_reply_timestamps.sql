-- Authenticated users may insert replies for their own tickets, but their RLS
-- policies do not permit UPDATE on support_tickets. Run this narrow parent
-- timestamp update with the function owner's privileges so every permitted
-- reply insert updates its ticket in the same transaction.
CREATE OR REPLACE FUNCTION public.touch_support_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.support_tickets
     SET updated_at = pg_catalog.now(),
         last_reply_at = pg_catalog.now()
   WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$function$;

-- Trigger execution continues; direct callers do not need this function.
REVOKE ALL PRIVILEGES ON FUNCTION public.touch_support_ticket()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_support_ticket() TO service_role;
