import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('home keeps weather context and attribution above a character-only dialogue area', () => {
  const home = read('src/screens/HomeScreen.tsx');
  assert.match(home, /useWeather\(\)/);
  assert.match(home, /<WeatherBackground condition=\{weather\?\.condition/);
  assert.match(home, /<HomeText style=\{styles\.credit\}>\{credit\}<\/HomeText>/);
  assert.match(home, /<CharacterDialogue name=\{character\.name\} text=\{text\}\/>/);
  assert.doesNotMatch(home, /WeatherMessage|features\/weather\/presentation/);
});

test('the home still plays dialogue audio while rendering a static idle image', () => {
  const playback = read('src/components/home/DialogueAvatar.tsx');
  assert.match(playback, /useHomeDialogueAudio\(characterVoices\[character\.id\]\[situation\]\)/);
  assert.match(playback, /<AvatarView character=\{character\} \/>/);
  assert.doesNotMatch(playback, /DialogueVideo|mouthFrames/);

  const image = read('src/components/home/CharacterImage.tsx');
  assert.match(image, /imageFor\(characterId, 'idle'\)/);
  assert.doesNotMatch(image, /mouthFrame|requestAnimationFrame/);
});
