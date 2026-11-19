import { useCallback, createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalScheduleRepository } from './repository';
import { dateKeyAt, type Schedule } from './model';
interface ScheduleContextValue { items: Schedule[]; loading: boolean; loadError?: string; reload: () => Promise<void>; repository: LocalScheduleRepository; accept: (items: Schedule[]) => void }
const Context = createContext<ScheduleContextValue | null>(null);
export function ScheduleProvider({ children }: { children: ReactNode }) {
  const repository = useRef(new LocalScheduleRepository(AsyncStorage)).current;
  const [items,setItems] = useState<Schedule[]>([]);
  const [loading,setLoading] = useState(true);
  const [loadError,setError] = useState<string>();
  const reload = useCallback(async () => {
    setLoading(true);
    try { setItems(await repository.list()); setError(undefined); }
    catch (e) { setError(e instanceof Error ? e.message : '일정을 불러오지 못했어요.'); }
    finally { setLoading(false); }
  }, [repository]);
  useEffect(() => { void reload(); }, [reload]);
  return <Context.Provider value={{items,loading,loadError,reload,repository,accept:setItems}}>{children}</Context.Provider>;
}
export function useSchedules() { const value=useContext(Context);if (!value) throw new Error('ScheduleProvider is required');return value; }
export function useToday() {
  const [today,setToday]=useState(dateKeyAt());
  useEffect(()=>{
    const update=()=>setToday(dateKeyAt());
    const timer=setInterval(update,15_000);
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')update();});
    return ()=>{clearInterval(timer);subscription.remove();};
  },[]);
  return today;
}
