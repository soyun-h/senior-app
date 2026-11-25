import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LocalScheduleRepository,SCHEDULE_STORAGE_KEY} from '../src/features/schedules/repository.ts';
import {schedulesForDate,parseSchedules} from '../src/features/schedules/model.ts';
const now=Date.parse('2026-11-19T00:00:00Z');
const draft=(extra={})=>({title:'일정',type:'general',recurrence:{mode:'once',date:'2026-11-19'},hour:18,minute:30,reminderMinutes:10,notificationMethod:'alarm',...extra});
class Storage{raw=null;fail=false;async getItem(){return this.raw;}async setItem(k,v){if(this.fail)throw Error('test');this.raw=v;}}
test('update keeps ID, creation timestamp, completion history, legacy memo and unrelated records without duplicates',async()=>{
 const storage=new Storage(),repo=new LocalScheduleRepository(storage);
 await repo.create(draft({medicationNote:'기존 메모',type:'medication'}),'one',now);await repo.create(draft(),'other',now);await repo.toggleCompletion('one','2026-11-19',now);
 const before=await repo.list();const result=await repo.update('one',draft({title:'수정한 일정',hour:19,recurrence:{mode:'range',startDate:'2026-11-20',endDate:'2026-11-22'}}),now+1000);
 assert.equal(result.length,2);const s=result.find(i=>i.id==='one');assert.equal(s.id,'one');assert.equal(s.createdAt,before[0].createdAt);assert.deepEqual(s.completedDates,['2026-11-19']);assert.equal(s.medicationNote,'기존 메모');assert.deepEqual(result[1],before[1]);assert.equal(s.title,'수정한 일정');
 const restored=await new LocalScheduleRepository(storage).list();assert.deepEqual(restored,result);assert.equal(schedulesForDate(restored,'2026-11-19').filter(s=>s.id==='one').length,0);assert.equal(schedulesForDate(restored,'2026-11-21').filter(s=>s.id==='one').length,1);
});
test('existing past execution times and old weekly starts can be edited while creation validation remains strict',async()=>{
 const storage=new Storage(),repo=new LocalScheduleRepository(storage);await repo.create(draft(),'one',now);
 await repo.update('one',draft({title:'제목만 변경'}),now+24*3600000);assert.equal((await repo.list())[0].title,'제목만 변경');
 await repo.update('one',draft({recurrence:{mode:'weekly',startDate:'2026-11-01',weekdays:[4,7]}}),now);assert.equal(schedulesForDate(await repo.list(),'2026-11-19').length,1);
 await assert.rejects(repo.create(draft(),'new',now+24*3600000));
 for(const invalid of [{title:' '},{hour:24},{recurrence:{mode:'weekly',startDate:'2026-11-01',weekdays:[]}},{recurrence:{mode:'range',startDate:'2026-11-22',endDate:'2026-11-21'}}])await assert.rejects(repo.update('one',draft(invalid),now));
});
test('notification editing preserves legacy alarm and disabled values until explicit selection, then saves selected mode',async()=>{
 const storage=new Storage(),repo=new LocalScheduleRepository(storage);await repo.create(draft(),'alarm',now);
 await repo.update('alarm',draft({title:'이름 변경'}),now);assert.equal((await repo.list())[0].notificationMethod,'alarm');assert.equal((await repo.list())[0].notificationsEnabled,true);
 let data=JSON.parse(storage.raw);data.items[0].notificationsEnabled=false;storage.raw=JSON.stringify(data);
 await repo.update('alarm',draft({title:'꺼진 알람 유지'}),now);assert.equal((await repo.list())[0].notificationsEnabled,false);assert.equal((await repo.list())[0].notificationMethod,'alarm');
 await repo.update('alarm',draft(),now,{notificationEdited:true});assert.equal((await repo.list())[0].notificationsEnabled,true);
 await repo.update('alarm',draft({notificationMethod:'none'}),now,{notificationEdited:true});assert.equal((await repo.list())[0].notificationMethod,'none');assert.equal((await repo.list())[0].notificationsEnabled,false);
});
test('failed update, missing ID and caller mutation cannot overwrite records or publish a duplicate',async()=>{
 const storage=new Storage(),repo=new LocalScheduleRepository(storage);await repo.create(draft(),'one',now);const original=storage.raw;storage.fail=true;await assert.rejects(repo.update('one',draft({title:'실패'}),now));assert.equal(storage.raw,original);storage.fail=false;
 await assert.rejects(repo.update('missing',draft(),now));assert.equal(storage.raw,original);
 const input=draft({title:'정상 수정'});const promise=repo.update('one',input,now);input.title='외부 변경';await promise;assert.equal((await repo.list())[0].title,'정상 수정');assert.equal((await repo.list()).length,1);
 const data=JSON.parse(storage.raw);data.items[0].completedDates=['bad'];assert.throws(()=>parseSchedules(JSON.stringify(data)));
});
