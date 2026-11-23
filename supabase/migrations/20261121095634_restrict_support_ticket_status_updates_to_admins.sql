-- Ordinary ticket owners may no longer update ticket rows.
-- The existing "Admins can manage all support tickets" policy remains
-- and continues to authorize administrators via app_metadata.role = 'admin'.
DROP POLICY IF EXISTS "Users can update their own ticket status only"
ON public.support_tickets;
