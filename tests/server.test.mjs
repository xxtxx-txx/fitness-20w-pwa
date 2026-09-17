import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
async function withServer(prefix,fn) {
 const child=spawn(process.execPath,[fileURLToPath(new URL('../tools/serve.mjs',import.meta.url)),'--port','0','--base',prefix],{stdio:['ignore','pipe','pipe']});
 try {
  const [chunk]=await once(child.stdout,'data');
  const url=chunk.toString().match(/http:\/\/\S+/)?.[0];assert.ok(url);
  await fn(url);
 } finally {child.kill();await once(child,'exit');}
}
test('Static server: root HTML, module MIME and manifest respond correctly',async()=>{
 await withServer('/',async url=>{
  const r=await fetch(url);assert.equal(r.status,200);assert.match(await r.text(),/type="module"/);
  const js=await fetch(new URL('app.js',url));assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);
  const m=await fetch(new URL('manifest.webmanifest',url));assert.equal(m.status,200);assert.equal((await m.json()).scope,'./');
 });
});
test('Static server: repository sub-path serves all app-shell files and icons',async()=>{
 await withServer('/fitness/',async url=>{
  for(const asset of ['','index.html','app.js','date-engine.js','program.js','state.js','styles.css','sw.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png']) assert.equal((await fetch(new URL(asset,url))).status,200,asset);
  assert.equal((await fetch(new URL('../wrong/',url))).status,404);
 });
});
