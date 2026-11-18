import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDialogueMedia, resolveNabiMedia } from '../src/features/avatar/nabiMedia.ts';
import { estimateFiveVowelCues, fiveVowelMouth, mouthAt, vowelMouth } from '../src/features/avatar/visemes.ts';

function localAssets(entries = {}) {
  return Object.assign(path => {
    assert.ok(Object.hasOwn(entries, path), path);
    return entries[path];
  }, { keys: () => Object.keys(entries) });
}

test('optional Navi assets can be absent or incomplete without interfering with dialogue playback', () => {
  assert.deepEqual(getDialogueMedia('char2', 'greeting'), {});
  assert.deepEqual(resolveNabiMedia('greeting', localAssets()), { mouthFrames: undefined, video: undefined });
  assert.deepEqual(resolveNabiMedia('greeting', localAssets({ './mouth_a.png': 1 })), {
    mouthFrames: undefined, video: undefined,
  });
});

test('all five registered images and only the video for the current line are selected', () => {
  const files = localAssets({
    './mouth_a.png': 1, './mouth_e.png': 2, './mouth_i.png': 3, './mouth_o.png': 4, './mouth_u.png': 5,
    './greeting.mp4': 6, './schedule_pending.mp4': 7,
  });
  assert.deepEqual(resolveNabiMedia('greeting', files), {
    mouthFrames: { a: 1, e: 2, i: 3, o: 4, u: 5 }, video: 6,
  });
  assert.equal(resolveNabiMedia('schedulePending', files).video, 7);
  assert.equal(resolveNabiMedia('rain', files).video, undefined);
});

test('five vowel cue timing covers the audio duration and closes the mouth on pauses and at the end', () => {
  assert.deepEqual(Array.from('아에이오우', fiveVowelMouth), ['a', 'e', 'i', 'o', 'u']);
  assert.deepEqual(Array.from('에우', vowelMouth), ['i', 'o']);
  const cues = estimateFiveVowelCues('아에이오우.', 3);
  assert.equal(mouthAt(cues, 0), 'rest');
  assert.deepEqual(cues.filter(cue => cue.mouth !== 'rest').map(cue => cue.mouth), ['a', 'e', 'i', 'o', 'u']);
  assert.equal(mouthAt(cues, 3), 'rest');
  assert.deepEqual(estimateFiveVowelCues('', 0), [{ t: 0, mouth: 'rest' }]);
});
