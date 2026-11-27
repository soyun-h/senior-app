import type { SupabaseClient } from '@supabase/supabase-js';
import { android, photoSource, type ProofPhoto } from '../android/bridge';
import { dateKeyAt, type DateKey } from '../schedules/model';
import type { Guardian, Proof, Records } from '../android/careStorage';
import { browserStore, readableCloudError } from './client';
import { deterministicId } from './cloudSchedules';
import { testScheduleId } from './legacyData';

type QueuedPhoto = { proof: Proof; scheduleKnown: boolean };
type Draft = { photo: string; guardian: string; status: 'opened' | 'failed'; at: string | null };
type Cache = { guardians: Guardian[]; photos: Proof[]; pending: QueuedPhoto[]; drafts: Draft[]; loaded: boolean };
type PhotoRow = { id: string; schedule_occurrence_id: string | null; schedule_title: string; storage_path: string;
  captured_at: string; uploaded_at: string; scheduled_at: string | null; message_status: Draft['status'] | null };
const photoColumns = 'id,schedule_occurrence_id,schedule_title,storage_path,captured_at,uploaded_at,scheduled_at,message_status';
const pageSize = 20;

export function privatePhotoPath(user: string, id: string, captured: number) {
  return `${user}/${dateKeyAt(captured).slice(0, 7).replace('-', '/')}/${id}.jpg`;
}
const toProof = (row: PhotoRow): Proof => ({ id: row.id, scheduleId: row.schedule_occurrence_id ?? '', title: row.schedule_title,
  date: dateKeyAt(Date.parse(row.scheduled_at ?? row.captured_at)), savedAt: Date.parse(row.captured_at),
  uploadedAt: Date.parse(row.uploaded_at), messageStatus: row.message_status ?? undefined });

export class CloudCare {
  private queue: Promise<unknown> = Promise.resolve();
  private syncJob?: Promise<void>;
  private closed = false;
  private offset = 0;
  hasMore = false;
  private readonly key: string;
  constructor(private readonly client: SupabaseClient, private readonly user: string) { this.key = `care:${user}`; }

  private serial<T>(work: () => Promise<T>) {
    const run = this.queue.then(work);
    this.queue = run.catch(() => {});
    return run;
  }
  private async cache(): Promise<Cache> {
    const raw = await browserStore.getItem(this.key);
    return raw ? JSON.parse(raw) as Cache : { guardians: [], photos: [], pending: [], drafts: [], loaded: false };
  }
  private async save(cache: Cache) { await browserStore.setItem(this.key, JSON.stringify(cache)); }
  private current(cache: Cache): Records { return { guardians: cache.guardians, proofs: cache.photos }; }
  async cachedRecords() { return this.current(await this.cache()); }

  async records(more = false) {
    const from = more ? this.offset : 0;
    const [guardians, photos] = await Promise.all([
      more ? Promise.resolve(null) : this.client.from('guardians').select('id,name,phone_number').eq('user_id', this.user).order('name'),
      this.client.from('photos').select(photoColumns).eq('user_id', this.user).order('captured_at', { ascending: false })
        .order('id', { ascending: false }).range(from, from + pageSize - 1),
    ]);
    return this.serial(async () => {
      if (this.closed) return { guardians: [], proofs: [] };
      const cache = await this.cache();
      if (guardians?.error || photos.error) {
        if (!cache.loaded && !cache.photos.length) {
          throw new Error(readableCloudError(guardians?.error ?? photos.error, '서버에서 연락처와 사진을 불러오지 못했어요.'));
        }
        return this.current(cache);
      }
      if (guardians) cache.guardians = guardians.data!.map(row => ({ id: row.id, name: row.name, phone: row.phone_number }));
      const known = new Map<string, Proof>();
      for (const proof of (more ? cache.photos : cache.photos.filter(proof => !proof.uploadedAt))) known.set(proof.id, proof);
      for (const row of photos.data as PhotoRow[]) known.set(row.id, toProof(row));
      cache.photos = [...known.values()].sort((a, b) => b.savedAt - a.savedAt);
      cache.loaded = true;
      this.offset = from + photos.data.length;
      this.hasMore = photos.data.length === pageSize;
      await this.save(cache);
      return this.current(cache);
    });
  }

  async photosForDates(first: DateKey, end: DateKey, signal: AbortSignal) {
    const { photos } = await this.cache();
    const proofs = new Map(photos.filter(photo => !photo.uploadedAt && photo.date >= first && photo.date < end)
      .map(photo => [photo.id, photo]));
    const startAt = new Date(`${first}T00:00:00+09:00`).toISOString();
    const endAt = new Date(`${end}T00:00:00+09:00`).toISOString();
    const dateRange = `and(scheduled_at.gte.${startAt},scheduled_at.lt.${endAt}),and(scheduled_at.is.null,captured_at.gte.${startAt},captured_at.lt.${endAt})`;
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await this.client.from('photos').select(photoColumns).eq('user_id', this.user)
        .or(dateRange).order('id').range(offset, offset + 99).abortSignal(signal);
      if (error) throw new Error(readableCloudError(error, '사진 기록을 불러오지 못했어요.'));
      for (const row of data as PhotoRow[]) proofs.set(row.id, toProof(row));
      if (data.length < 100) break;
    }
    return [...proofs.values()].sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id));
  }

  saveGuardian(contact: Guardian, editing: boolean) { return this.serial(async () => {
    const cache = await this.cache();
    const row = { id: contact.id, user_id: this.user, name: contact.name, phone_number: contact.phone };
    const query = editing ? this.client.from('guardians').update(row).eq('id', contact.id).eq('user_id', this.user)
      : this.client.from('guardians').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    const result = await query.select('id').maybeSingle();
    if (result.error?.code === '23505') throw new Error('이미 등록된 전화번호예요.');
    if (result.error || editing && !result.data) throw new Error(readableCloudError(result.error, '보호자를 서버에 저장하지 못했어요.'));
    cache.guardians = [...cache.guardians.filter(item => item.id !== contact.id), contact];
    await this.save(cache);
    return this.current(cache);
  }); }

  saveProof(proof: Proof) { return this.serial(async () => {
    if (this.closed) throw new Error('현재 로그인 계정에서 다시 시도해 주세요.');
    const cache = await this.cache();
    if (!cache.photos.some(item => item.id === proof.id)) {
      cache.photos = [proof, ...cache.photos];
      if (proof.scheduleId !== testScheduleId) cache.pending.push({ proof, scheduleKnown: !!proof.scheduleId });
      await this.save(cache);
    }
    return this.current(cache);
  }); }

  noteDraft(proof: Proof, guardian: Guardian, opened: boolean, at: number) { return this.serial(async () => {
    if (this.closed || proof.scheduleId === testScheduleId) return;
    const cache = await this.cache();
    const status = opened ? 'opened' : 'failed';
    cache.drafts = [...cache.drafts.filter(item => item.photo !== proof.id), { photo: proof.id, guardian: guardian.id,
      status, at: opened ? new Date(at).toISOString() : null }];
    cache.photos = cache.photos.map(photo => photo.id === proof.id ? { ...photo, messageStatus: status } : photo);
    await this.save(cache);
  }); }

  private async upload(pending: QueuedPhoto): Promise<number | false> {
    if (!android) return false;
    const { proof } = pending;
    const file = await android.photo({ accountId: this.user, id: proof.id });
    const response = await fetch(photoSource(file.uri));
    if (!response.ok) return false;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 4 || bytes.byteLength > 1048576) return false;
    let occurrence: string | undefined;
    if (pending.scheduleKnown) {
      const result = await this.client.from('schedule_occurrences').select('id').eq('user_id', this.user)
        .eq('schedule_id', proof.scheduleId).eq('occurrence_date', proof.date).maybeSingle();
      if (result.error) return false;
      occurrence = result.data?.id;
    }
    const path = privatePhotoPath(this.user, proof.id, proof.savedAt);
    const bucket = this.client.storage.from('verification-photos');
    const { error } = await bucket.upload(path, bytes, { contentType: 'image/jpeg', cacheControl: '60', upsert: false });
    if (error) {
      const existing = await bucket.info(path);
      if (existing.error || existing.data.size !== bytes.byteLength) return false;
    }
    const metadata = await this.client.from('photos').upsert({ id: proof.id, user_id: this.user, schedule_occurrence_id: occurrence ?? null,
      schedule_title: proof.title, scheduled_at: proof.scheduledAt ?? null, storage_path: path, captured_at: new Date(proof.savedAt).toISOString(),
      file_size: bytes.byteLength, mime_type: 'image/jpeg' }, { onConflict: 'id', ignoreDuplicates: true }).select('uploaded_at').maybeSingle();
    if (metadata.error) return false;
    if (metadata.data) return Date.parse(metadata.data.uploaded_at);
    const recorded = await this.client.from('photos').select('uploaded_at').eq('id', proof.id).eq('user_id', this.user).maybeSingle();
    return recorded.data ? Date.parse(recorded.data.uploaded_at) : false;
  }

  flush() {
    if (this.closed) return Promise.resolve();
    return this.syncJob ??= this.flushSnapshot().finally(() => { this.syncJob = undefined; });
  }

  private async flushSnapshot() {
    const snapshot = await this.serial(() => this.cache());
    for (const entry of snapshot.pending) {
      if (this.closed) return;
      const uploadedAt = await this.upload(entry).catch(() => false as const);
      if (!uploadedAt) continue;
      await this.serial(async () => {
        if (this.closed) return;
        const cache = await this.cache();
        cache.pending = cache.pending.filter(pending => pending.proof.id !== entry.proof.id);
        cache.photos = cache.photos.map(photo => photo.id === entry.proof.id ? { ...photo, uploadedAt } : photo);
        await this.save(cache);
      });
    }
    const afterUploads = await this.serial(() => this.cache());
    for (const draft of afterUploads.drafts) {
      if (this.closed) return;
      if (afterUploads.pending.some(entry => entry.proof.id === draft.photo)) continue;
      const update = { guardian_id: draft.guardian as string | null, message_status: draft.status, message_opened_at: draft.at };
      let result = await this.client.from('photos').update(update).eq('id', draft.photo).eq('user_id', this.user).select('id').maybeSingle();
      if (result.error?.code === '23503') result = await this.client.from('photos').update({ ...update, guardian_id: null })
        .eq('id', draft.photo).eq('user_id', this.user).select('id').maybeSingle();
      if (result.error || !result.data) continue;
      await this.serial(async () => {
        if (this.closed) return;
        const cache = await this.cache();
        cache.drafts = cache.drafts.filter(item => item.photo !== draft.photo || item.at !== draft.at || item.status !== draft.status || item.guardian !== draft.guardian);
        await this.save(cache);
      });
    }
  }

  async photo(id: string): Promise<ProofPhoto> {
    if (android) {
      const local = await android.photo({ accountId: this.user, id }).catch(() => null);
      if (local) return local;
    }
    const metadata = await this.client.from('photos').select('storage_path').eq('id', id).eq('user_id', this.user).maybeSingle();
    if (!metadata.data) throw new Error('저장된 사진을 찾을 수 없어요.');
    const response = await this.client.storage.from('verification-photos').download(metadata.data.storage_path);
    if (response.error) throw new Error('사진을 불러오지 못했어요. 연결을 확인해 주세요.');
    if (!android) return { id, uri: URL.createObjectURL(response.data) };
    const bytes = new Uint8Array(await response.data.arrayBuffer());
    if (bytes.length > 1048576) throw new Error('저장된 사진의 크기를 확인해 주세요.');
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
    return android.restorePhoto({ accountId: this.user, id, base64: btoa(chunks.join('')) });
  }

  async pendingCount() { const cache = await this.cache(); return cache.pending.length + cache.drafts.length; }
  clear() { this.closed = true; return this.serial(() => browserStore.removeItem(this.key)); }

  async importLegacyPhotos(proofs: Proof[], scheduleIds: Set<string>) {
    if (!android) return 0;
    let missing = 0;
    for (const proof of proofs) {
      const id = await deterministicId(this.user, `photo:${proof.id}`);
      const result = await android.importLegacyPhoto({ accountId: this.user, sourceId: proof.id, id });
      if (!result.copied) { missing++; continue; }
      const scheduleId = scheduleIds.has(proof.scheduleId) ? await deterministicId(this.user, `schedule:${proof.scheduleId}`) : '';
      await this.saveProof({ ...proof, id, scheduleId, uploadedAt: undefined, messageStatus: undefined });
    }
    return missing;
  }
  importLegacy(guardians: Guardian[]) { return this.serial(async () => {
    for (const original of guardians) {
      const saved = await this.client.from('guardians').upsert({ id: await deterministicId(this.user, `guardian:${original.id}`),
        user_id: this.user, name: original.name, phone_number: original.phone }, { onConflict: 'user_id,phone_number', ignoreDuplicates: true });
      if (saved.error) throw saved.error;
    }
  }); }
}
