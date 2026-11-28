import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScheduleListScreen } from './src/screens/ScheduleListScreen';
import { ScheduleAddScreen } from './src/screens/ScheduleAddScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ScheduleProvider, useSchedules } from './src/features/schedules/ScheduleProvider';
import { AndroidCareScreen, type CarePage } from './src/screens/AndroidCareScreen';
import { createAlarmSync, reservationOutcome } from './src/features/android/alarmSync';
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
  const [nativeError, setNativeError] = useState('');
  const askedForPermissions = useRef(false);
  const [alarmError, setAlarmError] = useState('');
  const alarmSync = useRef<ReturnType<typeof createAlarmSync> | null>(null);
  const statusRevision = useRef(0);
  const alarmPermission = useRef<boolean | undefined>(undefined);
  const actionRun = useRef<Promise<void>>(Promise.resolve());
  const activePhoto = useRef<string | undefined>(undefined);

  const applyNativeStatus = useCallback((next: NativeStatus) => {
    const allowed = next.notifications && next.exact;
    const restore = allowed && alarmPermission.current === false;
    alarmPermission.current = allowed;
    setStatus(next);
    if (restore) void alarmSync.current?.request(true);
  }, []);

  const cloudSchedules = account?.schedules;
  useLayoutEffect(() => {
    const bridge = android;
    if (!bridge) return;
    const controller = createAlarmSync(async () => {
      if (!cloudSchedules) return repository.list();
      const cached = await cloudSchedules.cached();
      if (cached === null) throw new Error('No current schedule snapshot');
      return cached;
    }, (schedules, force) => bridge.sync({ accountId, schedules, force }), result => {
      statusRevision.current++;
      if (result) applyNativeStatus(result);
      setAlarmError(result ? '' : 'Android 알람 예약 상태를 확인하지 못했어요.');
    });
    alarmSync.current = controller;
    return () => { controller.dispose(); alarmSync.current = null; };
  }, [accountId, applyNativeStatus, cloudSchedules, repository]);

  const sync = useCallback((force = false) => alarmSync.current?.request(force) ?? Promise.resolve(undefined), []);

  useLayoutEffect(() => {
    if (!loading && !loadError) void sync();
  }, [items, loading, loadError, sync]);

  useEffect(() => {
    if (loading || loadError || !android) return;
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void sync(); });
    const listening = android.addListener('changed', () => void sync());
    return () => { foreground.remove(); void listening.then(subscription => subscription.remove()).catch(() => {}); };
  }, [loading, loadError, sync]);

  useEffect(() => {
    if (!android) return;
    const bridge = android;
    let active = true;
    const refresh = async () => {
      const revision = ++statusRevision.current;
      try {
        const result = await bridge.status();
        if (active && revision === statusRevision.current) {
          applyNativeStatus(result);
          setNativeError('');
        }
      } catch (error) {
        if (active && revision === statusRevision.current) setNativeError(error instanceof Error ? error.message : 'Android 상태를 확인하지 못했어요.');
      }
    };
    void refresh();
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const nativeResume = bridge.addListener('changed', refresh);
    void nativeResume.catch(() => {});
    return () => {
      active = false;
      foreground.remove();
      void nativeResume.then(listener => listener.remove()).catch(() => {});
    };
  }, [applyNativeStatus]);

  useEffect(() => {
    const bridge = android;
    if (!bridge || !status || (status.notifications && status.exact) || askedForPermissions.current) return;
    askedForPermissions.current = true;
    Alert.alert('Android 알람 설정', '설정한 시각에 알람을 받으려면 알림 및 정확한 알람 권한이 필요해요.', [
      { text: '나중에', style: 'cancel' },
      { text: '권한 확인', onPress: () => {
        setScreen('settings');
        if (!status.notifications) void bridge.requestNotifications().then(next => {
          statusRevision.current++;
          applyNativeStatus(next);
        }).catch(error => {
          setNativeError(error instanceof Error ? error.message : '알림 권한을 요청하지 못했어요.');
        });
      } },
    ]);
  }, [applyNativeStatus, status]);

  const consume = useCallback(() => {
    const bridge = android;
    if (!bridge) return;
    actionRun.current = actionRun.current.then(async () => {
      if (activePhoto.current) return;
      const { items: actions } = await bridge.actions({ accountId });
      if (!actions.length) return;
      const schedules = account ? await account.schedules.cached() ?? await repository.list() : await repository.list();
      for (const action of actions) {
        // Older installations can still have a queued pre-alert tap.
        if (action.action === 'before') {
          await bridge.acknowledge({ accountId, key: action.key });
          continue;
        }
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
    setScreen(screen === 'schedule-add' ? editReturn : screen === 'voice' ? voiceReturn
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
  const nativeNotice = nativeError || alarmError || (upcoming && android && status && (!status.notifications || !status.exact)
    ? '휴대전화 알림과 정확한 알람을 허용하면 예약할 수 있어요.' : upcoming && !android ? '정각 알람은 설치형 안드로이드 앱에서 울려요.' : undefined);

  switch (screen) {
    case 'home': return <HomeScreen characterId={account?.profile.character} onNavigate={navigate}
      onSettings={() => open('settings')} onVoice={() => open('voice')}/>;
    case 'schedule': return <ScheduleListScreen registrationNotice={registrationNotice} onRegistrationNoticeConsumed={() => setRegistrationNotice(false)}
      onAdd={() => edit()} onEdit={edit} onNavigate={navigate} nativeNotice={nativeNotice} onNativeSettings={android ? () => open('settings') : undefined}/>;
    case 'calendar': return <CalendarScreen date={calendarDate} onSelect={setCalendarDate} onAdd={() => edit()} onEdit={edit} onNavigate={navigate}/>;
    case 'schedule-add': return <ScheduleAddScreen key={existing?.id ?? 'new'} existing={existing} onSavingChange={setSaving} onBack={back}
      activeTab={editReturn} initialDate={editReturn === 'calendar' ? calendarDate : undefined}
      onSaved={async saved => {
        if (android) {
          const outcome = reservationOutcome(saved, await sync());
          if (outcome === 'blocked' || outcome === 'failed' || outcome === 'unconfirmed') {
            Alert.alert('일정을 저장했어요', outcome === 'blocked'
              ? '권한이 부족해 Android 알람은 예약되지 않았어요. 설정에서 권한을 확인해 주세요.'
              : outcome === 'failed' ? '이 일정의 Android 알람을 예약하지 못했어요.'
                : '이 일정의 Android 알람은 예약 확인이 필요해요.');
          }
        }
        setRegistrationNotice(!existing && editReturn === 'schedule');
        setScreen(editReturn);
      }} onNavigate={navigate}/>;
    default: return <AndroidCareScreen key={screen + (target?.action?.key ?? '')} page={screen} status={status}
      onStatus={next => { statusRevision.current++; applyNativeStatus(next); }} nativeError={nativeError} navigate={navigate} open={open} back={back} schedule={target?.schedule} date={target?.date}
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
