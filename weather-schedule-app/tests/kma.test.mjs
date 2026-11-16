import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toGrid, latestBase, kstInstant, normalize, chooseCondition, readItems, isStale, usable, parseEnvelope } from '../shared/kma.ts';
import { selectWeatherMode } from '../shared/mode.ts';
import { now, fixture, envelope } from './kma-fixtures.mjs';
test('DFS projects Seoul and rejects unsupported positions',()=>{
 assert.deepEqual(toGrid(37.5665,126.978),{x:60,y:127});
 assert.throws(()=>toGrid(NaN,127)); assert.throws(()=>toGrid(35,139));
});
test('KST publication cutoffs and previous-day midnight',()=>{
 assert.equal(latestBase('observation',Date.parse('2026-11-16T15:14:59Z')).date,'20261116');
 assert.equal(latestBase('observation',Date.parse('2026-11-16T15:14:59Z')).time,'2300');
 assert.equal(latestBase('observation',Date.parse('2026-11-16T15:15:00Z')).time,'0000');
 assert.equal(latestBase('forecast',Date.parse('2026-11-16T15:44:59Z')).time,'2330');
 assert.equal(latestBase('forecast',Date.parse('2026-11-16T15:45:00Z')).time,'0030');
 assert.equal(kstInstant('20261117','0000'),'2026-11-16T15:00:00.000Z');
 assert.throws(()=>kstInstant('20260230','0000')); assert.throws(()=>kstInstant('20261117','2460'));
});
test('observed precipitation wins over predicted rain; forecast metadata stays separate',()=>{
 const f=fixture(); const s=normalize(f.obs,f.forecasts,f.obsBase,f.fcstBase,now);
 assert.equal(s.condition,'clear'); assert.equal(s.observedPrecipitation,0);assert.equal(s.forecastPrecipitation,1);
 assert.equal(s.observedAt,'2026-11-17T01:00:00.000Z');assert.equal(s.forecastIssuedAt,'2026-11-17T00:30:00.000Z');
 assert.equal(s.temperatureCelsius,13);
});
test('five states, mixed rain/snow, and forecast lightning priority',()=>{
 assert.equal(chooseCondition(0,1,0),'clear');assert.equal(chooseCondition(0,4,0),'cloudy');
 assert.equal(chooseCondition(1,4,0),'rain');assert.equal(chooseCondition(2,4,0),'rain');
 assert.equal(chooseCondition(3,4,0),'snow');assert.equal(chooseCondition(7,4,0),'snow');
 assert.equal(chooseCondition(0,1,1),'thunder');assert.equal(chooseCondition(3,4,2),'thunder');
});
test('missing lightning stays unknown; missing or sentinel core values never fabricate weather',()=>{
 const f=fixture();let rows=f.forecasts.filter(r=>r.category!=='LGT');
 assert.equal(normalize(f.obs,rows,f.obsBase,f.fcstBase,now).lightning,null);
 assert.throws(()=>normalize(f.obs,[],f.obsBase,f.fcstBase,now));
 assert.throws(()=>normalize([{...f.obs[0],obsrValue:'-999'},f.obs[1]],f.forecasts,f.obsBase,f.fcstBase,now));
 assert.throws(()=>normalize(f.obs,f.forecasts.map(r=>({...r,fcstTime:'1500'})),f.obsBase,f.fcstBase,now));
 assert.throws(()=>normalize(f.obs,f.forecasts.map(r=>r.category==='LGT'?{...r,fcstValue:'-1'}:r),f.obsBase,f.fcstBase,now));
});
test('upstream error envelopes and truncation are rejected',()=>{
 assert.throws(()=>readItems({response:{header:{resultCode:'30'}}}));
 assert.throws(()=>readItems({response:{header:{resultCode:'00'},body:{totalCount:2,items:{item:[{}]}}}}));
});
test('age, stale fallback and invalid caches are distinguished',()=>{
 const d=envelope();assert.equal(isStale(d,now),false);assert.equal(isStale(d,now+16*60000),true);
 assert.equal(isStale({...d,cacheStatus:'stale'},now),true);assert.equal(usable(d,now+7*3600000),false);
 assert.equal(usable(d,now-3600000),false);assert.deepEqual(parseEnvelope(d),d);
 assert.throws(()=>parseEnvelope({...d,snapshot:{...d.snapshot,temperatureCelsius:'13'}}));
 assert.throws(()=>parseEnvelope({...d,snapshot:{...d.snapshot,condition:'rain'}}));
});
test('production ignores demo flag, and development defaults to live',()=>{
 assert.equal(selectWeatherMode(false,'demo'),'live');assert.equal(selectWeatherMode(true),'live');
 assert.equal(selectWeatherMode(true,'demo'),'demo');
});
