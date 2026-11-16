import { assertGrid, latestBase, normalize, readItems, usable, type Grid, type WeatherEnvelope, type Item, type Base } from '../shared/kma.ts';
// Narrow platform contracts keep server code type-checkable without bundling a server SDK into the app.
interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T>(options: { prefix: string }): Promise<Map<string, T>>;
  transaction<T>(fn: (storage: Storage) => Promise<T>): Promise<T>;
  setAlarm(time: number): Promise<void>;
}
interface Context { storage: Storage }
export interface Env {
  KMA_SERVICE_KEY?: string;
  ALLOWED_ORIGINS?: string;
  DAILY_UPSTREAM_LIMIT?: string;
  WEATHER_GATEWAY: { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } };
}
class PublicError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
function gridFrom(url: URL): Grid {
  const x = url.searchParams.get('x'), y = url.searchParams.get('y');
  if (!x || !y || !/^\d+$/.test(x) || !/^\d+$/.test(y)) throw new Error('INVALID_GRID');
  const grid = { x: Number(x), y: Number(y) }; assertGrid(grid); return grid;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allow = (env.ALLOWED_ORIGINS ?? '').split(',').map(x => x.trim()).filter(Boolean);
    if (origin && !allow.includes(origin)) return json({ error: 'ORIGIN_DENIED' }, 403);
    const headers: Record<string, string> = { Vary: 'Origin' };
    if (origin) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS' });
    let response: Response;
    if (url.pathname !== '/weather') response = json({ error: 'NOT_FOUND' }, 404);
    else if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
    else if (request.method !== 'GET') response = json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    else {
      try {
        try { gridFrom(url); } catch { return json({ error: 'INVALID_GRID' }, 400); }
        // Singleton coordinates upstream budget + coalescing across every worker isolate.
        const gateway = env.WEATHER_GATEWAY.get(env.WEATHER_GATEWAY.idFromName('kma-global-v1'));
        // Never forward caller headers, URLs or service keys to KMA. CF-Connecting-IP is set by Cloudflare.
        const { x, y } = gridFrom(url);
        const internal = new Request(`https://gateway/weather?x=${x}&y=${y}`, { headers: { 'X-Client-IP': request.headers.get('CF-Connecting-IP') ?? 'unknown' } });
        response = await gateway.fetch(internal);
      } catch { response = json({ error: 'GATEWAY_UNAVAILABLE' }, 503); }
    }
    response = new Response(response.body, response);
    for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
    return response;
  },
};
export class WeatherGateway {
  private pending = new Map<string, Promise<WeatherEnvelope>>();
  private ctx: Context;
  private env: Env;
  constructor(ctx: Context, env: Env) { this.ctx = ctx; this.env = env; }
  async fetch(request: Request): Promise<Response> {
    let grid: Grid;
    try { grid = gridFrom(new URL(request.url)); } catch { return json({ error: 'INVALID_GRID' }, 400); }
    try {
      await this.rateLimit(request.headers.get('X-Client-IP') ?? 'unknown');
      if (!this.env.KMA_SERVICE_KEY) return json({ error: 'KEY_NOT_CONFIGURED' }, 503);
      const key = `cache:${grid.x}:${grid.y}`;
      let work = this.pending.get(key);
      if (!work) {
        // Include the cache read in the shared operation: a very fast refresh may
        // finish while another request is awaiting storage/rate-limit I/O.
        work = this.load(grid, key);
        this.pending.set(key, work);
        void work.finally(() => { this.pending.delete(key); }).catch(() => {});
      }
      return json(await work);
    } catch (e) {
      const error = e instanceof PublicError ? e : new PublicError(503, 'WEATHER_UNAVAILABLE');
      // Intentionally never return upstream text, credentials, request URLs, or raw exceptions.
      return json({ error: error.message }, error.status);
    }
  }
  private async load(grid: Grid, key: string): Promise<WeatherEnvelope> {
    const cached = await this.ctx.storage.get<WeatherEnvelope>(key);
    if (cached && Date.now() - Date.parse(cached.refreshedAt) < 300_000 && usable(cached)) return cached;
    try { return await this.refresh(grid, key); }
    catch (e) {
      if (cached && usable(cached)) return { ...cached, cacheStatus: 'stale' };
      throw e;
    }
  }
  private async rateLimit(ip: string) {
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)))].map(v => v.toString(16).padStart(2, '0')).join('');
    const minute = Math.floor(Date.now() / 60_000);
    await this.ctx.storage.transaction(async storage => {
      let state = await storage.get<{ minute: number; counts: Record<string, number> }>('rate');
      if (!state || state.minute !== minute) state = { minute, counts: {} };
      if ((state.counts[hash] ?? 0) >= 20 || (!(hash in state.counts) && Object.keys(state.counts).length >= 1024)) throw new PublicError(429, 'RATE_LIMITED');
      state.counts[hash] = (state.counts[hash] ?? 0) + 1;
      await storage.put('rate', state);
    });
  }
  private async reserveUpstream() {
    const day = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
    const limit = Number(this.env.DAILY_UPSTREAM_LIMIT ?? '800');
    if (!Number.isInteger(limit) || limit < 1) throw new PublicError(503, 'INVALID_SERVER_CONFIGURATION');
    await this.ctx.storage.transaction(async storage => {
      let budget = await storage.get<{ day: string; calls: number }>('budget');
      if (!budget || budget.day !== day) budget = { day, calls: 0 };
      if (budget.calls >= limit) throw new PublicError(429, 'UPSTREAM_BUDGET_EXHAUSTED');
      await storage.put('budget', { day, calls: budget.calls + 1 });
    });
  }
  private async rows(kind: 'observation' | 'forecast', grid: Grid, now: number): Promise<{ rows: Item[]; base: Base }> {
    for (let back = 0; back <= 1; back++) {
      const base = latestBase(kind, now, back);
      await this.reserveUpstream();
      const url = new URL(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${kind === 'observation' ? 'getUltraSrtNcst' : 'getUltraSrtFcst'}`);
      const key = this.env.KMA_SERVICE_KEY!;
      // Portal accepts a decoding key. Accommodate percent-encoded keys once, not twice.
      let decoded: string;
      try { decoded = key.includes('%') ? decodeURIComponent(key) : key; } catch { throw new PublicError(503, 'INVALID_SERVER_CONFIGURATION'); }
      for (const [k, v] of Object.entries({ serviceKey: decoded, pageNo: '1', numOfRows: '1000', dataType: 'JSON', base_date: base.date, base_time: base.time, nx: String(grid.x), ny: String(grid.y) })) url.searchParams.set(k, v);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('UPSTREAM_HTTP');
        return { rows: readItems(await response.json()), base };
      } catch { if (back === 1) throw new PublicError(503, 'WEATHER_UNAVAILABLE'); }
      finally { clearTimeout(timer); }
    }
    throw new PublicError(503, 'WEATHER_UNAVAILABLE');
  }
  private async refresh(grid: Grid, key: string): Promise<WeatherEnvelope> {
    const now = Date.now();
    // Sequential requests avoid orphaned upstream calls after a failed first request.
    const observation = await this.rows('observation', grid, now);
    const forecast = await this.rows('forecast', grid, now);
    const snapshot = normalize(observation.rows, forecast.rows, observation.base, forecast.base, now);
    const data: WeatherEnvelope = { snapshot, grid, refreshedAt: new Date(Date.now()).toISOString(), cacheStatus: 'fresh' };
    await this.ctx.storage.put(key, data);
    await this.ctx.storage.setAlarm(Date.now() + 3_600_000);
    return data;
  }
  async alarm() {
    for (const [key, value] of await this.ctx.storage.list<WeatherEnvelope>({ prefix: 'cache:' })) if (!usable(value)) await this.ctx.storage.delete(key);
    await this.ctx.storage.setAlarm(Date.now() + 3_600_000);
  }
}
