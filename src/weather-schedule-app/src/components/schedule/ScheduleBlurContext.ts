import { createContext, type ComponentRef, type RefObject } from 'react';
import type { View } from 'react-native';

/** SDK 58 Android blur reads the schedule page, never the popup itself. */
export const ScheduleBlurContext = createContext<RefObject<ComponentRef<typeof View> | null> | undefined>(undefined);
