// App-wide state: who is signed in, which person we are looking at, their data, navigation,
// bottom sheets and toasts. Screens read from useApp() and call its actions.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler } from 'react-native';
import type { AuthUser, Backend, NewTaskInput, PersonSettingsPatch } from '../data/backend';
import { friendlyError } from '../data/backend';
import { DemoBackend } from '../data/demoBackend';
import { indexLogs, type LogIndex } from '../logic/stats';
import { todayISO } from '../logic/dates';
import { syncReminders } from '../notifications';
import type { Area, Feel, Feeling, Helped, InviteResult, NewPerson, PersonSummary, Reminder, Role, Snapshot } from '../types';

export type RouteName =
  | 'loading'
  | 'welcome'
  | 'auth'
  | 'join'
  | 'ob-who'
  | 'ob-profile'
  | 'ob-needs'
  | 'ob-access'
  | 'ob-team'
  | 'ob-ready'
  | 'clients'
  | 'today'
  | 'task'
  | 'checkin'
  | 'tracker'
  | 'myweek'
  | 'notes'
  | 'overview'
  | 'strategy'
  | 'settings';

export interface Route {
  name: RouteName;
  params?: { taskId?: string; strategyId?: string; authMode?: 'signin' | 'signup' };
}

export type SheetState =
  | { kind: 'add' }
  | { kind: 'feeling'; feeling: Feeling | null }
  | { kind: 'done'; taskId: string }
  | { kind: 'switch'; strategyId: string };

export interface OnboardingDraft {
  who: 'self' | 'client' | null;
  name: string;
  age: NewPerson['age_band'] | null;
  ageConfirmed: boolean;
  dx: string[];
  needs: string[];
  areas: Area[];
  pics: boolean;
  read: boolean;
  motion: boolean;
  email1: string;
  email2: string;
}

export const emptyDraft = (): OnboardingDraft => ({
  who: null,
  name: '',
  age: null,
  ageConfirmed: false,
  dx: [],
  needs: [],
  areas: ['daily', 'school'],
  pics: false,
  read: false,
  motion: false,
  email1: '',
  email2: '',
});

const LAST_PERSON = 'stepwise-last-person';

export const homeFor = (role: Role): RouteName => (role === 'self' ? 'today' : 'overview');

function useAppValue(backend: Backend) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [stack, setStack] = useState<Route[]>([{ name: 'loading' }]);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [created, setCreated] = useState<{ personId: string; invites: InviteResult[] } | null>(null);
  const [intent, setIntent] = useState<'start' | 'join' | null>(null);
  const [today, setToday] = useState(todayISO());
  const [doneCount, setDoneCount] = useState(0);
  const [demoRole, setDemoRoleState] = useState<Role>('self');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapRef = useRef<Snapshot | null>(null);
  snapRef.current = snap;

  const route = stack[stack.length - 1];

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const go = useCallback((name: RouteName, params?: Route['params']) => setStack((s) => [...s, { name, params }]), []);
  const reset = useCallback((name: RouteName, params?: Route['params']) => setStack([{ name, params }]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  const loadPerson = useCallback(
    async (personId: string) => {
      const data = await backend.load(personId);
      setSnap(data);
      setToday(todayISO());
      if (data.me.role === 'self') syncReminders(data).catch(() => {});
      return data;
    },
    [backend],
  );

  const openPerson = useCallback(
    async (personId: string) => {
      const [data, list] = await Promise.all([loadPerson(personId), backend.listPeople()]);
      setPeople(list);
      AsyncStorage.setItem(LAST_PERSON, personId).catch(() => {});
      if (data.me.role === 'therapist') backend.recordView(personId).catch(() => {});
      reset(homeFor(data.me.role));
    },
    [backend, loadPerson, reset],
  );

  /** Works out where to go after launch or sign-in. */
  const enter = useCallback(
    async (nextIntent: 'start' | 'join' | null = null) => {
      try {
        const u = await backend.getUser();
        setUser(u);
        if (backend instanceof DemoBackend) setDemoRoleState(await backend.demoRole());
        if (!u) {
          setSnap(null);
          reset('welcome');
          return;
        }
        const list = await backend.listPeople();
        setPeople(list);
        if (nextIntent === 'start') return reset('ob-who');
        if (nextIntent === 'join') return reset('join');
        if (!list.length) {
          setSnap(null);
          return reset('welcome');
        }
        const isTherapist = list.some((p) => p.role === 'therapist');
        const last = await AsyncStorage.getItem(LAST_PERSON).catch(() => null);
        const lastOk = last && list.some((p) => p.person.id === last);
        if (isTherapist && list.length > 1 && !lastOk) return reset('clients');
        await openPerson(lastOk ? last! : list[0].person.id);
      } catch (e) {
        toast(friendlyError(e));
        reset('welcome');
      }
    },
    [backend, openPerson, reset, toast],
  );

  useEffect(() => {
    enter();
    const off = backend.onAuthChange((u) => {
      setUser(u);
      if (!u) {
        // Signed out (or the session expired): back to the start.
        setSnap(null);
        reset('welcome');
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend]);

  const refresh = useCallback(async () => {
    const current = snapRef.current;
    if (!current) return;
    try {
      await loadPerson(current.person.id);
    } catch (e) {
      toast(friendlyError(e));
    }
  }, [loadPerson, toast]);

  // Refresh when the app comes back to the foreground (picks up teammates' changes and a new day).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Android hardware back button.
  const stackLen = stack.length;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) {
        setSheet(null);
        return true;
      }
      if (stackLen > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [sheet, stackLen, back]);

  /** Runs a change, then reloads the person's data. Shows a friendly toast on errors. */
  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      try {
        await fn();
        await refresh();
        if (success) toast(success);
        return true;
      } catch (e) {
        toast(friendlyError(e));
        return false;
      }
    },
    [refresh, toast],
  );

  const personId = snap?.person.id ?? '';

  const actions = useMemo(
    () => ({
      tick: async (taskId: string) => {
        const s = snapRef.current;
        if (!s) return;
        const strategy = s.strategies.find((x) => x.task_id === taskId && !x.ended_on);
        if (!strategy) return;
        const date = todayISO();
        const logged = s.logs.some((l) => l.strategy_id === strategy.id && l.date === date);
        if (logged) {
          await run(() => backend.deleteLog(strategy.id, date));
        } else if (await run(() => backend.saveLog({ personId: s.person.id, strategyId: strategy.id, taskId, date, feel: null, helped: null }))) {
          setDoneCount((n) => n + 1);
          setSheet({ kind: 'done', taskId });
        }
      },
      checkIn: async (taskId: string, feel: Feel, helped: Helped) => {
        const s = snapRef.current;
        if (!s) return;
        const strategy = s.strategies.find((x) => x.task_id === taskId && !x.ended_on);
        if (!strategy) return;
        if (await run(() => backend.saveLog({ personId: s.person.id, strategyId: strategy.id, taskId, date: todayISO(), feel, helped }))) {
          reset('today');
          setDoneCount((n) => n + 1);
          setSheet({ kind: 'done', taskId });
        }
      },
      setReminder: (strategyId: string, reminder: Reminder | null, success?: string) => run(() => backend.setReminder(strategyId, reminder), success),
      addTask: (input: NewTaskInput) => run(() => backend.addTask(personId, input), 'Task added for everyone'),
      archiveTask: (taskId: string) => run(() => backend.archiveTask(taskId), 'Task removed from the plan'),
      switchStrategy: (strategyId: string, next: { name: string; description: string }) => run(() => backend.switchStrategy(strategyId, next), `${next.name} starts today`),
      extendTrial: (strategyId: string, days: number) => run(() => backend.extendTrial(strategyId), `Trial extended by ${days} days`),
      setFlag: (strategyId: string, on: boolean, success?: string) => run(() => backend.setFlag(strategyId, on), success),
      logFeeling: (feeling: Feeling, note: string) => run(() => backend.logFeeling(personId, feeling, note)),
      addNote: (text: string) => run(() => backend.addNote(personId, text)),
      updatePerson: (patch: PersonSettingsPatch) => run(() => backend.updatePerson(personId, patch)),
      removeMember: (membershipId: string, success: string) => run(() => backend.removeMember(membershipId), success),
      createInvite: async (role: Role) => {
        try {
          const code = await backend.createInvite(personId, role);
          await refresh();
          return code;
        } catch (e) {
          toast(friendlyError(e));
          return null;
        }
      },
      deletePerson: async () => {
        try {
          await backend.deletePerson(personId);
          await AsyncStorage.removeItem(LAST_PERSON).catch(() => {});
          setSnap(null);
          toast('Profile deleted');
          await enter();
        } catch (e) {
          toast(friendlyError(e));
        }
      },
    }),
    [backend, personId, refresh, reset, run, toast, enter],
  );

  const idx: LogIndex = useMemo(() => indexLogs(snap?.logs ?? []), [snap]);

  return {
    backend,
    user,
    people,
    snap,
    idx,
    today,
    route,
    stackLen,
    go,
    reset,
    back,
    sheet,
    openSheet: setSheet,
    closeSheet: () => setSheet(null),
    toastMsg,
    toast,
    draft,
    setDraft,
    created,
    setCreated,
    intent,
    setIntent,
    doneCount,
    demoRole,
    enter,
    openPerson,
    refresh,
    actions,
  };
}

export type AppValue = ReturnType<typeof useAppValue>;

const Ctx = createContext<AppValue | null>(null);

export function AppProvider({ backend, children }: { backend: Backend; children: React.ReactNode }) {
  const value = useAppValue(backend);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

/** Shortcut for screens that only make sense once a person is loaded. */
export function useSnap() {
  const app = useApp();
  if (!app.snap) throw new Error('No person loaded');
  return { ...app, snap: app.snap };
}
