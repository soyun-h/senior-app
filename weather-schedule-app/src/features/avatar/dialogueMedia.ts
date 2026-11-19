/// <reference types="expo/types/metro-require" />

import type { CharacterId, HomeDialogueSituation, SpokenVowel } from './characterTypes';

const vowels = ['a', 'e', 'i', 'o', 'u'] as const;
export type MouthFrames = Record<SpokenVowel, number>;

export interface DialogueMedia {
  mouthFrames?: MouthFrames;
  video?: number;
}

interface LocalAssets {
  keys(): string[];
  (path: string): number;
}

/** 한 캐릭터의 dialogue 폴더에서 입 모양 PNG 5장(모두 있을 때만)과 현재 대사의 영상을 고른다. */
export function resolveDialogueMedia(situation: HomeDialogueSituation, files: LocalAssets): DialogueMedia {
  const paths = new Set(files.keys());
  const frames = vowels.map(vowel => [vowel, `./mouth_${vowel}.png`] as const);
  const mouthFrames = frames.every(([, path]) => paths.has(path))
    ? Object.fromEntries(frames.map(([vowel, path]) => [vowel, files(path)])) as MouthFrames
    : undefined;
  const videoPath = `./${situation.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase())}.mp4`;
  return { mouthFrames, video: paths.has(videoPath) ? files(videoPath) : undefined };
}

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
