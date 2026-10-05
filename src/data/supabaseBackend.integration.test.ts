// Runs the real SupabaseBackend against a running Supabase (local or a test project).
// Skipped unless SUPABASE_TEST_URL and SUPABASE_TEST_ANON_KEY are set, and the project has
// `okafor@clinic.com` in public.clinicians. Never point this at your production project.
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => {
  const m = new Map<string, string>();
  return { default: { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v), removeItem: async (k: string) => void m.delete(k) } };
});

const URL = process.env.SUPABASE_TEST_URL;
const KEY = process.env.SUPABASE_TEST_ANON_KEY;
const run = URL && KEY ? describe : describe.skip;

run('SupabaseBackend (live)', () => {
  const stamp = Date.now();
  const pw = 'correct-horse-battery';
  type B = import('./supabaseBackend').SupabaseBackend;
  let sam: B, alex: B, okafor: B, young: B;
  let personId = '';
  let codes: Record<string, string> = {};

  beforeAll(async () => {
    const { SupabaseBackend } = await import('./supabaseBackend');
    const make = (k: string) => new SupabaseBackend(URL!, KEY!, { storageKey: `test-${k}` });
    [sam, alex, okafor, young] = [make('sam'), make('alex'), make('okafor'), make('young')];
    const signUp = (b: B, email: string, name: string) => b.signUp({ email, password: pw, displayName: name, ageConfirmed: true, consentVersion: '2026-10' });
    await signUp(sam, `sam${stamp}@example.com`, 'Sam');
    await signUp(alex, `alex${stamp}@example.com`, 'Alex');
    // The clinician email must be on the clinicians list; reuse it across runs by signing in if it exists.
    await signUp(okafor, 'okafor@clinic.com', 'Dr. Okafor').catch(() => okafor.signIn('okafor@clinic.com', pw));
    if (!(await okafor.getUser())) await okafor.signIn('okafor@clinic.com', pw);
  });

  it('refuses sign-up without the 18+ confirmation', async () => {
    await expect(young.signUp({ email: `young${stamp}@example.com`, password: pw, displayName: 'Y', ageConfirmed: false, consentVersion: '2026-10' })).rejects.toThrow(/18/);
  });

  it('lets an adult create their own profile and invite their team', async () => {
    expect(await sam.isClinician()).toBe(false);
    await expect(sam.createPerson({ first_name: 'Jo', age_band: '25-34', age_confirmed: true, dx_tags: [], needs: [], tracked_areas: [], picture_mode: false, read_aloud: false, reduce_motion: false, my_role: 'therapist', invites: [] })).rejects.toThrow(/clinicians/);
    const res = await sam.createPerson({
      first_name: 'Sam', age_band: '25-34', age_confirmed: true, dx_tags: ['ADHD'], needs: ['Remembering'], tracked_areas: ['daily', 'work'],
      picture_mode: false, read_aloud: true, reduce_motion: false, my_role: 'self',
      invites: [{ role: 'support', email: `alex${stamp}@example.com` }, { role: 'therapist', email: 'okafor@clinic.com' }],
    });
    personId = res.personId;
    codes = Object.fromEntries(res.invites.map((i) => [i.role, i.code]));
    expect(Object.keys(codes).sort()).toEqual(['support', 'therapist']);
    const people = await sam.listPeople();
    expect(people).toHaveLength(1);
    expect(people[0].role).toBe('self');
  });

  it('adds a task, ticks it, rates it and unticks it', async () => {
    await sam.addTask(personId, { title: 'Took medicine', area: 'daily', icon: 'medication', strategy: { name: 'Alarm + pill organizer', description: '', steps: ['Alarm', 'Take meds'], timer_minutes: 0, freq_per_week: 7, freq_days: [], reminder: null } });
    let snap = await sam.load(personId);
    expect(snap.tasks).toHaveLength(1);
    expect(snap.me.role).toBe('self');
    expect(snap.me.display_name).toBe('Sam');
    const s = snap.strategies[0];
    expect(s.steps).toEqual(['Alarm', 'Take meds']);
    expect(s.trial_length_days).toBe(14);
    const date = new Date().toISOString().slice(0, 10);
    await sam.saveLog({ personId, strategyId: s.id, taskId: s.task_id, date, feel: null, helped: null });
    await sam.saveLog({ personId, strategyId: s.id, taskId: s.task_id, date, feel: 'Easy', helped: 2 });
    snap = await sam.load(personId);
    expect(snap.logs).toHaveLength(1);
    expect(snap.logs[0].helped).toBe(2);
    await sam.deleteLog(s.id, date);
    expect((await sam.load(personId)).logs).toHaveLength(0);
    await sam.setReminder(s.id, 'morning');
    expect((await sam.load(personId)).strategies[0].reminder).toBe('morning');
    expect(snap.notes.some((n) => n.kind === 'system' && /Added "Took medicine"/.test(n.text))).toBe(true);
  });

  it('lets a support person join, flag and post but not invite or switch', async () => {
    await expect(alex.load(personId)).rejects.toBeTruthy();
    await expect(alex.redeemInvite('000000')).rejects.toThrow(/not valid/);
    expect(await alex.redeemInvite(codes.support)).toBe(personId);
    await expect(sam.redeemInvite(codes.support)).rejects.toThrow(/not valid/);
    const snap = await alex.load(personId);
    expect(snap.me.role).toBe('support');
    expect(snap.members.map((m) => m.display_name).sort()).toEqual(['Alex', 'Sam']);
    const sid = snap.strategies[0].id;
    await alex.setFlag(sid, true);
    await alex.addNote(personId, 'Mornings are rushed this week.');
    await alex.logFeeling(personId, 'Worried', '');
    await expect(alex.createInvite(personId, 'support')).rejects.toThrow(/cannot invite/);
    await expect(alex.switchStrategy(sid, { name: 'X', description: '' })).rejects.toThrow(/therapist/);
    await expect(alex.updatePerson(personId, { picture_mode: true })).rejects.toThrow(/Only the person/);
    const after = await alex.load(personId);
    expect(after.flags).toHaveLength(1);
    expect(after.notes.find((n) => n.text === 'Mornings are rushed this week.')?.author_name).toBe('Alex');
    expect(after.notes.find((n) => n.feeling === 'Worried')?.text).toBe('Feeling worried.');
  });

  it('lets the therapist join, extend and switch', async () => {
    expect(await okafor.isClinician()).toBe(true);
    expect(await okafor.redeemInvite(codes.therapist)).toBe(personId);
    await okafor.recordView(personId);
    let snap = await okafor.load(personId);
    const sid = snap.strategies[0].id;
    await okafor.extendTrial(sid);
    snap = await okafor.load(personId);
    expect(snap.strategies[0].trial_length_days).toBe(21);
    expect(snap.flags).toHaveLength(0);
    await okafor.switchStrategy(sid, { name: 'Token board', description: 'Earn a token per part' });
    snap = await okafor.load(personId);
    const current = snap.strategies.find((s) => !s.ended_on)!;
    expect(current.name).toBe('Token board');
    expect(current.replaced_strategy_id).toBe(sid);
    expect(snap.notes[0].text).toMatch(/Switched took medicine from Alarm \+ pill organizer to Token board/);
  });

  it('lets the therapist set up a second client profile', async () => {
    const res = await okafor.createPerson({ first_name: 'Jo', age_band: '35-49', age_confirmed: true, dx_tags: [], needs: [], tracked_areas: ['work'], picture_mode: true, read_aloud: true, reduce_motion: true, my_role: 'therapist', invites: [{ role: 'self', email: 'jo@example.com' }] });
    expect(res.invites[0].role).toBe('self');
    const list = await okafor.listPeople();
    expect(list.filter((p) => p.role === 'therapist').length).toBeGreaterThanOrEqual(2);
    await okafor.deletePerson(res.personId);
  });

  it('lets the adult change settings, remove support and delete everything', async () => {
    await sam.updatePerson(personId, { picture_mode: true });
    let snap = await sam.load(personId);
    expect(snap.person.picture_mode).toBe(true);
    const alexMember = snap.members.find((m) => m.role === 'support')!;
    await sam.removeMember(alexMember.id);
    expect(await alex.listPeople()).toHaveLength(0);
    await sam.archiveTask(snap.tasks[0].id);
    snap = await sam.load(personId);
    expect(snap.tasks).toHaveLength(0);
    await sam.deletePerson(personId);
    expect(await sam.listPeople()).toHaveLength(0);
    expect(await okafor.listPeople().then((l) => l.some((p) => p.person.id === personId))).toBe(false);
  });

  it('signs out', async () => {
    await sam.signOut();
    expect(await sam.getUser()).toBeNull();
  });
});
