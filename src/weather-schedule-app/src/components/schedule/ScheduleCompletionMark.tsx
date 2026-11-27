import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** 34px original geometry. Stops/direction estimated from the supplied PNG, not Figma tokens. */
export function ScheduleCompletionMark() {
  const id = useId().replaceAll(':', '');
  return <Svg width={34} height={34} viewBox="0 0 34 34" accessible={false}>
    <Defs><LinearGradient id={id} x1="0%" y1="64%" x2="100%" y2="36%">
      <Stop offset="0" stopColor="#3DA369"/><Stop offset="1" stopColor="#1BC464"/>
    </LinearGradient></Defs>
    <Circle cx={17} cy={17} r={17} fill={`url(#${id})`}/>
    <Path transform="translate(1.5 1.5)" d="M8 16L13 21L23 10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>;
}
