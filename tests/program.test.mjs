import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../date-engine.js';
import { PROGRAM, phaseFor, reductionFor, nutritionFor, workoutFor, planFor } from '../program.js';

test('AT-05–11: every weekday has the prescribed workout and raw rice split', () => {
  const expected = [[1,'strength',200,100],[2,'zone2',170,85],[3,'strength',200,100],[4,'recovery',140,70],[5,'strength',200,100],[6,'zone2',170,85],[0,'recovery',140,70]];
  for (const [day,kind,total,half] of expected) {
    assert.equal(workoutFor(day,1).kind,kind);
    const n=nutritionFor(day); assert.equal(n.totalRice,total); assert.equal(n.lunch.rice,half); assert.equal(n.dinner.rice,half);
  }
  assert.equal(workoutFor(1,1).english,'Strength A');
  assert.equal(workoutFor(3,1).english,'Strength B');
  assert.equal(workoutFor(5,1).english,'Strength C');
});
test('AT-12–14: exact breakfast and raw protein amounts across all days', () => {
  for (let day=0;day<7;day++) {
    const n=nutritionFor(day);
    assert.deepEqual(n.breakfast.map(x => [x.id,x.amount,x.unit]),[['eggs',3,'个'],['oats',60,'g'],['milk',250,'ml']]);
    assert.equal(n.lunch.amount,400); assert.equal(n.lunch.label,'生鸡胸肉');
    assert.equal(n.dinner.amount,220); assert.equal(n.dinner.label,'生去皮去骨鸡腿肉');
    assert.equal(n.lunch.raw,true); assert.equal(n.dinner.raw,true);
  }
});
test('AT-10: all Saturday phase boundaries, optional MRT never auto-selected', () => {
  for (let week=1;week<=20;week++) {
    const normal = workoutFor(6,week);
    const selected = workoutFor(6,week,'mrt');
    if (week>=5 && week<=16) {
      assert.equal(normal.kind,'zone2'); assert.equal(selected.kind,'mrt'); assert.equal(selected.duration,'10–15 分钟');
    } else if (week<20) {
      assert.equal(selected.kind,'zone2'); assert.equal(normal.kind,'zone2');
      if (week===19) assert.equal(selected.duration,'20–30 分钟');
    } else assert.equal(selected.kind,'assessment');
  }
});
test('Deadlift is never transformed into MRT in any active training week', () => {
  for (let w=1;w<=19;w++) {
    const workout=workoutFor(3,w,'mrt');
    assert.equal(workout.kind,'strength');
    assert.equal(workout.exercises[0].id,'deadlift');
    assert.equal(workout.exercises[0].prescription,'3 × 3–5');
  }
});
test('Phase, reduced-volume and assessment boundaries are explicit', () => {
  for (const [w,id] of [[1,'foundation'],[4,'foundation'],[5,'accumulation'],[8,'accumulation'],[9,'build'],[12,'build'],[13,'intensification'],[16,'intensification'],[17,'consolidation'],[20,'consolidation']]) assert.equal(phaseFor(w).id,id);
  for (const w of [4,8,12,16,19]) assert.ok(reductionFor(w));
  for (const w of [1,3,5,7,9,11,13,15,17,18,20]) assert.equal(reductionFor(w),null);
  assert.equal(phaseFor(21),null);
  assert.equal(reductionFor(19).title,'本周总训练量减少约 40%');
});
test('Optional top/back-off progression is not forced; W13 heavier main lifts use 4–6', () => {
  assert.equal(workoutFor(1,9).exercises[0].prescription,'3 × 5–8');
  assert.equal(workoutFor(1,13).exercises[0].prescription,'3 × 4–6');
  assert.equal(workoutFor(1,13).exercises[1].prescription,'3 × 4–6');
  assert.equal(workoutFor(5,13).exercises[0].prescription,'3 × 6–10');
});
test('Program data does not mutate while deriving any of 140 daily plans', () => {
  const before=JSON.stringify(PROGRAM);
  for(let i=0;i<140;i++) planFor('2026-09-14',addDays('2026-09-14',i),{});
  assert.equal(JSON.stringify(PROGRAM),before);
});
test('No automatic rice substitution after W9; no shrimp; no invented milk macros', () => {
  for(let i=0;i<140;i++) {
    const p=planFor('2026-09-14',addDays('2026-09-14',i));
    assert.ok([140,170,200].includes(p.nutrition.totalRice));
    assert.equal(p.nutrition.lunch.amount,400); assert.equal(p.nutrition.dinner.amount,220);
  }
  assert.equal(PROGRAM.nutrition.carbohydrateSource,'rice');
  assert.equal(PROGRAM.nutrition.breakfast[2].macroMetadata,null);
  assert.equal(PROGRAM.extensions.carbSubstitution,false);
  assert.deepEqual(PROGRAM.nutrition.futureProteinAlternatives,[]);
});
test('Upcoming is labelled preview; complete has no new prescription', () => {
  assert.equal(planFor('2026-09-14','2026-09-13').cycle.status,'upcoming');
  assert.equal(planFor('2026-09-14','2027-02-01').cycle.status,'complete');
  assert.equal(planFor('2026-09-14','2027-02-01').workout,null);
});
test('MRT is stored per date and remains ineffective outside allowed phases', () => {
  const settings={conditioningChoices:{'2026-10-17':'mrt','2026-09-19':'mrt'}};
  assert.equal(planFor('2026-09-14','2026-10-17',settings).workout.kind,'mrt');
  assert.equal(planFor('2026-09-14','2026-09-19',settings).workout.kind,'zone2');
});
test('Minimum Mode remains an unexposed, disabled extension', () => assert.equal(PROGRAM.extensions.minimumMode.enabled,false));
