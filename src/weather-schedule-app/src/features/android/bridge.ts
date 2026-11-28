import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { Schedule } from '../schedules/model';

export type NativeStatus = { notifications: boolean; exact: boolean; fullScreen: boolean; debug: boolean; scheduled: number; nextAlarmAt?: number; chooseSmsRecipient: boolean };
export type ReservationOutcome = 'scheduled' | 'blocked' | 'failed' | 'unconfirmed' | 'notNeeded';
export type AlarmSyncResult = NativeStatus & {
  reservations?: { id: string; date: string; due: number; outcome: ReservationOutcome }[];
};
export type AlarmAction = { key: string; id: string; date: string; action: 'before' | 'confirm' | 'photo' };
export type ProofPhoto = { id: string; uri: string; capturedAt?: number };
type AccountScope = { accountId?: string };
export type AndroidBridge = {
  status(): Promise<NativeStatus>;
  diagnostics(options: AccountScope): Promise<{ originAllowed: boolean; accountMatches: boolean }>;
  sync(options: AccountScope & { schedules: Schedule[]; force?: boolean }): Promise<AlarmSyncResult>;
  requestNotifications(): Promise<NativeStatus>;
  openSettings(options: { kind: 'exact' | 'fullScreen' | 'notifications' }): Promise<void>;
  actions(options: AccountScope): Promise<{ items: AlarmAction[] }>;
  acknowledge(options: AccountScope & { key: string }): Promise<void>;
  pickContact(options: AccountScope): Promise<{ name?: string; phone?: string }>;
  takePhoto(options: AccountScope & { facing: 'front' | 'back' }): Promise<Partial<ProofPhoto>>;
  photo(options: AccountScope & { id: string }): Promise<ProofPhoto>;
  restorePhoto(options: { accountId: string; id: string; base64: string }): Promise<ProofPhoto>;
  importLegacyPhoto(options: { accountId: string; sourceId: string; id: string }): Promise<{ copied: boolean }>;
  removePhoto(options: AccountScope & { id: string }): Promise<void>;
  compose(options: AccountScope & { id: string; phone: string; body: string }): Promise<{ opened: boolean }>;
  share(options: AccountScope & { id: string; body: string }): Promise<void>;
  recognize(): Promise<{ text?: string }>;
  voicePlaybackAllowed(): Promise<{ allowed: boolean }>;
  speak(options: { text: string }): Promise<void>;
  stopVoice(): Promise<void>;
  testAlarm(options: { cancel: boolean }): Promise<NativeStatus>;
  addListener(event: 'changed' | 'voiceOutputChanged', listener: () => void): Promise<PluginListenerHandle>;
  authGet(options: { key: string }): Promise<{ value?: string }>;
  authSet(options: { key: string; value?: string }): Promise<void>;
  authLaunch(options: { url: string }): Promise<void>;
  authRedirect(): Promise<{ redirect: string }>;
  authCallback(): Promise<{ url?: string }>;
  accountScope(options: { id?: string }): Promise<void>;
  purgeAccountFiles(options: { id: string }): Promise<void>;
};

// Capacitor captures the native method table at registration. Wait for the table before registering.
type AllitEvent = Parameters<AndroidBridge['addListener']>[0];
export function createAndroidBridge(platform: string, available: () => boolean,
  register: () => AndroidBridge, delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {
  if (platform !== 'android') return null;
  let allit: AndroidBridge | undefined;
  let connecting: Promise<AndroidBridge> | undefined;
  const listeners = new Map<AllitEvent, { callbacks: Set<() => void>; connecting: boolean; attached: boolean }>();

  function connect() {
    if (allit) return Promise.resolve(allit);
    return connecting ??= (async () => {
      for (let attempt = 0; !available() && attempt < 20; attempt++) await delay(100);
      if (!available()) {
        console.warn('[AllitBridge] PLUGIN_UNAVAILABLE');
        throw new Error('Android 네이티브 연결을 열지 못했어요. (PLUGIN_UNAVAILABLE)');
      }
      return allit = register();
    })().finally(() => { connecting = undefined; });
  }

  async function addListener(event: AllitEvent, callback: () => void): Promise<PluginListenerHandle> {
    const entry = listeners.get(event) ?? { callbacks: new Set<() => void>(), connecting: false, attached: false };
    listeners.set(event, entry);
    // Each subscription owns its cleanup, even when callers share the same callback.
    const subscriber = () => callback();
    entry.callbacks.add(subscriber);
    if (!entry.connecting && !entry.attached) {
      entry.connecting = true;
      let recovered = !available();
      const emit = () => {
        for (const listener of [...entry.callbacks]) {
          if (!entry.callbacks.has(listener)) continue;
          try { listener(); }
          catch (error) { console.warn('[AllitBridge] Event callback failed', error instanceof Error ? error.name : 'Error'); }
        }
      };
      void (async () => {
        try {
          while (entry.callbacks.size) {
            try {
              const bridge = await connect();
              if (!entry.callbacks.size) return;
              // The native listener is shared for the WebView lifetime. Screen cleanup removes JS callbacks.
              await bridge.addListener(event, emit);
              entry.attached = true;
              if (recovered) emit();
              return;
            } catch {
              recovered = true;
              if (entry.callbacks.size) await delay(1000);
            }
          }
        } finally { entry.connecting = false; }
      })();
    }
    return { remove: async () => { entry.callbacks.delete(subscriber); } };
  }

  return new Proxy({ addListener } as AndroidBridge, {
    get(target, property: keyof AndroidBridge) {
      if (property === 'addListener') return target.addListener;
      return async (...args: unknown[]) => {
        const bridge = await connect();
        return Reflect.apply(bridge[property], bridge, args);
      };
    },
  });
}

export const android = createAndroidBridge(Capacitor.getPlatform(), () => Capacitor.isPluginAvailable('Allit'),
  () => registerPlugin<AndroidBridge>('Allit'));

export function photoSource(uri: string) { return Capacitor.convertFileSrc(uri); }
