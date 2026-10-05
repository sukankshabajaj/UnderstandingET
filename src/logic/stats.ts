// The strategy switch rule and the numbers behind Today, Tracker, My week and Overview.
// Everything here is pure (no I/O) so it can be unit tested — see stats.test.ts.
import { DAY_SHORT } from '../constants';
import type { Helped, Log, Settings, Snapshot, Strategy, Task } from '../types';
import { addDays, diffDays, weekdayMon0 } from './dates';

/** What happened for one strategy on one day. */
export type DayValue = Helped | 'nr' | 'missed' | 'none' | 'today' | 'future';
export type Status = 'Too early' | 'Working' | 'Mixed' | 'Not working';

export const STATUS_HUE: Record<Status, number | null> = {
  'Too early': null,
  Working: 150,
  Mixed: 75,
  'Not working': 25,
};

export const isDone = (v: DayValue): v is Helped | 'nr' => v === 0 || v === 1 || v === 2 || v === 'nr';

export function isScheduled(s: Pick<Strategy, 'freq_days'>, date: string): boolean {
  return !s.freq_days.length || s.freq_days.includes(weekdayMon0(date));
}

export function freqText(s: Pick<Strategy, 'freq_per_week' | 'freq_days'>): string {
  if (s.freq_days.length) {
    const d = [...s.freq_days].sort((a, b) => a - b);
    if (d.join() === '0,1,2,3,4') return 'Weekdays';
    if (d.length === 7) return 'Every day';
    return d.map((i) => DAY_SHORT[i]).join(', ');
  }
  if (s.freq_per_week >= 7) return 'Every day';
  if (s.freq_per_week === 1) return 'Once a week';
  return `${s.freq_per_week}× a week`;
}

export function weeklyTarget(s: Pick<Strategy, 'freq_per_week' | 'freq_days'>): number {
  return s.freq_days.length || s.freq_per_week;
}

/** The running (not ended) strategy for a task. */
export function currentStrategy(strategies: Strategy[], taskId: string): Strategy | undefined {
  return strategies.find((s) => s.task_id === taskId && !s.ended_on);
}

/** The strategy that was running for a task on a given day (the newest one wins on a switch day). */
export function strategyOn(strategies: Strategy[], taskId: string, date: string): Strategy | undefined {
  let best: Strategy | undefined;
  for (const s of strategies) {
    if (s.task_id !== taskId || s.started_on > date) continue;
    if (s.ended_on && s.ended_on < date) continue;
    if (!best || s.started_on >= best.started_on) best = s;
  }
  return best;
}

export type LogIndex = Map<string, Map<string, Log>>;

export function indexLogs(logs: Log[]): LogIndex {
  const idx: LogIndex = new Map();
  for (const l of logs) {
    let m = idx.get(l.strategy_id);
    if (!m) idx.set(l.strategy_id, (m = new Map()));
    m.set(l.date, l);
  }
  return idx;
}

export function dayValue(s: Strategy, idx: LogIndex, date: string, today: string): DayValue {
  if (date < s.started_on) return 'none';
  const log = idx.get(s.id)?.get(date);
  if (log && log.done) return log.helped ?? 'nr';
  if (date > today) return 'future';
  if (!isScheduled(s, date)) return 'none';
  if (date === today) return 'today';
  if (s.ended_on && date > s.ended_on) return 'none';
  return 'missed';
}

export interface StrategyStats {
  /** Number of rated check-ins. */
  n: number;
  /** Helped rate 0–1 = sum(helped) / (2 × rated). */
  rate: number;
  /** Trial day, 1 on the start date. */
  day: number;
  len: number;
  status: Status;
  flagged: boolean;
  review: boolean;
  /** One value per trial day, from the start date (at least `len` long). */
  history: DayValue[];
  doneDays: number;
}

export function strategyStats(
  s: Strategy,
  idx: LogIndex,
  settings: Settings,
  today: string,
  flagged: boolean,
): StrategyStats {
  const logs = [...(idx.get(s.id)?.values() ?? [])].filter((l) => l.done);
  const rated = logs.filter((l) => l.helped != null);
  const n = rated.length;
  const rate = n ? rated.reduce((a, l) => a + (l.helped as number), 0) / (2 * n) : 0;
  const end = s.ended_on ?? today;
  const day = Math.max(1, diffDays(s.started_on, end) + 1);
  const len = s.trial_length_days;
  const status: Status =
    n < settings.min_rated_logs
      ? 'Too early'
      : rate >= settings.working_rate
        ? 'Working'
        : rate >= settings.mixed_rate
          ? 'Mixed'
          : 'Not working';
  const history: DayValue[] = [];
  for (let i = 0; i < Math.max(len, day); i++) {
    history.push(dayValue(s, idx, addDays(s.started_on, i), today));
  }
  return {
    n,
    rate,
    day,
    len,
    status,
    flagged,
    review: (status === 'Not working' && day >= settings.review_day) || flagged,
    history,
    doneDays: logs.length,
  };
}

export function verdict(st: StrategyStats, settings: Settings): string {
  if (st.status === 'Too early') return `Not enough check-ins yet (${st.n} of ${settings.min_rated_logs} needed).`;
  if (st.status === 'Not working' && st.day >= settings.review_day)
    return 'Rule met: the evidence supports trying a different strategy.';
  if (st.status === 'Working') return 'On track: keep this strategy going.';
  if (st.status === 'Mixed') return 'Close to target. Keep going and recheck at the end of the trial.';
  return `Below target, but keep collecting data until day ${settings.review_day}.`;
}

export function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// ---------------------------------------------------------------------------
// Views over a whole snapshot
// ---------------------------------------------------------------------------

export interface TaskDay {
  task: Task;
  strategy: Strategy;
  log: Log | undefined;
  value: DayValue;
}

/** Active tasks with a running strategy, in the order they were added. */
export function activeTasks(snap: Snapshot): { task: Task; strategy: Strategy }[] {
  const out: { task: Task; strategy: Strategy }[] = [];
  for (const task of snap.tasks) {
    if (!task.active) continue;
    const strategy = currentStrategy(snap.strategies, task.id);
    if (strategy) out.push({ task, strategy });
  }
  return out;
}

/** Tasks planned for today (every-day/flexible ones, plus those whose chosen days include today). */
export function todayPlan(snap: Snapshot, idx: LogIndex, today: string): TaskDay[] {
  return activeTasks(snap)
    .filter(({ strategy }) => isScheduled(strategy, today))
    .map(({ task, strategy }) => {
      const log = idx.get(strategy.id)?.get(today);
      return { task, strategy, log, value: dayValue(strategy, idx, today, today) };
    });
}

export function openFlag(snap: Snapshot, strategyId: string) {
  return snap.flags.find((f) => f.strategy_id === strategyId && !f.resolved_at);
}

export interface WeekRow {
  task: Task;
  strategy: Strategy;
  cells: DayValue[];
  done: number;
  possible: number;
}

export function weekRows(snap: Snapshot, idx: LogIndex, weekStart: string, today: string) {
  let done = 0;
  let possible = 0;
  const rows: WeekRow[] = activeTasks(snap).map(({ task, strategy }) => {
    let dn = 0;
    let pos = 0;
    const cells: DayValue[] = [];
    for (let j = 0; j < 7; j++) {
      const date = addDays(weekStart, j);
      const s = strategyOn(snap.strategies, task.id, date);
      const v: DayValue = !s ? 'none' : dayValue(s, idx, date, today);
      if (isDone(v)) dn++;
      if (isDone(v) || v === 'missed' || v === 'today') pos++;
      cells.push(v);
    }
    done += dn;
    possible += pos;
    return { task, strategy, cells, done: dn, possible: pos };
  });
  return { rows, done, possible };
}

export type DayState = 'Done' | 'Missed' | 'To do' | 'Planned';

export interface DayInfo {
  done: number;
  total: number;
  rows: { task: Task; strategy: Strategy; state: DayState; value: DayValue }[];
}

/** What was planned and done on one calendar day (for the month view). */
export function dayInfo(snap: Snapshot, idx: LogIndex, date: string, today: string): DayInfo {
  const rows: DayInfo['rows'] = [];
  for (const task of snap.tasks) {
    if (!task.active) continue;
    const s = strategyOn(snap.strategies, task.id, date);
    if (!s) continue;
    const v = dayValue(s, idx, date, today);
    if (v === 'none') continue;
    if (v === 'future' && !isScheduled(s, date)) continue;
    const state: DayState = isDone(v) ? 'Done' : v === 'missed' ? 'Missed' : v === 'today' ? 'To do' : 'Planned';
    rows.push({ task, strategy: s, state, value: v });
  }
  return { done: rows.filter((r) => r.state === 'Done').length, total: rows.length, rows };
}

/** Last 7 days per area, for "My week". */
export function areaWeek(snap: Snapshot, idx: LogIndex, area: Task['area'], today: string) {
  let count = 0;
  let total = 0;
  const days: { date: string; done: number; total: number }[] = [];
  for (let j = 6; j >= 0; j--) {
    const date = addDays(today, -j);
    let dn = 0;
    let tt = 0;
    for (const task of snap.tasks) {
      if (!task.active || task.area !== area) continue;
      const s = strategyOn(snap.strategies, task.id, date);
      if (!s) continue;
      const v = dayValue(s, idx, date, today);
      if (isDone(v)) {
        dn++;
        tt++;
      } else if (v === 'missed' || v === 'today') tt++;
    }
    count += dn;
    total += tt;
    days.push({ date, done: dn, total: tt });
  }
  return { count, total, days };
}
