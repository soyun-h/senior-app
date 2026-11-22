import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const characters = ['char1', 'char2', 'char3', 'char4', 'char5'];
const videoFiles = ['greeting', 'night', 'schedule_pending', 'schedule_complete', 'rain', 'snow', 'thunder'].map(name => `${name}.mp4`);

const folderOf = id => new URL(`../assets/characters/${id}/dialogue/`, import.meta.url);
const filesOf = id => readdirSync(folderOf(id)).filter(name => !name.startsWith('.'));

test('every character has a dialogue folder holding only video file names the app looks for', () => {
  for (const id of characters) {
    const unknown = filesOf(id).filter(name => !videoFiles.includes(name));
    assert.deepEqual(unknown, [], `${id}: 인식되지 않는 파일명입니다. README의 에셋 규격을 확인하세요.`);
  }
});

test('dialogue videos are MP4 containers', () => {
  for (const id of characters) {
    for (const name of filesOf(id).filter(file => videoFiles.includes(file))) {
      const bytes = readFileSync(new URL(name, folderOf(id)));
      assert.equal(bytes.subarray(4, 8).toString('latin1'), 'ftyp', `${id}/${name}: MP4 파일이 아닙니다`);
    }
  }
});
