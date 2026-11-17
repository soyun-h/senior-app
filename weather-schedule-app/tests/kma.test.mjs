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

function afternoonResponse({ issuedDate='20261117', issuedTime='1500', validDate='20261117', validTime='1600' } = {}) {
 const at=Date.parse('2026-11-17T07:20:00Z'); // 16:20 KST
 const ob=latestBase('observation',at),fb=latestBase('forecast',at);
 const obs=[['T1H','13.7'],['PTY','1']].map(([category,obsrValue])=>({category,obsrValue,baseDate:ob.date,baseTime:ob.time}));
 const rows=[['SKY','4'],['PTY','1'],['LGT','0']].map(([category,fcstValue])=>({category,fcstValue,baseDate:issuedDate,baseTime:issuedTime,fcstDate:validDate,fcstTime:validTime}));
 return { at,ob,fb,obs,rows };
}
function normalized(f){return normalize(f.obs,f.rows,f.ob,f.fb,f.at);}
test('1530 request accepts 1500 response and preserves actual issue vs observation vs valid time',()=>{
 const f=afternoonResponse();assert.equal(f.fb.time,'1530');
 const s=normalized(f);assert.equal(s.forecastIssuedAt,'2026-11-17T06:00:00.000Z');
 assert.equal(s.forecastValidAt,'2026-11-17T07:00:00.000Z');assert.equal(s.observedAt,'2026-11-17T07:00:00.000Z');
 assert.equal(s.temperatureCelsius,13.7);assert.equal(s.condition,'rain');
});
test('hourly response still combines observed snow and predicted lightning correctly',()=>{
 const f=afternoonResponse();f.obs[1].obsrValue='3';assert.equal(normalized(f).condition,'snow');
 f.rows.find(r=>r.category==='LGT').fcstValue='1';assert.equal(normalized(f).condition,'thunder');
});
test('current valid time cannot make an old issue fresh; future and later-than-request issues are rejected',()=>{
 assert.throws(()=>normalized(afternoonResponse({issuedTime:'1400'})),/KMA_NO_RECENT_FORECAST_ISSUE/);
 assert.throws(()=>normalized(afternoonResponse({issuedTime:'1630',validTime:'1700'})),/KMA_NO_RECENT_FORECAST_ISSUE/);
 assert.throws(()=>normalized(afternoonResponse({issuedTime:'1600',validTime:'1700'})),/KMA_NO_RECENT_FORECAST_ISSUE/);
});
test('invalid issue date/minutes, validity before issue, and beyond horizon are rejected',()=>{
 assert.throws(()=>normalized(afternoonResponse({issuedDate:'20260230'})),/INVALID_TIME/);
 assert.throws(()=>normalized(afternoonResponse({issuedTime:'1515'})),/KMA_INVALID_FORECAST_ISSUE/);
 assert.throws(()=>normalized(afternoonResponse({validTime:'1500'})),/KMA_INVALID_FORECAST_VALIDITY/);
 assert.throws(()=>normalized(afternoonResponse({validTime:'2200'})),/KMA_INVALID_FORECAST_VALIDITY/);
 assert.throws(()=>normalized(afternoonResponse({validTime:'1800'})),/KMA_NO_NEAR_FORECAST/);
});
test('newest eligible issue is selected without mixing older lightning or incomplete categories',()=>{
 const f=afternoonResponse();const older=f.rows.map(r=>({...r,baseTime:'1430',fcstValue:r.category==='LGT'?'1':r.fcstValue}));
 f.rows=[...older,...f.rows];assert.equal(normalized(f).condition,'rain');
 // The newest issue has no SKY: an older issue must not fill that hole.
 f.rows=f.rows.filter(r=>!(r.baseTime==='1500'&&r.category==='SKY'));
 assert.throws(()=>normalized(f),/KMA_MISSING_SKY/);
});
test('forecast category duplicates are rejected rather than silently selecting a value',()=>{
 const f=afternoonResponse();f.rows.push({...f.rows[0],fcstValue:'1'});
 assert.throws(()=>normalized(f),/KMA_DUPLICATE_FORECAST_CATEGORY/);
});
test('response issue selection works across KST midnight and records the previous date',()=>{
 const at=Date.parse('2026-11-17T15:20:00Z'); // 11/18 00:20 KST
 const ob=latestBase('observation',at),fb=latestBase('forecast',at);
 assert.equal(fb.date,'20261117');assert.equal(fb.time,'2330');
 const obs=[['T1H','2'],['PTY','0']].map(([category,obsrValue])=>({category,obsrValue,baseDate:ob.date,baseTime:ob.time}));
 const rows=[['SKY','1'],['PTY','0']].map(([category,fcstValue])=>({category,fcstValue,baseDate:'20261117',baseTime:'2300',fcstDate:'20261118',fcstTime:'0000'}));
 const s=normalize(obs,rows,ob,fb,at);assert.equal(s.forecastIssuedAt,'2026-11-17T14:00:00.000Z');assert.equal(s.forecastValidAt,'2026-11-17T15:00:00.000Z');assert.equal(s.lightning,null);
});
