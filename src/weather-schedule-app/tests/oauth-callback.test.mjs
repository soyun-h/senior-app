import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { parseCallback, socialLoginOptions, verifierKey } from '../src/features/account/oauthCallback.ts';

const native = 'com.allitcare.android.debug.oauth://auth/callback';
const web = 'https://release-team.example/allit/delete-account.html';
const now = 1800000000000;
const pending = { provider: 'google', redirect: native, started: now - 500 };

test('PKCE accepts only the expected debug or hosted path', () => {
  assert.deepEqual(parseCallback(`${native}?code=example_code`, pending, now), { code: 'example_code' });
  assert.deepEqual(parseCallback(`${web}?code=web-code`, { ...pending, redirect: web }, now), { code: 'web-code' });
  assert.equal(parseCallback('com.allitcare.android.oauth://auth/callback?code=code', pending, now), undefined);
  assert.equal(parseCallback('https://release-team.example/delete-account.html?code=code', { ...pending, redirect: web }, now), undefined);
  assert.equal(parseCallback('https://release-team.example.evil.example/allit/delete-account.html?code=code', { ...pending, redirect: web }, now), undefined);
});

test('PKCE rejects late, ambiguous, implicit-flow and malformed callbacks', () => {
  for (const suffix of ['?code=one&code=two', '?code=one&error=denied', '?code=one&access_token=hidden',
    '#access_token=hidden', '?code=%3Cbad%3E', '?code=one#fragment']) {
    assert.equal(parseCallback(native + suffix, pending, now), undefined, suffix);
  }
  assert.equal(parseCallback(`${native}?code=late`, pending, now + 15 * 60000), undefined);
});

test('OAuth denial is reported without showing the provider error text', () => {
  assert.deepEqual(parseCallback(`${native}?error=access_denied`, pending, now), { cancelled: true });
  assert.deepEqual(parseCallback(`${native}?error=server_error&error_description=internal`, pending, now), { failed: true });
});

test('official Supabase SDK builds a Kakao S256 authorize URL without account_email', async () => {
  const map = new Map();
  const client = createClient('https://allitfixture.supabase.co', 'sb_publishable_test_fixture', { auth: {
    storage: { getItem: key => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: key => void map.delete(key) },
    storageKey: 'allit-auth', autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, flowType: 'pkce',
  } });
  const { data, error } = await client.auth.signInWithOAuth({ provider: 'kakao', options: socialLoginOptions('kakao', native) });
  assert.equal(error, null);
  const url = new URL(data.url);
  assert.equal(url.pathname, '/auth/v1/authorize');
  assert.equal(url.searchParams.get('redirect_to'), native);
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  assert.match(url.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(url.searchParams.get('scope'), 'profile_nickname profile_image');
  assert.equal(url.searchParams.has('scopes'), false);
  const slot = verifierKey(data.flowId);
  assert.match(slot, /^allit-auth-flow-[a-f0-9]{32}-code-verifier$/);
  assert.equal(map.get(slot), map.get('allit-auth-code-verifier'));
  assert.deepEqual(JSON.parse(map.get('allit-auth-flows-code-verifier')), [data.flowId]);
  assert.equal(verifierKey('../invalid'), undefined);
  assert.equal(map.has('allit-auth-code-verifier'), true);
});
