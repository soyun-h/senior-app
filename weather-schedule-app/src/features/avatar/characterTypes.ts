/** 캐릭터 모듈 타입. 기존 types.ts(AvatarDefinition)와 별도로 관리한다. */
export type CharacterId = 'char1' | 'char2' | 'char3' | 'char4' | 'char5';
export type CallState = 'CALL_INCOMING' | 'GREETING' | 'LISTENING' | 'TALKING' | 'AUTH_SUCCESS' | 'AUTH_FAIL';
export type CharacterAction = 'none' | 'nod' | 'laugh' | 'shy' | 'worry' | 'cheer' | 'encourage';
export type Pose = 'profile' | 'idle' | 'wave' | 'ok' | 'encourage' | 'mouth_a' | 'mouth_o' | 'mouth_i';
export type HomeDialogueSituation = 'greeting' | 'night' | 'schedulePending' | 'scheduleComplete' | 'rain' | 'snow' | 'thunder';
/** 입 모양: rest=다문 입(idle), a=아·어, e=에·애, i=이·으, o=오, u=우, m=ㅁㅂㅍ(입술 닫힘) */
export type SpokenVowel = 'a' | 'e' | 'i' | 'o' | 'u';
/** 재생에 쓰는 입 모양 세트. 'aio'는 에→이, 우→오로 합쳐 3장만 쓰고, 'aeiou'는 5장을 모두 쓴다. */
export type MouthSet = 'aio' | 'aeiou';
export type Mouth = 'rest' | SpokenVowel | 'm';
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

/** 입 모양 큐: t초부터 mouth 모양을 보여 준다. */
export interface MouthCue { t: number; mouth: Mouth }
