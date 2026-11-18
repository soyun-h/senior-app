/** 캐릭터 AI 타입 (담당: 한나). 소윤 님 types.ts(AvatarDefinition)는 그대로 두고 따로 둬요. */
export type CharacterId = 'char1' | 'char2' | 'char3' | 'char4' | 'char5';
export type CallState = 'CALL_INCOMING' | 'GREETING' | 'LISTENING' | 'TALKING' | 'AUTH_SUCCESS' | 'AUTH_FAIL';
export type CharacterAction = 'none' | 'nod' | 'laugh' | 'shy' | 'worry' | 'cheer' | 'encourage';
export type Pose = 'profile' | 'idle' | 'wave' | 'ok' | 'encourage' | 'mouth_a' | 'mouth_o' | 'mouth_i';
export type HomeDialogueSituation = 'greeting' | 'night' | 'schedulePending' | 'scheduleComplete' | 'rain' | 'snow' | 'thunder';
/** 입 모양: rest=다문 입(idle), a=아·어, o=오·우, i=이·에, m=ㅁㅂㅍ(입술 닫힘) */
export type SpokenVowel = 'a' | 'e' | 'i' | 'o' | 'u';
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

/** 소윤 님 WeatherSnapshot도, 간단한 {sky, temp}도 받아요 */
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

/** 입 모양 큐: t초에 mouth 모양으로 바꿔요 */
export interface MouthCue { t: number; mouth: Mouth }
