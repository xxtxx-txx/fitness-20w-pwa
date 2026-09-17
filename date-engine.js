/** Civil-date arithmetic: never divide the elapsed milliseconds of two local midnights. */
export const DAY_MS = 86_400_000;
export const TOTAL_DAYS = 140;
export const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const WEEKDAY_LONG = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < 1000 || y > 9999) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
export function dayNumber(key) {
  if (!isDateKey(key)) throw new TypeError('无效日期，请使用 YYYY-MM-DD。');
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}
export function localDateKey(date = new Date()) {
  if (Number.isNaN(date.getTime())) throw new TypeError('无效的本地时间。');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(key, days) {
  if (!Number.isInteger(days)) throw new TypeError('天数必须是整数。');
  return new Date((dayNumber(key) + days) * DAY_MS).toISOString().slice(0, 10);
}
export function weekday(key) { return new Date(dayNumber(key) * DAY_MS).getUTCDay(); }
export function mondayOf(key) { return addDays(key, -((weekday(key) + 6) % 7)); }
export function shortDate(key, includeYear = false) {
  if (!isDateKey(key)) return '';
  const [y, m, d] = key.split('-').map(Number);
  return `${includeYear ? `${y}年` : ''}${m}月${d}日`;
}
export function cycleFor(startDate, date) {
  const offset = dayNumber(date) - dayNumber(startDate);
  if (offset < 0) return { status: 'upcoming', offset, day: null, week: null, daysUntil: -offset };
  if (offset >= TOTAL_DAYS) return { status: 'complete', offset, day: null, week: null, daysUntil: 0 };
  return { status: 'active', offset, day: offset + 1, week: Math.floor(offset / 7) + 1, daysUntil: 0 };
}
