import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const base = new URL('../', import.meta.url);
test('rendered schedule icons and button surfaces use the exact on-disk source XML', async () => {
  const code = await readFile(new URL('src/components/schedule/ScheduleAsset.tsx', base), 'utf8');
  const source = JSON.parse(code.match(/const source = (.+) as const;/)[1]);
  for (const [name, folder] of [
    ['fold','icons'], ['open','icons'], ['month-left','icons'], ['month-right','icons'],
    ['trash','icons'], ['small-calendar','icons'], ['back','icons'], ['bell','icons'],
    ['edit','icons'], ['check','icons'], ['plus','icons'], ['cancel-button','decoration'],
    ['delete-button','decoration'], ['register-button','decoration'], ['toggle-on','decoration'], ['toggle-off','decoration'],
  ]) assert.equal(source[name], await readFile(new URL(`assets/schedule/${folder}/${name}.svg`, base), 'utf8'), name);
  assert.equal(source.alarm, await readFile(new URL('assets/design/refinement/icons/to do icon.svg', base), 'utf8'));
});
