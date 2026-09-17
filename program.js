import { cycleFor, weekday } from './date-engine.js';

export const APP_VERSION = '0.1.0';
export const BASELINE_VERSION = 'AWC-Fitness-20W-v0.1';
const ex = (id, name, prescription, detail = '') => ({ id, name, prescription, detail });
export const PROGRAM = {
  baselineWeightKg: 96.5,
  totalWeeks: 20,
  weekdays: {
    1: { type: 'strength', workout: 'A', rice: 200 },
    2: { type: 'conditioning', workout: 'zone2', rice: 170 },
    3: { type: 'strength', workout: 'B', rice: 200 },
    4: { type: 'recovery', workout: 'recovery', rice: 140 },
    5: { type: 'strength', workout: 'C', rice: 200 },
    6: { type: 'conditioning', workout: 'saturday', rice: 170 },
    0: { type: 'recovery', workout: 'rest', rice: 140 },
  },
  phases: [
    { id: 'foundation', from: 1, to: 4, name: '基础建立', english: 'Foundation', note: '稳定动作、建立工作重量，先把习惯练起来。主项初期保留约 3 次余力。' },
    { id: 'accumulation', from: 5, to: 8, name: '训练积累', english: 'Accumulation', note: '以增肌和训练量积累为重点；恢复良好时，周六可选择 MRT。程序不自动加组。' },
    { id: 'build', from: 9, to: 12, name: '能力进阶', english: 'Build', note: '主项可逐步采用 1 组 Top Set + 2 组 Back-off。不强制切换；未确定重量前保留原处方，无需测 1RM。' },
    { id: 'intensification', from: 13, to: 16, name: '强度提升', english: 'Intensification', note: '深蹲 / 卧推较重工作组侧重 4–6 次；硬拉 3–5 次，通常保留 1–2 次余力。' },
    { id: 'consolidation', from: 17, to: 20, name: '巩固与评估', english: 'Consolidation', note: '第 17–18 周正常进阶，可尝试次数纪录；第 19 周减量，第 20 周评估与恢复。不要求真实 1RM。' },
  ],
  workouts: {
    A: { name: '力量 A', english: 'Strength A', duration: '60–75 分钟', focus: '深蹲 · 卧推', exercises: [
      ex('squat', '杠铃后蹲', '3 × 5–8', '保留 2–3 次余力（RIR）；组间休息 2.5–4 分钟。'),
      ex('bench', '杠铃卧推', '3 × 5–8', '保留 2–3 次余力（RIR）；组间休息 2.5–3 分钟。'),
      ex('pull-assist', '辅助引体 / 高位下拉', '3 × 6–10'),
      ex('chest-row', '胸托划船', '3 × 8–12'),
      ex('lunge', '反向箭步蹲', '2 × 8–12 / 侧'),
      ex('lateral', '侧平举', '3 × 12–20'),
    ] },
    B: { name: '力量 B', english: 'Strength B', duration: '60–75 分钟', focus: '硬拉 · 引体', exercises: [
      ex('deadlift', '硬拉', '3 × 3–5', '保留约 2 次余力（RIR）；组间休息 3–4 分钟。硬拉不能改成 MRT。'),
      ex('pull-progression', '引体进阶', '3–4 组', '按当前能力阶段执行。进阶路线见下方说明，不自动升级。'),
      ex('press', '肩上推举', '3 × 6–10'),
      ex('seated-row', '坐姿划船', '2–3 × 8–12'),
      ex('leg-curl', '腿弯举', '3 × 10–15'),
      ex('carry', '农夫走', '3 × 30–40 m'),
    ] },
    C: { name: '力量 C', english: 'Strength C', duration: '60–75 分钟', focus: '增肌 · 体态', exercises: [
      ex('bench-volume', '容量卧推 / 器械推胸', '3 × 6–10'),
      ex('leg-press', '腿举 / 前蹲', '3 × 8–12'),
      ex('pull-progression', '引体进阶', '3 组', '按当前能力阶段执行，不自动升级。'),
      ex('rdl', '罗马尼亚硬拉', '2 × 8–10'),
      ex('lateral', '侧平举', '3 × 12–20'),
      ex('biceps', '肱二头肌', '2 × 10–15'),
      ex('triceps', '肱三头肌', '2 × 10–15'),
    ] },
  },
  nutrition: {
    breakfast: [
      { id: 'eggs', label: '鸡蛋', amount: 3, unit: '个' },
      { id: 'oats', label: '燕麦', amount: 60, unit: 'g', raw: true },
      { id: 'milk', label: '牛奶', amount: 250, unit: 'ml', macroMetadata: null },
    ],
    lunchProtein: { label: '生鸡胸肉', amount: 400, unit: 'g', raw: true },
    dinnerProtein: { label: '生去皮去骨鸡腿肉', amount: 220, unit: 'g', raw: true },
    vegetablesDaily: '400–600 g',
    carbohydrateSource: 'rice',
    futureProteinAlternatives: [],
  },
  pullUpProgression: ['高位下拉', '辅助引体', '肩胛引体 / 悬挂', '离心引体', '单次自重引体', '多次自重引体'],
  extensions: {
    minimumMode: { enabled: false, A: ['squat', 'bench', 'pull-up', 'row'], B: ['deadlift', 'press', 'pull-up', 'leg-press'] },
    automaticProgression: false, carbSubstitution: false, proteinSubstitution: false,
  },
};

export function phaseFor(week) { return PROGRAM.phases.find(p => week >= p.from && week <= p.to) || null; }
export function reductionFor(week) {
  if (week === 19) return { title: '本周总训练量减少约 40%', detail: '本周是减量周。下列组数为常规处方参考，不是本周必须完成的目标；AWC 没有指定逐动作减量组数，本版不擅自分配。不要补课。' };
  if ([4, 8, 12, 16].includes(week)) return { title: `第 ${week} 周 · 恢复 / 减量周`, detail: `减少本周训练量${week === 12 ? '并复盘' : '，优先恢复'}。下列组数为常规处方参考，不是本周必须完成的目标；AWC 未指定具体减量组数，本版不自动生成。` };
  return null;
}
export function nutritionFor(day) {
  const totalRice = PROGRAM.weekdays[day].rice;
  return { breakfast: PROGRAM.nutrition.breakfast, lunch: { ...PROGRAM.nutrition.lunchProtein, rice: totalRice / 2 }, dinner: { ...PROGRAM.nutrition.dinnerProtein, rice: totalRice / 2 }, totalRice, vegetables: PROGRAM.nutrition.vegetablesDaily };
}
export function workoutFor(day, week, conditioningChoice = 'zone2') {
  const spec = PROGRAM.weekdays[day];
  if (week === 20) return {
    kind: 'assessment', name: '评估与恢复', english: 'Assessment', duration: '不要求 1RM', focus: '看见这 20 周的变化',
    items: ['照片与身体形态', '体重趋势、腰围', '深蹲、卧推、硬拉表现', '引体能力、心肺表现'],
    note: '按恢复情况完成评估，不必在一天做完。以表现和身体变化复盘，不把 13% 体脂当作本周期硬指标。',
  };
  if (['A', 'B', 'C'].includes(spec.workout)) {
    const source = PROGRAM.workouts[spec.workout];
    const exercises = source.exercises.map(e => {
      const result = { ...e };
      if (['squat', 'bench', 'deadlift'].includes(e.id) && week <= 3) result.detail = e.detail.replace(/保留(?:约 2| 2–3) 次余力（RIR）/, '基础期初期保留约 3 次余力（RIR）');
      if (week >= 13 && week <= 16 && ['squat', 'bench', 'deadlift'].includes(e.id)) {
        if (e.id !== 'deadlift') result.prescription = '3 × 4–6';
        result.detail = e.detail.replace(/保留(?:约 2| 2–3) 次余力（RIR）/, '本阶段较重工作组通常保留 1–2 次余力（RIR）') + ' 第 16 周优先减量恢复。';
      }
      return result;
    });
    return { ...source, kind: 'strength', exercises };
  }
  if (spec.workout === 'recovery' || spec.workout === 'rest') return {
    kind: 'recovery', name: spec.workout === 'rest' ? '完全恢复' : '恢复日', english: 'Recovery', duration: '不补课', focus: '今天不安排力量训练',
    items: spec.workout === 'rest' ? ['正常日常活动', '不补练、不追加训练', '可提前准备下周食物'] : ['正常走路', '可选 5–10 分钟活动度练习', '优先恢复和睡眠'],
  };
  const canChoose = day === 6 && week >= 5 && week <= 16;
  if (canChoose && conditioningChoice === 'mrt') return {
    kind: 'mrt', name: 'MRT 循环训练', english: 'Conditioning', duration: '10–15 分钟', focus: '2–3 轮 · 不包含硬拉', canChoose,
    items: ['器械推胸', '绳索 / 坐姿划船', '登阶', '农夫走', '核心 / Pallof 抗旋转推'],
    note: '动作间休息 20–30 秒；轮间休息约 90 秒。不要额外补练。',
  };
  return { kind: 'zone2', name: day === 6 && week === 19 ? '轻量 Zone 2' : 'Zone 2 有氧', english: 'Conditioning', duration: day === 6 && week === 19 ? '20–30 分钟' : '30–40 分钟', focus: '坡度走 · 自行车 · 椭圆机', canChoose,
    note: '能正常说完整句子，但不会觉得特别轻松。不追加补偿性训练。',
    extra: day === 6 && [17, 18].includes(week) ? '本阶段保持正常 Zone 2 / 轻体能训练。' : '',
  };
}
export function planFor(startDate, date, settings = {}) {
  const cycle = cycleFor(startDate, date);
  const day = weekday(date);
  const week = cycle.week;
  return {
    date, weekday: day, cycle, phase: phaseFor(week), reduction: reductionFor(week),
    nutrition: nutritionFor(day),
    workout: cycle.status === 'complete' ? null : workoutFor(day, week || 1, settings.conditioningChoices?.[date]),
    riceNote: week >= 9 ? '米饭仍是默认主食。以后可按偏好选择土豆 / 红薯，不因周次自动替换；本版不做替换换算。' : '',
  };
}
