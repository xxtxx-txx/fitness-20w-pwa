/** Tests our SW event logic with a Cache Storage double; NOT a browser offline certification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const scope='https://example.test/fitness/';
function harness({failInstall=false}={}) {
  const events={},stores=new Map(),stats={skip:0,claimed:0,fetches:0,addAll:[],deleted:[]};
  const cacheFor = key => {
    if(!stores.has(key))stores.set(key,new Map());
    const entries=stores.get(key);
    return {
      addAll:async requests=>{stats.addAll.push(requests);if(failInstall)throw new Error('precache failed');for(const r of requests)entries.set(r.url,new Response(`cached:${r.url}`));},
      match:async req=>entries.get(typeof req==='string'?req:req.url)?.clone(),
    };
  };
  const caches={open:async key=>cacheFor(key),keys:async()=>[...stores.keys()],delete:async key=>{stats.deleted.push(key);return stores.delete(key);}};
  const self={registration:{scope},location:{origin:'https://example.test'},clients:{claim:async()=>{stats.claimed++;}},skipWaiting:()=>{stats.skip++;},addEventListener:(name,fn)=>{events[name]=fn;}};
  vm.runInNewContext(source,{self,caches,URL,Request,Response,Set,Promise,fetch:async()=>{stats.fetches++;return new Response('network');}});
  return {events,stats,stores,caches,dispatch:async name=>{let job;events[name]({waitUntil:p=>{job=p;}});await job;},fetchEvent:async request=>{let result;events.fetch({request,respondWith:p=>{result=p;}});return result?await result:undefined;}};
}
test('SW harness: one atomic precache request includes every critical asset',async()=>{
 const h=harness();await h.dispatch('install');assert.equal(h.stats.addAll.length,1);assert.equal(h.stats.addAll[0].length,11);
 assert.ok(h.stats.addAll[0].every(r=>r.url.startsWith(scope)));assert.equal(h.stats.skip,0);
});
test('SW harness: navigation returns the cached app shell without fetching',async()=>{
 const h=harness();await h.dispatch('install');
 for(const url of [scope,scope+'index.html',scope+'?from=launcher']) {
  const r=await h.fetchEvent({url,method:'GET',mode:'navigate'});assert.match(await r.text(),/cached:.*index.html$/);
 }
 assert.equal(h.stats.fetches,0);
});
test('SW harness: static modules and icons are served from this release cache',async()=>{
 const h=harness();await h.dispatch('install');
 for(const name of ['app.js','program.js','state.js','date-engine.js','styles.css','manifest.webmanifest','icons/icon-192.png']) {
  const r=await h.fetchEvent({url:scope+name,method:'GET',mode:'cors'});assert.ok(r);assert.match(await r.text(),/^cached:/);
 }
 assert.equal(h.stats.fetches,0);
});
test('SW harness: other origins, other scopes and non-GET requests are untouched',async()=>{
 const h=harness();await h.dispatch('install');
 for(const request of [{url:'https://other.test/fitness/app.js',method:'GET',mode:'cors'},{url:'https://example.test/other/app.js',method:'GET',mode:'cors'},{url:scope+'app.js',method:'POST',mode:'cors'}]) assert.equal(await h.fetchEvent(request),undefined);
});
test('SW harness: activation deletes only old caches belonging to this exact scope',async()=>{
 const h=harness();await h.dispatch('install');
 h.stores.set(`fitness-20w:${scope}:old`,new Map());h.stores.set('foreign-app-cache',new Map());h.stores.set('fitness-20w:https://example.test/another/:0.1.0',new Map());
 await h.dispatch('activate');assert.deepEqual(h.stats.deleted,[`fitness-20w:${scope}:old`]);assert.ok(h.stores.has('foreign-app-cache'));assert.equal(h.stats.claimed,1);
});
test('SW harness: update activation requires the explicit message',()=>{
 const h=harness();h.events.message({data:{type:'UNKNOWN'}});assert.equal(h.stats.skip,0);
 h.events.message({data:{type:'SKIP_WAITING'}});assert.equal(h.stats.skip,1);
});
test('SW harness: failed precache propagates rejection and never activates itself',async()=>{
 const h=harness({failInstall:true});await assert.rejects(h.dispatch('install'),/precache failed/);assert.equal(h.stats.skip,0);assert.equal(h.stats.claimed,0);
});
