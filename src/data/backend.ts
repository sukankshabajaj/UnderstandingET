// The app talks to its data through this interface. There are two versions:
//  - DemoBackend: sample data kept on this device (no account needed)
//  - SupabaseBackend: the real, shared database for clients and their teams
import type { InviteResult, NewPerson, NewStrategy, Person, PersonSummary, Reminder, Role, Snapshot, Area, Feel, Helped, Feeling } from '../types';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  ageConfirmed: boolean;
  consentVersion: string;
}

export interface NewTaskInput {
  title: string;
  area: Area;
  icon: string;
  strategy: NewStrategy;
}

export type PersonSettingsPatch = Partial<Pick<Person, 'picture_mode' | 'read_aloud' | 'reduce_motion' | 'private_notifications'>>;

export interface Backend {
  readonly mode: 'demo' | 'live';

  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** The Privacy Policy / Terms version this user last agreed to (null if none). */
  getConsentVersion(): Promise<string | null>;
  acceptConsent(version: string): Promise<void>;
  /** Withdraws consent and permanently deletes the signed-in account and the profiles it owns. */
  deleteAccount(): Promise<void>;

  /** True if this user's email is on the clinic's list of clinicians (can create client profiles). */
  isClinician(): Promise<boolean>;
  listPeople(): Promise<PersonSummary[]>;
  createPerson(input: NewPerson): Promise<{ personId: string; invites: InviteResult[] }>;
  redeemInvite(code: string): Promise<string>;
  createInvite(personId: string, role: Role, email?: string, relation?: string): Promise<string>;
  load(personId: string): Promise<Snapshot>;

  saveLog(input: { personId: string; strategyId: string; taskId: string; date: string; feel: Feel | null; helped: Helped | null }): Promise<void>;
  deleteLog(strategyId: string, date: string): Promise<void>;
  addTask(personId: string, input: NewTaskInput): Promise<void>;
  archiveTask(taskId: string): Promise<void>;
  switchStrategy(strategyId: string, next: { name: string; description: string }): Promise<void>;
  extendTrial(strategyId: string): Promise<void>;
  setFlag(strategyId: string, flagged: boolean): Promise<void>;
  setReminder(strategyId: string, reminder: Reminder | null): Promise<void>;
  logFeeling(personId: string, feeling: Feeling, note: string): Promise<void>;
  addNote(personId: string, text: string): Promise<void>;
  updatePerson(personId: string, patch: PersonSettingsPatch): Promise<void>;
  removeMember(membershipId: string): Promise<void>;
  deletePerson(personId: string): Promise<void>;
  recordView(personId: string): Promise<void>;
}

/** Turns database/network errors into short, friendly sentences. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/Invalid login credentials/i.test(msg)) return 'That email and password do not match.';
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/User already registered/i.test(msg)) return 'There is already an account with that email. Try signing in.';
  if (/Password should be at least/i.test(msg)) return 'Please use a password with at least 8 characters.';
  if (/Failed to fetch|Network request failed/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg || 'Something went wrong. Please try again.';
}
