import { addDays, cycleFor, localDateKey, mondayOf, shortDate, weekday, WEEKDAY_LONG, WEEKDAY_NAMES } from './date-engine.js';
import { APP_VERSION, BASELINE_VERSION, PROGRAM, planFor } from './program.js';
import { createStore, defaultState, MAX_IMPORT_BYTES, parseBackup } from './state.js';

const base = new URL('./', import.meta.url);
export const STORAGE_KEY = `fitness-20w:${base.pathname}:v1`;
let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('浏览器禁止本地存储。'); }, setItem() { throw new Error('浏览器禁止本地存储。'); } }; }
const store = createStore(storage, STORAGE_KEY);
const main = document.querySelector('#main');
const navigation = document.querySelector('#navigation');
let loaded = store.load();
let state = loaded.state;
let today = localDateKey();
let selectedDate = today;
let weekCursor = mondayOf(today);
let view = 'day';
let toastTimer;
let modalPending = false;
let pendingWorker = null;
let offlineReady = false;
let offlineProblem = false;
let reloadForUpdate = false;

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5m0-9v.1"/>',
  today: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-11 5 2 2 4-4"/>',
  week: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M10 10v10m5-10v10"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  barbell: '<path d="M7 12h10M3 10v4m18-4v4M5 8v8m14-8v8M7 7v10M17 7v10"/>',
  meal: '<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18m12-18v18M20 3c-4 2-4 9 0 9"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  leaf: '<path d="M20 4C8 2 2 8 6 15s14 4 14-11ZM5 21l9-11"/>',
  move: '<path d="m4 16 5-9 5 10 6-9M4 21h16"/>',
};
function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.today}</svg>`; }
function toast(message, error = false) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.className = `toast${error ? ' toast-error' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, error ? 6500 : 3000);
}
async function confirmAction(title, description, label = '确认') {
  if (modalPending) return false;
  modalPending = true;
  const dialog = document.querySelector('#confirm-dialog');
  const originalFocus = document.activeElement;
  document.querySelector('#dialog-title').textContent = title;
  document.querySelector('#dialog-description').textContent = description;
  document.querySelector('#dialog-confirm').textContent = label;
  dialog.returnValue = '';
  dialog.showModal();
  // Focus cancellation first for destructive actions.
  dialog.querySelector('[value="cancel"]').focus();
  return new Promise(resolve => dialog.addEventListener('close', () => {
    modalPending = false;
    originalFocus?.focus();
    resolve(dialog.returnValue === 'confirm');
  }, { once: true }));
}
function mutate(reducer, success) {
  try {
    state = store.change(reducer);
    loaded = { kind: 'ok', state };
    render();
    if (success) toast(success);
    return true;
  } catch (error) { toast(error.message, true); return false; }
}
function download(text, filename) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function renderNav() {
  navigation.hidden = !state;
  if (!state) return;
  navigation.innerHTML = [['day', '今天', 'today'], ['week', '本周', 'week'], ['settings', '设置', 'settings']].map(([id, name, glyph]) =>
    `<button type="button" data-view="${id}" ${view === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${name}</span></button>`).join('');
}
function renderSetup() {
  return `<section class="setup-shell">
    <div class="setup-symbol">${icon('barbell')}</div>
    <p class="eyebrow">20 WEEK PROGRAM</p><h1>从哪天开始？</h1>
    <p class="setup-intro">今天练什么，今天吃什么。<br>选好开始日期，以后打开就能看到。</p>
    <form id="setup-form" class="panel setup-panel">
      <div class="field-header"><label for="start-date">计划开始日期</label><button class="text-button" type="button" data-action="date-today">设为今天</button></div>
      <input id="start-date" name="startDate" type="date" required value="${today}" min="1900-01-01" max="9998-12-31">
      <p class="help">从这一天起，每 7 天算一个计划周。训练按真实星期安排，非周一开始也不用补课。</p>
      <button type="submit" class="primary wide">开始我的 20 周 ${icon('arrow')}</button>
    </form>
    <p class="setup-note">无需登录 · 记录保存在这台设备 · 支持离线</p>
    <button type="button" class="text-button" data-action="import">已有记录？导入 JSON 备份</button>
  </section>`;
}
function renderStorageError() {
  return `<section class="panel error-panel"><p class="eyebrow">本地记录保护</p><h1>暂时无法读取数据</h1>
    <p>${esc(loaded.error)}</p><p class="help">没有覆盖原始数据。可先导出原始内容，或用有效备份恢复。</p>
    <div class="button-stack"><button class="primary" data-action="export-raw">导出原始数据</button><button class="secondary" data-action="import">导入有效备份</button><button class="text-button danger-text" data-action="recover-reset">确认后重新设置</button></div></section>`;
}
function renderPhase(plan) {
  if (!plan.phase) return '';
  return `<span class="phase-label">${esc(plan.phase.name)}</span>`;
}
function renderExercises(plan) {
  const exercises = plan.workout.exercises;
  const row = (exercise, index) => `<details class="exercise ${index < 2 ? 'primary-exercise' : ''}" data-exercise="${exercise.id}">
    <summary><span class="exercise-name">${esc(exercise.name)}</span><span class="exercise-dose">${plan.reduction ? '<small>常规参考 </small>' : ''}${esc(exercise.prescription)}</span></summary>
    <p>${esc(exercise.detail || '按当前可控的工作重量执行；本版不自动加重量或加组。')}${plan.reduction ? ' 本周减量，常规组数仅供参考。' : ''}</p>
  </details>`;
  return `<div class="primary-exercises">${exercises.slice(0, 2).map((e, i) => row(e, i)).join('')}</div><div class="assistance-exercises">${exercises.slice(2).map((e, i) => row(e, i + 2)).join('')}</div>`;
}
function renderWorkout(plan) {
  const w = plan.workout;
  if (!w) return `<section class="panel training-panel cycle-complete" aria-labelledby="training-heading">
    <div class="section-label">${icon('check')}<h2 id="training-heading">Cycle Complete</h2></div><h3>20 周周期已结束</h3>
    <p>没有自动重启 Week 1。之前的完成记录仍然保留，可回到周计划查看。</p>
    <button class="secondary" data-action="last-week">查看第 20 周</button><p class="help">今天的饮食仍显示既定的星期 Baseline，供日常执行参考。</p></section>`;
  const trainingIcon = w.kind === 'strength' || w.kind === 'mrt' ? 'barbell' : w.kind === 'recovery' ? 'leaf' : 'move';
  return `<section class="panel training-panel ${w.kind}" aria-labelledby="training-heading">
    <div class="section-label">${icon(trainingIcon)}<h2 id="training-heading">${selectedDate === today ? '今天' : '这天'}练什么</h2><span class="duration">${esc(w.duration)}</span>${w.kind === 'strength' ? `<button type="button" class="info-button" data-action="workout-info" aria-label="查看训练细节与本周安排">${icon('info')}</button>` : ''}</div>
    <div class="workout-title"><h3>${esc(w.name)}</h3><span>${esc(w.english)}</span></div>
    ${plan.reduction ? `<aside class="reduction-notice"><strong>${esc(plan.reduction.title)}</strong><span>常规组数仅供参考，不是本周目标。</span><details><summary>减量说明</summary><p>${esc(plan.reduction.detail)}</p></details></aside>` : ''}
    ${w.canChoose ? `<fieldset class="conditioning-choice"><legend>今天选一种，不叠加</legend><button type="button" data-conditioning="zone2" aria-pressed="${w.kind === 'zone2'}">Zone 2</button><button type="button" data-conditioning="mrt" aria-pressed="${w.kind === 'mrt'}">MRT</button></fieldset>` : ''}
    ${w.kind === 'strength' ? renderExercises(plan) : `<div class="session-body"><p class="session-focus">${esc(w.focus)}</p>${w.items ? `<ul class="simple-items">${w.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}${w.note ? `<p class="session-note">${esc(w.note)}</p>` : ''}${w.extra ? `<p class="session-note">${esc(w.extra)}</p>` : ''}</div>`}

  </section>`;
}
function renderMeals(plan) {
  const n = plan.nutrition;
  const breakfast = n.breakfast.map(item => `<span><strong>${item.amount}</strong><span class="unit">${item.unit}</span> ${esc(item.label)}</span>`).join('<i>·</i>');
  const rice = grams => `<span class="rice-dose"><strong>${grams}</strong><span class="unit">g</span> 生米</span><i>·</i><span>蔬菜</span>`;
  return `<section class="panel nutrition-panel" aria-labelledby="nutrition-heading">
    <div class="section-label">${icon('meal')}<h2 id="nutrition-heading">${selectedDate === today ? '今天' : '这天'}吃什么</h2><span class="raw-badge">生米 <b>${n.totalRice}</b>g / 天</span></div>
    <div class="meal-row" data-meal="breakfast"><h3>早餐</h3><div class="meal-food breakfast-food">${breakfast}</div></div>
    <div class="meal-row" data-meal="lunch"><h3>午餐</h3><div class="meal-food"><p><strong>${n.lunch.amount}</strong><span class="unit">g</span> ${esc(n.lunch.label)}</p><p class="meal-secondary">${rice(n.lunch.rice)}</p></div></div>
    <div class="meal-row" data-meal="dinner"><h3>晚餐</h3><div class="meal-food"><p><strong>${n.dinner.amount}</strong><span class="unit">g</span> ${esc(n.dinner.label)}</p><p class="meal-secondary">${rice(n.dinner.rice)}</p></div></div>
    <p class="food-note">按生重称量 · 蔬菜合计 ${esc(n.vegetables)} / 天</p>
  </section>`;
}
function renderCompletion(plan) {
  const done = Boolean(state.completedDays[selectedDate]);
  const dateAllowed = selectedDate <= today && plan.cycle.status === 'active';
  if (!dateAllowed) return `<section class="completion-area"><p class="muted">${plan.cycle.status === 'complete' ? '保留历史记录，不自动开始新周期。' : plan.cycle.status === 'upcoming' ? '计划开始后，就可以记录完成。' : '这是未来计划，到了当天再记录完成。'}</p></section>`;
  if (done) return `<section class="completion-area done-area"><div class="completion-done" role="status">${icon('check')} ${selectedDate === today ? '今日' : '这天'}已完成<span>已保存到本机</span></div><button class="text-button undo-button" type="button" data-action="undo">撤销完成</button></section>`;
  return `<section class="completion-area"><button id="complete-day" class="primary complete-button" data-action="complete" type="button">${icon('check')}${selectedDate === today ? '今日完成' : '标记这天完成'}</button><p class="completion-caption">按今天的计划执行即可，恢复日也算完成。</p></section>`;
}
function renderDay() {
  const plan = planFor(state.programStartDate, selectedDate, state.settings);
  const current = selectedDate === today;
  const cycleLabel = plan.cycle.status === 'active' ? `<span class="week-number">W${String(plan.cycle.week).padStart(2, '0')}</span><span class="week-total"> / 20</span>` : `<span class="cycle-label">${plan.cycle.status === 'complete' ? '周期完成' : '尚未开始'}</span>`;
  const context = plan.cycle.status === 'active' ? `第 ${plan.cycle.day} / 140 天` : plan.cycle.status === 'upcoming' ? `${plan.cycle.daysUntil} 天后开始` : 'Cycle Complete';
  return `<section class="page-heading">
    <div><p class="eyebrow">${shortDate(selectedDate)} · ${WEEKDAY_LONG[weekday(selectedDate)]}</p><h1>${current ? '今天' : '日计划'}<span class="heading-date">${esc(context)}</span></h1></div>
    <div class="week-indicator">${cycleLabel}${renderPhase(plan)}</div>
  </section>
  ${!current ? `<div class="preview-bar"><span>正在查看 ${shortDate(selectedDate)} · 今天是 ${shortDate(today)}</span><button class="text-button" data-action="today">回到今天</button></div>` : ''}
  ${plan.cycle.status === 'upcoming' ? `<div class="preview-notice">${shortDate(state.programStartDate, true)} 开始。下面是星期安排预览，未提前消耗 Week 1。</div>` : ''}
  <div class="today-grid">${renderWorkout(plan)}${renderMeals(plan)}</div>
  ${renderCompletion(plan)}`;
}
function renderWeek() {
  const end = addDays(weekCursor, 6);
  const currentWeek = mondayOf(today) === weekCursor;
  return `<section class="page-heading"><div><p class="eyebrow">${shortDate(weekCursor, true)} — ${shortDate(end)}</p><h1>周计划</h1></div><button type="button" class="text-button" data-action="this-week" ${currentWeek ? 'disabled' : ''}>回到本周</button></section>
    <div class="week-toolbar"><button type="button" class="icon-button previous" data-action="previous-week" aria-label="上一周">${icon('arrow')}</button><span>星期安排 · 按日期查看</span><button type="button" class="icon-button" data-action="next-week" aria-label="下一周">${icon('arrow')}</button></div>
    <section class="panel week-panel" aria-label="七天训练和饮食">
      ${Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekCursor, i);
        const plan = planFor(state.programStartDate, date, state.settings);
        const done = Boolean(state.completedDays[date]);
        const within = plan.cycle.status === 'active';
        return `<button type="button" class="week-row ${date === today ? 'is-today' : ''} ${done ? 'is-complete' : ''}" data-date="${date}" aria-label="${shortDate(date)} ${WEEKDAY_NAMES[weekday(date)]}，${plan.workout?.name || '周期已结束'}，${done ? '已完成' : '未完成'}，${plan.nutrition.totalRice}克生米">
          <span class="week-day"><strong>${WEEKDAY_NAMES[weekday(date)]}</strong><small>${date.slice(5).replace('-', '/')}</small></span>
          <span class="week-plan"><strong>${esc(plan.workout?.name || '周期已结束')}${date === today ? '<em>今天</em>' : ''}</strong><small>${within ? `W${plan.cycle.week}${plan.reduction ? ' · 减量' : ''}` : plan.cycle.status === 'upcoming' ? '开始前预览' : '周期外'} · 生米 ${plan.nutrition.totalRice}g</small></span>
          <span class="day-check" aria-hidden="true">${done ? icon('check') : '<span></span>'}</span>
        </button>`;
      }).join('')}
    </section>
    <p class="help week-explanation">开始日：${shortDate(state.programStartDate, true)}。计划周从开始日起每 7 天计算；这个页面按周一到周日排列，因此可能跨两个计划周。浏览不改变真实日期。</p>`;
}
function renderSettings() {
  const end = addDays(state.programStartDate, 139);
  return `<section class="page-heading"><div><p class="eyebrow">LOCAL FIRST</p><h1>设置</h1></div><span class="version-pill">v${APP_VERSION}</span></section>
    <form id="settings-form" class="panel settings-section"><h2>我的周期</h2>
      <label for="settings-start">计划开始日期</label><input id="settings-start" name="startDate" type="date" required value="${state.programStartDate}" min="1900-01-01" max="9998-12-31">
      <p class="help">本周期至 ${shortDate(end, true)}。修改后只重算周次，不移动或删除原日期的完成记录。</p>
      <label for="baseline-weight">基准体重 <span class="muted">kg</span></label><input id="baseline-weight" name="weight" type="number" inputmode="decimal" required min="0.1" max="1000" step="0.1" value="${state.baselineWeightKg}">
      <p class="help">仅记录参考，不据此自动减少食物或改变训练。</p><button type="submit" class="primary wide">保存设置</button>
    </form>
    <section class="panel settings-section"><h2>备份与恢复</h2><p>数据只保存在当前浏览器 / 设备。换手机、换访问地址或清理浏览器数据前，请导出备份。</p>
      <div class="two-buttons"><button type="button" class="secondary" data-action="export">导出 JSON</button><button type="button" class="secondary" data-action="import">导入 JSON</button></div><p class="help">导入会先校验格式，并在你确认后替换现有记录；取消不会改变数据。</p>
    </section>
    <section class="panel settings-section"><h2>关于 Fitness</h2><dl class="about-list"><div><dt>应用版本</dt><dd>${APP_VERSION}</dd></div><div><dt>周期</dt><dd>20 周 / 140 天</dd></div><div><dt>数据</dt><dd>本地保存 · 无账号</dd></div><div><dt>主食</dt><dd>米饭，按生米重量</dd></div></dl>
      <p class="help">核心训练与饮食无需外部服务。安装使用浏览器的“安装应用 / 添加到主屏幕”；首次联网加载完成后再测试离线。</p><p class="help">训练与食物数量来自既定 AWC；可选进阶不自动启用，未指定的减量组数不自动推算。</p>
      <details class="plain-details"><summary>周期目标与边界</summary><p>第 20 周相比第 1 周，在照片、体态和运动表现上出现明显变化。体脂率不是硬 KPI，不强制测 1RM。牛奶营养数据待定，不提供未经确认的热量总计。未自动替换土豆、红薯或虾仁。鸡蛋按个，牛奶按 ml；其他食材按生重 / 烹饪前称量。蔬菜每日合计约 400–600 g。第 9 周起仍可继续吃米饭，不按周次强制替换。</p><p>${BASELINE_VERSION}</p></details>
    </section>
    <section class="reset-section"><button type="button" class="text-button danger-text" data-action="reset-completions">清空所有完成记录</button><p class="help">需要二次确认；不会删除开始日期和基准体重。</p></section>`;
}
function render(focusHeading = false) {
  main.innerHTML = loaded.kind === 'error' ? renderStorageError() : !state ? renderSetup() : view === 'week' ? renderWeek() : view === 'settings' ? renderSettings() : renderDay();
  renderNav();
  document.title = `Fitness · ${!state ? '开始' : view === 'settings' ? '设置' : view === 'week' ? '本周' : selectedDate === today ? '今天' : '日计划'}`;
  if (focusHeading) { main.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }
}
function goToday() { today = localDateKey(); selectedDate = today; weekCursor = mondayOf(today); view = 'day'; render(true); }
function refreshDate() {
  const now = localDateKey();
  if (now !== today) { today = now; selectedDate = today; weekCursor = mondayOf(today); if (view !== 'settings') view = 'day'; render(); }
}

async function handleClick(event) {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.view) {
    view = button.dataset.view;
    if (view === 'day') return goToday();
    if (view === 'week') weekCursor = mondayOf(today);
    render(true); return;
  }
  if (button.dataset.date) { selectedDate = button.dataset.date; view = 'day'; render(true); return; }
  if (button.dataset.conditioning && state) {
    const choice = button.dataset.conditioning;
    const plan = planFor(state.programStartDate, selectedDate, state.settings);
    if (!plan.workout?.canChoose || !['zone2', 'mrt'].includes(choice)) return;
    mutate(s => { s.settings.conditioningChoices[selectedDate] = choice; return s; });
    return;
  }
  const action = button.dataset.action;
  if (!action) return;
  if (action === 'date-today') { document.querySelector('#start-date').value = localDateKey(); return; }
  if (action === 'workout-info') {
    const plan = planFor(state.programStartDate, selectedDate, state.settings);
    const info = document.querySelector('#workout-info-content');
    info.innerHTML = `<p>点开动作可查看组间休息和余力要求。RIR 表示还能完成的标准动作次数。</p><p>${esc(plan.phase?.note || PROGRAM.phases[0].note)}</p><p><strong>引体路线</strong><br>${PROGRAM.pullUpProgression.map(esc).join(' → ')}。当前阶段由你选择，本版只显示既定训练，不自动晋级。</p><p><strong>硬拉不能改成 MRT。</strong></p>`;
    document.querySelector('#workout-info-dialog').showModal();
    return;
  }
  if (action === 'today') return goToday();
  if (action === 'previous-week' || action === 'next-week') { weekCursor = addDays(weekCursor, action === 'previous-week' ? -7 : 7); render(); return; }
  if (action === 'this-week') { weekCursor = mondayOf(today); render(); return; }
  if (action === 'last-week') { weekCursor = mondayOf(addDays(state.programStartDate, 139)); view = 'week'; render(true); return; }
  if (action === 'complete') {
    const previousToday = today;
    refreshDate();
    if (previousToday !== today) { toast('日期已变化，请确认新一天的计划后再记录完成'); return; }
    const targetDate = selectedDate;
    if (!state || targetDate > today || cycleFor(state.programStartDate, targetDate).status !== 'active') return;
    button.disabled = true;
    mutate(s => { if (!s.completedDays[targetDate]) s.completedDays[targetDate] = { completedAt: new Date().toISOString() }; return s; }, '完成记录已保存');
    button.disabled = false;
    document.querySelector('.undo-button')?.focus({ preventScroll: true });
  } else if (action === 'undo') {
    const targetDate = selectedDate;
    if (await confirmAction('撤销这天的完成记录？', `${shortDate(targetDate, true)} 将恢复为未完成。其他日期不会改变。`, '确认撤销')) {
      mutate(s => { delete s.completedDays[targetDate]; return s; }, '已撤销完成');
      document.querySelector('#complete-day')?.focus({ preventScroll: true });
    }
  } else if (action === 'export') {
    const current = store.load();
    if (current.kind !== 'ok') return toast('数据暂不可用，请先恢复。', true);
    download(JSON.stringify(current.state, null, 2), `fitness-backup-${today}.json`);
    toast('备份已生成；请保存在安全的位置');
  } else if (action === 'export-raw') {
    try { download(store.raw() || '{}', `fitness-raw-backup-${today}.json`); } catch { toast('浏览器拒绝读取存储，无法导出。', true); }
  } else if (action === 'import') {
    const fileInput = document.querySelector('#import-file'); fileInput.value = ''; fileInput.click();
  } else if (action === 'reset-completions') {
    if (await confirmAction('清空全部完成记录？', '这会清除所有日期的打勾记录，不能在 App 内撤回。建议先导出备份。开始日期、体重和训练设置不变。', '清空记录')) mutate(s => { s.completedDays = {}; return s; }, '完成记录已清空');
  } else if (action === 'recover-reset') {
    if (await confirmAction('覆盖无法读取的数据？', '建议先导出原始数据。确认后将以今天为开始日重新设置，原始记录会被替换。', '重新设置')) {
      try { state = store.save(defaultState(today)); loaded = { kind: 'ok', state }; goToday(); } catch (error) { toast(error.message, true); }
    }
  }
}
async function handleSubmit(event) {
  if (!['setup-form', 'settings-form'].includes(event.target.id)) return;
  event.preventDefault();
  const data = new FormData(event.target);
  const start = data.get('startDate');
  try {
    if (event.target.id === 'setup-form') {
      state = store.save(defaultState(start)); loaded = { kind: 'ok', state }; goToday();
    } else {
      const weight = Number(data.get('weight'));
      if (start !== state.programStartDate && !await confirmAction('调整计划开始日期？', '周次与训练阶段会重新计算。现有完成记录仍留在原日期，不移动、不清空。', '保存新日期')) return;
      mutate(s => { s.programStartDate = start; s.baselineWeightKg = weight; return s; }, '设置已保存');
    }
  } catch (error) { toast(error.message, true); }
}
async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('文件超过 1 MB，未导入。');
    const imported = parseBackup(await file.text());
    const count = Object.keys(imported.completedDays).length;
    if (!await confirmAction('导入这份备份？', `开始日 ${shortDate(imported.programStartDate, true)}，共 ${count} 条完成记录。确认后替换本机当前数据，不合并；建议已先导出当前备份。`, '确认导入')) return;
    state = store.save(imported); loaded = { kind: 'ok', state }; goToday(); toast('备份已恢复');
  } catch (error) { toast(error.message, true); }
  finally { event.target.value = ''; }
}
function updateOfflineStatus() {
  const el = document.querySelector('#offline-status');
  if (offlineReady) { el.textContent = navigator.onLine ? '离线已就绪' : '正在离线使用'; el.className = 'local-status ready'; }
  else { el.textContent = offlineProblem ? '离线未就绪' : '正在准备离线'; el.className = 'local-status'; }
}
function showUpdate(worker) {
  if (!worker) return;
  pendingWorker = worker;
  document.querySelector('#update-notice').hidden = false;
}
async function registerOffline() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) { offlineProblem = true; updateOfflineStatus(); return; }
  try {
    // Reuse an already installed worker offline; registering again must not gate readiness.
    const existing = await navigator.serviceWorker.getRegistration(base.href);
    const registration = existing?.scope === base.href && existing.active
      ? existing
      : await navigator.serviceWorker.register(new URL('./sw.js', base), { scope: base.href, updateViaCache: 'none' });
    if (registration.waiting) showUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration.waiting || worker);
        if (worker.state === 'redundant' && !registration.active) { offlineProblem = true; updateOfflineStatus(); }
      });
    });
    await navigator.serviceWorker.ready;
    offlineReady = true; updateOfflineStatus();
    if (navigator.onLine) registration.update().catch(() => { /* Offline or a temporary server failure does not block Today. */ });
  } catch { offlineProblem = true; updateOfflineStatus(); }
}

// Event delegation keeps the UI independent of the structured program definition.
document.addEventListener('click', event => { handleClick(event).catch(error => toast(error.message, true)); });
document.addEventListener('submit', event => { handleSubmit(event).catch(error => toast(error.message, true)); });
document.querySelector('#import-file').addEventListener('change', handleImport);
document.querySelector('.wordmark').addEventListener('click', event => { event.preventDefault(); if (state) goToday(); });
document.querySelector('#apply-update').addEventListener('click', () => {
  if (!pendingWorker) return;
  reloadForUpdate = true;
  document.querySelector('#apply-update').disabled = true;
  pendingWorker.postMessage({ type: 'SKIP_WAITING' });
});
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadForUpdate) location.reload(); });
window.addEventListener('online', updateOfflineStatus);
window.addEventListener('offline', updateOfflineStatus);
window.addEventListener('focus', refreshDate);
window.addEventListener('pageshow', refreshDate);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshDate(); });
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) { loaded = store.load(); state = loaded.state; render(); toast('已同步此浏览器其他窗口的记录'); }
});
// Also handle a tab left open across midnight and a timezone change while it remains visible.
setInterval(refreshDate, 15000);
function scheduleMidnight() {
  const now = new Date(); const next = new Date(now); next.setHours(24, 0, 0, 50);
  setTimeout(() => { refreshDate(); scheduleMidnight(); }, Math.max(50, next.getTime() - now.getTime()));
}
render();
updateOfflineStatus();
registerOffline();
scheduleMidnight();
