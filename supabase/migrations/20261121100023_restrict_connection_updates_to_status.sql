-- Remove broad UPDATE privileges from client roles.
REVOKE UPDATE ON TABLE public.connections FROM anon, authenticated;

-- Recipients retain permission to update only the status column.
-- The existing RLS UPDATE policy still limits updates to the recipient.
GRANT UPDATE (status) ON TABLE public.connections TO authenticated;
