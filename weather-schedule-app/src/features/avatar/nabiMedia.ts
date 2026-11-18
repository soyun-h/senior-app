/// <reference types="expo/types/metro-require" />

import type { CharacterId, HomeDialogueSituation, SpokenVowel } from './characterTypes';

const vowels = ['a', 'e', 'i', 'o', 'u'] as const;
export type MouthFrames = Record<SpokenVowel, number>;

interface DialogueMedia {
  mouthFrames?: MouthFrames;
  video?: number;
}

interface LocalAssets {
  keys(): string[];
  (path: string): number;
}

export function resolveNabiMedia(situation: HomeDialogueSituation, files: LocalAssets): DialogueMedia {
  const paths = new Set(files.keys());
  const frames = vowels.map(vowel => [vowel, `./mouth_${vowel}.png`] as const);
  const mouthFrames = frames.every(([, path]) => paths.has(path))
    ? Object.fromEntries(frames.map(([vowel, path]) => [vowel, files(path)])) as MouthFrames
    : undefined;
  const videoPath = `./${situation.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase())}.mp4`;
  return { mouthFrames, video: paths.has(videoPath) ? files(videoPath) : undefined };
}

export function getDialogueMedia(characterId: CharacterId, situation: HomeDialogueSituation): DialogueMedia {
  if (characterId !== 'char1') return {};
  const files = require.context(
    '../../../assets/characters/char1/dialogue',
    false,
    /^\.\/(?:mouth_[aeiou]\.png|(?:greeting|night|schedule_pending|schedule_complete|rain|snow|thunder)\.mp4)$/,
  );
  return resolveNabiMedia(situation, files);
}
