// Live mode: talks to your Supabase project. The database enforces who can see and change what
// (see supabase/migrations), so this file only needs to make the calls.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { AuthUser, Backend, NewTaskInput, PersonSettingsPatch, SignUpInput } from './backend';
import type { Feel, Feeling, Helped, Member, NewPerson, Person, PersonSummary, Reminder, Role, Snapshot } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { addDays, todayISO } from '../logic/dates';

function toAuthUser(u: User | null | undefined): AuthUser | null {
  if (!u) return null;
  return { id: u.id, email: u.email ?? '', displayName: (u.user_metadata?.display_name as string) ?? '' };
}

/** Throws the Supabase error if there is one, otherwise returns the data. */
function ok<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw res.error;
  return res.data as NonNullable<R['data']>;
}

export class SupabaseBackend implements Backend {
  readonly mode = 'live' as const;
  private sb: SupabaseClient;

  constructor(url: string, anonKey: string, options: { storageKey?: string } = {}) {
    this.sb = createClient(url, anonKey, {
      auth: {
        storageKey: options.storageKey,
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }

  async getUser() {
    const { data } = await this.sb.auth.getSession();
    return toAuthUser(data.session?.user);
  }

  onAuthChange(cb: (u: AuthUser | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_event, session) => cb(toAuthUser(session?.user)));
    return () => data.subscription.unsubscribe();
  }

  async signUp(input: SignUpInput) {
    if (!input.ageConfirmed) throw new Error('Stepwise is for adults 18 and over.');
    const res = await this.sb.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: { display_name: input.displayName.trim(), age_confirmed_18: true, consent_version: input.consentVersion },
      },
    });
    ok(res);
    return { needsConfirmation: !res.data.session };
  }

  async signIn(email: string, password: string) {
    ok(await this.sb.auth.signInWithPassword({ email: email.trim(), password }));
  }

  async resetPassword(email: string) {
    ok(await this.sb.auth.resetPasswordForEmail(email.trim()));
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async getConsentVersion() {
    const uid = await this.uid();
    const rows = ok(
      await this.sb.from('consents').select('version').eq('user_id', uid).is('withdrawn_at', null).order('accepted_at', { ascending: false }).limit(1),
    ) as { version: string }[];
    return rows[0]?.version ?? null;
  }

  async acceptConsent(version: string) {
    const uid = await this.uid();
    ok(await this.sb.from('consents').insert({ user_id: uid, version }));
  }

  async deleteAccount() {
    ok(await this.sb.rpc('delete_my_account'));
    // The account no longer exists, so just clear the session on this device.
    await this.sb.auth.signOut({ scope: 'local' });
  }

  private async uid() {
    const u = await this.getUser();
    if (!u) throw new Error('Please sign in again.');
    return u.id;
  }

  async isClinician() {
    return (ok(await this.sb.rpc('is_clinician')) as boolean) === true;
  }

  async listPeople(): Promise<PersonSummary[]> {
    const uid = await this.uid();
    const rows = ok(await this.sb.from('team_memberships').select('role, person:people(*)').eq('user_id', uid).order('created_at'));
    return (rows as unknown as { role: Role; person: Person | null }[])
      .filter((r) => r.person)
      .map((r) => ({ role: r.role, person: r.person as Person }));
  }

  async createPerson(input: NewPerson) {
    const res = ok(
      await this.sb.rpc('create_person', {
        p_first_name: input.first_name,
        p_age_band: input.age_band,
        p_age_confirmed: input.age_confirmed,
        p_dx_tags: input.dx_tags,
        p_needs: input.needs,
        p_tracked_areas: input.tracked_areas,
        p_picture_mode: input.picture_mode,
        p_read_aloud: input.read_aloud,
        p_reduce_motion: input.reduce_motion,
        p_my_role: input.my_role,
        p_invites: input.invites.filter((i) => i.email.trim()),
      }),
    ) as { person_id: string; invites: { role: Role; email: string; code: string }[] };
    return { personId: res.person_id, invites: res.invites };
  }

  async redeemInvite(code: string) {
    return ok(await this.sb.rpc('redeem_invite', { p_code: code })) as string;
  }

  async createInvite(personId: string, role: Role, email?: string, relation?: string) {
    return ok(await this.sb.rpc('create_invite', { p_person: personId, p_role: role, p_email: email ?? null, p_relation: relation ?? null })) as string;
  }

  async load(personId: string): Promise<Snapshot> {
    const uid = await this.uid();
    const since = addDays(todayISO(), -180);
    const [person, members, tasks, strategies, logs, notes, flags, settings] = await Promise.all([
      this.sb.from('people').select('*').eq('id', personId).single(),
      this.sb.from('team_memberships').select('id, person_id, user_id, role, relation_label, profile:profiles(display_name)').eq('person_id', personId).order('created_at'),
      this.sb.from('tasks').select('*').eq('person_id', personId).eq('active', true).order('created_at'),
      this.sb.from('strategies').select('*').eq('person_id', personId).order('started_on'),
      this.sb.from('logs').select('*').eq('person_id', personId).gte('date', since),
      this.sb.from('notes').select('*').eq('person_id', personId).order('created_at', { ascending: false }).limit(300),
      this.sb.from('flags').select('*').eq('person_id', personId).is('resolved_at', null),
      this.sb.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    const memberRows = ok(members) as unknown as (Omit<Member, 'display_name'> & { profile: { display_name: string } | null })[];
    const allMembers: Member[] = memberRows.map(({ profile, ...m }) => ({ ...m, display_name: profile?.display_name || 'Team member' }));
    const me = allMembers.find((m) => m.user_id === uid);
    if (!me) throw new Error('You are no longer on this team.');
    return {
      person: ok(person) as Person,
      me,
      members: allMembers,
      tasks: ok(tasks),
      strategies: ok(strategies),
      logs: ok(logs),
      notes: ok(notes),
      flags: ok(flags),
      settings: { ...DEFAULT_SETTINGS, ...((ok(settings) as object | null) ?? {}) },
    };
  }

  async saveLog(input: { personId: string; strategyId: string; taskId: string; date: string; feel: Feel | null; helped: Helped | null }) {
    const uid = await this.uid();
    ok(
      await this.sb.from('logs').upsert(
        { strategy_id: input.strategyId, task_id: input.taskId, person_id: input.personId, date: input.date, done: true, feel: input.feel, helped: input.helped, created_by: uid },
        { onConflict: 'strategy_id,date' },
      ),
    );
  }

  async deleteLog(strategyId: string, date: string) {
    ok(await this.sb.from('logs').delete().eq('strategy_id', strategyId).eq('date', date));
  }

  async addTask(personId: string, input: NewTaskInput) {
    ok(await this.sb.rpc('add_task', { p_person: personId, p_title: input.title, p_area: input.area, p_icon: input.icon, p_strategy: input.strategy }));
  }

  async archiveTask(taskId: string) {
    ok(await this.sb.rpc('archive_task', { p_task: taskId }));
  }

  async switchStrategy(strategyId: string, next: { name: string; description: string }) {
    ok(await this.sb.rpc('switch_strategy', { p_strategy: strategyId, p_new: next }));
  }

  async extendTrial(strategyId: string) {
    ok(await this.sb.rpc('extend_trial', { p_strategy: strategyId }));
  }

  async setFlag(strategyId: string, flagged: boolean) {
    ok(await this.sb.rpc('set_flag', { p_strategy: strategyId, p_flagged: flagged }));
  }

  async setReminder(strategyId: string, reminder: Reminder | null) {
    ok(await this.sb.rpc('set_reminder', { p_strategy: strategyId, p_reminder: reminder ?? '' }));
  }

  async logFeeling(personId: string, feeling: Feeling, note: string) {
    ok(await this.sb.rpc('log_feeling', { p_person: personId, p_feeling: feeling, p_note: note }));
  }

  async addNote(personId: string, text: string) {
    const uid = await this.uid();
    ok(await this.sb.from('notes').insert({ person_id: personId, author_id: uid, text: text.trim(), kind: 'note' }));
  }

  async updatePerson(personId: string, patch: PersonSettingsPatch) {
    const rows = ok(await this.sb.from('people').update(patch).eq('id', personId).select('id'));
    if (!rows?.length) throw new Error('Only the person or their therapist can change this.');
  }

  async removeMember(membershipId: string) {
    ok(await this.sb.rpc('remove_member', { p_membership: membershipId }));
  }

  async deletePerson(personId: string) {
    ok(await this.sb.rpc('delete_person', { p_person: personId }));
  }

  async recordView(personId: string) {
    ok(await this.sb.rpc('record_view', { p_person: personId }));
  }
}
