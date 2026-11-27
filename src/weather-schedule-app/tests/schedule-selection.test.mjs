import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDates, shiftDate, selectDate, selectionLabel, to24Hour, pickerTimeLabel } from '../src/features/schedules/selection.ts';

test('calendar grid supports either approved week start and includes adjacent month dates',()=>{
 const mon=calendarDates('2026-11','monday'),sun=calendarDates('2026-11','sunday');
 assert.equal(mon[0],'2026-10-26');assert.equal(mon.at(-1),'2026-12-06');assert.equal(mon.length,42);
 assert.equal(sun[0],'2026-11-01');assert.equal(sun.at(-1),'2026-12-05');assert.equal(sun.length,35);
 assert.equal(shiftDate('2026-12-31',1),'2027-01-01');assert.equal(shiftDate('2028-02-28',1),'2028-02-29');
 assert.throws(()=>calendarDates('2026-13','monday'));
});
test('date taps support single days, ascending and descending inclusive ranges, and starting again',()=>{
 let s={startDate:'2026-11-23',endDate:'2026-11-23',awaitingEnd:false};
 s=selectDate(s,'2026-11-25');assert.deepEqual(s,{startDate:'2026-11-25',endDate:'2026-11-25',awaitingEnd:true});
 s=selectDate(s,'2026-12-02');assert.equal(selectionLabel(s.startDate,s.endDate),'2026.11.25 - 12.02');
 s=selectDate(s,'2026-12-05');s=selectDate(s,'2026-12-01');assert.equal(selectionLabel(s.startDate,s.endDate),'2026.12.01 - 12.05');
 assert.equal(selectionLabel('2026-12-31','2027-01-02'),'2026.12.31 - 2027.01.02');
 assert.equal(selectionLabel('2026-11-23','2026-11-23'),'2026.11.23');
});
test('wheel values cover midnight, noon and every hour and minute without locale parsing',()=>{
 assert.equal(to24Hour('오전',12),0);assert.equal(to24Hour('오후',12),12);assert.equal(to24Hour('오후',7),19);
 for(let hour=0;hour<24;hour++)for(let minute=0;minute<60;minute++){
  assert.equal(pickerTimeLabel(hour,minute),`${hour<12?'오전':'오후'} ${String(hour%12||12).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
 }
 assert.throws(()=>to24Hour('오후',0));assert.throws(()=>pickerTimeLabel(24,0));assert.throws(()=>pickerTimeLabel(12,60));
});

test('drag hit testing follows measured Sunday grid and ignores outside positions', async()=>{
 const {calendarDateAtPoint,dragDateSelection}=await import('../src/features/schedules/selection.ts');
 const dates=calendarDates('2026-10','sunday'), width=242,height=207.5;
 const point=(column,row)=>calendarDateAtPoint(dates,width,height,(column+.5)*width/7,(row+.5)*height/5);
 assert.equal(point(0,1),'2026-10-04');assert.equal(point(4,1),'2026-10-08');
 assert.deepEqual(dragDateSelection(point(0,1),point(4,1)),{startDate:'2026-10-04',endDate:'2026-10-08',awaitingEnd:false});
 assert.deepEqual(dragDateSelection('2026-10-14','2026-10-04'),{startDate:'2026-10-04',endDate:'2026-10-14',awaitingEnd:false});
 assert.deepEqual(dragDateSelection('2026-10-08','2026-10-08'),{startDate:'2026-10-08',endDate:'2026-10-08',awaitingEnd:false});
 for(const [x,y] of [[-1,0],[0,-1],[width,0],[0,height]])assert.equal(calendarDateAtPoint(dates,width,height,x,y),undefined);
 assert.equal(calendarDateAtPoint(dates,0,height,0,0),undefined);
 assert.equal(selectionLabel('2026-10-04','2026-10-08'),'2026.10.04 - 10.08');
 assert.throws(()=>dragDateSelection('2026-13-01','2026-10-08'));
});
