import type { SupabaseClient } from '@supabase/supabase-js';
import type { CharacterId } from '../avatar/characterTypes';
import { browserStore, newId } from './client';

type Message = { conversation_id: string; turn_id: string; role: 'user' | 'assistant'; content: string; created_at: string };
type Conversation = { id: string; character_id: CharacterId; started_at: string; ended_at?: string };
type Pending = { sessions: Conversation[]; messages: Message[] };

export class Conversations {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly key: string;
  constructor(private readonly client: SupabaseClient, private readonly user: string) { this.key = `conversations:${user}`; }
  private async load(): Promise<Pending> {
    const raw = await browserStore.getItem(this.key);
    return raw ? JSON.parse(raw) as Pending : { sessions: [], messages: [] };
  }
  private serial<T>(work: () => Promise<T>) {
    const run = this.queue.then(work);
    this.queue = run.catch(() => {});
    return run;
  }
  private save(pending: Pending) { return browserStore.setItem(this.key, JSON.stringify(pending)); }

  open(character: CharacterId): Conversation { return { id: newId(), character_id: character, started_at: new Date().toISOString() }; }
  start(session: Conversation) { return this.serial(async () => {
    const pending = await this.load();
    if (!pending.sessions.some(item => item.id === session.id)) {
      pending.sessions.push(session);
      await this.save(pending);
    }
  }); }
  record(session: Conversation, turn: string, user: string, reply?: string) { return this.serial(async () => {
    const pending = await this.load();
    if (!pending.sessions.some(entry => entry.id === session.id)) pending.sessions.push(session);
    const base = { conversation_id: session.id, turn_id: turn, created_at: new Date().toISOString() };
    const entries: Message[] = [{ ...base, role: 'user', content: user.trim().slice(0, 4096) }];
    if (reply?.trim()) entries.push({ ...base, role: 'assistant', content: reply.trim().slice(0, 4096) });
    for (const entry of entries) {
      if (entry.content && !pending.messages.some(item => item.turn_id === entry.turn_id && item.role === entry.role)) pending.messages.push(entry);
    }
    await this.save(pending);
  }); }
  close(session: Conversation) { return this.serial(async () => {
    const pending = await this.load();
    pending.sessions = [...pending.sessions.filter(item => item.id !== session.id), { ...session, ended_at: new Date().toISOString() }];
    await this.save(pending);
  }); }

  flush() { return this.serial(async () => {
    const pending = await this.load();
    for (const session of [...pending.sessions]) {
      const saved = await this.client.from('conversations').upsert({ ...session, user_id: this.user }, { onConflict: 'id' });
      if (saved.error) continue;
      const messages = pending.messages.filter(item => item.conversation_id === session.id);
      if (messages.length) {
        const result = await this.client.from('messages').upsert(messages.map(item => ({ ...item, user_id: this.user })),
          { onConflict: 'user_id,conversation_id,turn_id,role', ignoreDuplicates: true });
        if (result.error) continue;
      }
      pending.sessions = pending.sessions.filter(item => item !== session);
      pending.messages = pending.messages.filter(item => item.conversation_id !== session.id);
      await this.save(pending);
    }
  }); }

  async history(character: CharacterId, offset = 0) {
    const result = await this.client.from('conversations').select('id,character_id,started_at,ended_at').eq('user_id', this.user)
      .eq('character_id', character).order('started_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 19);
    if (result.error) throw new Error('대화 기록을 불러오지 못했어요.');
    return result.data;
  }
  async messages(conversation: string, offset = 0) {
    const result = await this.client.from('messages').select('id,role,content,created_at').eq('user_id', this.user)
      .eq('conversation_id', conversation).order('created_at').order('id').range(offset, offset + 49);
    if (result.error) throw new Error('대화 내용을 불러오지 못했어요.');
    return result.data;
  }
  async pendingCount() { return (await this.load()).sessions.length; }
  clear() { return this.serial(() => browserStore.removeItem(this.key)); }
}
