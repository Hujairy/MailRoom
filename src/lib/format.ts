import { DATE_LOCALE } from '../config';

const dateTime = new Intl.DateTimeFormat(DATE_LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dayMonth = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short' });
const time = new Intl.DateTimeFormat(DATE_LOCALE, { hour: '2-digit', minute: '2-digit' });
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const valid = (d: Date) => !Number.isNaN(d.getTime());

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return valid(d) ? dateTime.format(d) : value;
}

export function formatDayMonth(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return valid(d) ? dayMonth.format(d) : '';
}

export function formatTime(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return valid(d) ? time.format(d) : '';
}

export function timeAgo(value: string): string {
  const d = new Date(value);
  if (!valid(d)) return '';
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  // Round the magnitude so "14.5 hours ago" matches waitingFor() ("15 hours").
  const n = (unit: number) => Math.sign(seconds) * Math.round(abs / unit);
  if (abs < 60) return 'just now';
  if (abs < 3600) return relative.format(n(60), 'minute');
  if (abs < 86400) return relative.format(n(3600), 'hour');
  if (abs < 86400 * 14) return relative.format(n(86400), 'day');
  return dayMonth.format(d);
}

/** "3 hours", "2 days" — how long a delivery has been waiting. */
export function waitingFor(value: string): string {
  const d = new Date(value);
  if (!valid(d)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (minutes < 60) return minutes <= 1 ? 'a minute' : `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour' : `${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'a day' : `${days} days`;
}

export function daysWaiting(value: string): number {
  const d = new Date(value);
  return valid(d) ? (Date.now() - d.getTime()) / 86400000 : 0;
}

/** yyyy-mm-dd in local time, for comparing with a date input. */
export function localDay(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (!valid(d)) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isToday(value: string): boolean {
  return localDay(value) === localDay(new Date());
}

/** Same reference format the mail room uses for hand deliveries, e.g. 1/11/2026_12:42:54. */
export function byHandRef(value: string | Date = new Date()): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}_${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function firstName(name: string): string {
  return name.replace(/@.*/, '').split(/[\s._]+/).filter(Boolean)[0] ?? name;
}

export function initials(name: string): string {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
