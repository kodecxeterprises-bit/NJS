import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAppApi } from './app-routes';

test('protected application API rejects requests without a bearer token', async () => {
  const response = await handleAppApi(
    new Request('https://njs.example/api/dashboard/stats'),
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-secret' },
  );
  assert.ok(response);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Not authenticated' });
});

test('non-API paths are not handled by the application API router', async () => {
  const response = await handleAppApi(
    new Request('https://njs.example/dashboard'),
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-secret' },
  );
  assert.equal(response, null);
});
