import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// 날씨 안내 영역은 날씨 담당 브랜치의 구성을 그대로 쓴다.
// 캐릭터 작업에서 이 조건이 깨지면 테스트가 실패한다.
test('home screen keeps the shared weather message layout', () => {
  const home = read('src/screens/HomeScreen.tsx');
  assert.match(home, /<WeatherMessage weather=\{weather\} notice=\{notice\}\/>/);
  assert.match(home, /<HomeText style=\{styles\.credit\}>\{credit\}<\/HomeText>/);
  assert.doesNotMatch(home, /features\/weather\/presentation/, 'HomeScreen이 날씨 문구를 직접 만들면 안 됩니다');

  const message = read('src/components/home/WeatherMessage.tsx');
  assert.match(message, /panel: \{ position: 'absolute', bottom: 90,/);
});

test('character dialogue sits above the weather message instead of on top of it', () => {
  const dialogue = read('src/components/home/CharacterDialogue.tsx');
  const bottom = Number(dialogue.match(/panel: \{ position: 'absolute', bottom: (\d+),/)?.[1]);
  assert.ok(bottom >= 90 + 85, `대사창 bottom(${bottom})이 날씨 안내(bottom 90, 높이 85)와 겹칩니다`);
});
