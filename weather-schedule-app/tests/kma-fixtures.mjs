import { latestBase, normalize } from '../shared/kma.ts';
export const now = Date.parse('2026-11-17T01:20:00Z'); // 10:20 KST
export function fixture(time = now) {
  const obsBase = latestBase('observation', time), fcstBase = latestBase('forecast', time);
  const obs = [['T1H','13'],['PTY','0']].map(([category,obsrValue]) => ({category,obsrValue,baseDate:obsBase.date,baseTime:obsBase.time}));
  const forecasts = [['SKY','1'],['PTY','1'],['LGT','0']].map(([category,fcstValue]) => ({category,fcstValue,baseDate:fcstBase.date,baseTime:fcstBase.time,fcstDate:'20261117',fcstTime:'1000'}));
  return { obs, forecasts, obsBase, fcstBase };
}
export function envelope(time = now) {
  const f=fixture(time);
  return { snapshot:normalize(f.obs,f.forecasts,f.obsBase,f.fcstBase,time),grid:{x:60,y:127},refreshedAt:new Date(time).toISOString(),cacheStatus:'fresh' };
}
