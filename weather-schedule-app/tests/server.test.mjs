import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { WeatherGateway } from '../server/worker.ts';
import { fixture, now, envelope } from './kma-fixtures.mjs';
class Storage {
 data=new Map();queue=Promise.resolve();
 async get(key){return structuredClone(this.data.get(key));}
 async put(key,v){this.data.set(key,structuredClone(v));}
 async delete(key){return this.data.delete(key);}
 async list({prefix}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)));}
 async transaction(fn){ const result=this.queue.then(()=>fn(this));this.queue=result.catch(()=>{});return result; }
 async setAlarm(){}
}
const req=()=>new Request('https://gateway/weather?x=60&y=127',{headers:{'X-Client-IP':'test'}});
const env=()=>({KMA_SERVICE_KEY:'test-fixture-key',DAILY_UPSTREAM_LIMIT:'800'});
function mockKma(t){let calls=0;t.mock.method(globalThis,'fetch',async url=>{
 calls++;const u=new URL(url);assert.equal(u.hostname,'apis.data.go.kr');assert.equal(u.searchParams.get('nx'),'60');
 const f=fixture();const items=u.pathname.endsWith('getUltraSrtNcst')?f.obs:f.forecasts;
 return Response.json({response:{header:{resultCode:'00'},body:{totalCount:items.length,items:{item:items}}}});
});return ()=>calls;}
test('server missing key never calls upstream or leaks a credential',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('unexpected network')});
 const gateway=new WeatherGateway({storage:new Storage()},{});
 const r=await gateway.fetch(req());assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'KEY_NOT_CONFIGURED'});
});
test('same-grid concurrent requests share two calls; cache reuses result and global budget is charged',async t=>{
 t.mock.method(Date,'now',()=>now);const calls=mockKma(t);const storage=new Storage();
 const g=new WeatherGateway({storage},env());
 const responses=await Promise.all([g.fetch(req()),g.fetch(req())]);
 assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(calls(),2);
 assert.equal((await g.fetch(req())).status,200);assert.equal(calls(),2);
 assert.equal((await storage.get('budget')).calls,2);
});
test('upstream errors retain last good data with stale label; response is sanitized',async t=>{
 t.mock.method(Date,'now',()=>now);const storage=new Storage();
 await storage.put('cache:60:127',{...envelope(),refreshedAt:new Date(now-600000).toISOString()});
 t.mock.method(globalThis,'fetch',async()=>{throw Error('secret diagnostic should never leave server')});
 const r=await new WeatherGateway({storage},env()).fetch(req());
 assert.equal(r.status,200);const d=await r.json();assert.equal(d.cacheStatus,'stale');assert.equal(d.snapshot.temperatureCelsius,13);
 assert.ok(!JSON.stringify(d).includes('secret diagnostic'));
});
test('daily upstream budget fails closed without issuing extra requests',async t=>{
 t.mock.method(Date,'now',()=>now);const calls=mockKma(t);
 const r=await new WeatherGateway({storage:new Storage()},{...env(),DAILY_UPSTREAM_LIMIT:'1'}).fetch(req());
 assert.equal(r.status,429);assert.equal(calls(),1);assert.deepEqual(await r.json(),{error:'UPSTREAM_BUDGET_EXHAUSTED'});
});
test('bad grids, method and untrusted web origin never reach gateway',async()=>{
 const e={ALLOWED_ORIGINS:'https://team.example',WEATHER_GATEWAY:{get(){throw Error('must not be reached')}}};
 assert.equal((await worker.fetch(new Request('https://api.example/weather?x=NaN&y=127'),e)).status,400);
 assert.equal((await worker.fetch(new Request('https://api.example/weather?x=60&y=127',{method:'POST'}),e)).status,405);
 assert.equal((await worker.fetch(new Request('https://api.example/weather?x=60&y=127',{headers:{Origin:'https://other.example'}}),e)).status,403);
});
test('client per-minute rate limit applies even to cached requests',async t=>{
 t.mock.method(Date,'now',()=>now);const storage=new Storage();await storage.put('cache:60:127',envelope());
 const g=new WeatherGateway({storage},env());
 for(let i=0;i<20;i++)assert.equal((await g.fetch(req())).status,200);
 assert.equal((await g.fetch(req())).status,429);
});
test('expired cache is not returned when upstream is unavailable',async t=>{
 t.mock.method(Date,'now',()=>now+7*3600000);const storage=new Storage();await storage.put('cache:60:127',envelope());
 t.mock.method(globalThis,'fetch',async()=>{throw Error('offline')});
 const r=await new WeatherGateway({storage},env()).fetch(req());assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'WEATHER_UNAVAILABLE'});
});
test('delayed observation publication retries the previous cycle, counting every call',async t=>{
 t.mock.method(Date,'now',()=>now);let observationCalls=0;
 t.mock.method(globalThis,'fetch',async url=>{
  const u=new URL(url),f=fixture();
  if(u.pathname.endsWith('getUltraSrtNcst')){
   observationCalls++;
   if(observationCalls===1)return Response.json({response:{header:{resultCode:'03'}}});
   return Response.json({response:{header:{resultCode:'00'},body:{totalCount:2,items:{item:f.obs.map(r=>({...r,baseTime:'0900'}))}}}});
  }
  return Response.json({response:{header:{resultCode:'00'},body:{totalCount:3,items:{item:f.forecasts}}}});
 });
 const storage=new Storage(),r=await new WeatherGateway({storage},env()).fetch(req());
 assert.equal(r.status,200);const data=await r.json();assert.equal(data.snapshot.observedAt,'2026-11-17T00:00:00.000Z');assert.equal((await storage.get('budget')).calls,3);
});
test('gateway accepts a normal hourly response to a half-hour request and caches actual issue time',async t=>{
 t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'fetch',async url=>{
  const u=new URL(url),f=fixture();const observation=u.pathname.endsWith('getUltraSrtNcst');
  if(!observation)assert.equal(u.searchParams.get('base_time'),'0930');
  const items=observation?f.obs:f.forecasts.map(r=>({...r,baseTime:'0900'}));
  return Response.json({response:{header:{resultCode:'00'},body:{totalCount:items.length,items:{item:items}}}});
 });
 const storage=new Storage(),r=await new WeatherGateway({storage},env()).fetch(req());
 assert.equal(r.status,200);const d=await r.json();assert.equal(d.snapshot.forecastIssuedAt,'2026-11-17T00:00:00.000Z');
 assert.equal((await storage.get('cache:60:127')).snapshot.forecastIssuedAt,d.snapshot.forecastIssuedAt);
});
