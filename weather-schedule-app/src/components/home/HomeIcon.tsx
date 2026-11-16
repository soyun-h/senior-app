import Svg, { Circle, Path, Rect } from 'react-native-svg';
export type IconName = 'home' | 'alarm' | 'calendar' | 'settings' | 'check' | 'clock';
export function HomeIcon({ name, color = '#4AAE78', size = 28 }: { name: IconName; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {name === 'home' && <Path d="M3 15 16 3l13 12v14H20V19h-8v10H3Z" />}
    {name === 'calendar' && <><Rect x={3} y={6} width={26} height={24} rx={4}/><Path d="M9 2v7m14-7v7M3 13h26"/><Circle cx={9} cy={20} r={1}/><Circle cx={16} cy={20} r={1}/><Circle cx={23} cy={20} r={1}/></>}
    {name === 'alarm' && <><Circle cx={16} cy={17} r={10}/><Path d="M16 11v7l4 3M4 7l4-3M24 4l4 3M7 26l-2 4m20-4 2 4"/></>}
    {name === 'settings' && <><Path d="m12 3-1 4-4 1-3 4 3 4-1 4 4 3 4-1 3 4 5-1 1-4 4-2v-5l-4-2-1-5-5-1-2-4Z"/><Circle cx={16} cy={15} r={5}/></>}
    {name === 'check' && <><Circle cx={16} cy={16} r={14} fill={color} stroke="none"/><Path d="m9 16 5 5 9-11" stroke="white" strokeWidth={3}/></>}
    {name === 'clock' && <><Circle cx={16} cy={16} r={14} fill={color} stroke="none"/><Path d="M16 7v10l-5 4" stroke="white"/></>}
  </Svg>;
}
