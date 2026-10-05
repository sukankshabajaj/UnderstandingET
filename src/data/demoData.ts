// Sample data for demo mode (Sam, 28, and Dr. Okafor), built relative to today's date.
import { DEFAULT_SETTINGS } from '../types';
import type { Area, Feel, Helped, Log, Member, Note, Person, Reminder, Strategy, Task, Flag, Settings } from '../types';
import { addDays, todayISO, weekdayMon0 } from '../logic/dates';

export interface DemoDB {
  version: 1;
  people: Person[];
  members: Member[];
  tasks: Task[];
  strategies: Strategy[];
  logs: Log[];
  notes: Note[];
  flags: Flag[];
  settings: Settings;
  /** Which demo user you are acting as. */
  userId: string;
}

export const DEMO_USERS = {
  self: { id: 'demo-user-sam', name: 'Sam' },
  support: { id: 'demo-user-support', name: 'Alex' },
  therapist: { id: 'demo-user-therapist', name: 'Dr. Okafor' },
} as const;

let counter = 0;
export const demoId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

interface SeedTask {
  title: string;
  area: Area;
  icon: string;
  today?: { feel: Feel; helped: Helped };
  strat: {
    name: string;
    desc: string;
    steps: string[];
    timer: number;
    hist: (Helped | null)[]; // one entry per past day of the trial, oldest first; null = not done
    len: number;
    prev: string;
    freq?: { n: number; days: number[] };
    reminder?: Reminder;
  };
}

const SEED: SeedTask[] = [
  {
    title: 'Took medicine', area: 'daily', icon: 'medication', today: { feel: 'Easy', helped: 2 },
    strat: { name: 'Alarm + pill organizer', desc: 'Phone alarm labelled "meds", organizer next to the kettle.', steps: ['Alarm goes off', 'Take meds from the organizer', 'Dismiss the alarm'], timer: 0, hist: [2, 2, 2, 1, 2, 2, null, 2, 2, 2, 2, 2, 2, 2, 1, 2], len: 21, prev: 'Remembering on my own', reminder: '08:00' },
  },
  {
    title: 'Posted online', area: 'work', icon: 'campaign',
    strat: { name: 'Batch on Mondays', desc: 'Write all posts for the week in one Monday session.', steps: ['Open the drafts doc', 'Write one post', 'Schedule it', 'Repeat for the week'], timer: 0, hist: [1, 0, 0, null, 0, 1, 0, 0, null, 0, 0, 1, 0, null, 0, 0], len: 21, prev: 'Posting when inspired', freq: { n: 3, days: [] } },
  },
  {
    title: 'Made personas', area: 'work', icon: 'groups', today: { feel: 'Okay', helped: 1 },
    strat: { name: 'Pomodoro (25/5)', desc: '25 minutes of focused work, then a 5 minute break away from the desk.', steps: ['Close chat and email', 'Pick one persona', 'Start the timer', 'Break when it rings'], timer: 25, hist: [1, 2, 1, 1, null, 2, 1, 2, 1, 1, 2, 1, 1, null, 2, 1], len: 21, prev: 'Working until done', freq: { n: 5, days: [0, 1, 2, 3, 4] } },
  },
  {
    title: 'Clothes ready before sleep', area: 'daily', icon: 'checkroom',
    strat: { name: 'Chair by the bed', desc: "Tomorrow's outfit goes on the chair before brushing teeth.", steps: ["Check tomorrow's weather", 'Pick the outfit', 'Put it on the chair'], timer: 0, hist: [2, null, 2, 2, 1, 2, null, 2, 2, 2], len: 14, prev: 'Choosing in the morning', reminder: '19:00' },
  },
  {
    title: 'Course reading', area: 'school', icon: 'menu_book',
    strat: { name: 'Online body-doubling', desc: 'Read on a video call with a study partner, cameras on.', steps: ['Join the study call', 'Say your goal out loud', 'Read one chapter'], timer: 0, hist: [2, 1, null], len: 14, prev: 'Reading alone' },
  },
];

export interface DemoSeedOptions {
  firstName?: string;
  ageBand?: Person['age_band'];
  pictureMode?: boolean;
  readAloud?: boolean;
  reduceMotion?: boolean;
  trackedAreas?: Area[];
  userRole?: keyof typeof DEMO_USERS;
}

export function seedDemo(opts: DemoSeedOptions = {}, now = new Date()): DemoDB {
  const today = todayISO(now);
  const personId = 'demo-person-sam';
  const name = opts.firstName?.trim() || 'Sam';
  const created = new Date(now.getTime() - 30 * 86400000).toISOString();
  const person: Person = {
    id: personId,
    first_name: name,
    age_band: opts.ageBand ?? '25-34',
    dx_tags: ['ADHD'],
    needs: ['Starting tasks', 'Remembering'],
    tracked_areas: opts.trackedAreas ?? ['daily', 'work', 'school'],
    picture_mode: opts.pictureMode ?? false,
    read_aloud: opts.readAloud ?? false,
    reduce_motion: opts.reduceMotion ?? false,
    private_notifications: true,
  };
  const members: Member[] = [
    { id: 'demo-m-self', person_id: personId, user_id: DEMO_USERS.self.id, role: 'self', relation_label: null, display_name: name },
    { id: 'demo-m-support', person_id: personId, user_id: DEMO_USERS.support.id, role: 'support', relation_label: 'Partner', display_name: DEMO_USERS.support.name },
    { id: 'demo-m-therapist', person_id: personId, user_id: DEMO_USERS.therapist.id, role: 'therapist', relation_label: null, display_name: DEMO_USERS.therapist.name },
  ];
  const tasks: Task[] = [];
  const strategies: Strategy[] = [];
  const logs: Log[] = [];
  SEED.forEach((seed, i) => {
    const taskId = `demo-task-${i}`;
    const startedOn = addDays(today, -seed.strat.hist.length);
    tasks.push({ id: taskId, person_id: personId, title: seed.title, area: seed.area, icon: seed.icon, active: true, created_at: new Date(now.getTime() - (40 - i) * 86400000).toISOString() });
    const prevId = `demo-strategy-${i}-prev`;
    strategies.push({
      id: prevId, task_id: taskId, person_id: personId, name: seed.strat.prev, description: '', steps: [], timer_minutes: 0,
      freq_per_week: 7, freq_days: [], reminder: null, trial_length_days: 14, started_on: addDays(startedOn, -14),
      ended_on: startedOn, end_reason: 'switched', replaced_strategy_id: null,
    });
    const strategyId = `demo-strategy-${i}`;
    const freqDays = seed.strat.freq?.days ?? [];
    strategies.push({
      id: strategyId, task_id: taskId, person_id: personId, name: seed.strat.name, description: seed.strat.desc,
      steps: seed.strat.steps, timer_minutes: seed.strat.timer, freq_per_week: seed.strat.freq?.n ?? 7, freq_days: freqDays,
      reminder: seed.strat.reminder ?? null, trial_length_days: seed.strat.len, started_on: startedOn, ended_on: null,
      end_reason: null, replaced_strategy_id: prevId,
    });
    seed.strat.hist.forEach((helped, d) => {
      const date = addDays(startedOn, d);
      if (helped == null || (freqDays.length && !freqDays.includes(weekdayMon0(date)))) return;
      logs.push({ id: `demo-log-${i}-${d}`, strategy_id: strategyId, task_id: taskId, person_id: personId, date, done: true, feel: helped === 2 ? 'Easy' : helped === 1 ? 'Okay' : 'Hard', helped });
    });
    if (seed.today && (!freqDays.length || freqDays.includes(weekdayMon0(today)))) {
      logs.push({ id: `demo-log-${i}-today`, strategy_id: strategyId, task_id: taskId, person_id: personId, date: today, done: true, feel: seed.today.feel, helped: seed.today.helped });
    }
  });
  const ago = (days: number, hour = 18) => {
    const d = new Date(now.getTime() - days * 86400000);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const notes: Note[] = [
    { id: 'demo-n1', person_id: personId, author_id: DEMO_USERS.self.id, author_name: name, author_role: 'self', text: 'Posting feels like a wall right now.', feeling: 'Overwhelmed', kind: 'note', created_at: ago(1) },
    { id: 'demo-n2', person_id: personId, author_id: DEMO_USERS.therapist.id, author_name: DEMO_USERS.therapist.name, author_role: 'therapist', text: 'Batching posts on Mondays is not sticking. Let us talk about alternatives at the next session.', feeling: null, kind: 'note', created_at: ago(4, 11) },
  ];
  const userRole = opts.userRole ?? 'self';
  return { version: 1, people: [person], members, tasks, strategies, logs, notes, flags: [], settings: { ...DEFAULT_SETTINGS }, userId: DEMO_USERS[userRole].id };
}
