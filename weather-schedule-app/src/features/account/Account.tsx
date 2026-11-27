import { useCallback, createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { android } from '../android/bridge';
import { clearPrimaryGuardian, loadRecords as readLegacyCare } from '../android/careStorage';
import type { CharacterId } from '../avatar/characterTypes';
import { authStorage, browserStore, cloudOrigin, cloudRequested, readableCloudError, releaseBuild, supabase } from './client';
import { cancelSocialLogin, finishSocialLogin, hasPendingSocialLogin, singleProvider, startSocialLogin } from './oauth';
import type { SocialProvider } from './oauthCallback';
import { CloudSchedules, loadLegacySchedules } from './cloudSchedules';
import { CloudCare } from './cloudCare';
import { Conversations } from './conversations';
import { hasLegacyData, legacyProofs, type LegacyData } from './legacyData';

type Profile = { displayName: string; preferredTitle: string; character: CharacterId; speak: boolean };
const initialProfile: Profile = { displayName: '', preferredTitle: '', character: 'char1', speak: true };
type Account = {
  id: string; profile: Profile; schedules: CloudSchedules; care: CloudCare; conversations: Conversations;
  pending: number; saveProfile(profile: Profile): Promise<void>; retry(): Promise<void>;
  scheduleRevision: number; hasLegacy: boolean; legacy(): Promise<string>; signOut(): Promise<void>; remove(): Promise<void>;
};
const AccountContext = createContext<Account | null>(null);
export const useAccount = () => useContext(AccountContext);
const externalDelete = typeof window !== 'undefined' && !!window.location?.pathname.endsWith('/delete-account.html');

export function AccountButton({ title, onPress, disabled = false }: { title: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={disabled}
    style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}

function SocialLoginButton({ provider, disabled, onPress }: { provider: SocialProvider; disabled: boolean; onPress(): void }) {
  const google = provider === 'google';
  const label = google ? 'Google로 계속하기' : '카카오 로그인';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.socialButton, google ? styles.googleButton : styles.kakaoButton,
      disabled ? styles.disabled : pressed && styles.socialPressed]}>
    {google ? <>
      <Image source={require('../../../assets/auth/google-g.png')} style={styles.googleIcon} resizeMode="contain" accessible={false}/>
      <Text style={styles.googleText}>{label}</Text>
    </> : <Image source={require('../../../assets/auth/kakao-login-ko.png')} style={styles.kakaoImage}
      resizeMode="contain" accessible={false}/>}
  </Pressable>;
}
function Frame({ children, title }: { children: ReactNode; title: string }) {
  return <View style={styles.frame}><View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>{children}
  </View></View>;
}
export function privacyLink() {
  if (typeof window !== 'undefined') window.location.assign(new URL('privacy.html', window.location.href).href);
}

export function AccountGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [scope, setScope] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleted, setDeleted] = useState(false);
  const [retryScope, setRetryScope] = useState(0);
  const [scopeFailed, setScopeFailed] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let mounted = true;
    const verify = async () => {
      const { data: { session: current } } = await client.auth.getSession();
      if (!current || !mounted) return;
      const result = await client.auth.getUser();
      if ([401, 403].includes(result.error?.status ?? 0) || result.error?.code === 'user_not_found') {
        const { data: { session: latest } } = await client.auth.getSession();
        if (latest && latest.user.id !== current.user.id) return;
        await authStorage.removeItem('allit-auth');
        await android?.accountScope({});
        if (result.error?.code === 'user_not_found') {
          const id = current.user.id;
          await Promise.allSettled([android?.purgeAccountFiles({ id }), clearPrimaryGuardian(id, cloudOrigin), ...['schedules', 'care', 'conversations', 'profile']
            .map(key => browserStore.removeItem(`${key}:${id}`))]);
        }
        if (mounted) setSession(null);
      }
    };
    const online = () => void verify().catch(() => {});
    const completeLogin = async () => {
      await finishSocialLogin();
      const pending = !!android && await hasPendingSocialLogin();
      if (mounted) setWaiting(pending);
    };
    const resume = () => void completeLogin().then(() => {
      online();
    }).catch(error => { if (mounted) { setWaiting(false); setNotice(error.message); } });
    const auth = client.auth.onAuthStateChange((_event, value) => { if (mounted) setSession(value); });
    const native = android?.addListener('changed', resume);
    void client.auth.getSession().then(async result => {
      if (!mounted) return;
      let current = result.data.session;
      if (!current && (isAuthRetryableFetchError(result.error) || navigator.onLine === false)) {
        const cached = await authStorage.getItem('allit-auth');
        if (cached) current = JSON.parse(cached) as Session;
      }
      if (!mounted) return;
      if (result.error && !current) setNotice('저장된 로그인을 확인하지 못했어요. 다시 로그인해 주세요.');
      setSession(current);
      try { await completeLogin(); } catch (error) { if (mounted) setNotice(error instanceof Error ? error.message : '로그인에 실패했어요.'); }
      online();
    }).catch(() => { if (mounted) setNotice('저장된 로그인 정보를 읽지 못했어요.'); })
      .finally(() => { if (mounted) setReady(true); });
    window.addEventListener('online', online);
    return () => { mounted = false; auth.data.subscription.unsubscribe(); window.removeEventListener('online', online); void native?.then(listener => listener.remove()); };
  }, []);

  const id = session && singleProvider(session) ? session.user.id : undefined;
  const scopeKey = id ?? 'signed-out';
  useEffect(() => {
    if (!supabase || !ready) return;
    let mounted = true;
    setScopeFailed(false);
    void Promise.resolve(android?.accountScope({ id })).then(() => {
      if (mounted) setScope(scopeKey);
    }).catch(() => { if (mounted) { setScopeFailed(true); setNotice('Android 계정 저장소를 열지 못했어요.'); } });
    return () => { mounted = false; };
  }, [id, ready, scopeKey, retryScope]);

  async function login(provider: SocialProvider) {
    setBusy(true); setNotice('');
    try { await startSocialLogin(provider); setWaiting(!!android); }
    catch (error) { setNotice(error instanceof Error ? error.message : '로그인을 시작하지 못했어요.'); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try { await cancelSocialLogin(); setWaiting(false); setNotice('로그인이 취소됐어요.'); }
    catch { setNotice('다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  const afterSignOut = useCallback((removed: boolean) => {
    setSession(null); setWaiting(false); setNotice('');
    if (removed) setDeleted(true);
  }, []);

  if (!cloudRequested && !externalDelete) return <>{children}</>;
  if (!supabase) return <Frame title={externalDelete ? '계정 및 데이터 삭제' : '올잇 로그인'}>
    <Text style={styles.text}>현재 빌드에 Supabase 공개 연결 정보가 설정되어 있지 않아요.</Text>
  </Frame>;
  if (deleted) return <Frame title="계정 삭제 완료"><Text style={styles.text}>계정과 서버에 저장한 데이터가 삭제됐어요.</Text></Frame>;
  if (!ready || scope !== scopeKey) return <Frame title="올잇">
    {scopeFailed ? <><Text accessibilityRole="alert" style={styles.text}>{notice}</Text>
      <AccountButton title="다시 시도" onPress={() => setRetryScope(value => value + 1)}/></> : <ActivityIndicator accessibilityLabel="로그인 상태 확인 중"/>}
  </Frame>;
  if (session && id) return <SignedIn key={id} session={session} onSignOut={afterSignOut}>{children}</SignedIn>;
  return <Frame title={externalDelete ? '계정 및 데이터 삭제' : '올잇 시작하기'}>
    {externalDelete && <Text style={styles.text}>가입할 때 사용한 계정으로 로그인하여 삭제를 신청하세요.</Text>}
    {session && !id ? <>
      <Text accessibilityRole="alert" style={styles.text}>가입에 사용한 제공업체를 확인해 주세요. Google과 카카오는 별개의 계정이에요.</Text>
      <AccountButton title="로그아웃" onPress={() => void supabase?.auth.signOut({ scope: 'local' })}/>
    </> : <>
      <SocialLoginButton provider="google" disabled={busy || waiting} onPress={() => void login('google')}/>
      <SocialLoginButton provider="kakao" disabled={busy || waiting} onPress={() => void login('kakao')}/>
    </>}
    {waiting && <><Text style={styles.text}>브라우저에서 인증을 마치면 앱으로 돌아와요.</Text>
      <AccountButton title="로그인 취소" disabled={busy} onPress={() => void cancel()}/></>}
    {!!notice && <Text accessibilityRole="alert" style={styles.text}>{notice}</Text>}
    <Pressable accessibilityRole="link" onPress={privacyLink}><Text style={styles.link}>개인정보 처리방침</Text></Pressable>
  </Frame>;
}

function SignedIn({ session, children, onSignOut }: { session: Session; children: ReactNode; onSignOut(removed: boolean): void }) {
  const client = supabase!;
  const id = session.user.id;
  const schedules = useMemo(() => new CloudSchedules(client, id), [client, id]);
  const care = useMemo(() => new CloudCare(client, id), [client, id]);
  const conversations = useMemo(() => new Conversations(client, id), [client, id]);
  const profileKey = `profile:${id}`;
  const [profile, setProfile] = useState(initialProfile);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [legacyData, setLegacyData] = useState<LegacyData>();
  const [showLegacy, setShowLegacy] = useState(false);
  const [showLegacyResult, setShowLegacyResult] = useState(false);
  const [legacyNotice, setLegacyNotice] = useState('');
  const [scheduleRevision, setScheduleRevision] = useState(0);
  const legacyPromptKey = `legacy-prompt:${id}`;
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const pendingCount = useCallback(async () => {
    const counts = await Promise.all([schedules.pendingCount(), care.pendingCount(), conversations.pendingCount()]);
    const count = counts.reduce((total, value) => total + value, 0);
    setPending(count);
    return count;
  }, [schedules, care, conversations]);
  const retry = useCallback(async () => {
    await pendingCount();
    await Promise.allSettled([schedules.flushCompletions().then(() => care.flush()), conversations.flush()]);
    await pendingCount();
  }, [care, conversations, pendingCount, schedules]);

  useEffect(() => {
    if (externalDelete) return;
    let live = true;
    const syncProfile = async () => {
      const cached = await browserStore.getItem(profileKey).catch(() => null);
      if (cached && live) setProfile(JSON.parse(cached));
      const seed = typeof session.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name
        : typeof session.user.user_metadata.name === 'string' ? session.user.user_metadata.name : '';
      await Promise.all([
        client.from('profiles').upsert({ user_id: id, display_name: seed.slice(0, 80) }, { onConflict: 'user_id', ignoreDuplicates: true }),
        client.from('user_settings').upsert({ user_id: id }, { onConflict: 'user_id', ignoreDuplicates: true }),
      ]);
      const [p, s] = await Promise.all([
        client.from('profiles').select('display_name,preferred_title,selected_character_id,onboarding_completed_at').eq('user_id', id).maybeSingle(),
        client.from('user_settings').select('speak_replies').eq('user_id', id).maybeSingle(),
      ]);
      if (p.data && live) {
        const value = { displayName: p.data.display_name, preferredTitle: p.data.preferred_title,
          character: p.data.selected_character_id as CharacterId, speak: s.data?.speak_replies ?? true };
        setProfile(value);
        setNeedsProfile(!p.data.onboarding_completed_at);
        await browserStore.setItem(profileKey, JSON.stringify(value));
      }
    };
    void syncProfile().catch(() => {});
    const resume = () => { void retry().catch(() => {}); };
    resume();
    window.addEventListener('online', resume);
    const native = android?.addListener('changed', resume);
    return () => { live = false; window.removeEventListener('online', resume); void native?.then(listener => listener.remove()); };
  }, [client, id, profileKey, retry]);

  useEffect(() => {
    if (externalDelete || releaseBuild) return;
    let live = true;
    void Promise.all([loadLegacySchedules(), readLegacyCare(), browserStore.getItem(legacyPromptKey)]).then(([schedules, care, answered]) => {
      const data = { schedules, guardians: care.guardians, proofs: legacyProofs(care.proofs, !!android) };
      if (!live || !hasLegacyData(data)) return;
      setLegacyData(data);
      setShowLegacy(!answered);
    }).catch(() => {});
    return () => { live = false; };
  }, [legacyPromptKey]);

  async function clearLocal() {
    await android?.accountScope({});
    await Promise.all([schedules.clear(), care.clear(), conversations.clear(), browserStore.removeItem(profileKey), android?.purgeAccountFiles({ id })]);
  }
  async function signOut() {
    await Promise.allSettled([schedules.list(), retry()]);
    if (await pendingCount()) throw new Error('아직 서버로 보내지 못한 기록이 있어요. 연결 후 동기화한 다음 로그아웃해 주세요.');
    const result = await client.auth.signOut({ scope: 'local' });
    if (result.error) throw new Error('로그아웃하지 못했어요. 연결을 확인해 주세요.');
    await clearLocal();
    onSignOut(false);
  }
  async function remove() {
    const result = await client.functions.invoke<{ deleted: boolean }>('delete-account', { body: {} });
    if (result.error || !result.data?.deleted) throw new Error('계정 삭제를 완료하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    await clearLocal();
    await clearPrimaryGuardian(id, cloudOrigin);
    await browserStore.removeItem(legacyPromptKey);
    await client.auth.signOut({ scope: 'local' }).catch(() => {});
    await authStorage.removeItem('allit-auth');
    await cancelSocialLogin();
    onSignOut(true);
  }
  async function saveProfile(value: Profile) {
    const result = await client.rpc('allit_save_profile', { name: value.displayName.trim(), title: value.preferredTitle.trim(),
      selected_character: value.character, speak: value.speak });
    if (result.error) throw new Error('설정을 저장하지 못했어요. 다시 저장해 주세요.');
    setProfile(value);
    setNeedsProfile(false);
    await browserStore.setItem(profileKey, JSON.stringify(value));
  }

  async function dismissLegacy() {
    await browserStore.setItem(legacyPromptKey, 'answered');
    setShowLegacy(false);
    setShowLegacyResult(false);
    setLegacyNotice('');
  }

  async function legacy() {
    if (!legacyData) return '가져올 기기 자료가 없어요.';
    const sources = new Set(legacyData.schedules.map(item => item.id));
    let missing: number;
    try {
      await schedules.importLegacy(legacyData.schedules, new Set(legacyData.proofs.map(proof => `${proof.scheduleId}:${proof.date}`)));
      await care.importLegacy(legacyData.guardians);
      missing = await care.importLegacyPhotos(legacyData.proofs, sources);
    } catch (error) {
      throw new Error(readableCloudError(error, '자료 복사를 완료하지 못했어요. 기기 원본을 보존했으니 다시 시도해 주세요.'));
    } finally {
      setScheduleRevision(value => value + 1);
    }
    await dismissLegacy();
    void retry().catch(() => {});
    if (missing) return `이 기기에서 사진 ${missing}장을 찾을 수 없어요. 복사된 사진은 사진 인증 기록에서 확인할 수 있어요.`;
    return legacyData.proofs.length ? '일정과 보호자는 서버에 저장했어요. 사진의 업로드 상태는 사진 인증 기록에서 확인할 수 있어요.'
      : '기존 일정을 포함한 기기 자료를 현재 계정으로 가져왔어요.';
  }

  if (externalDelete) return <Frame title="계정 및 데이터 삭제">
    <Text style={styles.text}>프로필, 설정, 보호자, 일정과 완료 기록, 대화, 올잇에 저장된 사진과 계정이 삭제됩니다. 삭제 후 복구할 수 없습니다. 이미 보낸 사진은 수신자의 메시지 앱에 남을 수 있습니다.</Text>
    {confirm ? <AccountButton title="계정과 데이터 최종 삭제" disabled={busy} onPress={() => {
      setBusy(true); setNotice('');
      void remove().catch(error => setNotice(error.message)).finally(() => setBusy(false));
    }}/> : <AccountButton title="계정 삭제 계속하기" onPress={() => setConfirm(true)}/>}
    <AccountButton title="로그아웃" disabled={busy} onPress={() => void signOut().catch(error => setNotice(error.message))}/>
    {!!notice && <Text accessibilityRole="alert" style={styles.text}>{notice}</Text>}
  </Frame>;
  return <AccountContext.Provider value={{ id, profile, schedules, care, conversations, pending, saveProfile, retry, scheduleRevision,
    hasLegacy: !!legacyData, legacy, signOut, remove }}>
    {children}
    {needsProfile && <ProfileSetup profile={profile} save={saveProfile} skip={() => {
      setNeedsProfile(false);
      void saveProfile(profile).catch(() => {});
    }}/>}
    {!needsProfile && (showLegacy || showLegacyResult) && <Modal animationType="fade" onRequestClose={() => { if (!busy) void dismissLegacy().catch(() => {}); }}>
      <Frame title="이 기기의 자료 복사">
        {showLegacy && <>
          <Text style={styles.text}>이 기기의 본인 일정 {legacyData?.schedules.length}건, 보호자 {legacyData?.guardians.length}명, 인증 사진 {legacyData?.proofs.length}장을 현재 계정으로 복사할까요? 기기 원본은 보존돼요.</Text>
          <AccountButton title={busy ? '복사 중…' : '현재 계정에 복사'} disabled={busy} onPress={() => {
            setBusy(true); setLegacyNotice('');
            void legacy().then(message => { setLegacyNotice(message); setShowLegacyResult(true); })
              .catch(error => setLegacyNotice(error.message)).finally(() => setBusy(false));
          }}/>
          <AccountButton title="나중에" disabled={busy} onPress={() => void dismissLegacy().catch(() => setShowLegacy(false))}/>
        </>}
        {!!legacyNotice && <Text accessibilityRole="alert" style={styles.text}>{legacyNotice}</Text>}
        {showLegacyResult && <AccountButton title="확인" onPress={() => { setShowLegacyResult(false); setLegacyNotice(''); }}/>}
      </Frame>
    </Modal>}
  </AccountContext.Provider>;
}

function ProfileSetup({ profile, save, skip }: { profile: Profile; save(value: Profile): Promise<void>; skip(): void }) {
  const [name, setName] = useState(profile.displayName);
  const [title, setTitle] = useState(profile.preferredTitle);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  function submit(value: Profile) {
    setBusy(true); setNotice('');
    void save(value).catch(() => setNotice('설정을 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')).finally(() => setBusy(false));
  }
  return <Modal animationType="fade" onRequestClose={() => { if (!busy) skip(); }}>
    <Frame title="회원 정보">
      <TextInput accessibilityLabel="이름" placeholder="성함을 입력하세요" style={styles.input}
        value={name} onChangeText={setName} maxLength={80}/>
      <TextInput accessibilityLabel="부를 이름" placeholder="편하게 불러 드릴 이름" style={styles.input}
        value={title} onChangeText={setTitle} maxLength={50}/>
      <AccountButton title="저장하고 시작하기" disabled={busy} onPress={() => submit({ ...profile, displayName: name, preferredTitle: title })}/>
      <AccountButton title="지금은 건너뛰기" disabled={busy} onPress={skip}/>
      {!!notice && <Text accessibilityRole="alert" style={styles.text}>{notice}</Text>}
    </Frame>
  </Modal>;
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F2F9F1' },
  card: { width: '100%', maxWidth: 460, padding: 22, gap: 16, backgroundColor: '#FFFFFF', borderRadius: 16 },
  title: { fontSize: 30, color: '#003C40', fontWeight: '700' }, text: { fontSize: 18, color: '#003C40', lineHeight: 28 },
  button: { backgroundColor: '#2D7951', borderRadius: 12, minHeight: 54, padding: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' }, disabled: { opacity: 0.55 },
  socialButton: { minHeight: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 10 },
  googleButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#747775' },
  googleIcon: { width: 20, height: 20 },
  googleText: { flexShrink: 1, color: '#1F1F1F', fontSize: 17, fontWeight: '500', textAlign: 'center' },
  kakaoButton: { backgroundColor: '#FEE500' },
  kakaoImage: { width: '100%', maxWidth: 268, height: 52 },
  socialPressed: { opacity: 0.82 },
  link: { fontSize: 16, color: '#006954', textDecorationLine: 'underline', paddingVertical: 10 },
  input: { borderWidth: 1, borderColor: '#A4C6B3', borderRadius: 10, minHeight: 49, fontSize: 17, padding: 12, color: '#003C40' },
});
