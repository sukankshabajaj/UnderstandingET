import type { AgeBand, Area, Feel, Feeling, Reminder } from './types';

export const AREAS: Record<Area, { name: string; h: number; icon: string }> = {
  daily: { name: 'Daily life', h: 135, icon: 'home' },
  school: { name: 'Academics', h: 300, icon: 'school' },
  work: { name: 'Work', h: 70, icon: 'work' },
  chores: { name: 'Chores', h: 210, icon: 'cleaning_services' },
};
export const AREA_KEYS = Object.keys(AREAS) as Area[];

export interface FeelingInfo {
  label: Feeling;
  icon: string;
  h: number;
  title: string;
  text: string;
  tip: string;
}

export const FEELINGS: FeelingInfo[] = [
  { label: 'Calm', icon: 'self_improvement', h: 150, title: 'Good to hear', text: 'Feeling calm is a good time to start something tricky.', tip: 'Pick the next task while you feel steady.' },
  { label: 'Happy', icon: 'sentiment_very_satisfied', h: 95, title: 'That is great', text: 'Something is going well today.', tip: 'Add a note about what made it good, so you can do it again.' },
  { label: 'Tired', icon: 'battery_2_bar', h: 255, title: 'Thanks for noticing', text: 'Being tired makes everything harder. That is normal.', tip: 'Drink some water or take a 5 minute rest before the next task.' },
  { label: 'Worried', icon: 'sentiment_worried', h: 300, title: 'Thanks for telling us', text: 'Worries feel big. Naming them is a good first step.', tip: 'Name one thing you can control right now.' },
  { label: 'Frustrated', icon: 'sentiment_frustrated', h: 40, title: 'That is okay', text: 'Frustration means something is hard. It does not mean you are failing.', tip: 'Take a 3 minute movement break, then try one small step.' },
  { label: 'Overwhelmed', icon: 'sentiment_stressed', h: 25, title: 'Thanks for telling us', text: 'When it is too much, make the next step tiny.', tip: 'Do just one small step, or ask someone for help.' },
];
export const FEELING: Record<Feeling, FeelingInfo> = Object.fromEntries(FEELINGS.map((f) => [f.label, f])) as Record<Feeling, FeelingInfo>;

export const FEEL_OPTS: { label: Feel; h: number; icon: string }[] = [
  { label: 'Easy', h: 150, icon: 'sentiment_satisfied' },
  { label: 'Okay', h: 75, icon: 'sentiment_neutral' },
  { label: 'Hard', h: 25, icon: 'sentiment_dissatisfied' },
];

export const HELP_OPTS: { label: string; value: 0 | 1 | 2; icon: string }[] = [
  { label: 'Yes, it helped', value: 2, icon: 'thumb_up' },
  { label: 'A little', value: 1, icon: 'thumbs_up_down' },
  { label: 'No', value: 0, icon: 'thumb_down' },
];
export const HELP_LABEL = ['did not help', 'helped a little', 'helped'];

export const FREQS: [string, number][] = [
  ['Every day', 7],
  ['5× a week', 5],
  ['3× a week', 3],
  ['Once a week', 1],
];

export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Turns a reminder time like '19:30' into '7:30 pm'. */
export function formatTime(t: Reminder): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export function parseTime(t: Reminder): { hour: number; minute: number } {
  const [hour, minute] = t.split(':').map(Number);
  return { hour, minute };
}

export const DONE_TITLES = ['Well done!', 'Nice work!', 'You did it!', 'Great job!'];

export const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '35-49', label: '35–49' },
  { value: '50+', label: '50+' },
];

export const DX_OPTS = ['ADHD', 'Autism', 'Dyslexia', 'Anxiety', 'Dyspraxia', 'Other', 'Prefer not to say'];

export const NEED_OPTS: [string, string][] = [
  ['Starting tasks', 'play_circle'],
  ['Remembering', 'psychology_alt'],
  ['Changes in routine', 'swap_horiz'],
  ['Staying focused', 'center_focus_strong'],
  ['Noise and senses', 'hearing'],
  ['Big feelings', 'favorite'],
  ['Sleep', 'bedtime'],
  ['Getting organised', 'inventory_2'],
];

/** Strategy library offered when the therapist switches a strategy. */
export const STRATEGY_LIBRARY: { name: string; desc: string }[] = [
  { name: 'Token board', desc: 'Earn a token per finished part; 5 tokens = chosen break.' },
  { name: 'Chunked worksheet', desc: 'Only 3 problems visible at a time, rest folded away.' },
  { name: 'Body-doubling', desc: 'Someone sits nearby doing their own quiet task.' },
  { name: 'Choice of two', desc: 'Pick which of two tasks to do first.' },
  { name: 'Pomodoro (25/5)', desc: '25 minutes of focused work, then a 5 minute break away from the desk.' },
  { name: 'Visual checklist', desc: 'A short picture or word checklist where the task happens.' },
  { name: 'Alarm + cue card', desc: 'A labelled phone alarm plus a card where the task happens.' },
];

export { POLICY_VERSION as CONSENT_VERSION } from './legal';

/** Chooses an icon for a new task from words in its title, falling back to the area icon. */
export function iconForTask(title: string, area: Area): string {
  const t = title.toLowerCase();
  const rules: [RegExp, string][] = [
    [/medic|pill|meds|tablet/, 'medication'],
    [/cloth|outfit|dress/, 'checkroom'],
    [/math|sum/, 'calculate'],
    [/read|book/, 'menu_book'],
    [/study|course|homework|class|lecture/, 'school'],
    [/post|social|blog/, 'campaign'],
    [/persona|meeting|call|team/, 'groups'],
    [/bed|sleep/, 'bedtime'],
    [/cat|dog|pet/, 'pets'],
    [/morning|wake/, 'light_mode'],
    [/cook|meal|lunch|dinner|breakfast/, 'restaurant'],
    [/exercise|walk|run|gym/, 'directions_walk'],
    [/clean|laundry|dish|tidy/, 'cleaning_services'],
    [/email|mail/, 'mail'],
  ];
  for (const [re, icon] of rules) if (re.test(t)) return icon;
  return AREAS[area].icon;
}
