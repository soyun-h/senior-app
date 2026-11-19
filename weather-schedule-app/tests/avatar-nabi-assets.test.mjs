import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const folder = new URL('../assets/characters/char1/dialogue/', import.meta.url);
const outlines = JSON.parse(readFileSync(new URL('../src/features/avatar/characterOutlines.json', import.meta.url), 'utf8'));
const { width, height } = outlines.char1_idle;
const mouthFiles = ['a', 'e', 'i', 'o', 'u'].map(vowel => `mouth_${vowel}.png`);
const videoFiles = ['greeting', 'night', 'schedule_pending', 'schedule_complete', 'rain', 'snow', 'thunder'].map(name => `${name}.mp4`);
const files = readdirSync(folder).filter(name => !name.startsWith('.'));

function pngHeader(name) {
  const bytes = readFileSync(new URL(name, folder));
  assert.ok(bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${name}: PNG 파일이 아닙니다`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

test('Navi dialogue folder holds only file names the app looks for', () => {
  const unknown = files.filter(name => !mouthFiles.includes(name) && !videoFiles.includes(name));
  assert.deepEqual(unknown, [], '인식되지 않는 파일명입니다. README의 에셋 규격을 확인하세요.');
});

test('Navi mouth PNGs match the idle frame size and carry transparency', () => {
  for (const name of files.filter(file => mouthFiles.includes(file))) {
    const header = pngHeader(name);
    assert.deepEqual([header.width, header.height], [width, height], `${name}: ${width}x${height}이어야 합니다`);
    assert.equal(header.colorType, 6, `${name}: 투명 채널이 있는 RGBA PNG여야 합니다`);
  }
});

test('Navi dialogue videos are MP4 containers', () => {
  for (const name of files.filter(file => videoFiles.includes(file))) {
    const bytes = readFileSync(new URL(name, folder));
    assert.equal(bytes.subarray(4, 8).toString('latin1'), 'ftyp', `${name}: MP4 파일이 아닙니다`);
  }
});
