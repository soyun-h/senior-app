import { Text, type TextProps } from 'react-native';
export function HomeText(props: TextProps) {
  return <Text {...props} style={[{ color: '#111', fontSize: 16 }, props.style]} />;
}
