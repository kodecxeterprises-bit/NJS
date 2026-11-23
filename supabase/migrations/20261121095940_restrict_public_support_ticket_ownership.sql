-- Keep guest ticket submissions available, but prevent anonymous clients
-- from attaching tickets to an arbitrary account.
DROP POLICY IF EXISTS "Public can submit support tickets"
ON public.support_tickets;

CREATE POLICY "Guests can submit unlinked support tickets"
ON public.support_tickets
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND char_length(trim(requester_name)) BETWEEN 2 AND 120
  AND char_length(trim(requester_email)) BETWEEN 5 AND 254
);

-- Signed-in users may submit an unlinked ticket or associate it only
-- with their own authenticated account.
CREATE POLICY "Authenticated users can submit their own support tickets"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = (SELECT auth.uid()))
  AND char_length(trim(requester_name)) BETWEEN 2 AND 120
  AND char_length(trim(requester_email)) BETWEEN 5 AND 254
);
