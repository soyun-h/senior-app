/// <reference types="expo/types/metro-require" />

import type { CharacterId, HomeDialogueSituation, MouthSet, SpokenVowel } from './characterTypes';

/**
 * 재생에 쓰는 입 모양 세트. 'aeiou'로 바꾸면 mouth_e.png·mouth_u.png도 쓴다.
 * 5장이 모두 있는 캐릭터만 5모음으로 재생하고, 나머지는 기존 방식으로 동작한다.
 */
export const mouthSet: MouthSet = 'aio';
export const mouthSetVowels: Record<MouthSet, readonly SpokenVowel[]> = {
  aio: ['a', 'i', 'o'],
  aeiou: ['a', 'e', 'i', 'o', 'u'],
};
export type MouthFrames = Partial<Record<SpokenVowel, number>>;

export interface DialogueMedia {
  mouthFrames?: MouthFrames;
  video?: number;
}

interface LocalAssets {
  keys(): string[];
  (path: string): number;
}

/**
 * 캐릭터 dialogue 폴더에서 입 모양 PNG 세트와 현재 대사의 영상을 찾는다.
 * 세트의 PNG가 한 장이라도 없으면 mouthFrames는 undefined다.
 */
export function resolveDialogueMedia(situation: HomeDialogueSituation, files: LocalAssets, set: MouthSet = mouthSet): DialogueMedia {
  const paths = new Set(files.keys());
  const frames = mouthSetVowels[set].map(vowel => [vowel, `./mouth_${vowel}.png`] as const);
  const mouthFrames = frames.every(([, path]) => paths.has(path))
    ? Object.fromEntries(frames.map(([vowel, path]) => [vowel, files(path)])) as MouthFrames
    : undefined;
  const videoPath = `./${situation.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase())}.mp4`;
  return { mouthFrames, video: paths.has(videoPath) ? files(videoPath) : undefined };
}

// 대사 영상 파일명: greeting, night, schedule_pending, schedule_complete, rain, snow, thunder (.mp4)
// 파일이 있으면 해당 상황에서 영상을 먼저 재생하고, 없으면 음원과 입 모양 이미지로 재생한다.
// Metro는 require.context 인자를 리터럴로만 받으므로 캐릭터별 폴더를 하나씩 적는다.
const dialogueFolders: Record<CharacterId, () => LocalAssets> = {
  char1: () => require.context('../../../assets/characters/char1/dialogue', false,
    /^\.\/(?:mouth_[aeiou]\.png|(?:greeting|night|schedule_pending|schedule_complete|rain|snow|thunder)\.mp4)$/),
  char2: () => require.context('../../../assets/characters/char2/dialogue', false,
    /^\.\/(?:mouth_[aeiou]\.png|(?:greeting|night|schedule_pending|schedule_complete|rain|snow|thunder)\.mp4)$/),
  char3: () => require.context('../../../assets/characters/char3/dialogue', false,
    /^\.\/(?:mouth_[aeiou]\.png|(?:greeting|night|schedule_pending|schedule_complete|rain|snow|thunder)\.mp4)$/),
  char4: () => require.context('../../../assets/characters/char4/dialogue', false,
    /^\.\/(?:mouth_[aeiou]\.png|(?:greeting|night|schedule_pending|schedule_complete|rain|snow|thunder)\.mp4)$/),
  char5: () => require.context('../../../assets/characters/char5/dialogue', false,
    /^\.\/(?:mouth_[aeiou]\.png|(?:greeting|night|schedule_pending|schedule_complete|rain|snow|thunder)\.mp4)$/),
};

export function getDialogueMedia(characterId: CharacterId, situation: HomeDialogueSituation): DialogueMedia {
  return resolveDialogueMedia(situation, dialogueFolders[characterId]());
}
