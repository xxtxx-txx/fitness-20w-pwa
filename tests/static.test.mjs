import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('AT-01/02 prerequisites: manifest fields, relative scope and valid PNG dimensions', () => {
 const m=JSON.parse(read('manifest.webmanifest'));
 for(const k of ['name','short_name','start_url','scope','display','theme_color','background_color','icons']) assert.ok(m[k]);
 assert.equal(m.display,'standalone');assert.equal(m.scope,'./');assert.equal(m.start_url,'./');
 for(const size of [192,512]) assert.ok(m.icons.find(i=>i.sizes===`${size}x${size}`));
 assert.ok(m.icons.find(i=>i.purpose==='maskable'));
 for(const i of m.icons) {
  const b=readFileSync(new URL('../'+i.src,import.meta.url));const [w,h]=i.sizes.split('x').map(Number);
  assert.equal(b.readUInt32BE(16),w);assert.equal(b.readUInt32BE(20),h);
 }
});
test('AT-17: application assets do not load external services or CDN dependencies', () => {
 for(const file of ['index.html','app.js','date-engine.js','program.js','state.js','styles.css','sw.js']) {
  assert.doesNotMatch(read(file),/https?:\/\//);
  assert.doesNotMatch(read(file),/firebase|supabase|openai\.com/i);
 }
 assert.match(read('index.html'),/content="default-src 'self'/);
});
test('Sub-path safe static asset and manifest references', () => {
 assert.doesNotMatch(read('index.html'),/(src|href)="\//);
 assert.match(read('app.js'),/new URL\('\.\/', import.meta.url\)/);
 assert.match(read('sw.js'),/self.registration.scope/);
});
test('Release cache is versioned, scope-isolated and install is atomic', () => {
 const sw=read('sw.js');assert.match(sw,/RELEASE = '0.1.0'/);assert.match(sw,/cache.addAll/);assert.match(sw,/key.startsWith\(PREFIX\)/);
 for (const file of ['index.html','app.js','program.js','date-engine.js','state.js','styles.css','manifest.webmanifest']) assert.ok(sw.includes(file));
});
