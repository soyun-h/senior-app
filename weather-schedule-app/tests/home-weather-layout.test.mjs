import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// 날씨 안내와 하단 내비게이션은 허소윤/members의 구성을 그대로 쓴다.
test('home keeps the shared weather message and bottom navigation', () => {
  const home = read('src/screens/HomeScreen.tsx');
  assert.match(home, /<WeatherMessage weather=\{weather\} notice=\{notice\}\/>/);
  assert.match(home, /<BottomNavigation activeTab="home"\/>/);
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

test('the character shows the situation pose while speaking and can replay the line', () => {
  const home = read('src/screens/HomeScreen.tsx');
  assert.match(home, /<DialogueAvatar key=\{`\$\{character\.id\}:\$\{situation\}`\} character=\{character\} situation=\{situation\} pose=\{pose\}\/>/);

  const avatar = read('src/components/home/DialogueAvatar.tsx');
  assert.match(avatar, /useHomeDialogueAudio\(characterVoices\[character\.id\]\[situation\]\)/);
  assert.match(avatar, /onPress=\{replay\}/);

  const view = read('src/components/home/AvatarView.tsx');
  assert.match(view, /pose !== 'idle' && phase !== 'done'/, '대사가 끝나면 기본 자세로 돌아가야 합니다');
  assert.match(view, /useReducedMotion\(\)/);
  assert.match(view, /if \(reduced === null\) return;/, '동작 줄이기 설정을 확인하기 전에는 움직이면 안 됩니다');
});
