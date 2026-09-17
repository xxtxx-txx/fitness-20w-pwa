import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, defaultState, parseBackup, validateState } from '../state.js';
const valid = () => defaultState('2026-09-14');
const memory = () => { const entries=new Map(); return {getItem:k=>entries.get(k) ?? null,setItem:(k,v)=>entries.set(k,v)}; };
test('AT-16: config and completion persist across store instances', () => {
  const storage=memory(); const first=createStore(storage,'test'); assert.equal(first.load().kind,'empty');
  first.save(valid()); first.change(s=>{s.completedDays['2026-09-14']={completedAt:'2026-09-14T10:00:00.000Z'};return s;});
  const next=createStore(storage,'test'); assert.equal(next.load().kind,'ok'); assert.ok(next.load().state.completedDays['2026-09-14']);
});
test('Backup round-trip retains schema, config, completion and future JSON user data', () => {
  const s=valid(); s.completedDays['2026-09-14']=true; s.userData={future:{waist:[{date:'2026-09-14',value:91}]}};
  assert.deepEqual(parseBackup(JSON.stringify(s)),s);
});
test('Malformed, wrong-schema and bad dates are rejected', () => {
  for (const text of ['not json','null','[]','{}','{"schemaVersion":2}']) assert.throws(()=>parseBackup(text));
  const s=valid();s.programStartDate='2026-02-30';assert.throws(()=>validateState(s));
});
test('Unknown top-level controls, dangerous keys and malformed completions are rejected', () => {
  const s=valid(); s.backendURL='https://example.org';assert.throws(()=>validateState(s));
  const t=valid(); t.completedDays={'2026-09-14':false};assert.throws(()=>validateState(t));
  const raw=JSON.stringify(valid()).replace('"settings":{','"settings":{"__proto__":{},');assert.throws(()=>parseBackup(raw));
});
test('Invalid weights and incompatible carb settings are rejected', () => {
  for(const w of [0,-1,NaN,Infinity,'96.5']) {const s=valid();s.baselineWeightKg=w;assert.throws(()=>validateState(s));}
  const s=valid();s.settings.carbohydrateSource='potato';assert.throws(()=>validateState(s));
});
test('Oversized import is rejected without writing anything', () => assert.throws(()=>parseBackup('x'.repeat(1_000_001))));
test('Failed write is not reported as saved; original state survives', () => {
  let existing=JSON.stringify(valid());
  const storage={getItem:()=>existing,setItem:()=>{throw new Error('quota');}};
  const store=createStore(storage,'test');assert.throws(()=>store.change(s=>{s.baselineWeightKg=90;return s;}));assert.equal(store.load().state.baselineWeightKg,96.5);
});
test('Corrupt existing storage is preserved and does not silently become fresh setup', () => {
  const storage=memory();storage.setItem('test','broken');const store=createStore(storage,'test');
  assert.equal(store.load().kind,'error');assert.equal(store.raw(),'broken');assert.throws(()=>store.change(s=>s));
});
test('Reset completion and start-date edits do not mutate unrelated data', () => {
  const storage=memory(),store=createStore(storage,'test');const s=valid();s.completedDays['2026-09-14']=true;store.save(s);
  store.change(t=>{t.programStartDate='2026-09-16';return t;});assert.ok(store.load().state.completedDays['2026-09-14']);
  store.change(t=>{t.completedDays={};return t;});assert.equal(store.load().state.programStartDate,'2026-09-16');assert.equal(store.load().state.baselineWeightKg,96.5);
});
test('Empty settings baseline from AWC is accepted and normalized', () => {
  const s=valid();s.settings={};delete s.userData;const normalized=validateState(s);
  assert.equal(normalized.settings.carbohydrateSource,'rice');assert.deepEqual(normalized.settings.conditioningChoices,{});
});
test('Invalid or object-valued MRT choices are rejected', () => {
  const s=valid();s.settings.conditioningChoices['2026-09-19']={x:1};assert.throws(()=>validateState(s));
});
