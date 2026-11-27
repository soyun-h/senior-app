import { useCallback, createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalScheduleRepository } from './repository';
import { dateKeyAt, type Schedule, type ScheduleRepository } from './model';
interface ScheduleContextValue { items: Schedule[]; loading: boolean; loadError?: string; reload: () => Promise<void>; repository: ScheduleRepository; accept: (items: Schedule[]) => void }
const Context = createContext<ScheduleContextValue | null>(null);
type RemoteRepository = ScheduleRepository & { cached(): Promise<Schedule[] | null> };
export function ScheduleProvider({ children, remote, revision }: { children: ReactNode; remote?: RemoteRepository; revision?: number }) {
  const local = useRef(new LocalScheduleRepository(AsyncStorage)).current;
  const repository = remote ?? local;
  const [items,setItems] = useState<Schedule[]>([]);
  const [loading,setLoading] = useState(true);
  const [loadError,setError] = useState<string>();
  const ready = useRef(false);
  const pending = useRef<Promise<void> | null>(null);
  const accept = useCallback((items: Schedule[]) => { ready.current = true; setItems(items); setLoading(false); setError(undefined); }, []);
  const reload = useCallback(() => {
    if (pending.current) return pending.current;
    // Cached empty lists are ready too. Background reads never hide ready content.
    if (!ready.current) setLoading(true);
    const request = (async () => {
      try { accept(await repository.list()); }
      catch (e) { setError(e instanceof Error ? e.message : '일정을 불러오지 못했어요.'); }
      finally { setLoading(false); pending.current = null; }
    })();
    pending.current = request;
    return request;
  }, [repository, accept]);
  useEffect(() => {
    if (!remote) { void reload(); return; }
    let active = true;
    void remote.cached().then(cached => { if (active && cached && !ready.current) accept(cached); })
      .catch(() => {}).finally(() => { if (active) void reload(); });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void reload(); });
    const online = () => void reload();
    window.addEventListener('online', online);
    return () => { active = false; foreground.remove(); window.removeEventListener('online', online); };
  }, [accept, reload, remote, revision]);
  return <Context.Provider value={{items,loading,loadError,reload,repository,accept}}>{children}</Context.Provider>;
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
