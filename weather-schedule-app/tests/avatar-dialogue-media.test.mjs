import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveDialogueMedia } from '../src/features/avatar/dialogueMedia.ts';
import { estimateFiveVowelCues, mouthAt, vowelMouth } from '../src/features/avatar/visemes.ts';

function localAssets(entries = {}) {
  return Object.assign(path => {
    assert.ok(Object.hasOwn(entries, path), path);
    return entries[path];
  }, { keys: () => Object.keys(entries) });
}

test('optional dialogue assets can be absent or incomplete without interfering with dialogue playback', () => {
  assert.deepEqual(resolveDialogueMedia('greeting', localAssets()), { mouthFrames: undefined, video: undefined });
  assert.deepEqual(resolveDialogueMedia('greeting', localAssets({ './mouth_a.png': 1 })), {
    mouthFrames: undefined, video: undefined,
  });
});

test('three vowels activate the PNG set without requiring or loading e and u', () => {
  const files = localAssets({
    './mouth_a.png': 1, './mouth_e.png': 2, './mouth_i.png': 3, './mouth_o.png': 4, './mouth_u.png': 5,
    './greeting.mp4': 6, './schedule_pending.mp4': 7,
  });
  assert.deepEqual(resolveDialogueMedia('greeting', files), {
    mouthFrames: { a: 1, i: 3, o: 4 }, video: 6,
  });
  assert.deepEqual(resolveDialogueMedia('greeting', localAssets({ './mouth_a.png': 1, './mouth_i.png': 3, './mouth_o.png': 4 })).mouthFrames, { a: 1, i: 3, o: 4 });
  assert.equal(resolveDialogueMedia('schedulePending', files).video, 7);
  assert.equal(resolveDialogueMedia('rain', files).video, undefined);
});

test('estimated cue timing folds e into i and u into o, and closes the mouth at the end', () => {
  assert.deepEqual(Array.from('아에이오우', vowelMouth), ['a', 'i', 'i', 'o', 'o']);
  const cues = estimateFiveVowelCues('아에이오우.', 3);
  assert.equal(mouthAt(cues, 0), 'rest');
  assert.deepEqual(cues.filter(cue => cue.mouth !== 'rest').map(cue => cue.mouth), ['a', 'i', 'o']);
  assert.equal(mouthAt(cues, 3), 'rest');
  assert.deepEqual(estimateFiveVowelCues('', 0), [{ t: 0, mouth: 'rest' }]);
});
