import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('bundled Pretendard files retain official bytes and contain the declared native font weights', async () => {
  const base = new URL('../assets/fonts/pretendard/', import.meta.url);
  const provenance = JSON.parse(await readFile(new URL('source.json',base),'utf8'));
  const expected = {Regular:400,Medium:500,SemiBold:600,Bold:700};
  for(const item of provenance.files){
    const bytes=await readFile(new URL(item.file,base));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
    assert.match(item.url,/^https:\/\/raw\.githubusercontent\.com\/orioncactus\/pretendard\/v1\.3\.9\//);
    if(!item.file.endsWith('.otf'))continue;
    assert.equal(bytes.toString('ascii',0,4),'OTTO');
    let os2;
    for(let i=0;i<bytes.readUInt16BE(4);i++){
      const entry=12+i*16;
      if(bytes.toString('ascii',entry,entry+4)==='OS/2')os2=bytes.readUInt32BE(entry+8);
    }
    assert.notEqual(os2,undefined);
    const face=item.file.replace('Pretendard-','').replace('.otf','');
    assert.equal(bytes.readUInt16BE(os2+4),expected[face],face);
  }
  const license=await readFile(new URL('OFL.txt',base),'utf8');
  assert.match(license,/Copyright \(c\) 2021, Kil Hyung-jin/);
  assert.match(license,/SIL OPEN FONT LICENSE Version 1\.1/);
});
