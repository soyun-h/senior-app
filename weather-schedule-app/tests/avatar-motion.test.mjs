import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isMouthOpen, legacyMouthPoses, mouthRegions } from '../src/features/avatar/characterMotion.ts';

test('open and closed frames alternate in 200 ms windows based on playback time', () => {
  assert.deepEqual([0, 0.199, 0.2, 0.399, 0.4, 0.6].map(isMouthOpen), [true, true, false, false, true, false]);
});

test('each character has a local mouth region and idle and open image sources', () => {
  const { characters } = JSON.parse(readFileSync(new URL('../src/features/avatar/characters.json', import.meta.url), 'utf8'));
  const outlines = JSON.parse(readFileSync(new URL('../src/features/avatar/characterOutlines.json', import.meta.url), 'utf8'));
  for (const { id, assets } of characters) {
    const { x, y, width, height } = mouthRegions[id];
    const idle = outlines[`${id}_idle`];
    assert.ok(assets.idle && assets.mouth_a, id);
    assert.ok(x > 0 && y > 0 && x + width < idle.width && y + height < idle.height, id);
    assert.ok(width < idle.width / 4 && height < idle.height / 6, id);
  }
});

test('older mouth assets fall back to the closest available vowel shape', () => {
  assert.deepEqual(legacyMouthPoses, { a: 'mouth_a', e: 'mouth_i', i: 'mouth_i', o: 'mouth_o', u: 'mouth_o' });
});
