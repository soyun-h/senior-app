import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const characters = ['char1', 'char2', 'char3', 'char4', 'char5'];
const outlines = JSON.parse(readFileSync(new URL('../src/features/avatar/characterOutlines.json', import.meta.url), 'utf8'));
const mouthFiles = ['a', 'e', 'i', 'o', 'u'].map(vowel => `mouth_${vowel}.png`);
const videoFiles = ['greeting', 'night', 'schedule_pending', 'schedule_complete', 'rain', 'snow', 'thunder'].map(name => `${name}.mp4`);

const folderOf = id => new URL(`../assets/characters/${id}/dialogue/`, import.meta.url);
const filesOf = id => readdirSync(folderOf(id)).filter(name => !name.startsWith('.'));

function pngHeader(id, name) {
  const bytes = readFileSync(new URL(name, folderOf(id)));
  assert.ok(bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${id}/${name}: PNG 파일이 아닙니다`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

test('every character has a dialogue folder holding only file names the app looks for', () => {
  for (const id of characters) {
    const unknown = filesOf(id).filter(name => !mouthFiles.includes(name) && !videoFiles.includes(name));
    assert.deepEqual(unknown, [], `${id}: 인식되지 않는 파일명입니다. README의 에셋 규격을 확인하세요.`);
  }
});

test('mouth PNGs match each idle frame size and carry transparency', () => {
  for (const id of characters) {
    const { width, height } = outlines[`${id}_idle`];
    for (const name of filesOf(id).filter(file => mouthFiles.includes(file))) {
      const header = pngHeader(id, name);
      assert.deepEqual([header.width, header.height], [width, height], `${id}/${name}: ${width}x${height}이어야 합니다`);
      assert.equal(header.colorType, 6, `${id}/${name}: 투명 채널이 있는 RGBA PNG여야 합니다`);
    }
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
