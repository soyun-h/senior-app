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
export function ScheduleListScreen({ onAdd, onNavigate, registrationNotice=false, onRegistrationNoticeConsumed }: { onAdd:()=>void; onNavigate:(tab:BottomTabId)=>void; registrationNotice?:boolean; onRegistrationNoticeConsumed?:()=>void }) {
  const { items,loading,loadError,reload,repository,accept }=useSchedules();const today=useToday();
  const [error,setError]=useState<string>();const [busy,setBusy]=useState<string[]>([]);const locks=useRef(new Set<string>());
  const [registrationToastVisible,setRegistrationToastVisible]=useState(false);
  const registrationOpacity=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(registrationNotice){
      registrationOpacity.setValue(0);
      setRegistrationToastVisible(true);
      onRegistrationNoticeConsumed?.();
    }
  },[registrationNotice,onRegistrationNoticeConsumed,registrationOpacity]);
  useEffect(()=>{
    if(!registrationToastVisible)return;
    // Add 250ms fade-in; retain the existing 1600ms hold and 600ms fade-out.
    const animation=Animated.sequence([
      Animated.timing(registrationOpacity,{toValue:1,duration:250,easing:Easing.linear,useNativeDriver:Platform.OS!=='web'}),
      Animated.delay(1600),
      Animated.timing(registrationOpacity,{toValue:0,duration:600,easing:Easing.linear,useNativeDriver:Platform.OS!=='web'}),
    ]);
    animation.start(({finished})=>{if(finished)setRegistrationToastVisible(false);});
    return ()=>animation.stop();
  },[registrationToastVisible,registrationOpacity]);
  const [deleting,setDeleting]=useState<Schedule|null>(null);
  const [deleteBusy,setDeleteBusy]=useState(false);
  const [deleteError,setDeleteError]=useState<string>();
  const [toast,setToast]=useState(false);
  const deletingRef=useRef(false);
  const deletionOpacity=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(!toast)return;
    deletionOpacity.setValue(0);
    const animation=Animated.sequence([
      Animated.timing(deletionOpacity,{toValue:1,duration:250,easing:Easing.linear,useNativeDriver:Platform.OS!=='web'}),
      Animated.delay(1600),
      Animated.timing(deletionOpacity,{toValue:0,duration:600,easing:Easing.linear,useNativeDriver:Platform.OS!=='web'}),
    ]);
    animation.start(({finished})=>{if(finished)setToast(false);});
    return ()=>animation.stop();
  },[toast,deletionOpacity]);
  async function remove(){
    if(!deleting||deletingRef.current)return;
    deletingRef.current=true;setDeleteBusy(true);setDeleteError(undefined);
    try{
      accept(await repository.delete(deleting.id));setDeleting(null);setRegistrationToastVisible(false);deletionOpacity.stopAnimation();deletionOpacity.setValue(0);setToast(true);

    }catch{setDeleteError('삭제하지 못했어요. 다시 시도해 주세요.');}
    finally{deletingRef.current=false;setDeleteBusy(false);}
  }
  async function change(id:string,action:()=>Promise<typeof items>) {
    if(locks.current.has(id))return;locks.current.add(id);setBusy([...locks.current]);setError(undefined);
    try{accept(await action());}catch{setError('변경 내용을 저장하지 못했어요. 다시 시도해 주세요.');}
    finally{locks.current.delete(id);setBusy([...locks.current]);}
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
    {!loading&&!loadError&&schedules.map((schedule,row)=>{
      const complete=schedule.completedDates.includes(today),disabled=busy.includes(schedule.id),enabled=schedule.notificationsEnabled&&schedule.notificationMethod==='video-call';
      return <Pressable onLayout={event=>cardImageTrace('parent-layout',{row,width:event.nativeEvent.layout.width,height:event.nativeEvent.layout.height})} key={schedule.id} accessibilityRole="button" accessibilityLabel={`${schedule.title} 일정 카드`} accessibilityHint="길게 눌러 일정을 삭제합니다" disabled={disabled} delayLongPress={500} onLongPress={()=>{setDeleting(schedule);setDeleteError(undefined);setToast(false);}}><CardFrame row={row} source={deleting?.id===schedule.id?(enabled?require('../../assets/schedule/images/card-on-selected.png'):require('../../assets/schedule/images/card-off-selected.png')):enabled?require('../../assets/schedule/images/card-on.png'):require('../../assets/schedule/images/card-off.png')}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={`${schedule.title} 완료`} accessibilityState={{checked:complete,disabled}} aria-checked={complete} disabled={disabled} onPress={()=>void change(schedule.id,()=>repository.toggleCompletion(schedule.id,today))} style={styles.checkTouch}>
          <View style={[styles.check,!enabled&&{borderColor:'#D8D8D8'},complete&&styles.complete]}>{complete&&<ScheduleCompletionMark/>}</View>
        </Pressable>
        <View style={styles.cardText}><Text numberOfLines={2} style={[styles.cardTitle,!enabled&&styles.offText]}>{schedule.title}</Text><Text style={[styles.time,!enabled&&styles.offText]}>{formatTime(schedule.hour,schedule.minute)}</Text></View>
        <View style={[styles.bell,{opacity:enabled?1:0.25}]}><ScheduleAsset name="bell" width={23} height={27}/></View>
        <Pressable accessibilityRole="switch" accessibilityLabel={`${schedule.title} 알림`} aria-checked={enabled} accessibilityHint={schedule.notificationMethod==='alarm'?'현재 알람 방식입니다. 켜면 영상통화 알림으로 변경합니다.':undefined} accessibilityState={{checked:enabled,disabled}} disabled={disabled} onPress={()=>void change(schedule.id,()=>repository.setNotifications(schedule.id,!enabled))} style={styles.toggleTouch}><ScheduleAsset name={enabled?'toggle-on':'toggle-off'} width={48} height={24}/></Pressable>
      </CardFrame></Pressable>;
    })}
  </ScrollView>
    {registrationToastVisible&&<Animated.View testID="schedule-registration-toast" pointerEvents="none" accessibilityRole="alert" style={[styles.toast,{opacity:registrationOpacity,transform:[{translateX:2}]}]}><Text style={styles.toastText}>일정을 추가했습니다.</Text></Animated.View>}
    {toast&&<Animated.View testID="schedule-deletion-toast" pointerEvents="none" accessibilityRole="alert" style={[styles.toast,{opacity:deletionOpacity}]}><Text style={styles.toastText}>삭제되었습니다</Text></Animated.View>}
    <ScheduleDeleteDialog schedule={deleting} busy={deleteBusy} error={deleteError} onCancel={()=>setDeleting(null)} onDelete={()=>void remove()}/>
  </ScheduleShell>;
}
/** Background only: an unpadded absolute layer fills the card's border box.
 * Always mount the original image; do not gate it on an onLayout callback.
 */
// Temporary development-only diagnostics: never log titles, schedule IDs, URLs or raw errors.
function cardImageTrace(event: string, fields: Record<string, string | number | boolean | undefined>) {
  if (__DEV__) console.info('[ScheduleCard native-diag-1]', JSON.stringify({ platform: Platform.OS, event, ...fields }));
}
function CardFrame({ source, children, row }: { source: ImageSourcePropType; children: ReactNode; row: number }) {
  useEffect(() => {
    if (!__DEV__) return;
    const resolved = typeof Image.resolveAssetSource === 'function' ? Image.resolveAssetSource(source) : undefined;
    const uri = resolved?.uri ?? '';
    const asset = uri.match(/card-(?:on|off)(?:-selected)?(?:\.[a-f0-9]+)?\.png(?=[?\s]|$)/)?.[0] ?? 'unresolved';
    cardImageTrace('source-resolved', { row, available: !!resolved, asset,
      width: resolved?.width, height: resolved?.height, scale: resolved?.scale,
      transport: !uri ? 'unresolved' : /^https?:/.test(uri) ? 'network' : 'local',
      sourceType: typeof source, declaredOpacity: 1, backgroundOrder: 'before-content' });
  }, [source, row]);
  return <View style={styles.card} onLayout={event=>cardImageTrace('card-layout',{row,width:event.nativeEvent.layout.width,height:event.nativeEvent.layout.height})}>
    <View pointerEvents="none" collapsable={false} style={StyleSheet.absoluteFill} onLayout={event=>cardImageTrace('background-layout',{row,width:event.nativeEvent.layout.width,height:event.nativeEvent.layout.height})}>
      <Image accessible={false} source={source} resizeMode="stretch" style={{ width: '100%', height: '100%' }}
        onLayout={event=>cardImageTrace('image-layout',{row,width:event.nativeEvent.layout.width,height:event.nativeEvent.layout.height})}
        onLoadStart={()=>cardImageTrace('load-start',{row})}
        onLoad={event=>cardImageTrace('load-success',{row,width:event.nativeEvent.source?.width,height:event.nativeEvent.source?.height})}
        onLoadEnd={()=>cardImageTrace('load-end',{row})}
        onError={event=>{
          const error=event.nativeEvent.error ?? '';
          const http=error.match(/\b(?:400|401|403|404|408|429|500|502|503|504)\b/)?.[0];
          cardImageTrace('load-error',{row,reason:http?`http-${http}`:/decode|format|corrupt/i.test(error)?'decode':/network|connect|timeout|host/i.test(error)?'network':'unknown'});
        }}/>
    </View>
    {children}
  </View>;
}
const styles=StyleSheet.create({
  content:{paddingHorizontal:22,paddingTop:50,paddingBottom:108},heading:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},title:{fontSize:30,lineHeight:42,transform:[{translateY:-2}],fontWeight:'700',color:'#111'},
  date:{fontSize:16,lineHeight:24,color:'#858585',fontWeight:'600',textAlign:'center',marginTop:42},add:{flexDirection:'row',alignItems:'center',gap:5,minHeight:40,marginTop:16,marginBottom:21,marginHorizontal:6},plus:{width:40,height:40,borderRadius:20,backgroundColor:'#FFFFFFDD',justifyContent:'center',alignItems:'center',boxShadow:'0px 1px 6px #4EA67422'},addText:{fontSize:18,lineHeight:22,color:'#4EA674'},
  card:{aspectRatio:316/98,marginBottom:0,flexDirection:'row',alignItems:'center',paddingHorizontal:18},checkTouch:{minWidth:54,minHeight:54,alignItems:'center',justifyContent:'center'},check:{width:34,height:34,borderRadius:17,backgroundColor:'white',borderWidth:1.5,borderColor:'#4EA674',alignItems:'center',justifyContent:'center'},complete:{backgroundColor:'transparent',borderWidth:0},tick:{fontSize:26,color:'white',fontWeight:'700',lineHeight:32},
  cardText:{position:'absolute',left:88,right:114,minWidth:0},cardTitle:{fontSize:20,lineHeight:24,fontWeight:'600',color:'#003C40'},time:{fontSize:16,fontWeight:'500',transform:[{translateY:2}],lineHeight:25,color:'#003C40'},offText:{color:'#666'},bell:{position:'absolute',right:82,top:'50%',marginTop:-13.5,width:25,height:27,alignItems:'center',justifyContent:'center',flexShrink:0},toggleTouch:{position:'absolute',right:30,top:'50%',marginTop:-24,height:48,width:48,flexShrink:0,alignItems:'center',justifyContent:'center'},
  toast:{position:'absolute',bottom:95,alignSelf:'center',width:212,height:38,borderRadius:19,backgroundColor:'#4EA674A6',alignItems:'center',justifyContent:'center'},toastText:{fontSize:14,lineHeight:18,fontWeight:'600',color:'#FFF'},
  empty:{fontSize:18,color:'#66786D',textAlign:'center',lineHeight:30,marginTop:26},error:{fontSize:16,color:'#A32727',lineHeight:25},retry:{minHeight:48,alignItems:'center',justifyContent:'center'},
});
