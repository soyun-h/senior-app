import { useRef, useState, useEffect, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScheduleShell } from '../components/schedule/ScheduleShell';
import { ScheduleAsset } from '../components/schedule/ScheduleAsset';
import { Choice, RegisterButton, SectionTitle } from '../components/schedule/ScheduleControls';
import { DatePicker } from '../components/schedule/DatePicker';
import { HomeIcon } from '../components/home/HomeIcon';
import { classifyTitle, dateKeyAt, weekday, onDate, formatDate, type NotificationMethod, type ScheduleDraft, type ScheduleType, type Weekday } from '../features/schedules/model';
import { useSchedules } from '../features/schedules/ScheduleProvider';
import type { BottomTabId } from '../navigation/bottomTabs';
const weekdays=['월','화','수','목','금','토','일'];
export function ScheduleAddScreen({ onBack,onSaved,onNavigate,onSavingChange }: { onBack:()=>void;onSaved:(message:string)=>void;onNavigate:(tab:BottomTabId)=>void;onSavingChange:(busy:boolean)=>void }) {
  const {repository,accept}=useSchedules();
  const [title,setTitle]=useState('');const [type,setType]=useState<ScheduleType>('general');const [manual,setManual]=useState(false);
  const [mode,setMode]=useState<'once'|'weekly'>('once');const [date,setDate]=useState(dateKeyAt());
  const [days,setDays]=useState<Weekday[]>([]);const [hour,setHour]=useState('');const [minute,setMinute]=useState('');const [period,setPeriod]=useState<'오전'|'오후'>('오전');
  const [periodPicker,setPeriodPicker]=useState(false);const [typePicker,setTypePicker]=useState(false);const [method,setMethod]=useState<NotificationMethod>('video-call');
  const [picker,setPicker]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState<string>();
  const savingRef=useRef(false);const titleInput=useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(()=>setError(undefined),[title,type,mode,date,days,hour,minute,period,method]);
  const id=useRef(`schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`).current;
  function editTitle(value:string){setTitle(value);if(!manual)setType(classifyTitle(value));}
  async function save(){
    if(savingRef.current)return;savingRef.current=true;setSaving(true);onSavingChange(true);setError(undefined);
    try{
      if(!/^\d{1,2}$/.test(hour)||Number(hour)<1||Number(hour)>12||!/^\d{1,2}$/.test(minute)||Number(minute)>59)throw new Error('시(1~12)와 분(0~59)을 입력해 주세요.');
      const draft:ScheduleDraft={title,type,recurrence:mode==='once'?{mode:'once',date}:{mode:'weekly',weekdays:days,startDate:dateKeyAt()},hour:Number(hour)%12+(period==='오후'?12:0),minute:Number(minute),reminderMinutes:30,notificationMethod:method};
      const items=await repository.create(draft,id);accept(items);const saved=items.find(item=>item.id===id)!;onSaved(onDate(saved,dateKeyAt())?'오늘 일정 목록에서 확인할 수 있어요.':saved.recurrence.mode==='once'?`${formatDate(saved.recurrence.date)}에 표시돼요. 오늘 목록에는 표시되지 않아요.`:'선택한 반복 요일에 표시돼요. 오늘은 해당 요일이 아니에요.');
    }catch(e){setError(e instanceof Error&&/입력|선택|날짜|일정 번호/.test(e.message)?e.message:'일정을 저장하지 못했어요. 다시 시도해 주세요.');}
    finally{savingRef.current=false;setSaving(false);onSavingChange(false);}
  }
  return <ScheduleShell onNavigate={tab=>{if(!savingRef.current)onNavigate(tab);}} form>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="일정 목록으로 돌아가기" disabled={saving} onPress={onBack} style={styles.back}><ScheduleAsset name="back"/></Pressable><Text accessibilityRole="header" style={styles.title}>일정 추가</Text></View>
        <View style={[styles.section,{marginBottom:mode==='once'?44:33}]}>
          <SectionTitle>어떤 일정인가요?</SectionTitle>
          <View style={styles.inputRow}><TextInput ref={titleInput} accessibilityLabel="일정 제목" placeholder="예: 저녁 산책" value={title} onChangeText={editTitle} maxLength={80} editable={!saving} style={styles.input}/><Pressable accessibilityRole="button" accessibilityLabel="일정 유형 변경" accessibilityHint="제목으로 자동 분류된 복약 또는 일반 일정 유형을 변경합니다" onPress={()=>setTypePicker(true)} style={styles.edit}><ScheduleAsset name="edit"/></Pressable></View>

        </View>
        <View style={styles.section}>
          <SectionTitle>언제인가요?</SectionTitle>
          <View style={styles.panel}>
            <View style={styles.tabs}>
              <Pressable accessibilityRole="tab" accessibilityLabel="날짜 지정" aria-selected={mode==='once'} disabled={saving} onPress={()=>setMode('once')} style={[styles.tab,mode==='once'&&styles.activeTab]}><Text style={[styles.tabText,mode==='once'&&styles.activeTabText]}>날짜 지정</Text></Pressable>
              <Pressable accessibilityRole="tab" accessibilityLabel="요일 반복" aria-selected={mode==='weekly'} disabled={saving} onPress={()=>setMode('weekly')} style={[styles.tab,mode==='weekly'&&styles.activeTab]}><Text style={[styles.tabText,mode==='weekly'&&styles.activeTabText]}>요일 반복</Text></Pressable>
            </View>
            <View style={[styles.weekdays,mode==='once'&&styles.dateWeek]}>{weekdays.map((d,i)=>{
              const day=(i+1) as Weekday;const stamp=Date.parse(date+'T12:00:00+09:00')+(day-weekday(date))*86400000;const cellDate=dateKeyAt(stamp);
              const selected=mode==='once'?cellDate===date:days.includes(day);
              return <Pressable key={d} accessibilityRole={mode==='once'?'button':'checkbox'} accessibilityLabel={mode==='once'?`${cellDate} 날짜 선택`:`${d}요일 반복`} accessibilityState={{checked:mode==='weekly'?selected:undefined,selected}} aria-checked={mode==='weekly'?selected:undefined} disabled={saving} onPress={()=>{if(mode==='once'){setDate(cellDate);setPicker(true);}else setDays(old=>selected?old.filter(v=>v!==day):[...old,day].sort());}} style={[styles.day,mode==='once'&&styles.dateDay,selected&&styles.selectedDay]}><Text style={[styles.dayText,i===6&&{color:'#4EA674'},selected&&styles.selectedDayText]}>{d}</Text>{mode==='once'&&<Text style={[styles.dayText,selected&&styles.selectedDayText]}>{Number(cellDate.slice(8))}</Text>}</Pressable>;
            })}</View>
            <View style={styles.timeRow} accessibilityLabel="일정 실행 시각">
              <View style={styles.alarm}><HomeIcon name="alarm" size={27}/></View>
              <Pressable accessibilityRole="button" accessibilityLabel="오전 오후 선택" disabled={saving} onPress={()=>setPeriodPicker(true)} style={styles.period}><Text style={styles.periodText}>{period}⌄</Text></Pressable>
              <TextInput accessibilityLabel="일정 시" keyboardType="number-pad" maxLength={2} value={hour} onChangeText={setHour} editable={!saving} style={styles.timeInput}/><Text style={styles.timeUnit}>시</Text>
              <TextInput accessibilityLabel="일정 분" keyboardType="number-pad" maxLength={2} value={minute} onChangeText={setMinute} editable={!saving} style={styles.timeInput}/><Text style={styles.timeUnit}>분</Text>
            </View>

          </View>
        </View>
        <View style={[styles.section,{marginTop:16,marginBottom:36}]}>
          <SectionTitle>어떻게 알려드릴까요?</SectionTitle>
          <View style={[styles.panel,styles.methods]}><ScheduleAsset name="bell" width={25} height={32}/>{([{id:'video-call',label:'영상통화'},{id:'alarm',label:'알람'},{id:'none',label:'알람 끄기'}] as const).map(item=><Choice compact key={item.id} label={item.label} selected={method===item.id} disabled={saving} onPress={()=>setMethod(item.id)}/>)}</View>

        </View>
        {error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <RegisterButton label={saving?'저장 중…':'할 일 추가하기'} disabled={saving} onPress={()=>void save()}/>
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal transparent visible={periodPicker||typePicker} animationType="fade" onRequestClose={()=>{setPeriodPicker(false);setTypePicker(false);}}><Pressable accessibilityLabel="선택 닫기" onPress={()=>{setPeriodPicker(false);setTypePicker(false);}} style={styles.scrim}><View style={styles.popup}>{typePicker?<><Text style={styles.popupTitle}>일정 유형</Text>{(['general','medication'] as const).map(value=><Choice key={value} label={value==='general'?'일반 일정':'복약 일정'} selected={type===value} onPress={()=>{setType(value);setManual(true);setTypePicker(false);}}/>)}</>: (['오전','오후'] as const).map(value=><Choice key={value} label={value} selected={period===value} onPress={()=>{setPeriod(value);setPeriodPicker(false);}}/>)}</View></Pressable></Modal>
    <DatePicker visible={picker} value={date} onChange={setDate} onClose={()=>setPicker(false)}/>
  </ScheduleShell>;
}
const styles=StyleSheet.create({
  content:{paddingHorizontal:28,paddingTop:47,paddingBottom:110},header:{height:48,justifyContent:'center',alignItems:'center',marginBottom:42},back:{position:'absolute',left:0,width:48,height:48,borderRadius:24,backgroundColor:'#FFFFFFCC',alignItems:'center',justifyContent:'center',boxShadow:'0px 3px 5px #204C3320'},title:{fontSize:29,fontWeight:'700'},
  section:{marginBottom:30},inputRow:{height:40,flexDirection:'row',alignItems:'center',borderRadius:11,backgroundColor:'white',borderWidth:1,borderColor:'#D6D6D6'},input:{fontSize:16,paddingHorizontal:11,paddingVertical:7,height:38,color:'#333',flex:1,minWidth:0},edit:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  panel:{backgroundColor:'#FFFFFFDC',borderRadius:12,paddingHorizontal:17,paddingTop:0,paddingBottom:26,boxShadow:'0px 4px 18px #6C9B741A'},tabs:{height:42,flexDirection:'row',borderBottomWidth:2,borderColor:'#D1D1D1'},tab:{flex:1,alignItems:'center',justifyContent:'center',marginBottom:-2,borderBottomWidth:2,borderColor:'transparent'},activeTab:{borderColor:'#00765E'},tabText:{fontSize:16,color:'#C4C4C4',fontWeight:'600'},activeTabText:{color:'#00765E'},
  weekdays:{flexDirection:'row',justifyContent:'space-between',marginTop:20,marginBottom:27,height:34},dateWeek:{height:56,marginTop:17,marginBottom:24},day:{width:34,height:34,borderRadius:11,justifyContent:'center',alignItems:'center'},dateDay:{height:56,gap:4},selectedDay:{backgroundColor:'#C1E5BB'},dayText:{fontSize:16,color:'#666'},selectedDayText:{color:'#006954',fontWeight:'600'},
  timeRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',height:39},alarm:{width:27,marginRight:6},period:{width:69,height:39,borderWidth:1,borderColor:'#D6D6D6',borderRadius:8,alignItems:'center',justifyContent:'center',marginRight:8,backgroundColor:'white'},periodText:{fontSize:16,color:'#858585'},timeInput:{width:47,height:39,borderRadius:8,borderWidth:1,borderColor:'#D6D6D6',textAlign:'center',fontSize:18,backgroundColor:'white',padding:0,flexShrink:1},timeUnit:{fontSize:16,color:'#858585',marginLeft:4,marginRight:7},methods:{height:66,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,paddingVertical:0},error:{color:'#A32727',fontSize:16,lineHeight:25,marginBottom:12},
  scrim:{flex:1,backgroundColor:'#00000044',justifyContent:'center',alignItems:'center'},popup:{width:240,padding:18,borderRadius:16,backgroundColor:'white'},popupTitle:{fontSize:18,fontWeight:'600',textAlign:'center',marginBottom:10},
});
