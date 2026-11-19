import { useRef, useState, useEffect, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScheduleShell } from '../components/schedule/ScheduleShell';
import { ScheduleAsset } from '../components/schedule/ScheduleAsset';
import { Choice, RegisterButton, SectionTitle } from '../components/schedule/ScheduleControls';
import { DatePicker } from '../components/schedule/DatePicker';
import { HomeIcon } from '../components/home/HomeIcon';
import { classifyTitle, dateKeyAt, formatDate, type NotificationMethod, type ScheduleDraft, type ScheduleType, type Weekday } from '../features/schedules/model';
import { useSchedules } from '../features/schedules/ScheduleProvider';
import type { BottomTabId } from '../navigation/bottomTabs';
const weekdays=['월','화','수','목','금','토','일'];
export function ScheduleAddScreen({ onBack,onSaved,onNavigate,onSavingChange }: { onBack:()=>void;onSaved:()=>void;onNavigate:(tab:BottomTabId)=>void;onSavingChange:(busy:boolean)=>void }) {
  const {repository,accept}=useSchedules();
  const [title,setTitle]=useState('');const [type,setType]=useState<ScheduleType>('general');const [manual,setManual]=useState(false);
  const [note,setNote]=useState('');const [mode,setMode]=useState<'once'|'weekly'>('once');const [date,setDate]=useState(dateKeyAt());
  const [days,setDays]=useState<Weekday[]>([]);const [hour,setHour]=useState('9');const [minute,setMinute]=useState('00');const [period,setPeriod]=useState<'오전'|'오후'>('오전');
  const [reminder,setReminder]=useState<5|10|30>(30);const [method,setMethod]=useState<NotificationMethod>('video-call');
  const [picker,setPicker]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState<string>();
  const savingRef=useRef(false);const titleInput=useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(()=>setError(undefined),[title,type,note,mode,date,days,hour,minute,period,reminder,method]);
  const id=useRef(`schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`).current;
  function editTitle(value:string){setTitle(value);if(!manual)setType(classifyTitle(value));}
  async function save(){
    if(savingRef.current)return;savingRef.current=true;setSaving(true);onSavingChange(true);setError(undefined);
    try{
      if(!/^\d{1,2}$/.test(hour)||Number(hour)<1||Number(hour)>12||!/^\d{1,2}$/.test(minute)||Number(minute)>59)throw new Error('시(1~12)와 분(0~59)을 입력해 주세요.');
      const draft:ScheduleDraft={title,type,medicationNote:note,recurrence:mode==='once'?{mode:'once',date}:{mode:'weekly',weekdays:days,startDate:dateKeyAt()},hour:Number(hour)%12+(period==='오후'?12:0),minute:Number(minute),reminderMinutes:reminder,notificationMethod:method};
      const items=await repository.create(draft,id);accept(items);onSaved();
    }catch(e){setError(e instanceof Error&&/입력|선택|날짜|일정 번호/.test(e.message)?e.message:'일정을 저장하지 못했어요. 다시 시도해 주세요.');}
    finally{savingRef.current=false;setSaving(false);onSavingChange(false);}
  }
  return <ScheduleShell onNavigate={tab=>{if(!savingRef.current)onNavigate(tab);}} form>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="일정 목록으로 돌아가기" disabled={saving} onPress={onBack} style={styles.back}><ScheduleAsset name="back"/></Pressable><Text accessibilityRole="header" style={styles.title}>일정 추가</Text></View>
        <View style={styles.section}>
          <SectionTitle>어떤 일정인가요?</SectionTitle>
          <View style={styles.inputRow}><TextInput ref={titleInput} accessibilityLabel="일정 제목" placeholder="예: 저녁 산책" value={title} onChangeText={editTitle} maxLength={80} editable={!saving} style={styles.input}/><Pressable accessibilityRole="button" accessibilityLabel="일정 제목 수정" onPress={()=>titleInput.current?.focus()} style={styles.edit}><ScheduleAsset name="edit"/></Pressable></View>
          <View style={styles.typeRow} accessibilityLabel="일정 유형"><Choice label="복약 일정" selected={type==='medication'} disabled={saving} onPress={()=>{setType('medication');setManual(true);}}/><Choice label="일반 일정" selected={type==='general'} disabled={saving} onPress={()=>{setType('general');setManual(true);}}/></View>
          <Text style={styles.hint}>{manual?'직접 선택한 유형이에요.':'제목의 단어로 분류했어요. 직접 바꿀 수 있어요.'}</Text>
          {type==='medication'&&<TextInput accessibilityLabel="약 이름과 복용 메모" placeholder="약 이름·복용 메모 (선택)" value={note} onChangeText={setNote} maxLength={500} multiline editable={!saving} style={[styles.input,styles.note]}/>}
        </View>
        <View style={styles.section}>
          <SectionTitle>언제인가요?</SectionTitle>
          <View style={styles.panel}>
            <View style={styles.tabs}>
              <Pressable accessibilityRole="tab" accessibilityLabel="날짜 지정" aria-selected={mode==='once'} disabled={saving} onPress={()=>setMode('once')} style={[styles.tab,mode==='once'&&styles.activeTab]}><Text style={[styles.tabText,mode==='once'&&styles.activeTabText]}>날짜 지정</Text></Pressable>
              <Pressable accessibilityRole="tab" accessibilityLabel="요일 반복" aria-selected={mode==='weekly'} disabled={saving} onPress={()=>setMode('weekly')} style={[styles.tab,mode==='weekly'&&styles.activeTab]}><Text style={[styles.tabText,mode==='weekly'&&styles.activeTabText]}>요일 반복</Text></Pressable>
            </View>
            {mode==='once'?<Pressable accessibilityRole="button" accessibilityLabel="날짜 선택" disabled={saving} onPress={()=>setPicker(true)} style={styles.dateButton}><Text style={styles.dateText}>{formatDate(date)}</Text><Text style={styles.hint}>눌러서 날짜 변경</Text></Pressable>:<View style={styles.weekdays}>{weekdays.map((d,i)=>{const day=(i+1) as Weekday;const selected=days.includes(day);return <Pressable key={d} accessibilityRole="checkbox" accessibilityLabel={`${d}요일 반복`} accessibilityState={{checked:selected}} aria-checked={selected} disabled={saving} onPress={()=>setDays(old=>selected?old.filter(v=>v!==day):[...old,day].sort())} style={[styles.day,selected&&styles.selectedDay]}><Text style={[styles.dayText,selected&&styles.selectedDayText]}>{d}</Text></Pressable>;})}</View>}
            <View style={styles.timeRow} accessibilityLabel="일정 실행 시각">
              <View style={styles.period}><Choice label="오전" selected={period==='오전'} disabled={saving} onPress={()=>setPeriod('오전')}/><Choice label="오후" selected={period==='오후'} disabled={saving} onPress={()=>setPeriod('오후')}/></View>
              <TextInput accessibilityLabel="일정 시" keyboardType="number-pad" maxLength={2} value={hour} onChangeText={setHour} editable={!saving} style={styles.timeInput}/><Text style={styles.timeUnit}>시</Text>
              <TextInput accessibilityLabel="일정 분" keyboardType="number-pad" maxLength={2} value={minute} onChangeText={setMinute} editable={!saving} style={styles.timeInput}/><Text style={styles.timeUnit}>분</Text>
            </View>
            <View style={styles.reminder}><HomeIcon name="alarm"/>{([5,10,30] as const).map(n=><Choice key={n} label={`${n}분 전`} selected={reminder===n} disabled={saving} onPress={()=>setReminder(n)}/>)}</View>
          </View>
        </View>
        <View style={styles.section}>
          <SectionTitle>어떻게 알려드릴까요?</SectionTitle>
          <View style={[styles.panel,styles.methods]}><ScheduleAsset name="bell" width={25} height={32}/>{([{id:'video-call',label:'영상통화'},{id:'alarm',label:'알람'},{id:'none',label:'알람 끄기'}] as const).map(item=><Choice key={item.id} label={item.label} selected={method===item.id} disabled={saving} onPress={()=>setMethod(item.id)}/>)}</View>
          <Text style={styles.hint}>알림 방식만 저장돼요. 실제 알림·통화는 준비 중이에요.</Text>
        </View>
        {error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <RegisterButton label={saving?'저장 중…':'할 일 추가하기'} disabled={saving} onPress={()=>void save()}/>
      </ScrollView>
    </KeyboardAvoidingView>
    <DatePicker visible={picker} value={date} onChange={setDate} onClose={()=>setPicker(false)}/>
  </ScheduleShell>;
}
const styles=StyleSheet.create({
  content:{paddingHorizontal:24,paddingTop:42,paddingBottom:105},header:{height:48,justifyContent:'center',alignItems:'center',marginBottom:42},back:{position:'absolute',left:0,width:46,height:46,borderRadius:23,backgroundColor:'#FFFFFFCC',alignItems:'center',justifyContent:'center',boxShadow:'0px 3px 5px #204C3320'},title:{fontSize:29,fontWeight:'700'},
  section:{marginBottom:30},inputRow:{flexDirection:'row',alignItems:'center',borderRadius:11,backgroundColor:'white',borderWidth:1,borderColor:'#DDD'},input:{fontSize:17,padding:12,minHeight:46,color:'#333',flex:1},edit:{width:44,minHeight:44,alignItems:'center',justifyContent:'center'},note:{flex:0,borderWidth:1,borderColor:'#DDD',borderRadius:11,backgroundColor:'white',minHeight:70,marginTop:10,textAlignVertical:'top'},typeRow:{flexDirection:'row',marginTop:10,gap:12},hint:{fontSize:12,lineHeight:19,color:'#737373',marginTop:4},
  panel:{backgroundColor:'#FFFFFFDC',borderRadius:12,padding:16,boxShadow:'0px 4px 18px #6C9B7420'},tabs:{flexDirection:'row',borderBottomWidth:2,borderColor:'#D1D1D1'},tab:{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',marginBottom:-2,borderBottomWidth:2,borderColor:'transparent'},activeTab:{borderColor:'#00765E'},tabText:{fontSize:17,color:'#AAA',fontWeight:'600'},activeTabText:{color:'#00765E'},
  dateButton:{minHeight:76,alignItems:'center',justifyContent:'center',paddingVertical:10},dateText:{fontSize:17,color:'#006954',textAlign:'center'},weekdays:{flexDirection:'row',justifyContent:'space-between',marginVertical:18},day:{flex:1,minHeight:44,borderRadius:11,justifyContent:'center',alignItems:'center'},selectedDay:{backgroundColor:'#C1E5BB'},dayText:{fontSize:17,color:'#666'},selectedDayText:{color:'#006954',fontWeight:'700'},
  timeRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:3,flexWrap:'wrap',marginTop:10},period:{flexDirection:'row',marginRight:4},timeInput:{width:39,minHeight:44,borderRadius:8,borderWidth:1,borderColor:'#D6E6DA',textAlign:'center',fontSize:18,backgroundColor:'white'},timeUnit:{fontSize:14,color:'#666'},reminder:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:20},methods:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12,paddingVertical:10},error:{color:'#A32727',fontSize:16,lineHeight:25,marginBottom:12},
});
