// Demo mode: the whole app works offline on one device with sample data.
// Rules (who can switch, flag, invite…) match the real database so the demo behaves the same.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Backend, NewTaskInput, PersonSettingsPatch } from './backend';
import { DEMO_USERS, demoId, seedDemo, type DemoDB } from './demoData';
import type { Feel, Feeling, Helped, Member, NewPerson, Note, Reminder, Role, Snapshot } from '../types';
import { todayISO } from '../logic/dates';
import { POLICY_VERSION } from '../legal';

const KEY = 'stepwise-demo-v2'; // v2: reminders are exact times

export type DemoRole = keyof typeof DEMO_USERS;

export class DemoBackend implements Backend {
  readonly mode = 'demo' as const;
  private db: DemoDB | null = null;
  private loaded = false;
  private listeners = new Set<(u: ReturnType<DemoBackend['user']>) => void>();

  private async read(): Promise<DemoDB | null> {
    if (!this.loaded) {
      this.loaded = true;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        this.db = raw ? (JSON.parse(raw) as DemoDB) : null;
      } catch {
        this.db = null;
      }
    }
    return this.db;
  }

  private async write(db: DemoDB | null) {
    this.db = db;
    try {
      if (db) await AsyncStorage.setItem(KEY, JSON.stringify(db));
      else await AsyncStorage.removeItem(KEY);
    } catch {
      // Storage can be unavailable (e.g. private browsing). The demo still works in memory.
    }
  }

  private async mustDb(): Promise<DemoDB> {
    const db = await this.read();
    if (!db) throw new Error('Demo data not set up yet');
    return db;
  }

  private user() {
    const uid = this.db?.userId ?? DEMO_USERS.self.id;
    const u = Object.values(DEMO_USERS).find((x) => x.id === uid) ?? DEMO_USERS.self;
    const name = uid === DEMO_USERS.self.id ? (this.db?.people[0]?.first_name ?? u.name) : u.name;
    return { id: u.id, email: 'demo@stepwise.app', displayName: name };
  }

  private me(db: DemoDB, personId: string): Member {
    const m = db.members.find((x) => x.person_id === personId && x.user_id === db.userId);
    if (!m) throw new Error("Not on this person's team");
    return m;
  }

  private note(db: DemoDB, personId: string, text: string, kind: Note['kind'] = 'system', feeling: Feeling | null = null) {
    const me = this.me(db, personId);
    db.notes.unshift({ id: demoId('n'), person_id: personId, author_id: me.user_id, author_name: me.display_name, author_role: me.role, text, feeling, kind, created_at: new Date().toISOString() });
  }

  private strategy(db: DemoDB, id: string) {
    const s = db.strategies.find((x) => x.id === id);
    if (!s) throw new Error('Strategy not found');
    return s;
  }

  // --- demo-only controls ---------------------------------------------------

  async hasData() {
    return !!(await this.read());
  }

  async demoRole(): Promise<DemoRole> {
    const db = await this.read();
    const entry = Object.entries(DEMO_USERS).find(([, u]) => u.id === db?.userId);
    return (entry?.[0] as DemoRole) ?? 'self';
  }

  async setDemoRole(role: DemoRole) {
    const db = await this.mustDb();
    db.userId = DEMO_USERS[role].id;
    await this.write(db);
    this.emit();
  }

  async startSample(role: DemoRole = 'self') {
    await this.write(seedDemo({ userRole: role }));
    this.emit();
  }

  async reset() {
    await this.write(null);
    this.emit();
  }

  private emit() {
    const u = this.user();
    this.listeners.forEach((cb) => cb(u));
  }

  // --- Backend ----------------------------------------------------------------

  async getUser() {
    await this.read();
    return this.user();
  }

  onAuthChange(cb: (u: ReturnType<DemoBackend['user']> | null) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  async signUp() {
    return { needsConfirmation: false };
  }
  async signIn() {}
  async resetPassword() {}
  async signOut() {
    await this.reset();
  }
  // The demo has no real accounts, so it never asks for consent again.
  async getConsentVersion() {
    return POLICY_VERSION;
  }
  async acceptConsent() {}
  async deleteAccount() {
    await this.reset();
  }

  async isClinician() {
    return true;
  }

  async listPeople() {
    const db = await this.read();
    if (!db) return [];
    return db.members
      .filter((m) => m.user_id === db.userId)
      .map((m) => ({ person: db.people.find((p) => p.id === m.person_id)!, role: m.role }))
      .filter((x) => x.person);
  }

  async createPerson(input: NewPerson) {
    if (!input.age_confirmed) throw new Error('Stepwise is for adults 18 and over');
    const db = seedDemo({
      firstName: input.first_name,
      ageBand: input.age_band,
      pictureMode: input.picture_mode,
      readAloud: input.read_aloud,
      reduceMotion: input.reduce_motion,
      trackedAreas: input.tracked_areas,
      userRole: input.my_role,
    });
    db.people[0].dx_tags = input.dx_tags;
    db.people[0].needs = input.needs;
    await this.write(db);
    this.emit();
    const invites = input.invites
      .filter((i) => i.email.trim())
      .map((i) => ({ role: i.role, email: i.email.trim(), code: randomCode() }));
    return { personId: db.people[0].id, invites };
  }

  async redeemInvite(code: string) {
    if (!/^\d{6}$/.test(code)) throw new Error('That code is not valid or has expired');
    // In the demo, any 6 digits joins the sample team as the support person.
    let db = await this.read();
    if (!db) db = seedDemo({ userRole: 'support' });
    db.userId = DEMO_USERS.support.id;
    await this.write(db);
    this.emit();
    return db.people[0].id;
  }

  async createInvite(personId: string, role: Role) {
    const db = await this.mustDb();
    const me = this.me(db, personId);
    if (me.role === 'support') throw new Error('Support members cannot invite people');
    if (role === 'self' && (me.role !== 'therapist' || db.members.some((m) => m.person_id === personId && m.role === 'self')))
      throw new Error('This profile already has its owner');
    this.note(db, personId, `Created an invite code for a new ${role === 'self' ? 'profile owner' : role === 'support' ? 'support person' : 'therapist'}.`);
    await this.write(db);
    return randomCode();
  }

  async load(personId: string): Promise<Snapshot> {
    const db = await this.mustDb();
    const person = db.people.find((p) => p.id === personId);
    if (!person) throw new Error('Profile not found');
    const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
    return clone({
      person,
      me: this.me(db, personId),
      members: db.members.filter((m) => m.person_id === personId),
      tasks: db.tasks.filter((t) => t.person_id === personId && t.active),
      strategies: db.strategies.filter((s) => s.person_id === personId),
      logs: db.logs.filter((l) => l.person_id === personId),
      notes: db.notes.filter((n) => n.person_id === personId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      flags: db.flags.filter((f) => db.strategies.some((s) => s.id === f.strategy_id && s.person_id === personId) && !f.resolved_at),
      settings: db.settings,
    });
  }

  async saveLog(input: { personId: string; strategyId: string; taskId: string; date: string; feel: Feel | null; helped: Helped | null }) {
    const db = await this.mustDb();
    this.me(db, input.personId);
    const existing = db.logs.find((l) => l.strategy_id === input.strategyId && l.date === input.date);
    if (existing) Object.assign(existing, { done: true, feel: input.feel, helped: input.helped });
    else db.logs.push({ id: demoId('l'), strategy_id: input.strategyId, task_id: input.taskId, person_id: input.personId, date: input.date, done: true, feel: input.feel, helped: input.helped });
    await this.write(db);
  }

  async deleteLog(strategyId: string, date: string) {
    const db = await this.mustDb();
    db.logs = db.logs.filter((l) => !(l.strategy_id === strategyId && l.date === date));
    await this.write(db);
  }

  async addTask(personId: string, input: NewTaskInput) {
    const db = await this.mustDb();
    this.me(db, personId);
    const taskId = demoId('t');
    db.tasks.push({ id: taskId, person_id: personId, title: input.title.trim(), area: input.area, icon: input.icon, active: true, created_at: new Date().toISOString() });
    db.strategies.push({ id: demoId('s'), task_id: taskId, person_id: personId, ...input.strategy, name: input.strategy.name.trim(), trial_length_days: db.settings.trial_days, started_on: todayISO(), ended_on: null, end_reason: null, replaced_strategy_id: null });
    this.note(db, personId, `Added "${input.title.trim()}" with strategy "${input.strategy.name.trim()}".`);
    await this.write(db);
  }

  async archiveTask(taskId: string) {
    const db = await this.mustDb();
    const t = db.tasks.find((x) => x.id === taskId);
    if (!t) return;
    t.active = false;
    this.note(db, t.person_id, `Removed "${t.title}" from the plan.`);
    await this.write(db);
  }

  async switchStrategy(strategyId: string, next: { name: string; description: string }) {
    const db = await this.mustDb();
    const old = this.strategy(db, strategyId);
    if (this.me(db, old.person_id).role !== 'therapist') throw new Error('Only the therapist can switch a strategy');
    const today = todayISO();
    old.ended_on = today;
    old.end_reason = 'switched';
    db.strategies.push({ ...old, id: demoId('s'), name: next.name.trim(), description: next.description, timer_minutes: 0, trial_length_days: db.settings.trial_days, started_on: today, ended_on: null, end_reason: null, replaced_strategy_id: old.id });
    db.flags.forEach((f) => f.strategy_id === old.id && !f.resolved_at && (f.resolved_at = new Date().toISOString()));
    const task = db.tasks.find((t) => t.id === old.task_id)!;
    this.note(db, old.person_id, `Switched ${task.title.toLowerCase()} from ${old.name} to ${next.name.trim()}. New ${db.settings.trial_days}-day trial.`);
    await this.write(db);
  }

  async extendTrial(strategyId: string) {
    const db = await this.mustDb();
    const s = this.strategy(db, strategyId);
    if (this.me(db, s.person_id).role !== 'therapist') throw new Error('Only the therapist can extend a trial');
    s.trial_length_days += db.settings.extend_days;
    db.flags.forEach((f) => f.strategy_id === s.id && !f.resolved_at && (f.resolved_at = new Date().toISOString()));
    this.note(db, s.person_id, `Extended the ${s.name} trial by ${db.settings.extend_days} days.`);
    await this.write(db);
  }

  async setFlag(strategyId: string, flagged: boolean) {
    const db = await this.mustDb();
    const s = this.strategy(db, strategyId);
    if (this.me(db, s.person_id).role === 'self') throw new Error('Only support or the therapist can flag a strategy');
    const open = db.flags.find((f) => f.strategy_id === s.id && !f.resolved_at);
    if (flagged && !open) {
      db.flags.push({ id: demoId('f'), strategy_id: s.id, flagged_by: db.userId, created_at: new Date().toISOString(), resolved_at: null });
      this.note(db, s.person_id, `Flagged ${s.name} for review.`);
    } else if (!flagged && open) {
      open.resolved_at = new Date().toISOString();
    }
    await this.write(db);
  }

  async setReminder(strategyId: string, reminder: Reminder | null) {
    const db = await this.mustDb();
    this.strategy(db, strategyId).reminder = reminder;
    await this.write(db);
  }

  async logFeeling(personId: string, feeling: Feeling, note: string) {
    const db = await this.mustDb();
    this.note(db, personId, note.trim() || `Feeling ${feeling.toLowerCase()}.`, 'note', feeling);
    await this.write(db);
  }

  async addNote(personId: string, text: string) {
    const db = await this.mustDb();
    this.note(db, personId, text.trim(), 'note');
    await this.write(db);
  }

  async updatePerson(personId: string, patch: PersonSettingsPatch) {
    const db = await this.mustDb();
    if (this.me(db, personId).role === 'support') throw new Error('Only the person or their therapist can change this');
    Object.assign(db.people.find((p) => p.id === personId)!, patch);
    await this.write(db);
  }

  async removeMember(membershipId: string) {
    const db = await this.mustDb();
    const m = db.members.find((x) => x.id === membershipId);
    if (!m) return;
    const me = this.me(db, m.person_id);
    if (m.role === 'self') throw new Error('The profile owner cannot be removed');
    if (!(m.user_id === me.user_id || me.role === 'self' || (me.role === 'therapist' && m.role === 'therapist')))
      throw new Error('You cannot remove this person');
    this.note(db, m.person_id, m.user_id === me.user_id ? 'Left the team.' : `Removed ${m.display_name} from the team.`);
    db.members = db.members.filter((x) => x.id !== membershipId);
    await this.write(db);
  }

  async deletePerson() {
    await this.reset();
  }

  async recordView() {}
}

function randomCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}
