import { useSoftCardPress, SCHEDULE_LONG_PRESS_MS } from '../components/schedule/useSoftCardPress';
import { ScheduleNotificationSummary } from '../components/schedule/ScheduleNotificationSummary';
import { ScheduleSkeleton } from '../components/schedule/ScheduleSkeleton';
import { ScheduleCompletionMark } from '../components/schedule/ScheduleCompletionMark';
import { ScheduleText as Text } from '../components/schedule/ScheduleText';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { ScheduleShell } from '../components/schedule/ScheduleShell';
import { ScheduleAsset } from '../components/schedule/ScheduleAsset';
import { ScheduleDeleteDialog } from '../components/schedule/ScheduleDeleteDialog';
import { HomeIcon } from '../components/home/HomeIcon';
import { formatDate, formatTime, schedulesForDate, type Schedule } from '../features/schedules/model';
import { useSchedules, useToday } from '../features/schedules/ScheduleProvider';
import type { BottomTabId } from '../navigation/bottomTabs';
export function ScheduleListScreen({ onAdd, onEdit, onNavigate, registrationNotice=false, onRegistrationNoticeConsumed }: { onAdd:()=>void; onEdit:(schedule:Schedule)=>void; onNavigate:(tab:BottomTabId)=>void; registrationNotice?:boolean; onRegistrationNoticeConsumed?:()=>void }) {
  const { items,loading,loadError,reload,repository,accept }=useSchedules();const today=useToday();
  const [error,setError]=useState<string>();const [busy,setBusy]=useState<string[]>([]);const locks=useRef(new Set<string>());
  const [toast,setToast]=useState<{kind:'registration'|'deletion'|'completion';serial:number;id?:string}|null>(null);
  const toastSerial=useRef(0);
  const toastOpacity=useRef(new Animated.Value(0)).current;
  const longPressHandled=useRef(new Set<string>());
  const [pressing,setPressing]=useState<string|null>(null);
  const [deleting,setDeleting]=useState<Schedule|null>(null);
  const [deleteBusy,setDeleteBusy]=useState(false);
  const [deleteError,setDeleteError]=useState<string>();
  const deletingRef=useRef(false);
  useEffect(()=>{
    if(registrationNotice){
      setToast({kind:'registration',serial:++toastSerial.current});
      onRegistrationNoticeConsumed?.();
    }
  },[registrationNotice,onRegistrationNoticeConsumed]);
  useEffect(()=>{
    toastOpacity.setValue(0);
    if(!toast)return;
    const animation=Animated.sequence([
      Animated.timing(toastOpacity,{toValue:1,duration:250,easing:Easing.linear,useNativeDriver:Platform.OS!=='web'}),
      Animated.delay(1600),
      Animated.timing(toastOpacity,{toValue:0,duration:600,easing:Easing.linear,useNativeDriver:Platform.OS!=='web'}),
    ]);
    animation.start(({finished})=>{
      if(finished)setToast(current=>current?.serial===toast.serial?null:current);
    });
    return ()=>animation.stop();
  },[toast,toastOpacity]);
  async function remove(){
    if(!deleting||deletingRef.current)return;
    deletingRef.current=true;setDeleteBusy(true);setDeleteError(undefined);
    try{
      accept(await repository.delete(deleting.id));setDeleting(null);setPressing(null);
      setToast({kind:'deletion',serial:++toastSerial.current});

    }catch{setDeleteError('삭제하지 못했어요. 다시 시도해 주세요.');}
    finally{deletingRef.current=false;setDeleteBusy(false);}
  }
  async function change(id:string,action:()=>Promise<typeof items>) {
    if(locks.current.has(id))return;locks.current.add(id);setBusy([...locks.current]);setError(undefined);
    try{const updated=await action();accept(updated);return updated;}catch{setError('변경 내용을 저장하지 못했어요. 다시 시도해 주세요.');}
    finally{locks.current.delete(id);setBusy([...locks.current]);}
  }
  async function completeSchedule(schedule:Schedule){
    const wasComplete=schedule.completedDates.includes(today);
    const updated=await change(schedule.id,()=>repository.toggleCompletion(schedule.id,today));
    if(!updated)return;
    if(!wasComplete&&updated.find(item=>item.id===schedule.id)?.completedDates.includes(today)){
      setToast({kind:'completion',id:schedule.id,serial:++toastSerial.current});
    }else if(toast?.kind==='completion'&&toast.id===schedule.id)setToast(null);
  }
  useEffect(()=>{void reload();},[reload,today]);
  const schedules=schedulesForDate(items,today);
  return <ScheduleShell onNavigate={onNavigate}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.heading}><HomeIcon name="alarm"/><Text accessibilityRole="header" style={styles.title}>일정</Text></View>
    <Text style={styles.date}>{formatDate(today)}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="할 일 추가" disabled={loading||!!loadError} onPress={onAdd} style={styles.add}><View style={styles.plus}><ScheduleAsset name="plus"/></View><Text style={styles.addText}>할일 추가</Text></Pressable>
    {loading&&<ScheduleSkeleton/>}
    {loadError&&<View><Text accessibilityRole="alert" style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={()=>void reload()} style={styles.retry}><Text>다시 불러오기</Text></Pressable></View>}
    {error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!loading&&!loadError&&schedules.length===0&&<Text style={styles.empty}>오늘 날짜에 해당하는 일정이 없어요.{ '\n' }다른 날짜의 일정은 해당 날짜에 표시돼요.</Text>}
    {!loading&&!loadError&&schedules.map(schedule=>{
      const complete=schedule.completedDates.includes(today),disabled=busy.includes(schedule.id);
      // RN Web otherwise adds a 50ms press-in delay; feedback and the 500ms timer start together.
      return <Pressable key={schedule.id} accessibilityRole="button" accessibilityLabel={`${schedule.title} 일정 카드`} accessibilityHint="짧게 눌러 수정하고 길게 눌러 삭제합니다" onPressIn={()=>{longPressHandled.current.delete(schedule.id);setPressing(schedule.id);}} onPressOut={()=>{if(!longPressHandled.current.has(schedule.id))setPressing(current=>current===schedule.id?null:current);}} onPress={()=>{if(!longPressHandled.current.has(schedule.id))onEdit(schedule);}} disabled={disabled} {...(Platform.OS==='web'?{delayPressIn:0}:{unstable_pressDelay:0})} delayLongPress={SCHEDULE_LONG_PRESS_MS} onLongPress={()=>{longPressHandled.current.add(schedule.id);setToast(current=>current?.kind==='registration'?current:null);setDeleting(schedule);setDeleteError(undefined);}}><CardFrame source={complete?require('../../assets/schedule/images/card-on.png'):require('../../assets/schedule/images/card-off.png')} pressed={pressing===schedule.id} latched={deleting?.id===schedule.id} complete={complete}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={`${schedule.title} 완료`} accessibilityState={{checked:complete,disabled}} aria-checked={complete} disabled={disabled} onPressIn={event=>event.stopPropagation()} onPress={event=>{event.stopPropagation();void completeSchedule(schedule);}} onLongPress={event=>event.stopPropagation()} style={styles.checkTouch}>
          <View style={[styles.check,!complete&&{borderColor:'#D8D8D8'},complete&&styles.complete]}>{complete&&<ScheduleCompletionMark/>}</View>
        </Pressable>
        <View style={styles.cardText}><Text numberOfLines={2} style={[styles.cardTitle,!complete&&styles.offText,complete&&{textDecorationLine:'line-through'}]}>{schedule.title}</Text><Text style={[styles.time,!complete&&styles.offText]}>{formatTime(schedule.hour,schedule.minute)}</Text></View>
        <ScheduleNotificationSummary schedule={schedule} complete={complete}/>
      </CardFrame></Pressable>;
    })}
  </ScrollView>
    {toast&&<Animated.View key={toast.serial} testID={`schedule-${toast.kind}-toast`} pointerEvents="none" accessibilityRole="alert" style={[styles.toast,{opacity:toastOpacity}]}><Text style={styles.toastText}>{toastMessages[toast.kind]}</Text></Animated.View>}
    <ScheduleDeleteDialog schedule={deleting} busy={deleteBusy} error={deleteError} onCancel={()=>{setPressing(null);setDeleting(null);}} onDelete={()=>void remove()}/>
  </ScheduleShell>;
}
/** Fixed layout with a visual-only transform; original PNGs stay mounted beneath content. */
function CardFrame({ source, children, pressed, latched, complete }: { source: ImageSourcePropType; children: ReactNode; pressed:boolean; latched:boolean; complete:boolean }) {
  const {opacity,scale}=useSoftCardPress(pressed,latched);
  return <Animated.View testID="schedule-card-soft-press" style={[styles.card,{transform:[{scale}]}]}>
    <View pointerEvents="none" collapsable={false} style={StyleSheet.absoluteFill}>
      <Image accessible={false} source={source} resizeMode="stretch" style={{ width: '100%', height: '100%' }}/>
    </View>
    <Animated.View testID="schedule-card-dim" pointerEvents="none" collapsable={false} style={[StyleSheet.absoluteFill,{opacity}]}>
      <Image accessible={false} source={complete?require('../../assets/schedule/images/card-on-selected.png'):require('../../assets/schedule/images/card-off-selected.png')} resizeMode="stretch" style={{width:'100%',height:'100%'}}/>
    </Animated.View>
    {children}
  </Animated.View>;
}
const toastMessages={registration:'일정을 추가했어요',deletion:'삭제되었어요',completion:'일정을 완료했어요'} as const;
const styles=StyleSheet.create({
  content:{paddingHorizontal:22,paddingTop:50,paddingBottom:108},heading:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},title:{fontSize:30,lineHeight:42,transform:[{translateY:-2}],fontWeight:'700',color:'#111'},
  date:{fontSize:16,lineHeight:24,color:'#858585',fontWeight:'600',textAlign:'center',marginTop:42},add:{flexDirection:'row',alignItems:'center',gap:5,minHeight:40,marginTop:16,marginBottom:21,marginHorizontal:6},plus:{width:40,height:40,borderRadius:20,backgroundColor:'#FFFFFFDD',justifyContent:'center',alignItems:'center',boxShadow:'0px 1px 6px #4EA67422'},addText:{fontSize:18,lineHeight:22,color:'#4EA674'},
  card:{aspectRatio:316/98,marginBottom:0,flexDirection:'row',alignItems:'center',paddingHorizontal:18},checkTouch:{minWidth:54,minHeight:54,alignItems:'center',justifyContent:'center'},check:{width:34,height:34,borderRadius:17,backgroundColor:'white',borderWidth:1.5,borderColor:'#4EA674',alignItems:'center',justifyContent:'center'},complete:{backgroundColor:'transparent',borderWidth:0},tick:{fontSize:26,color:'white',fontWeight:'700',lineHeight:32},
  cardText:{position:'absolute',left:88,right:114,minWidth:0},cardTitle:{fontSize:20,lineHeight:24,fontWeight:'600',color:'#003C40'},time:{fontSize:16,fontWeight:'500',transform:[{translateY:2}],lineHeight:25,color:'#003C40'},offText:{color:'#666'},bell:{position:'absolute',right:82,top:'50%',marginTop:-13.5,width:25,height:27,alignItems:'center',justifyContent:'center',flexShrink:0},toggleTouch:{position:'absolute',right:30,top:'50%',marginTop:-24,height:48,width:48,flexShrink:0,alignItems:'center',justifyContent:'center'},
  toast:{position:'absolute',bottom:90,alignSelf:'center',width:212,height:38,borderRadius:19,backgroundColor:'#00000033',transform:[{translateX:2}],alignItems:'center',justifyContent:'center'},toastText:{fontSize:14,lineHeight:18,fontWeight:'600',color:'#FFF'},
  empty:{fontSize:18,color:'#66786D',textAlign:'center',lineHeight:30,marginTop:26},error:{fontSize:16,color:'#A32727',lineHeight:25},retry:{minHeight:48,alignItems:'center',justifyContent:'center'},
});
