/** 캐릭터 모듈 타입. 기존 types.ts(AvatarDefinition)와 별도로 관리한다. */
export type CharacterId = 'char1' | 'char2' | 'char3' | 'char4' | 'char5';
export type CallState = 'CALL_INCOMING' | 'GREETING' | 'LISTENING' | 'TALKING' | 'AUTH_SUCCESS' | 'AUTH_FAIL';
export type CharacterAction = 'none' | 'nod' | 'laugh' | 'shy' | 'worry' | 'cheer' | 'encourage';
export type Pose = 'profile' | 'idle' | 'wave' | 'ok' | 'encourage';
export type HomeDialogueSituation = 'greeting' | 'night' | 'schedulePending' | 'scheduleComplete' | 'rain' | 'snow' | 'thunder';
export type Honorific = '할머니' | '할아버지';

export interface CharacterDef {
  id: CharacterId;
  number: number;
  name: string;
  relation: string;
  age: string;
  gender: 'female' | 'male';
  tagline: string;
  personality: string;
  speechStyle: string;
  systemPrompt: string;
  favoriteActions: CharacterAction[];
  motion: { idle: number; energy: number; talkSpeed: number };
  voice: {
    elevenLabsVoiceId: string;
    settings: { stability: number; similarity_boost: number; style: number; speed: number };
    browserFallback: { pitch: number; rate: number };
  };
  assets: Partial<Record<Pose, string | null>>;
  stateLines: Record<string, string[]>;
  replyLines: Record<string, string[]>;
}

export interface CharacterConfig {
  version: number;
  states: CallState[];
  poses: Pose[];
  poseFallback: Partial<Record<Pose, Pose>>;
  commonRules: string[];
  characters: CharacterDef[];
}

/** WeatherSnapshot 또는 {sky, temp} 형태를 모두 받는다. */
export interface WeatherLike {
  condition?: string;
  temperatureCelsius?: number;
  guidance?: string;
  sky?: string;
  temp?: number;
  tip?: string;
}

export interface LineContext {
  honorific?: Honorific;
  alarmLabel?: string;
  weather?: WeatherLike | null;
  medTaken?: boolean;
  name?: string;
}

export interface CharacterReply {
  text: string;
  action: CharacterAction;
  end?: boolean;
  source?: 'ai' | 'demo' | 'script';
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

