import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateKeyAt, weekday, validDate, classifyTitle, validateDraft, schedulesForDate, formatTime, parseSchedules } from '../src/features/schedules/model.ts';
import { LocalScheduleRepository, SCHEDULE_STORAGE_KEY } from '../src/features/schedules/repository.ts';
const now=Date.parse('2026-11-19T00:00:00Z'); // Thursday, 09:00 KST
function draft(overrides={}){return {title:'저녁 산책',type:'general',recurrence:{mode:'once',date:'2026-11-19'},hour:18,minute:30,reminderMinutes:30,notificationMethod:'video-call',medicationNote:'',...overrides};}
class MemoryStorage {
 data=new Map();fail=false;
 async getItem(key){return this.data.get(key)??null;}
 async setItem(key,value){if(this.fail)throw Error('storage full');this.data.set(key,value);}
}
test('KST date boundaries, leap dates, weekdays, and AM/PM remain independent of host timezone',()=>{
 assert.equal(dateKeyAt(Date.parse('2026-11-19T14:59:59Z')),'2026-11-19');
 assert.equal(dateKeyAt(Date.parse('2026-11-19T15:00:00Z')),'2026-11-20');
 assert.equal(weekday('2026-11-19'),4);assert.equal(weekday('2026-11-22'),7);
 assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);
 assert.equal(formatTime(0,5),'오전 12:05');assert.equal(formatTime(12,0),'오후 12:00');assert.equal(formatTime(18,30),'오후 6:30');
});
test('title classifier is a conservative rule, not a medical inference',()=>{
 assert.equal(classifyTitle('당뇨약'),'medication');assert.equal(classifyTitle('약 먹기'),'medication');assert.equal(classifyTitle('비타민 복용'),'medication');
 assert.equal(classifyTitle('약속 장소로 이동'),'general');assert.equal(classifyTitle('저녁 산책'),'general');
});
test('required title, dates, time, recurrence weekdays, lead time and notification mode are validated',()=>{
 for(const invalid of [draft({title:' '}),draft({title:'a'.repeat(81)}),draft({hour:24}),draft({minute:-1}),draft({minute:2.5}),draft({recurrence:{mode:'once',date:'2026-02-30'}}),draft({hour:8}),draft({recurrence:{mode:'weekly',weekdays:[],startDate:'2026-11-19'}}),draft({recurrence:{mode:'weekly',weekdays:[4,4],startDate:'2026-11-19'}}),draft({recurrence:{mode:'weekly',weekdays:[8],startDate:'2026-11-19'}}),draft({reminderMinutes:15}),draft({notificationMethod:'push'})])assert.throws(()=>validateDraft(invalid,now));
 assert.doesNotThrow(()=>validateDraft(draft(),now));
});
test('all three notification choices and lead times persist separately from execution time',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);
 for(const [i,method] of ['video-call','alarm','none'].entries())await repo.create(draft({notificationMethod:method,reminderMinutes:[5,10,30][i]}),'id'+i,now);
 const loaded=await new LocalScheduleRepository(storage).list();
 assert.equal(loaded.length,3);
 loaded.forEach((s,i)=>{assert.equal(s.hour,18);assert.equal(s.minute,30);assert.equal(s.reminderMinutes,[5,10,30][i]);assert.equal(s.notificationsEnabled,s.notificationMethod!=='none');assert.equal(s.timeZone,'Asia/Seoul');});
});
test('single and weekly schedules appear only on matching dates, once and in time order',async()=>{
 const repo=new LocalScheduleRepository(new MemoryStorage());
 await repo.create(draft({title:'늦은 일정'}),'once',now);
 const items=await repo.create(draft({title:'빠른 반복',hour:10,recurrence:{mode:'weekly',weekdays:[4,6],startDate:'2026-11-19'}}),'repeat',now);
 assert.deepEqual(schedulesForDate(items,'2026-11-19').map(s=>s.id),['repeat','once']);
 assert.equal(schedulesForDate(items,'2026-11-20').length,0);
 assert.deepEqual(schedulesForDate(items,'2026-11-21').map(s=>s.id),['repeat']);
 assert.equal(schedulesForDate(items,'2026-11-14').length,0);
});
test('completion belongs to an occurrence date and resets on the next matching day, including after reload',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);
 await repo.create(draft({recurrence:{mode:'weekly',weekdays:[4,6],startDate:'2026-11-19'}}),'repeat',now);
 await repo.toggleCompletion('repeat','2026-11-19',now);
 const [saved]=await new LocalScheduleRepository(storage).list();
 assert.deepEqual(saved.completedDates,['2026-11-19']);assert.equal(saved.completedDates.includes('2026-11-21'),false);
 await assert.rejects(repo.toggleCompletion('repeat','2026-11-20',now));
 const [cleared]=await repo.toggleCompletion('repeat','2026-11-19',now);assert.deepEqual(cleared.completedDates,[]);
});
test('notification toggle and explicit manual type override persist; no medication text is invented',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);
 await repo.create(draft({title:'당뇨약',type:'general',medicationNote:'무시할 메모'}),'manual',now);
 await repo.create(draft({type:'medication',medicationNote:'내가 입력한 약 이름 · 식후'}),'med',now);
 await repo.setNotifications('manual',false,now+1000);
 const items=await new LocalScheduleRepository(storage).list();
 assert.equal(items[0].type,'general');assert.equal(items[0].medicationNote,'');assert.equal(items[0].notificationsEnabled,false);
 assert.equal(items[1].medicationNote,'내가 입력한 약 이름 · 식후');assert.equal(items[0].updatedAt,new Date(now+1000).toISOString());
});
test('parallel creates serialize, retried form IDs do not duplicate, and input mutation cannot alter a pending save',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);const d=draft();
 const first=repo.create(d,'a',now);d.title='변경된 외부 객체';
 await Promise.all([first,repo.create(draft(),'b',now),repo.create(draft(),'a',now)]);
 const items=await repo.list();assert.equal(items.length,2);assert.equal(items[0].title,'저녁 산책');
});
test('failed writes do not publish success or lose saved data; a retry succeeds',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);await repo.create(draft(),'a',now);
 const original=storage.data.get(SCHEDULE_STORAGE_KEY);storage.fail=true;
 await assert.rejects(repo.create(draft(),'b',now));await assert.rejects(repo.toggleCompletion('a','2026-11-19',now));
 assert.equal(storage.data.get(SCHEDULE_STORAGE_KEY),original);
 storage.fail=false;assert.equal((await repo.create(draft(),'b',now)).length,2);
});
test('invalid persisted schemas fail closed and are never silently overwritten',async()=>{
 const storage=new MemoryStorage();storage.data.set(SCHEDULE_STORAGE_KEY,'{"version":99,"items":[]}');
 const repo=new LocalScheduleRepository(storage);await assert.rejects(repo.list());await assert.rejects(repo.create(draft(),'new',now));
 assert.equal(storage.data.get(SCHEDULE_STORAGE_KEY),'{"version":99,"items":[]}');assert.deepEqual(parseSchedules(null),[]);
});

test('memo-free new schedules and legacy memos coexist without losing existing data',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);
 const fresh=draft();delete fresh.medicationNote;
 await repo.create(fresh,'fresh',now);
 await repo.create(draft({type:'medication',medicationNote:'기존 메모'}),'legacy',now);
 await repo.setNotifications('legacy',false,now+1000);
 const items=await new LocalScheduleRepository(storage).list();
 assert.equal(items[0].medicationNote,undefined);assert.equal(items[1].medicationNote,'기존 메모');
 assert.equal(schedulesForDate(items,'2026-11-19').length,2);
});

test('range schedules include both endpoints, survive reload, and keep completion per date',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);
 await repo.create(draft({recurrence:{mode:'range',startDate:'2026-11-19',endDate:'2026-11-21'}}),'range',now);
 await repo.toggleCompletion('range','2026-11-19',now);
 const loaded=await new LocalScheduleRepository(storage).list();
 for(const date of ['2026-11-19','2026-11-20','2026-11-21'])assert.equal(schedulesForDate(loaded,date).length,1);
 for(const date of ['2026-11-18','2026-11-22'])assert.equal(schedulesForDate(loaded,date).length,0);
 assert.deepEqual(loaded[0].completedDates,['2026-11-19']);
 await repo.toggleCompletion('range','2026-11-20',now+86_400_000);
 assert.deepEqual((await repo.list())[0].completedDates,['2026-11-19','2026-11-20']);
});
test('invalid or entirely elapsed ranges cannot be saved; persisted past ranges remain readable',async()=>{
 for(const r of [
  {mode:'range',startDate:'2026-11-21',endDate:'2026-11-19'},
  {mode:'range',startDate:'2026-02-30',endDate:'2026-11-21'},
  {mode:'range',startDate:'2026-11-18',endDate:'2026-11-21'},
  {mode:'range',startDate:'2026-11-19',endDate:'2026-11-19'},
 ])assert.throws(()=>validateDraft(draft({recurrence:r,hour:8}),now));
 const repo=new LocalScheduleRepository(new MemoryStorage());
 await repo.create(draft({recurrence:{mode:'range',startDate:'2026-11-19',endDate:'2026-11-21'}}),'range',now);
 assert.equal((await repo.list()).length,1);
});
test('deletion persists, removes all recurring occurrences, and leaves old records byte-for-byte unchanged',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);
 await repo.create(draft({medicationNote:'원래 자료'}),'once',now);
 await repo.create(draft({recurrence:{mode:'weekly',weekdays:[4,6],startDate:'2026-11-19'}}),'weekly',now);
 await repo.toggleCompletion('weekly','2026-11-19',now);
 const before=await repo.list();const remaining=await repo.delete('weekly');
 assert.deepEqual(remaining,[before[0]]);
 assert.deepEqual(await new LocalScheduleRepository(storage).list(),remaining);
 assert.equal(schedulesForDate(remaining,'2026-11-21').length,0);
 assert.deepEqual(await repo.delete('weekly'),remaining);
});
test('failed deletion retains data and serialized deletion cannot resurrect removed schedules',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);
 await repo.create(draft(),'original',now);const before=storage.data.get(SCHEDULE_STORAGE_KEY);
 storage.fail=true;await assert.rejects(repo.delete('original'));assert.equal(storage.data.get(SCHEDULE_STORAGE_KEY),before);
 storage.fail=false;
 await Promise.all([repo.create(draft(),'new',now),repo.delete('original')]);
 assert.deepEqual((await repo.list()).map(s=>s.id),['new']);
 await assert.rejects(repo.delete(''));
});

test('notification toggle preserves the selected delivery method, weekly state and completion',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);
 for(const method of ['none','alarm','video-call'])await repo.create(draft({notificationMethod:method,recurrence:{mode:'weekly',startDate:'2026-11-19',weekdays:[4]}}),method,now);
 await repo.toggleCompletion('none','2026-11-19',now);
 const legacy=(await repo.list()).find(s=>s.id==='alarm');assert.equal(legacy.notificationMethod,'alarm');assert.equal(legacy.notificationsEnabled,true);
 for(const method of ['none','alarm','video-call']){
  const before=(await repo.list()).find(s=>s.id===method);
  await repo.setNotifications(method,true,now+1000);
  let s=(await new LocalScheduleRepository(storage).list()).find(s=>s.id===method);
  const delivery=method==='none'?'video-call':method;
  assert.equal(s.notificationMethod,delivery);assert.equal(s.notificationsEnabled,true);assert.deepEqual(s.completedDates,before.completedDates);assert.deepEqual(s.recurrence,before.recurrence);
  await repo.setNotifications(method,false,now+2000);
  s=(await new LocalScheduleRepository(storage).list()).find(s=>s.id===method);
  assert.equal(s.notificationMethod,delivery);assert.equal(s.notificationsEnabled,false);assert.deepEqual(s.completedDates,before.completedDates);
 }
});
test('alarm confirmation is idempotent and editing moves its occurrence without keeping unrelated completion',async()=>{
 const repository=new LocalScheduleRepository(new MemoryStorage());
 await repository.create(draft({notificationMethod:'alarm'}),'alarm',now);
 await repository.complete('alarm','2026-11-19',now);
 await repository.complete('alarm','2026-11-19',now);
 assert.deepEqual((await repository.list())[0].completedDates,['2026-11-19']);
 await repository.update('alarm',draft({notificationMethod:'alarm',reminderMinutes:5,recurrence:{mode:'once',date:'2026-11-20'}}),now);
 const changed=(await repository.list())[0];
 assert.equal(changed.reminderMinutes,5);assert.deepEqual(changed.completedDates,[]);assert.equal(changed.recurrence.date,'2026-11-20');
});
test('failed video toggle preserves saved method, enabled flag, completion and unrelated records',async()=>{
 const storage=new MemoryStorage(),repo=new LocalScheduleRepository(storage);
 await repo.create(draft({notificationMethod:'alarm'}),'legacy',now);await repo.create(draft({notificationMethod:'none'}),'off',now);
 const before=storage.data.get(SCHEDULE_STORAGE_KEY);storage.fail=true;
 await assert.rejects(repo.setNotifications('legacy',true,now+1000));assert.equal(storage.data.get(SCHEDULE_STORAGE_KEY),before);
 storage.fail=false;await repo.setNotifications('off',true,now+1000);
 assert.deepEqual((await repo.list()).find(s=>s.id==='legacy'),JSON.parse(before).items.find(s=>s.id==='legacy'));
});
