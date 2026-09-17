import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { isDateKey, dayNumber, addDays, weekday, mondayOf, cycleFor, localDateKey } from '../date-engine.js';

const start = '2026-09-14';
test('AT-04: day 1 / 7 / 8 / 133 / 134 / 140 are correctly assigned', () => {
  for (const [day, week] of [[1,1],[7,1],[8,2],[28,4],[29,5],[133,19],[134,20],[140,20]]) {
    const actual = cycleFor(start, addDays(start, day - 1));
    assert.equal(actual.day, day); assert.equal(actual.week, week); assert.equal(actual.status, 'active');
  }
});
test('AT-19: day 141 and later never become Week 1 or Week 21', () => {
  for (const day of [141,142,280,366,1000]) {
    const actual = cycleFor(start, addDays(start, day - 1));
    assert.equal(actual.status, 'complete'); assert.equal(actual.week, null);
  }
});
test('Before the start date is upcoming, not Week 0 or a negative week', () => {
  assert.deepEqual(cycleFor(start, '2026-09-10'), { status: 'upcoming', offset: -4, day: null, week: null, daysUntil: 4 });
});
test('A Wednesday start preserves real weekdays and seven-day program weeks', () => {
  assert.equal(weekday('2026-09-16'), 3);
  assert.equal(cycleFor('2026-09-16', '2026-09-21').week, 1);
  assert.equal(cycleFor('2026-09-16', '2026-09-23').week, 2);
  assert.equal(mondayOf('2026-09-16'), '2026-09-14');
  assert.equal(mondayOf('2026-09-20'), '2026-09-14');
});
test('Dates are validated, including leap days and malformed input', () => {
  for (const value of ['2024-02-29','2026-09-18','2000-02-29']) assert.equal(isDateKey(value), true);
  for (const value of ['2026-02-29','2026-02-31','1900-02-29','2026-13-01','26-09-18','2026-1-2',null,{},'2026-09-18T00:00:00Z','__proto__']) assert.equal(isDateKey(value), false);
  assert.throws(() => dayNumber('2026-02-30'));
});
test('Leap-day and year boundaries use civil days', () => {
  assert.equal(addDays('2024-02-28',1), '2024-02-29');
  assert.equal(addDays('2024-02-28',2), '2024-03-01');
  assert.equal(addDays('2026-12-31',1), '2027-01-01');
});
test('All 140 days are covered exactly once by Weeks 1–20', () => {
  const weeks = {};
  for (let i=0;i<140;i++) { const w = cycleFor(start, addDays(start,i)).week; weeks[w] = (weeks[w] || 0)+1; }
  assert.equal(Object.keys(weeks).length,20);
  assert.ok(Object.values(weeks).every(count => count === 7));
});
test('DST and UTC+8: week calculations do not shift with local clock length', () => {
  const engine = new URL('../date-engine.js', import.meta.url).href;
  for (const tz of ['Asia/Kuala_Lumpur','America/New_York','Europe/Berlin','Pacific/Auckland']) {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `import {cycleFor,localDateKey} from ${JSON.stringify(engine)};console.log(JSON.stringify([cycleFor('2026-03-06','2026-03-13').week,cycleFor('2026-10-30','2026-11-06').week,localDateKey(new Date(2026,8,18,0,10))]));`], { env: { ...process.env, TZ:tz }, encoding:'utf8' });
    assert.deepEqual(JSON.parse(output),[2,2,'2026-09-18']);
  }
});
test('AT-03: local date formatting uses the local calendar, not UTC slicing', () => {
  assert.equal(localDateKey(new Date(2026,8,18,0,1)), '2026-09-18');
});
