/** Stable route IDs are independent from user-facing Korean labels. */
export type BottomTabId = 'schedule' | 'home' | 'calendar';
export const bottomTabs = [
  { id: 'schedule', label: '일정', icon: 'alarm' },
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'calendar', label: '달력', icon: 'calendar' },
] as const satisfies readonly { id: BottomTabId; label: string; icon: 'alarm' | 'home' | 'calendar' }[];
export interface BottomNavigationProps {
  activeTab: BottomTabId;
  /** Supply the screen/router's navigation callback once those screens exist. */
  onNavigate?: (tab: BottomTabId) => void;
  /** Omit for fully implemented apps; unfinished destinations stay visibly disabled. */
  enabledTabs?: readonly BottomTabId[];
}
