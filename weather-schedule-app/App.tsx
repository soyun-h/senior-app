import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScheduleListScreen } from './src/screens/ScheduleListScreen';
import { ScheduleAddScreen } from './src/screens/ScheduleAddScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ScheduleProvider, useSchedules } from './src/features/schedules/ScheduleProvider';
import { AndroidCareScreen, type CarePage } from './src/screens/AndroidCareScreen';
import { android, type AlarmAction, type NativeStatus } from './src/features/android/bridge';
import { dateKeyAt, onDate, type Schedule } from './src/features/schedules/model';
import type { BottomTabId } from './src/navigation/bottomTabs';
import { AccountGate, useAccount } from './src/features/account/Account';
type Screen = BottomTabId | 'schedule-add' | CarePage;

function Allit() {
  const account = useAccount();
  const accountId = account?.id;
  const { items, loading, loadError, repository, accept } = useSchedules();
  const [registrationNotice,setRegistrationNotice]=useState(false);
  const [saving,setSaving]=useState(false);
  const [screen,setScreen]=useState<Screen>('home');
  const [existing, setExisting] = useState<Schedule>();
  const [calendarDate, setCalendarDate] = useState(dateKeyAt);
  const [editReturn, setEditReturn] = useState<'schedule' | 'calendar'>('schedule');
  const [voiceReturn, setVoiceReturn] = useState<'home' | 'settings'>('settings');
  const [target, setTarget] = useState<{ schedule?: Schedule; date: string; action?: AlarmAction }>();
  const [status, setStatus] = useState<NativeStatus>();
  const [alarmError, setAlarmError] = useState('');
  const pending = useRef<Promise<void>>(Promise.resolve());
  const actionRun = useRef<Promise<void>>(Promise.resolve());
  const activePhoto = useRef<string | undefined>(undefined);

  const sync = useCallback((schedules: Schedule[]) => {
    if (!android) return Promise.resolve();
    const bridge = android;
    const run = pending.current.then(async () => {
      try { setStatus(await bridge.sync({ accountId, schedules })); setAlarmError(''); }
      catch { setAlarmError('안드로이드에 알람을 예약하지 못했어요. 다시 열면 예약을 다시 확인해요.'); }
    });
    pending.current = run;
    return run;
  }, [accountId]);

  useEffect(() => {
    if (loading || loadError || !android) return;
    void sync(items);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void sync(items); });
    const listening = android.addListener('changed', () => void sync(items));
    return () => { foreground.remove(); void listening.then(subscription => subscription.remove()).catch(() => {}); };
  }, [items, loading, loadError, sync]);

  const consume = useCallback(() => {
    const bridge = android;
    if (!bridge) return;
    actionRun.current = actionRun.current.then(async () => {
      if (activePhoto.current) return;
      const { items: actions } = await bridge.actions({ accountId });
      if (!actions.length) return;
      const schedules = account ? await account.schedules.cached() ?? await repository.list() : await repository.list();
      for (const action of actions) {
        const schedule = schedules.find(item => item.id === action.id && onDate(item, action.date));
        if (action.action === 'photo' && schedule) {
          activePhoto.current = action.key;
          setTarget({ schedule, date: action.date, action });
          setScreen('proof');
          return;
        }
        if (action.action === 'confirm' && schedule) {
          accept(await repository.complete(schedule.id, action.date));
          setScreen('schedule');
        } else if (action.action === 'before') {
          setTarget({ schedule, date: action.date });
          setScreen('upcoming');
        } else if (action.action === 'photo' && action.id === 'native-alarm-diagnostic') {
          activePhoto.current = action.key;
          setTarget({ date: action.date, action });
          setScreen('proof');
          return;
        }
        await bridge.acknowledge({ accountId, key: action.key });
      }
    }).catch(() => setAlarmError('알람 확인 기록을 불러오지 못했어요. 다시 열면 처리 내용을 확인해요.'));
  }, [accept, account?.schedules, accountId, repository]);

  useEffect(() => {
    if (!android || loading || loadError) return;
    consume();
    const subscription = android.addListener('changed', consume);
    return () => { void subscription.then(listener => listener.remove()).catch(() => {}); };
  }, [consume, loading, loadError]);

  const back = useCallback(() => {
    if (saving || screen === 'proof' && activePhoto.current) return;
    setScreen(screen === 'schedule-add' ? editReturn : screen === 'upcoming' ? 'schedule' : screen === 'voice' ? voiceReturn
      : screen === 'guardians' || screen === 'records' || screen === 'account' ? 'settings' : 'home');
  }, [editReturn, saving, screen, voiceReturn]);
  function navigate(tab: BottomTabId) { if (!saving) setScreen(tab); }
  useEffect(()=>{
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(screen==='home')return false;
      back(); return true;
    });return ()=>subscription.remove();
  },[screen,back]);

  function edit(schedule?: Schedule) {
    setExisting(schedule);
    setEditReturn(screen === 'calendar' ? 'calendar' : 'schedule');
    setScreen('schedule-add');
  }
  function open(page: CarePage) {
    if (page === 'voice') setVoiceReturn(screen === 'home' ? 'home' : 'settings');
    setTarget(undefined);
    setScreen(page);
  }
  const upcoming = items.some(item => item.notificationsEnabled && (item.recurrence.mode !== 'once' || item.recurrence.date >= dateKeyAt()));
  const nativeNotice = alarmError || (upcoming && android && status && (!status.notifications || !status.exact)
    ? '휴대전화 알림과 정확한 알람을 허용하면 예약할 수 있어요.' : upcoming && !android ? '정각 알람은 설치형 안드로이드 앱에서 울려요.' : undefined);

  switch (screen) {
    case 'home': return <HomeScreen characterId={account?.profile.character} onNavigate={navigate}
      onSettings={() => open('settings')} onVoice={() => open('voice')}/>;
    case 'schedule': return <ScheduleListScreen registrationNotice={registrationNotice} onRegistrationNoticeConsumed={() => setRegistrationNotice(false)}
      onAdd={() => edit()} onEdit={edit} onNavigate={navigate} nativeNotice={nativeNotice} onNativeSettings={android ? () => open('settings') : undefined}/>;
    case 'calendar': return <CalendarScreen date={calendarDate} onSelect={setCalendarDate} onAdd={() => edit()} onEdit={edit} onNavigate={navigate}/>;
    case 'schedule-add': return <ScheduleAddScreen key={existing?.id ?? 'new'} existing={existing} onSavingChange={setSaving} onBack={back}
      activeTab={editReturn} initialDate={editReturn === 'calendar' ? calendarDate : undefined}
      onSaved={async saved => { await sync(saved); setRegistrationNotice(!existing && editReturn === 'schedule'); setScreen(editReturn); }} onNavigate={navigate}/>;
    default: return <AndroidCareScreen key={screen + (target?.action?.key ?? '')} page={screen} status={status}
      onStatus={setStatus} navigate={navigate} open={open} back={back} onEdit={edit} schedule={target?.schedule} date={target?.date}
      fromAlarm={target?.action?.action === 'photo'} onComplete={async () => {
        if (target?.schedule && target.date) accept(await repository.complete(target.schedule.id, target.date, Date.now(), 'photo'));
      }} onDone={async () => {
        if (!target?.action) return;
        await android?.acknowledge({ accountId, key: target.action.key });
        activePhoto.current = undefined;
      }}/>;
  }
}

export default function App() {
  return <SafeAreaProvider><StatusBar hidden/><AccountGate><AccountApp/></AccountGate></SafeAreaProvider>;
}

function AccountApp() {
  const account = useAccount();
  return <ScheduleProvider key={account?.id ?? 'demo'} remote={account?.schedules} revision={account?.scheduleRevision}><Allit/></ScheduleProvider>;
}
