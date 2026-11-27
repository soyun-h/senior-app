import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homeSchedules} from '../src/features/schedules/home.ts';
const make=(id,hour,recurrence,completedDates=[])=>({id,title:id,hour,minute:0,recurrence,completedDates,createdAt:'2026-10-01T00:00:00Z'});
test('home uses today once/range/weekly items in time order, two slots, real completion, no mutations or fake records',()=>{
 const today='2026-10-04';
 const items=[make('future',8,{mode:'once',date:'2026-10-05'}),make('once',11,{mode:'once',date:today}),make('range',10,{mode:'range',startDate:today,endDate:'2026-10-08'}),make('weekly',9,{mode:'weekly',startDate:today,weekdays:[7]},[today])];
 const before=JSON.stringify(items);
 assert.deepEqual(homeSchedules(items,today),[{id:'weekly',title:'weekly',time:'9:00',completed:true},{id:'range',title:'range',time:'10:00',completed:false}]);
 assert.equal(JSON.stringify(items),before);
 assert.deepEqual(homeSchedules([],today),[]);
 assert.deepEqual(homeSchedules([items[0]],today),[]);
 assert.equal(homeSchedules(items.filter(s=>s.id!=='weekly'),today)[0].id,'range');
});
