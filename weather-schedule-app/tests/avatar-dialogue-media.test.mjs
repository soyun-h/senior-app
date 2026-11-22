import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveDialogueMedia } from '../src/features/avatar/dialogueMedia.ts';

function localAssets(entries = {}) {
  return Object.assign(path => {
    assert.ok(Object.hasOwn(entries, path), path);
    return entries[path];
  }, { keys: () => Object.keys(entries) });
}

test('dialogue video is optional', () => {
  assert.deepEqual(resolveDialogueMedia('greeting', localAssets()), { video: undefined });
});

test('each situation finds only its own video file', () => {
  const files = localAssets({ './greeting.mp4': 6, './schedule_pending.mp4': 7 });
  assert.equal(resolveDialogueMedia('greeting', files).video, 6);
  assert.equal(resolveDialogueMedia('schedulePending', files).video, 7);
  assert.equal(resolveDialogueMedia('rain', files).video, undefined);
});
