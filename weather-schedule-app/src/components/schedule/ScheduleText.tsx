import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { scheduleFace } from './scheduleTypography';

/** Explicitly scoped: no global Text defaults, CSS inheritance or navigation changes. */
export const ScheduleText = forwardRef<ComponentRef<typeof Text>, TextProps>(function ScheduleText(props, ref) {
  const style = StyleSheet.flatten(props.style);
  return <Text {...props} ref={ref} style={[props.style, {
    fontFamily: scheduleFace(style?.fontWeight),
    fontWeight: 'normal',
    includeFontPadding: false,
  }]}/>;
});
