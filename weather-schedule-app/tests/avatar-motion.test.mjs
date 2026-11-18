import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { characterMotion, isMouthOpen } from '../src/features/avatar/characterMotion.ts';

test('open and closed frames alternate in 200 ms windows based on playback time', () => {
  assert.deepEqual([0, 0.199, 0.2, 0.399, 0.4, 0.6].map(isMouthOpen), [true, true, false, false, true, false]);
});

test('each character has paired idle and open frames and uses only one whole image at a time', () => {
  const { characters } = JSON.parse(readFileSync(new URL('../src/features/avatar/characters.json', import.meta.url), 'utf8'));
  for (const character of characters) {
    assert.ok(character.assets.idle && character.assets.mouth_a, character.id);
  }
  assert.deepEqual(characterMotion('idle', true, true), { pose: 'mouth_a', bounce: false });
  assert.deepEqual(characterMotion('mouth_o', true, true), { pose: 'mouth_o', bounce: false });
  assert.deepEqual(characterMotion('mouth_o', true, false), { pose: 'idle', bounce: false });
});

test('unpaired gestures bounce only during speech and all poses return to idle', () => {
  for (const pose of ['wave', 'ok', 'encourage', 'profile']) {
    assert.deepEqual(characterMotion(pose, true, true), { pose, bounce: true });
    assert.deepEqual(characterMotion(pose, true, false), { pose, bounce: true });
  }
  for (const pose of ['idle', 'mouth_a', 'mouth_o', 'mouth_i', 'wave', 'ok', 'encourage', 'profile']) {
    assert.deepEqual(characterMotion(pose, false, true), { pose: 'idle', bounce: false });
  }
});
