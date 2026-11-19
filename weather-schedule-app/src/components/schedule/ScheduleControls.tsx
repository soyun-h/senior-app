import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScheduleAsset } from './ScheduleAsset';
import type { ReactNode } from 'react';
export const scheduleColors = { green:'#4EA674', dark:'#003C40', selected:'#C1E5BB', muted:'#858585' };
export function SectionTitle({ children }: { children: ReactNode }) {
  return <View style={styles.heading}><ScheduleAsset name="check"/><Text style={styles.headingText}>{children}</Text></View>;
}
export function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress:()=>void; disabled?:boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected,disabled}} aria-checked={selected} disabled={disabled} onPress={onPress} style={[styles.choice,selected&&styles.chosen]}><Text style={[styles.choiceText,selected&&styles.chosenText]}>{label}</Text></Pressable>;
}
export function RegisterButton({ label='할 일 추가하기', onPress, disabled=false }: { label?: string; onPress:()=>void; disabled?:boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[styles.register,disabled&&{opacity:0.55}]}>
    <View pointerEvents="none" style={styles.registerArt}><ScheduleAsset name="register-button" width="100%" height="100%"/></View>
    <Text style={styles.registerText}>{label}</Text>
  </Pressable>;
}
const styles=StyleSheet.create({
  heading:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:14},
  headingText:{fontSize:19,fontWeight:'700',color:'#111',lineHeight:28},
  choice:{minHeight:44,paddingHorizontal:10,paddingVertical:8,borderRadius:11,alignItems:'center',justifyContent:'center'},
  chosen:{backgroundColor:'#C1E5BB'},
  choiceText:{fontSize:16,color:'#858585'},chosenText:{color:'#006954',fontWeight:'600'},
  register:{height:72,justifyContent:'center',alignItems:'center',marginHorizontal:-10},
  registerArt:{position:'absolute',top:0,left:0,right:0,bottom:0},
  registerText:{fontSize:19,fontWeight:'700',color:'white',marginBottom:7},
});
