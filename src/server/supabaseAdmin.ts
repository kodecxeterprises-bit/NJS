import { supabaseAdmin } from './supabaseAdmin';

async function getSupabaseUser(req: Request) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const accessToken = authHeader.slice(7);

  const { data, error } = await supabaseAdmin.auth.getUser(
    accessToken
  );

  if (error || !data.user) {
    return null;
  }

  return data.user;
}