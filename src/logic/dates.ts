// Calendar dates are plain 'YYYY-MM-DD' strings in the person's local time zone.
import { MONTHS, WEEKDAYS_LONG, MONTHS_LONG } from '../constants';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(now: Date = new Date()): string {
  return toISO(now);
}

export function addDays(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string): number {
  const ms = fromISO(b).getTime() - fromISO(a).getTime();
  return Math.round(ms / 86400000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayMon0(s: string): number {
  return (fromISO(s).getDay() + 6) % 7;
}

export function mondayOf(s: string): string {
  return addDays(s, -weekdayMon0(s));
}

export function shortDate(s: string): string {
  const d = fromISO(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** e.g. "Monday, October 5" */
export function longDate(s: string): string {
  const d = fromISO(s);
  return `${WEEKDAYS_LONG[weekdayMon0(s)]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
}

/** "Today", "Yesterday" or "Oct 7" for a timestamp. */
export function relativeDay(timestamp: string, today: string): string {
  const day = toISO(new Date(timestamp));
  const diff = diffDays(day, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return shortDate(day);
}
