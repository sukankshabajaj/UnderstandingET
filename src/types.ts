// Shared data shapes. These mirror the tables in supabase/migrations.

export type Role = 'self' | 'support' | 'therapist';
export type Area = 'daily' | 'school' | 'work' | 'chores';
export type Reminder = 'morning' | 'afternoon' | 'evening';
export type Feel = 'Easy' | 'Okay' | 'Hard';
export type Helped = 0 | 1 | 2; // 2 = yes, 1 = a little, 0 = no
export type Feeling = 'Calm' | 'Happy' | 'Tired' | 'Worried' | 'Frustrated' | 'Overwhelmed';
export type AgeBand = '18-24' | '25-34' | '35-49' | '50+';

export interface Person {
  id: string;
  first_name: string;
  age_band: AgeBand;
  dx_tags: string[];
  needs: string[];
  tracked_areas: Area[];
  picture_mode: boolean;
  read_aloud: boolean;
  reduce_motion: boolean;
  private_notifications: boolean;
}

export interface Member {
  id: string;
  person_id: string;
  user_id: string;
  role: Role;
  relation_label: string | null;
  display_name: string;
}

export interface Task {
  id: string;
  person_id: string;
  title: string;
  area: Area;
  icon: string | null;
  active: boolean;
  created_at: string;
}

export interface Strategy {
  id: string;
  task_id: string;
  person_id: string;
  name: string;
  description: string;
  steps: string[];
  timer_minutes: number;
  freq_per_week: number;
  freq_days: number[]; // 0 = Mon … 6 = Sun; overrides freq_per_week when set
  reminder: Reminder | null;
  trial_length_days: number;
  started_on: string; // YYYY-MM-DD
  ended_on: string | null;
  end_reason: 'switched' | 'completed' | null;
  replaced_strategy_id: string | null;
}

export interface Log {
  id: string;
  strategy_id: string;
  task_id: string;
  person_id: string;
  date: string; // YYYY-MM-DD
  done: boolean;
  feel: Feel | null;
  helped: Helped | null; // null = ticked but not rated
}

export interface Note {
  id: string;
  person_id: string;
  author_id: string | null;
  author_name: string;
  author_role: Role | null;
  text: string;
  feeling: Feeling | null;
  kind: 'note' | 'system';
  created_at: string;
}

export interface Flag {
  id: string;
  strategy_id: string;
  flagged_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Settings {
  min_rated_logs: number;
  working_rate: number;
  mixed_rate: number;
  review_day: number;
  target_rate: number;
  trial_days: number;
  extend_days: number;
}

export const DEFAULT_SETTINGS: Settings = {
  min_rated_logs: 5,
  working_rate: 0.65,
  mixed_rate: 0.45,
  review_day: 10,
  target_rate: 0.6,
  trial_days: 14,
  extend_days: 7,
};

/** Everything the app needs to show one person's data. */
export interface Snapshot {
  person: Person;
  me: Member;
  members: Member[];
  tasks: Task[];
  strategies: Strategy[];
  logs: Log[];
  notes: Note[];
  flags: Flag[];
  settings: Settings;
}

export interface PersonSummary {
  person: Person;
  role: Role;
}

export interface NewStrategy {
  name: string;
  description: string;
  steps: string[];
  timer_minutes: number;
  freq_per_week: number;
  freq_days: number[];
  reminder: Reminder | null;
}

export interface NewPerson {
  first_name: string;
  age_band: AgeBand;
  age_confirmed: boolean;
  dx_tags: string[];
  needs: string[];
  tracked_areas: Area[];
  picture_mode: boolean;
  read_aloud: boolean;
  reduce_motion: boolean;
  my_role: 'self' | 'therapist';
  invites: { role: Role; email: string; relation_label?: string }[];
}

export interface InviteResult {
  role: Role;
  email: string;
  code: string;
}
