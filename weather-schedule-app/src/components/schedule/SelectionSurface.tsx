import { useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Uses selection.svg / date-selection.svg stops and normalized gradient coordinates. */
export function SelectionSurface({ radius = 10, variant = 'pill' }: { radius?: number; variant?: 'pill' | 'date' }) {
  const id = useId().replaceAll(':', '');
  const color = variant === 'date' ? '#C1E5BB' : '#C1E6BA';
  return <Svg pointerEvents="none" width="100%" height="100%" style={{ position: 'absolute' }}>
    <Defs><LinearGradient id={id} x1={variant === 'date' ? '50%' : '9.8684%'} y1="0%" x2={variant === 'date' ? '50%' : '101.6977%'} y2={variant === 'date' ? '100%' : '86.9263%'}><Stop offset="0" stopColor={color} stopOpacity={0.5}/><Stop offset="1" stopColor={color}/></LinearGradient></Defs>
    <Rect width="100%" height="100%" rx={radius} fill={`url(#${id})`}/>
  </Svg>;
}
