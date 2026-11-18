import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocation } from '../shared/location.ts';
const seoul={latitude:37.5665,longitude:126.978};
test('permission denial falls back to Seoul without reading GPS',async()=>{
 let gps=false;const result=await resolveLocation({permission:async()=>false,position:async()=>{gps=true;return seoul;}});
 assert.equal(gps,false);assert.deepEqual(result.grid,{x:60,y:127});assert.match(result.label,/권한 없음/);
});
test('allowed position uses DFS and does not claim fallback',async()=>{
 const r=await resolveLocation({permission:async()=>true,position:async()=>seoul});assert.equal(r.fallback,false);assert.deepEqual(r.grid,{x:60,y:127});
});
test('disabled GPS/timeout and unsupported overseas location are explicit fallbacks',async()=>{
 const r=await resolveLocation({permission:async()=>true,position:async()=>{throw Error('timeout')}});assert.equal(r.fallback,true);assert.match(r.label,/확인 불가/);
 const overseas=await resolveLocation({permission:async()=>true,position:async()=>({latitude:35,longitude:139})});assert.match(overseas.label,/지역 밖/);
});
