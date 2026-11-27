import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { dateKeyAt } from '../../features/schedules/model';
const weekdays=['월','화','수','목','금','토','일'];
export function DatePicker({ visible, value, onChange, onClose }: { visible:boolean; value:string; onChange:(date:string)=>void; onClose:()=>void }) {
  const [month,setMonth]=useState(value.slice(0,7));
  useEffect(()=>{if(visible)setMonth(value.slice(0,7));},[visible,value]);
  const [year,number]=month.split('-').map(Number);
  const offset=(new Date(Date.UTC(year,number-1,1)).getUTCDay()+6)%7;
  const days=new Date(Date.UTC(year,number,0)).getUTCDate();
  function shift(delta:number) { const d=new Date(Date.UTC(year,number-1+delta,1));setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`); }
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.panel}>
      <View style={styles.month}><Pressable accessibilityRole="button" onPress={()=>shift(-1)} style={styles.move}><Text>이전 달</Text></Pressable><Text accessibilityRole="header" style={styles.title}>{year}년 {number}월</Text><Pressable accessibilityRole="button" onPress={()=>shift(1)} style={styles.move}><Text>다음 달</Text></Pressable></View>
      <View style={styles.grid}>{weekdays.map(d=><View key={d} style={styles.cell}><Text style={styles.weekday}>{d}</Text></View>)}</View>
      <View style={styles.grid}>
        {Array.from({length:offset},(_,i)=><View key={'empty'+i} style={styles.cell}/>)}
        {Array.from({length:days},(_,i)=>{
          const date=`${month}-${String(i+1).padStart(2,'0')}`;const disabled=date<dateKeyAt();
          return <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${year}년 ${number}월 ${i+1}일`} accessibilityState={{selected:date===value,disabled}} aria-selected={date===value} disabled={disabled} onPress={()=>{onChange(date);onClose();}} style={[styles.cell,date===value&&styles.selected]}><Text style={{color:disabled?'#CCC':date===value?'#006954':'#444',fontSize:17}}>{i+1}</Text></Pressable>;
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}><Text style={{fontSize:17,color:'#006954'}}>닫기</Text></Pressable>
    </View></View>
  </Modal>;
}
const styles=StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'#00000055',alignItems:'center',justifyContent:'center',padding:20},
  panel:{width:'100%',maxWidth:360,backgroundColor:'white',borderRadius:20,padding:16},
  month:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},move:{minHeight:44,justifyContent:'center',padding:6},title:{fontSize:19,fontWeight:'700'},
  close:{minHeight:44,alignItems:'center',justifyContent:'center',marginTop:8},
  grid:{flexDirection:'row',flexWrap:'wrap'},cell:{width:'14.285714%',height:44,alignItems:'center',justifyContent:'center'},weekday:{fontSize:16,color:'#666'},selected:{backgroundColor:'#C1E5BB',borderRadius:10},
});
