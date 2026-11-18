import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import worker from '../server/worker.ts';
import { envelope } from './kma-fixtures.mjs';

const config = JSON.parse(readFileSync(new URL('../server/wrangler.jsonc', import.meta.url), 'utf8'));
const localhost = 'http://localhost:8081';
const codespaces = 'https://ideal-lamp-p7w5rxr56pwvfrpv9-8081.app.github.dev';
function setup(status = 200) {
  let calls = 0;
  const payload = status === 200 ? envelope() : { error: 'WEATHER_UNAVAILABLE' };
  return {
    calls: () => calls, payload,
    env: {
      ALLOWED_ORIGINS: config.vars.ALLOWED_ORIGINS,
      WEATHER_GATEWAY: {
        idFromName(name) { assert.equal(name, 'kma-global-v1'); return 'test-id'; },
        get() { return { async fetch() { calls++; return Response.json(payload, { status }); } }; },
      },
    },
  };
}
function request(origin, method = 'GET') {
  const headers = origin === undefined ? {} : { Origin: origin };
  if (method === 'OPTIONS') headers['Access-Control-Request-Method'] = 'GET';
  return new Request('https://api.example/weather?x=60&y=127', { method, headers });
}

test('configured allowlist contains only existing localhost and the exact requested Codespaces origin', () => {
  assert.deepEqual(config.vars.ALLOWED_ORIGINS.split(','), [localhost, codespaces]);
  assert.ok(!config.vars.ALLOWED_ORIGINS.includes('*'));
});
for (const origin of [localhost, codespaces]) {
  test(`allowed origin ${origin === localhost ? 'localhost' : 'Codespaces'} receives weather with exact CORS headers`, async () => {
    const s = setup();
    const response = await worker.fetch(request(origin), s.env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Vary'), 'Origin');
    assert.deepEqual(await response.json(), s.payload);
    assert.equal(s.calls(), 1);
  });
  test(`allowed origin ${origin === localhost ? 'localhost' : 'Codespaces'} preflight succeeds without fetching weather`, async () => {
    const s = setup();
    const response = await worker.fetch(request(origin, 'OPTIONS'), s.env);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
    assert.equal(response.headers.get('Vary'), 'Origin');
    assert.equal(s.calls(), 0);
  });
}
test('other sites, other Codespaces, suffix lookalikes, schemes, ports and null origins stay denied', async () => {
  for (const origin of [
    'https://other.example',
    'https://another-codespace-8081.app.github.dev',
    `${codespaces}.evil.example`,
    codespaces.replace('https:', 'http:'),
    `${codespaces}:8443`,
    'http://localhost:8082',
    'null',
  ]) {
    for (const method of ['GET', 'OPTIONS']) {
      const s = setup();
      const response = await worker.fetch(request(origin, method), s.env);
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
      assert.deepEqual(await response.json(), { error: 'ORIGIN_DENIED' });
      assert.equal(s.calls(), 0);
    }
  }
});
test('allowed Codespaces can read sanitized gateway errors rather than a CORS failure', async () => {
  const s = setup(503);
  const response = await worker.fetch(request(codespaces), s.env);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), codespaces);
  assert.deepEqual(await response.json(), { error: 'WEATHER_UNAVAILABLE' });
});
test('native and address-bar requests without Origin remain supported without wildcard headers', async () => {
  const s = setup();
  const response = await worker.fetch(request(undefined), s.env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.deepEqual(await response.json(), s.payload);
});
