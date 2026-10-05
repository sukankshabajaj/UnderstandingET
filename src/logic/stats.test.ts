import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../types';
import type { Log, Strategy } from '../types';
import { addDays, diffDays, mondayOf, weekdayMon0 } from './dates';
import { dayInfo, freqText, indexLogs, strategyOn, strategyStats, todayPlan, verdict, weekRows } from './stats';
import { seedDemo } from '../data/demoData';
import { oklch } from '../theme';

const TODAY = '2026-10-05'; // a Monday

function strat(over: Partial<Strategy> = {}): Strategy {
  return {
    id: 's1', task_id: 't1', person_id: 'p1', name: 'Plan', description: '', steps: [], timer_minutes: 0,
    freq_per_week: 7, freq_days: [], reminder: null, trial_length_days: 14, started_on: addDays(TODAY, -11),
    ended_on: null, end_reason: null, replaced_strategy_id: null, ...over,
  };
}

function logs(s: Strategy, values: (0 | 1 | 2 | null | 'nr')[]): Log[] {
  return values.flatMap((v, i) =>
    v === null ? [] : [{ id: `l${i}`, strategy_id: s.id, task_id: s.task_id, person_id: 'p1', date: addDays(s.started_on, i), done: true, feel: null, helped: v === 'nr' ? null : v }],
  );
}

describe('dates', () => {
  it('handles weekdays and differences', () => {
    expect(weekdayMon0(TODAY)).toBe(0);
    expect(mondayOf('2026-10-11')).toBe(TODAY);
    expect(diffDays('2026-09-28', TODAY)).toBe(7);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('switch rule', () => {
  it('is too early with fewer than 5 rated check-ins (unrated ticks do not count)', () => {
    const s = strat();
    const st = strategyStats(s, indexLogs(logs(s, [0, 0, 0, 0, 'nr', 'nr'])), DEFAULT_SETTINGS, TODAY, false);
    expect(st.n).toBe(4);
    expect(st.doneDays).toBe(6);
    expect(st.status).toBe('Too early');
    expect(st.review).toBe(false);
    expect(verdict(st, DEFAULT_SETTINGS)).toBe('Not enough check-ins yet (4 of 5 needed).');
  });

  it('computes the helped rate as sum / (2 × rated)', () => {
    const s = strat();
    const st = strategyStats(s, indexLogs(logs(s, [2, 1, 1, 2, 1])), DEFAULT_SETTINGS, TODAY, false);
    expect(st.rate).toBeCloseTo(7 / 10);
    expect(st.status).toBe('Working');
  });

  it('uses the 65% / 45% thresholds', () => {
    const s = strat();
    const mixed = strategyStats(s, indexLogs(logs(s, [1, 1, 1, 1, 1])), DEFAULT_SETTINGS, TODAY, false);
    expect(mixed.status).toBe('Mixed'); // 50%
    const notWorking = strategyStats(s, indexLogs(logs(s, [1, 0, 1, 0, 1])), DEFAULT_SETTINGS, TODAY, false);
    expect(notWorking.status).toBe('Not working'); // 30%
  });

  it('fires a review when not working from day 10, or when flagged', () => {
    const s = strat({ started_on: addDays(TODAY, -9) }); // day 10
    const idx = indexLogs(logs(s, [0, 0, 1, 0, 0, 0]));
    expect(strategyStats(s, idx, DEFAULT_SETTINGS, TODAY, false).review).toBe(true);
    const early = strat({ started_on: addDays(TODAY, -8) }); // day 9
    expect(strategyStats(early, indexLogs(logs(early, [0, 0, 1, 0, 0, 0])), DEFAULT_SETTINGS, TODAY, false).review).toBe(false);
    expect(strategyStats(early, indexLogs([]), DEFAULT_SETTINGS, TODAY, true).review).toBe(true);
  });

  it('respects clinic settings', () => {
    const s = strat();
    const st = strategyStats(s, indexLogs(logs(s, [1, 1, 1])), { ...DEFAULT_SETTINGS, min_rated_logs: 3, working_rate: 0.5 }, TODAY, false);
    expect(st.status).toBe('Working');
  });

  it('builds a trial history with missed, today and future days', () => {
    const s = strat({ started_on: addDays(TODAY, -2), trial_length_days: 5 });
    const st = strategyStats(s, indexLogs(logs(s, [2, null])), DEFAULT_SETTINGS, TODAY, false);
    expect(st.history).toEqual([2, 'missed', 'today', 'future', 'future']);
    expect(st.day).toBe(3);
  });

  it('marks unscheduled days as none', () => {
    const s = strat({ started_on: addDays(TODAY, -7), freq_days: [0, 2, 4] }); // Mon, Wed, Fri
    const st = strategyStats(s, indexLogs([]), DEFAULT_SETTINGS, TODAY, false);
    // starts last Monday: Mon missed, Tue none, Wed missed, Thu none, Fri missed, Sat none, Sun none, today (Mon) pending
    expect(st.history.slice(0, 8)).toEqual(['missed', 'none', 'missed', 'none', 'missed', 'none', 'none', 'today']);
  });
});

describe('frequency labels', () => {
  it('matches the prototype wording', () => {
    expect(freqText({ freq_per_week: 7, freq_days: [] })).toBe('Every day');
    expect(freqText({ freq_per_week: 3, freq_days: [] })).toBe('3× a week');
    expect(freqText({ freq_per_week: 1, freq_days: [] })).toBe('Once a week');
    expect(freqText({ freq_per_week: 5, freq_days: [4, 0, 1, 2, 3] })).toBe('Weekdays');
    expect(freqText({ freq_per_week: 2, freq_days: [5, 0] })).toBe('Mon, Sat');
  });
});

describe('demo data and views', () => {
  const now = new Date(2026, 9, 5, 12);
  const db = seedDemo({}, now);
  const snap = {
    person: db.people[0], me: db.members[0], members: db.members, tasks: db.tasks, strategies: db.strategies,
    logs: db.logs, notes: db.notes, flags: db.flags, settings: db.settings,
  };
  const idx = indexLogs(snap.logs);

  it('flags "Batch on Mondays" for review and keeps the others going', () => {
    const byName = Object.fromEntries(
      snap.strategies.filter((s) => !s.ended_on).map((s) => [s.name, strategyStats(s, idx, snap.settings, TODAY, false)]),
    );
    expect(byName['Batch on Mondays'].status).toBe('Not working');
    expect(byName['Batch on Mondays'].review).toBe(true);
    expect(byName['Alarm + pill organizer'].status).toBe('Working');
    expect(byName['Online body-doubling'].status).toBe('Too early');
  });

  it("lists today's plan with two tasks already done", () => {
    const plan = todayPlan(snap, idx, TODAY);
    expect(plan).toHaveLength(5);
    expect(plan.filter((p) => p.log).map((p) => p.task.title)).toEqual(['Took medicine', 'Made personas']);
  });

  it('uses the previous strategy for days before a switch', () => {
    const task = snap.tasks[4];
    const current = snap.strategies.find((s) => s.task_id === task.id && !s.ended_on)!;
    expect(strategyOn(snap.strategies, task.id, current.started_on)?.id).toBe(current.id);
    expect(strategyOn(snap.strategies, task.id, addDays(current.started_on, -1))?.name).toBe('Reading alone');
  });

  it('summarises a week and a day', () => {
    const wk = weekRows(snap, idx, mondayOf(TODAY), TODAY);
    expect(wk.rows).toHaveLength(5);
    expect(wk.done).toBe(2);
    expect(wk.rows[0].cells.slice(1)).toEqual(['future', 'future', 'future', 'future', 'future', 'future']);
    const yesterday = dayInfo(snap, idx, addDays(TODAY, -1), TODAY);
    expect(yesterday.rows.map((r) => r.state)).toContain('Done');
  });
});

describe('oklch conversion', () => {
  it('converts the design colours to hex', () => {
    expect(oklch(1, 0, 0)).toBe('#ffffff');
    expect(oklch(0, 0, 0)).toBe('#000000');
    expect(oklch(0.94, 0.035, 135)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
