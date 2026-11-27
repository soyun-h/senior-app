import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.119.2/cors';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const allowed = new Set(['https://localhost']);
const siteOrigin = Deno.env.get('ALLIT_WEB_ORIGIN');
if (siteOrigin && new URL(siteOrigin).protocol === 'https:' && new URL(siteOrigin).origin === siteOrigin) allowed.add(siteOrigin);
if (Deno.env.get('ALLIT_EDGE_ALLOW_LOCAL_DEV') === '1') {
  for (const origin of ['http://127.0.0.1:8090', 'http://localhost:8080', 'http://localhost:8090']) allowed.add(origin);
}
const bucket = 'verification-photos';

Deno.serve(async request => {
  const origin = request.headers.get('Origin');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origin && allowed.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = corsHeaders['Access-Control-Allow-Headers'];
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  function respond(status: number, body: { deleted?: boolean; error?: string }) {
    return new Response(JSON.stringify(body), { status, headers });
  }
  if (origin && !allowed.has(origin)) return respond(403, { error: 'origin' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respond(405, { error: 'method' });
  const token = request.headers.get('Authorization')?.match(/^Bearer ([^ ]+)$/i)?.[1];
  if (!token) return respond(401, { error: 'session' });
  if (!url || !serviceKey) return respond(503, { error: 'configuration' });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return respond(401, { error: 'session' });
    const target = data.user.id;
    if ((await admin.rpc('allit_begin_account_deletion', { target })).error) return respond(503, { error: 'retry' });
    // Each batch peels off the first page. Pending deletion blocks new uploads.
    for (let batch = 0; batch < 12; batch++) {
      const listed = await admin.rpc('allit_account_photo_paths', { target });
      if (listed.error || !Array.isArray(listed.data)) return respond(503, { error: 'retry' });
      const paths = listed.data as string[];
      if (!paths.length) {
        const result = await admin.auth.admin.deleteUser(target);
        return result.error ? respond(503, { error: 'retry' }) : respond(200, { deleted: true });
      }
      if (!paths.every(path => path.startsWith(`${target}/`))) return respond(503, { error: 'retry' });
      if ((await admin.storage.from(bucket).remove(paths)).error) return respond(503, { error: 'retry' });
    }
    return respond(503, { error: 'retry' });
  } catch {
    return respond(503, { error: 'retry' });
  }
});
