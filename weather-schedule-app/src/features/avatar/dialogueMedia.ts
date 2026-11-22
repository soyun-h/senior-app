/// <reference types="expo/types/metro-require" />

import type { CharacterId, HomeDialogueSituation } from './characterTypes';

export interface DialogueMedia {
  video?: number;
}

interface LocalAssets {
  keys(): string[];
  (path: string): number;
}

/** 캐릭터 dialogue 폴더에서 현재 대사의 영상을 찾는다. 없으면 video는 undefined다. */
export function resolveDialogueMedia(situation: HomeDialogueSituation, files: LocalAssets): DialogueMedia {
  const videoPath = `./${situation.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase())}.mp4`;
  return { video: files.keys().includes(videoPath) ? files(videoPath) : undefined };
}

// 대사 영상 파일명: greeting, night, schedule_pending, schedule_complete, rain, snow, thunder (.mp4)
// 홈 화면은 아직 이 함수를 쓰지 않는다. 영상을 넣을 때 DialogueAvatar에서 연결한다.
// Metro는 require.context 인자를 리터럴로만 받으므로 캐릭터별 폴더를 하나씩 적는다.
const VIDEO = /^\.\/(?:greeting|night|schedule_pending|schedule_complete|rain|snow|thunder)\.mp4$/;
const dialogueFolders: Record<CharacterId, () => LocalAssets> = {
  char1: () => require.context('../../../assets/characters/char1/dialogue', false, VIDEO),
  char2: () => require.context('../../../assets/characters/char2/dialogue', false, VIDEO),
  char3: () => require.context('../../../assets/characters/char3/dialogue', false, VIDEO),
  char4: () => require.context('../../../assets/characters/char4/dialogue', false, VIDEO),
  char5: () => require.context('../../../assets/characters/char5/dialogue', false, VIDEO),
};

export function getDialogueMedia(characterId: CharacterId, situation: HomeDialogueSituation): DialogueMedia {
  return resolveDialogueMedia(situation, dialogueFolders[characterId]());
}
