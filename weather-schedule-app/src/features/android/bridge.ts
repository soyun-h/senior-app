import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { Schedule } from '../schedules/model';

export type NativeStatus = { notifications: boolean; exact: boolean; fullScreen: boolean; debug: boolean; scheduled: number; nextAlarmAt?: number; chooseSmsRecipient: boolean };
export type AlarmAction = { key: string; id: string; date: string; action: 'before' | 'confirm' | 'photo' };
export type ProofPhoto = { id: string; uri: string; capturedAt?: number };
type AccountScope = { accountId?: string };
export type AndroidBridge = {
  status(): Promise<NativeStatus>;
  sync(options: AccountScope & { schedules: Schedule[] }): Promise<NativeStatus>;
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

export const android = Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('Allit')
  ? registerPlugin<AndroidBridge>('Allit') : null;

export function photoSource(uri: string) { return Capacitor.convertFileSrc(uri); }
