import { isDateKey } from './date-engine.js';
export const SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 1_000_000;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
function onlyKeys(obj, allowed, label) {
  if (!record(obj) || Object.keys(obj).some(k => !allowed.includes(k))) throw new TypeError(`${label}格式不兼容；当前数据不会被覆盖。`);
}
export function defaultState(startDate) {
  return { programStartDate: startDate, baselineWeightKg: 96.5, completedDays: {}, settings: { conditioningChoices: {}, milkMetadata: null, carbohydrateSource: 'rice' }, userData: {}, schemaVersion: SCHEMA_VERSION };
}
export function validateState(input) {
  onlyKeys(input, ['programStartDate', 'baselineWeightKg', 'completedDays', 'settings', 'schemaVersion', 'userData'], '备份');
  if (input.schemaVersion !== SCHEMA_VERSION) throw new TypeError('不支持此备份版本；需要 schemaVersion: 1。');
  if (!isDateKey(input.programStartDate) || input.programStartDate > '9998-12-31') throw new TypeError('计划开始日期无效。');
  if (typeof input.baselineWeightKg !== 'number' || !Number.isFinite(input.baselineWeightKg) || input.baselineWeightKg <= 0 || input.baselineWeightKg > 1000) throw new TypeError('基准体重必须是有效的正数。');
  if (!record(input.completedDays) || Object.keys(input.completedDays).length > 10000) throw new TypeError('完成记录格式无效。');
  const completedDays = {};
  for (const [date, value] of Object.entries(input.completedDays)) {
    if (!isDateKey(date)) throw new TypeError('完成记录包含无效日期。');
    if (value === true) { completedDays[date] = true; continue; }
    onlyKeys(value, ['completedAt'], '完成记录');
    if (!own(value, 'completedAt') || typeof value.completedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value.completedAt) || !Number.isFinite(Date.parse(value.completedAt))) throw new TypeError('完成记录时间无效。');
    completedDays[date] = { completedAt: value.completedAt };
  }
  onlyKeys(input.settings, ['conditioningChoices', 'milkMetadata', 'carbohydrateSource'], '设置');
  const conditioningChoices = {};
  const choices = input.settings.conditioningChoices ?? {};
  if (!record(choices) || Object.keys(choices).length > 10000) throw new TypeError('体能训练选项格式无效。');
  for (const [date, choice] of Object.entries(choices)) {
    if (!isDateKey(date) || !['zone2', 'mrt'].includes(choice)) throw new TypeError('体能训练选项无效。');
    conditioningChoices[date] = choice;
  }
  if (input.settings.carbohydrateSource !== undefined && input.settings.carbohydrateSource !== 'rice') throw new TypeError('v0.1 仅执行米饭 Baseline，不接受未实现的主食替换。');
  let milkMetadata = null;
  if (input.settings.milkMetadata !== undefined && input.settings.milkMetadata !== null) {
    const milk = input.settings.milkMetadata;
    onlyKeys(milk, ['brand', 'per100ml'], '牛奶信息');
    if (typeof milk.brand !== 'string' || milk.brand.length > 120) throw new TypeError('牛奶品牌信息无效。');
    onlyKeys(milk.per100ml, ['kcal', 'proteinG', 'carbsG', 'fatG'], '牛奶营养信息');
    for (const val of Object.values(milk.per100ml)) if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > 1000) throw new TypeError('牛奶营养数值无效。');
    milkMetadata = { brand: milk.brand, per100ml: { ...milk.per100ml } };
  }
  const userData = input.userData ?? {};
  if (!record(userData)) throw new TypeError('扩展数据格式无效。');
  // Kept as JSON only; future data is preserved but never inserted as HTML or executed.
  if (JSON.stringify(userData).length > 100000) throw new TypeError('扩展数据过大。');
  return { programStartDate: input.programStartDate, baselineWeightKg: input.baselineWeightKg, completedDays, settings: { conditioningChoices, milkMetadata, carbohydrateSource: 'rice' }, userData: JSON.parse(JSON.stringify(userData)), schemaVersion: SCHEMA_VERSION };
}
export function parseBackup(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new TypeError('备份文件超过 1 MB。');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new TypeError('不是有效的 JSON 文件；当前数据未改变。'); }
  return validateState(parsed);
}
export function createStore(storage, key) {
  return {
    key,
    load() {
      try {
        const raw = storage.getItem(key);
        if (raw === null) return { kind: 'empty', state: null };
        return { kind: 'ok', state: parseBackup(raw) };
      } catch (error) { return { kind: 'error', state: null, error: error.message || '无法读取本地存储。' }; }
    },
    save(input) {
      const state = validateState(input);
      try { storage.setItem(key, JSON.stringify(state)); }
      catch { throw new Error('本地保存失败。请检查浏览器存储权限或空间；未将本次操作标记为已保存。'); }
      return state;
    },
    change(reducer) {
      const loaded = this.load();
      if (loaded.kind !== 'ok') throw new Error('本地数据暂不可用，请先导出或恢复备份。');
      return this.save(reducer(loaded.state));
    },
    raw() { return storage.getItem(key); },
  };
}
