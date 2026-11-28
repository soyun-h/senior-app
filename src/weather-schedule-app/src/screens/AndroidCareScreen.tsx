import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ScheduleShell } from '../components/schedule/ScheduleShell';
import { ScheduleText as Text } from '../components/schedule/ScheduleText';
import { ScheduleAsset } from '../components/schedule/ScheduleAsset';
import { android, photoSource, type NativeStatus, type ProofPhoto } from '../features/android/bridge';
import { emptyRecords, loadPrimaryGuardian, loadRecords, savePrimaryGuardian, updateRecords, type Guardian, type Proof } from '../features/android/careStorage';
import { demoReply } from '../features/avatar/characterBrain';
import { getCharacter } from '../features/avatar/characterConfig';
import { recognizeKorean, speakKorean } from '../features/avatar/voiceIO';
import { dateKeyAt, formatDate, formatTime, type Schedule } from '../features/schedules/model';
import type { BottomTabId } from '../navigation/bottomTabs';
import { privacyLink, useAccount } from '../features/account/Account';
import { cloudOrigin, newId } from '../features/account/client';
import type { Conversations } from '../features/account/conversations';
import type { CharacterId } from '../features/avatar/characterTypes';
import { testScheduleId } from '../features/account/legacyData';

export type CarePage = 'settings' | 'guardians' | 'proof' | 'records' | 'voice' | 'account';
const titles: Record<CarePage, string> = {
  settings: '설정', guardians: '주요 연락처', proof: '인증하기', records: '사진 인증 기록', voice: '말벗', account: '계정 및 개인정보',
};
const alarmTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
});
const testTitle = '시험 사진 인증';

function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={disabled}
    style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}
function Field({ title, value, onChange, phone = false, maxLength }: { title: string; value: string; onChange: (value: string) => void; phone?: boolean; maxLength?: number }) {
  return <TextInput accessibilityLabel={title} placeholder={title} placeholderTextColor="#687A73" style={styles.input}
    value={value} onChangeText={onChange} keyboardType={phone ? 'phone-pad' : 'default'} maxLength={maxLength}/>;
}
function Panel({ children }: { children: ReactNode }) { return <View style={styles.panel}>{children}</View>; }

export function AndroidCareScreen({ page, status, onStatus, navigate, back, open, schedule, date, onComplete, onDone, fromAlarm }: {
  page: CarePage; status?: NativeStatus; onStatus: (status: NativeStatus) => void;
  navigate: (tab: BottomTabId) => void; back: () => void; open: (screen: CarePage) => void;
  schedule?: Schedule; date?: string; onComplete: () => Promise<void>;
  onDone: () => Promise<void>; fromAlarm: boolean;
}) {
  const bridge = android;
  const account = useAccount();
  const accountId = account?.id;
  const accountCare = account?.care;
  const conversations = account?.conversations;
  const character = account?.profile.character ?? 'char1';
  const [records, setRecords] = useState(emptyRecords);
  const [guardiansKnown, setGuardiansKnown] = useState(false);
  const [primary, setPrimary] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState<Guardian>();
  const [photo, setPhoto] = useState<ProofPhoto>();
  const [proof, setProof] = useState<Proof>();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<string>();
  const [transcript, setTranscript] = useState('');
  const [lastUtterance, setLastUtterance] = useState('');
  const [response, setResponse] = useState('');
  const [voicePhase, setVoicePhase] = useState<'listening' | 'speaking'>();
  const voiceJob = useRef<AbortController | undefined>(undefined);
  const cameraOpened = useRef(false);
  const retainedPhoto = useRef<string | undefined>(undefined);
  const proofCompletion = useRef<Promise<void> | undefined>(undefined);
  const [completionFailed, setCompletionFailed] = useState(false);
  const conversation = useRef<{ session: ReturnType<Conversations['open']>; started: boolean } | undefined>(undefined);
  const testPhoto = page === 'proof' && !schedule && status?.debug === true;
  const recipient = records.guardians.find(target => target.id === primary) ??
    (records.guardians.length === 1 ? records.guardians[0] : undefined);
  const body = message ?? (proof?.scheduleId === testScheduleId ? '올잇 사진 인증 테스트입니다.'
    : proof ? `${formatDate(proof.date)}${schedule ? ` ${formatTime(schedule.hour, schedule.minute)}` : ''} ${proof.title} 일정의 사진이에요.` : '');

  async function run(task: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setNotice('');
    try { await task(); }
    catch (error) { setNotice(error instanceof Error ? error.message : '휴대전화 기능을 실행하지 못했어요.'); }
    finally { working.current = false; setBusy(false); }
  }

  async function capture(selected: 'front' | 'back' = facing) {
    if (!bridge) return;
    const image = await bridge.takePhoto({ accountId, facing: selected });
    if (!image.id || !image.uri) return;
    const previous = photo;
    setPhoto({ id: image.id, uri: image.uri, capturedAt: image.capturedAt });
    if (previous && !proof && retainedPhoto.current !== previous.id) await bridge.removePhoto({ accountId, id: previous.id });
  }

  useEffect(() => {
    if (!['guardians', 'proof', 'records'].includes(page)) return;
    let live = true;
    if (accountCare) void accountCare.cachedRecords().then(value => { if (live) setRecords(value); }).catch(() => {});
    void loadPrimaryGuardian(accountId, cloudOrigin).then(value => { if (live) setPrimary(value); }).catch(() => {});
    void (accountCare ? accountCare.records() : loadRecords()).then(value => {
      if (live) { setRecords(value); setGuardiansKnown(true); }
    })
      .catch(error => { if (live) setNotice(error.message); });
    return () => { live = false; };
  }, [accountCare, accountId, page]);
  useEffect(() => {
    if (page !== 'voice') return;
    const current = conversations && { session: conversations.open(character), started: false };
    conversation.current = current;
    return () => {
      voiceJob.current?.abort();
      conversation.current = undefined;
      if (current?.started) void conversations?.close(current.session).then(() => conversations.flush()).catch(() => {});
    };
  }, [character, conversations, page]);
  useEffect(() => {
    const uri = photo?.uri;
    return () => { if (uri?.startsWith('blob:')) URL.revokeObjectURL(uri); };
  }, [photo?.uri]);
  useEffect(() => {
    if (page === 'proof' && (fromAlarm || testPhoto) && bridge && !cameraOpened.current) {
      cameraOpened.current = true;
      void run(() => capture());
    }
    // Auto-open once per proof screen and leave the shutter available for retry.
  }, [page, fromAlarm, testPhoto]);

  async function saveGuardian() {
    const digits = phone.replace(/[^\d+]/gu, '');
    if (!name.trim() || !/^\+?\d{8,15}$/.test(digits)) throw new Error('이름과 전화번호를 확인해 주세요.');
    if (name.trim().length > 80) throw new Error('보호자 이름을 80자까지 입력해 주세요.');
    const contact = { id: editing?.id ?? (accountCare ? newId() : `${Date.now()}-${Math.random()}`), name: name.trim(), phone: digits };
    const saved = accountCare ? await accountCare.saveGuardian(contact, !!editing) : await updateRecords(current => {
      if (current.guardians.some(item => item.id !== contact.id && item.phone === digits)) throw new Error('이미 등록된 전화번호예요.');
      const guardians = editing ? current.guardians.map(item => item.id === contact.id ? contact : item) : [...current.guardians, contact];
      return { ...current, guardians };
    });
    setRecords(saved);
    setGuardiansKnown(true);
    const first = saved.guardians.length === 1 ? saved.guardians[0] : records.guardians.length === 1 ? records.guardians[0] : undefined;
    if (first && !primary) await setPrimaryGuardian(first.id).catch(() => {});
    setEditing(undefined); setName(''); setPhone('');
    setNotice('보호자를 저장했어요.');
  }

  async function selectPhoneContact() {
    const picked = await bridge?.pickContact({ accountId });
    if (picked?.name !== undefined) setName(picked.name);
    if (picked?.phone !== undefined) setPhone(picked.phone);
  }

  async function setPrimaryGuardian(id: string) {
    await savePrimaryGuardian(id, accountId, cloudOrigin);
    setPrimary(id);
  }

  function guardianFields() {
    return <>
      {bridge && <Button title="휴대전화 연락처에서 선택" disabled={busy} onPress={() => void run(selectPhoneContact)}/>}
      <Field title="이름" value={name} onChange={setName} maxLength={80}/>
      <Field title="전화번호" value={phone} onChange={setPhone} phone/>
      <Button title={editing ? '보호자 수정 저장' : '보호자 등록'} disabled={busy} onPress={() => void run(saveGuardian)}/>
    </>;
  }

  async function registerProof() {
    if (!photo || (!schedule && !testPhoto)) return;
    const now = Date.now();
    const day = date ?? dateKeyAt(now);
    const scheduledAt = schedule ? new Date(`${day}T${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}:00+09:00`).toISOString() : undefined;
    const record: Proof = { id: photo.id, scheduleId: schedule?.id ?? testScheduleId,
      date: day, title: schedule?.title ?? testTitle, savedAt: photo.capturedAt ?? now, confirmedAt: now, scheduledAt };
    if (accountCare) setRecords(await accountCare.saveProof(record));
    else setRecords(await updateRecords(current => current.proofs.some(item => item.id === record.id)
      ? current : { ...current, proofs: [...current.proofs, record] }));
    if (!accountCare) setGuardiansKnown(true);
    retainedPhoto.current = photo.id;
    if (accountCare) completeProof();
    else { await onComplete(); await onDone(); }
    setProof(record);
    setNotice(accountCare && schedule ? '사진을 기기에 저장했어요. 연결되면 서버에도 저장돼요.' : '사진을 이 기기에 저장했어요.');
  }

  function completeProof() {
    setCompletionFailed(false);
    const complete = async () => {
      await onComplete();
      await onDone();
      void account?.retry().catch(() => {});
    };
    proofCompletion.current = complete();
    void proofCompletion.current.catch(() => {
      proofCompletion.current = undefined;
      setCompletionFailed(true);
      setNotice('사진은 기기에 보관했어요. 일정 완료는 다시 시도해 주세요.');
    });
  }

  function finishPage() {
    void run(async () => {
      if (page === 'proof' && photo && !proof && retainedPhoto.current !== photo.id) await bridge?.removePhoto({ accountId, id: photo.id });
      if (page === 'voice') await bridge?.stopVoice();
      if (page === 'proof') {
        if (completionFailed) { completeProof(); return; }
        if (proofCompletion.current) await proofCompletion.current;
        else await onDone();
      }
      back();
    });
  }

  function runVoice(task: (signal: AbortSignal) => Promise<void>) {
    void run(async () => {
      const job = new AbortController();
      voiceJob.current = job;
      try { await task(job.signal); }
      finally { voiceJob.current = undefined; setVoicePhase(undefined); }
    });
  }

  async function answer(text: string, signal: AbortSignal) {
    if (signal.aborted) return;
    const reply = demoReply(getCharacter(character), text).text;
    setLastUtterance(text);
    setResponse(reply);
    const current = conversation.current;
    if (conversations && current) {
      current.started = true;
      void conversations.record(current.session, newId(), text, reply).then(() => account?.retry())
        .catch(() => { if (!signal.aborted) setNotice('이 대화를 기기에 기록하지 못했어요.'); });
    }
    if (reply && account?.profile.speak !== false) {
      setVoicePhase('speaking');
      await speakKorean(reply, signal);
    }
  }

  return <ScheduleShell onNavigate={tab => { if (!busy && (page !== 'proof' || proof)) navigate(tab); }} form>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로가기" disabled={busy} onPress={finishPage} style={styles.back}><ScheduleAsset name="back"/></Pressable>
        <Text accessibilityRole="header" style={styles.title}>{titles[page]}</Text>
      </View>
      {notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
      {page === 'settings' && <>
        {!!status?.nextAlarmAt && <Text style={styles.text}>다음 알람 {alarmTime.format(status.nextAlarmAt)}</Text>}
        {bridge && status?.debug && <Panel>
          <Button title="시험 알람 예약" disabled={busy} onPress={() => void run(async () => {
            onStatus(await bridge.testAlarm({ cancel: false }));
            setNotice('1분 후 알람이 울려요. 사진으로 인증하기를 눌러 계속 시험할 수 있어요.');
          })}/>
          <Button title="시험 알람 취소" disabled={busy} onPress={() => void run(async () => { onStatus(await bridge.testAlarm({ cancel: true })); })}/>
          <Button title="시험 카메라 열기" disabled={busy} onPress={() => open('proof')}/>
        </Panel>}
        <Button title="보호자 연락처" onPress={() => open('guardians')}/>
        <Button title="사진 인증 기록" onPress={() => open('records')}/>
        <Button title="말벗" onPress={() => open('voice')}/>
        {account && <Button title="계정 및 개인정보" onPress={() => open('account')}/>}
        {bridge ? <Panel>
          <Text style={styles.heading}>안드로이드 알람</Text>
          <Text style={styles.text}>알림 {status?.notifications ? '허용' : '권한 확인 필요'} · 정확한 알람 {status?.exact ? '허용' : '권한 확인 필요'}</Text>
          <Text style={styles.text}>전체 화면 {status?.fullScreen ? '허용' : '알림으로 열기'} · 예약 {status?.scheduled ?? 0}개</Text>
          <Button title="알림 권한 요청" disabled={busy} onPress={() => void run(async () => { onStatus(await bridge.requestNotifications()); })}/>
          <Button title="알림 채널 설정" disabled={busy} onPress={() => void run(() => bridge.openSettings({ kind: 'notifications' }))}/>
          <Button title="알람 및 리마인더 설정" disabled={busy} onPress={() => void run(() => bridge.openSettings({ kind: 'exact' }))}/>
          {!status?.fullScreen && <Button title="전체 화면 알람 설정" disabled={busy} onPress={() => void run(() => bridge.openSettings({ kind: 'fullScreen' }))}/>}
        </Panel> : <Text style={styles.text}>휴대전화 알람과 카메라는 Android용 올잇에서 사용할 수 있어요.</Text>}
      </>}
      {page === 'guardians' && <>
        {records.guardians.map(contact => <Panel key={contact.id}>
          <Text style={styles.heading}>{contact.name}</Text><Text style={styles.text}>{contact.phone}</Text>
          {(primary === contact.id || records.guardians.length === 1) ? <Text style={styles.text}>기본 보호자</Text>
            : <Button title={`${contact.name}님을 기본 보호자로 지정`} disabled={busy} onPress={() => void run(() => setPrimaryGuardian(contact.id))}/>}
          <Button title={`${contact.name} 수정`} onPress={() => { setEditing(contact); setName(contact.name); setPhone(contact.phone); }}/>
        </Panel>)}
        <Panel>
          {guardianFields()}
          {editing && <Button title="수정 취소" disabled={busy} onPress={() => { setEditing(undefined); setName(''); setPhone(''); }}/>}
        </Panel>
      </>}
      {page === 'proof' && !proof && <Panel>
        <Text style={styles.heading}>{schedule?.title ?? testTitle}</Text>
        {!!photo && <Image accessibilityLabel="촬영한 사진 미리보기" source={{ uri: photoSource(photo.uri) }} style={styles.preview}/>}
        <Button title={facing === 'back' ? '전면 카메라로 전환' : '후면 카메라로 전환'} disabled={busy} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}/>
        <Button title={photo ? '재촬영' : '사진 촬영'} disabled={busy || !bridge} onPress={() => void run(() => capture())}/>
        {(schedule || testPhoto) && <Button title="등록하기" disabled={busy || !photo} onPress={() => void run(registerProof)}/>}
        <Button title="촬영 취소" disabled={busy} onPress={finishPage}/>
      </Panel>}
      {page === 'records' && <>
        {!records.proofs.length && <Text style={styles.text}>등록된 사진 인증이 없어요.</Text>}
        {records.proofs.map(record => <Panel key={record.id}>
          <Text style={styles.heading}>{record.title}</Text><Text style={styles.text}>{formatDate(record.date)}</Text>
          {accountCare && record.scheduleId !== testScheduleId && <Text style={styles.text}>{record.uploadedAt ? '서버 저장 완료' : '업로드 대기'}</Text>}
          <Button title={`${record.title} 사진 보기`} disabled={(!bridge && !accountCare) || busy} onPress={() => void run(async () => {
            const image = accountCare ? await accountCare.photo(record.id) : await bridge?.photo({ accountId, id: record.id });
            if (image) {
              setPhoto(image); setProof(record); setMessage(undefined); setSharing(false);
            }
          })}/>
        </Panel>)}
        {accountCare?.hasMore && <Button title="사진 더 보기" disabled={busy} onPress={() => void run(async () => { setRecords(await accountCare.records(true)); })}/>}
      </>}
      {proof && photo && (page === 'records' || page === 'proof') && <Panel>
        <Text style={styles.heading}>{page === 'proof' ? '인증 완료!' : proof.title}</Text>
        {completionFailed && <Button title="일정 완료 다시 시도" disabled={busy} onPress={completeProof}/>}
        <Image accessibilityLabel="저장된 인증 사진" source={{ uri: photoSource(photo.uri) }} style={styles.preview}/>
        {bridge && !recipient && (records.guardians.length
          ? <><Text style={styles.text}>사진을 보낼 보호자를 선택해 주세요.</Text>
            {records.guardians.map(target => <Button key={target.id} title={`${target.name}님을 기본 보호자로 지정`} disabled={busy}
              onPress={() => void run(() => setPrimaryGuardian(target.id))}/>)}</>
          : guardiansKnown ? <><Text style={styles.text}>사진을 보낼 보호자를 등록해 주세요.</Text>{guardianFields()}</>
            : <Button title="보호자 연락처 불러오기" disabled={busy} onPress={() => void run(async () => {
              setRecords(await (accountCare ? accountCare.records() : loadRecords()));
              setGuardiansKnown(true);
            })}/>)}
        {recipient && bridge && <>
          <Text style={styles.text}>받는 사람 {recipient.name} · {recipient.phone}</Text>
          {status?.chooseSmsRecipient && <Text style={styles.text}>메시지 앱에서 이 번호를 선택해 주세요.</Text>}
          <Field title="메시지 본문" value={body} onChange={setMessage} maxLength={1000}/>
          <Button title="보호자에게 MMS 작성" disabled={busy} onPress={() => void run(async () => {
            const at = Date.now();
            let result: { opened: boolean };
            try { result = await bridge.compose({ accountId, id: proof.id, phone: recipient.phone, body }); }
            catch (error) {
              void accountCare?.noteDraft(proof, recipient, false, at).then(() => account?.retry()).catch(() => {});
              throw error;
            }
            void accountCare?.noteDraft(proof, recipient, result.opened, at).then(() => account?.retry()).catch(() => {});
            setSharing(!result.opened);
            setNotice(result.opened ? '받는 사람과 사진을 메시지 앱에서 확인해 주세요.' : '사진을 첨부할 메시지 앱을 열 수 없어요. 시스템 공유를 이용할 수 있어요.');
          })}/>
          {sharing && <Button title="시스템 공유로 사진 보내기" disabled={busy} onPress={() => void run(() => bridge.share({ accountId, id: proof.id, body }))}/>}
        </>}
      </Panel>}
      {page === 'voice' && <Panel>
        <Text style={styles.heading}>{getCharacter(character).name}에게 말 걸기</Text>
        {!!lastUtterance && <Text style={styles.text}>나 · {lastUtterance}</Text>}
        {!!response && <Text accessibilityLiveRegion="polite" style={styles.text}>{getCharacter(character).name} · {response}</Text>}
        {voicePhase === 'listening' && <Text accessibilityLiveRegion="polite" style={styles.text}>듣고 있어요.</Text>}
        <Button title={lastUtterance ? '계속 말하기' : '음성 인식 시작'} disabled={busy} onPress={() => runVoice(async signal => {
          setVoicePhase('listening');
          const text = await recognizeKorean(signal);
          if (signal.aborted) return;
          if (text) await answer(text.slice(0, 4096), signal);
          else setNotice('인식된 말이 없어요. 다시 말하거나 글로 입력해 주세요.');
        })}/>
        {voicePhase && (voicePhase === 'speaking' || !bridge) && <Button
          title={voicePhase === 'speaking' ? '재생 중지' : '듣기 중지'} onPress={() => voiceJob.current?.abort()}/>}
        <Field title="글로 입력" value={transcript} onChange={setTranscript} maxLength={4096}/>
        <Button title="글로 보내기" disabled={busy || !transcript.trim()} onPress={() => runVoice(async signal => {
          setTranscript('');
          await answer(transcript.trim(), signal);
        })}/>
      </Panel>}
      {page === 'account' && account && <AccountSettings setNotice={setNotice} run={run} busy={busy}/>}
    </ScrollView>
  </ScheduleShell>;
}

const characters: CharacterId[] = ['char1', 'char2', 'char3', 'char4', 'char5'];
function AccountSettings({ setNotice, run, busy }: { setNotice(value: string): void; run(task: () => Promise<void>): Promise<void>; busy: boolean }) {
  const account = useAccount()!;
  const [profile, setProfile] = useState(account.profile);
  const [confirm, setConfirm] = useState<'import' | 'delete'>();
  useEffect(() => setProfile(account.profile), [account.profile]);
  return <>
    <Panel>
      <Field title="이름" value={profile.displayName} maxLength={80} onChange={displayName => setProfile({ ...profile, displayName })}/>
      <Field title="부를 이름" value={profile.preferredTitle} maxLength={50} onChange={preferredTitle => setProfile({ ...profile, preferredTitle })}/>
      {characters.map(character => <Button key={character} disabled={busy}
        title={`${getCharacter(character).name}${character === profile.character ? ' 선택됨' : ' 선택'}`}
        onPress={() => setProfile({ ...profile, character })}/>)}
      <Button title={`말벗 대답 읽기 ${profile.speak ? '끄기' : '켜기'}`} disabled={busy} onPress={() => setProfile({ ...profile, speak: !profile.speak })}/>
      <Button title="프로필 저장" disabled={busy} onPress={() => void run(async () => { await account.saveProfile(profile); setNotice('서버에 설정을 저장했어요.'); })}/>
    </Panel>
    <Panel>
      {!!account.pending && <Text style={styles.text}>동기화를 기다리는 기록 {account.pending}개</Text>}
      <Button title="동기화 다시 시도" disabled={busy} onPress={() => void run(async () => { await account.schedules.list(); await account.retry(); })}/>
      {account.hasLegacy && <Button title="이 기기의 기존 자료 가져오기" disabled={busy} onPress={() => setConfirm('import')}/>}
      {confirm === 'import' && <>
        <Text style={styles.text}>이 기기의 본인 일정, 보호자와 인증 사진을 현재 계정에 복사할까요? 기기 원본은 보존돼요.</Text>
        <Button title="현재 계정으로 가져오기" disabled={busy} onPress={() => void run(async () => { setNotice(await account.legacy()); setConfirm(undefined); })}/>
      </>}
      <Button title="개인정보 처리방침" onPress={privacyLink}/>
      <Button title="로그아웃" disabled={busy} onPress={() => void run(account.signOut)}/>
      <Button title="회원 탈퇴" disabled={busy} onPress={() => setConfirm('delete')}/>
      {confirm === 'delete' && <>
        <Text style={styles.text}>계정, 프로필, 보호자, 일정, 대화와 올잇에 저장된 사진이 삭제돼요. 삭제한 기록은 복구할 수 없어요. 이미 보낸 사진은 수신자의 메시지 앱에 남을 수 있어요.</Text>
        <Button title="계정과 데이터 최종 삭제" disabled={busy} onPress={() => void run(account.remove)}/>
      </>}
      {confirm && <Button title="취소" disabled={busy} onPress={() => setConfirm(undefined)}/>}
    </Panel>
  </>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 28, paddingTop: 47, paddingBottom: 112, gap: 12 },
  header: { height: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  back: { position: 'absolute', left: 0, width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFFCC', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, lineHeight: 38, fontWeight: '700', color: '#003C40' },
  heading: { fontSize: 21, fontWeight: '600', color: '#003C40' },
  text: { fontSize: 17, lineHeight: 26, color: '#003C40' },
  notice: { fontSize: 16, lineHeight: 24, color: '#165A49' },
  panel: { backgroundColor: '#FFFFFFDD', borderRadius: 14, padding: 16, gap: 9 },
  button: { backgroundColor: '#4EA674', borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, paddingVertical: 8 },
  buttonText: { color: 'white', fontSize: 17, fontWeight: '600' }, disabled: { opacity: 0.45 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#A4C6B3', padding: 12, borderRadius: 10, minHeight: 48, color: '#003C40', fontSize: 17 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, resizeMode: 'contain', backgroundColor: '#EDF5EE' },
});
