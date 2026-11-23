-- These are trigger-only SECURITY DEFINER functions, not public RPC endpoints.
-- Their attached triggers continue to invoke them; remove direct EXECUTE grants
-- from PUBLIC and API roles, and harden name resolution for privileged execution.
revoke all privileges on function public.create_njs_connection_notification()
  from public, anon, authenticated;

revoke all privileges on function public.create_njs_message_notification()
  from public, anon, authenticated;

alter function public.create_njs_connection_notification()
  set search_path = '';

alter function public.create_njs_message_notification()
  set search_path = '';
