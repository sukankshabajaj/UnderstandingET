// Bottom sheets: Add task, Log a feeling, Well done, Switch strategy.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSnap } from '../state/app';
import { AREAS, AREA_KEYS, DAY_LETTER, DONE_TITLES, FEELING, FEELINGS, FREQS, STRATEGY_LIBRARY, TASK_ICONS, formatTime, iconForTask } from '../constants';
import { colors, deep, mid, tint } from '../theme';
import { Btn, Choice, Col, Emoji, Field, Grid, Icon, Input, Row, ShareChoice, Sheet, T, TimePicker } from '../ui/kit';
import { freqText, todayPlan } from '../logic/stats';
import type { Area, Feeling, Reminder } from '../types';

export function Sheets() {
  const app = useSnap();
  const s = app.sheet;
  const rm = app.snap.person.reduce_motion;
  return (
    <>
      <Sheet visible={s?.kind === 'add'} onClose={app.closeSheet} reduceMotion={rm} scroll>
        {s?.kind === 'add' ? <TaskForm /> : null}
      </Sheet>
      <Sheet visible={s?.kind === 'edit'} onClose={app.closeSheet} reduceMotion={rm} scroll>
        {s?.kind === 'edit' ? <TaskForm taskId={s.taskId} /> : null}
      </Sheet>
      <Sheet visible={s?.kind === 'feeling'} onClose={app.closeSheet} reduceMotion={rm}>
        {s?.kind === 'feeling' ? <FeelingSheet initial={s.feeling} /> : null}
      </Sheet>
      <Sheet visible={s?.kind === 'done'} onClose={app.closeSheet} reduceMotion={rm}>
        {s?.kind === 'done' ? <WellDone taskId={s.taskId} /> : null}
      </Sheet>
      <Sheet visible={s?.kind === 'switch'} onClose={app.closeSheet} reduceMotion={rm} scroll>
        {s?.kind === 'switch' ? <SwitchSheet strategyId={s.strategyId} /> : null}
      </Sheet>
    </>
  );
}

/** Add a new task, or edit an existing one (and its current strategy) when taskId is given. */
function TaskForm({ taskId }: { taskId?: string }) {
  const app = useSnap();
  const task = taskId ? app.snap.tasks.find((t) => t.id === taskId) : undefined;
  const cur = task ? app.snap.strategies.find((s) => s.task_id === task.id && !s.ended_on) : undefined;
  const editing = !!task && !!cur;
  const [title, setTitle] = useState(task?.title ?? '');
  const [area, setArea] = useState<Area>(task?.area ?? (app.snap.person.tracked_areas[0] as Area) ?? 'daily');
  const [icon, setIcon] = useState<string | null>(task?.icon ?? null); // null = pick automatically from the title
  const [strat, setStrat] = useState(cur?.name ?? '');
  const [desc, setDesc] = useState(cur?.description ?? '');
  const [steps, setSteps] = useState<string[]>(cur?.steps.length ? cur.steps : ['']);
  const [freq, setFreq] = useState(cur && !cur.freq_days.length ? cur.freq_per_week : 7);
  const [days, setDays] = useState<number[]>(cur?.freq_days ?? []);
  const [rem, setRem] = useState<Reminder | null>(cur?.reminder ?? null);
  const [busy, setBusy] = useState(false);
  const ok = !!title.trim() && !!strat.trim();
  const name = app.snap.person.first_name;
  const shownIcon = icon ?? iconForTask(title, area);
  const save = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const input = {
      title: title.trim(),
      area,
      icon: shownIcon,
      strategy: {
        name: strat.trim(),
        description: desc.trim(),
        steps: steps.map((x) => x.trim()).filter(Boolean),
        timer_minutes: cur?.timer_minutes ?? 0,
        freq_per_week: days.length || freq,
        freq_days: [...days].sort((a, b) => a - b),
        reminder: rem,
      },
    };
    const done = editing ? await app.actions.editTask(task!.id, input) : await app.actions.addTask(input);
    setBusy(false);
    if (done) app.closeSheet();
  };
  return (
    <Col gap={16}>
      <Col gap={4}>
        <T heading size={20}>
          {editing ? 'Edit task' : 'New task'}
        </T>
        <T size={14} color={colors.muted} lh={1.4}>
          {editing
            ? 'Fix or update the details. The trial and its results are kept. To try a different strategy, use "Switch strategy".'
            : `Everyone on ${name}'s team can add tasks. It shows up for ${name} and the whole team.`}
        </T>
      </Col>
      <Field label="Task">
        <Input value={title} onChangeText={setTitle} placeholder="e.g. Medicines morning" />
      </Field>
      <Field label="Icon">
        <Grid cols={6} gap={6}>
          {TASK_ICONS.map((ic) => {
            const on = ic === shownIcon;
            return (
              <Pressable
                key={ic}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={ic.replace(/_/g, ' ')}
                onPress={() => setIcon(ic)}
                style={{ height: 48, borderRadius: 12, borderWidth: 2, borderColor: on ? deep(AREAS[area].h) : colors.border, backgroundColor: on ? tint(AREAS[area].h) : '#fff', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name={ic} size={24} color={on ? deep(AREAS[area].h) : colors.secondary} />
              </Pressable>
            );
          })}
        </Grid>
      </Field>
      <Field label="Area">
        <Grid cols={2}>
          {AREA_KEYS.map((k) => (
            <Choice key={k} selected={area === k} onPress={() => setArea(k)} border={deep(AREAS[k].h)} bg={tint(AREAS[k].h)}>
              <T bold size={14}>
                {AREAS[k].name}
              </T>
            </Choice>
          ))}
        </Grid>
      </Field>
      <Field label="Strategy to try">
        <Input value={strat} onChangeText={setStrat} placeholder="e.g. Pill box by the kettle" />
      </Field>
      {editing ? (
        <Field label="How the strategy works" optional>
          <Input value={desc} onChangeText={setDesc} placeholder="A short description" multiline style={{ minHeight: 64, textAlignVertical: 'top' }} />
        </Field>
      ) : null}
      <Field label="Steps to follow" optional>
        {steps.map((v, i) => (
          <Row key={i} gap={6}>
            <T bold size={14} color={colors.muted} align="center" style={{ width: 24 }}>
              {i + 1}
            </T>
            <Input value={v} onChangeText={(t) => setSteps((a) => Object.assign([...a], { [i]: t }))} placeholder={i === 0 ? 'e.g. Check the weather' : 'Next step'} style={{ flex: 1, minWidth: 0, borderRadius: 12, padding: 12, fontSize: 15 }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Remove step" onPress={() => setSteps((a) => (a.length > 1 ? a.filter((_, k) => k !== i) : ['']))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <T size={20} color={colors.muted}>
                ×
              </T>
            </Pressable>
          </Row>
        ))}
        <Pressable accessibilityRole="button" onPress={() => setSteps((a) => [...a, ''])} style={{ alignSelf: 'flex-start', paddingVertical: 8, minHeight: 44, justifyContent: 'center' }}>
          <T bold size={15}>
            + Add a step
          </T>
        </Pressable>
      </Field>
      <Field label="How often">
        <Grid cols={2}>
          {FREQS.map(([l, n]) => (
            <Choice key={l} selected={!days.length && freq === n} onPress={() => { setFreq(n); setDays([]); }}>
              <T bold size={14}>
                {l}
              </T>
            </Choice>
          ))}
        </Grid>
      </Field>
      <Field label="Choose days" optional>
        <Row gap={4}>
          {DAY_LETTER.map((l, i) => {
            const on = days.includes(i);
            return (
              <Pressable key={i} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]} onPress={() => setDays((d) => (on ? d.filter((x) => x !== i) : [...d, i]))} style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 2, borderColor: on ? colors.pickBorder : colors.border, backgroundColor: on ? colors.pickBorder : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <T bold size={14} color={on ? '#fff' : colors.primary}>
                  {l}
                </T>
              </Pressable>
            );
          })}
        </Row>
        <T size={13} color={colors.muted}>
          {days.length ? `${freqText({ freq_per_week: days.length, freq_days: days })}. Tap a day again to remove it.` : `No set days. Any day counts toward ${freqText({ freq_per_week: freq, freq_days: [] }).toLowerCase()}.`}
        </T>
      </Field>
      {app.reminders.shown ? (
        <Field label="Reminder" optional>
          <Grid cols={2}>
            <Choice selected={rem === null} onPress={() => setRem(null)}>
              <T bold size={14}>
                No reminder
              </T>
            </Choice>
            <Choice selected={rem !== null} onPress={() => setRem(rem ?? '19:00')}>
              <T bold size={14}>
                Remind me
              </T>
            </Choice>
          </Grid>
          {rem !== null ? <TimePicker value={rem} onChange={setRem} /> : null}
          {app.reminders.webNote ? <ReminderWebNote /> : null}
        </Field>
      ) : null}
      <Btn label={busy ? 'Saving…' : editing ? 'Save changes' : 'Add task'} size="md" disabled={!ok || busy} onPress={save} />
    </Col>
  );
}

function FeelingSheet({ initial }: { initial: Feeling | null }) {
  const app = useSnap();
  const [feel, setFeel] = useState<Feeling | null>(initial);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const isSelf = app.snap.me.role === 'self';
  const [shared, setShared] = useState(app.snap.person.share_by_default);
  if (saved && feel) {
    const f = FEELING[feel];
    return (
      <Col gap={16} style={{ alignItems: 'center', paddingTop: 8, paddingHorizontal: 4 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: tint(f.h), alignItems: 'center', justifyContent: 'center' }}>
          <Emoji size={40}>{f.emoji}</Emoji>
        </View>
        <T heading size={22}>
          {f.title}
        </T>
        <T size={16} lh={1.5} color="#3D3A34" align="center">
          {f.text}
        </T>
        <View style={{ width: '100%', backgroundColor: tint(f.h), borderRadius: 16, padding: 14, gap: 4 }}>
          <T bold size={13} color={colors.secondary}>
            Try this
          </T>
          <T bold size={16} lh={1.4}>
            {f.tip}
          </T>
        </View>
        <T size={13} color={colors.muted}>
          {!isSelf ? 'Saved to Notes.' : shared ? 'Saved to Notes. Your team can see it.' : '🔒 Saved to your private log. Only you can see it.'}
        </T>
        <Btn label="Done" size="md" style={{ alignSelf: 'stretch' }} onPress={app.closeSheet} />
      </Col>
    );
  }
  return (
    <Col gap={14}>
      <T heading size={20}>
        How are you feeling?
      </T>
      <Grid cols={3} gap={8}>
        {FEELINGS.map((f) => {
          const on = feel === f.label;
          return (
            <Pressable key={f.label} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setFeel(f.label)} style={{ alignItems: 'center', gap: 8, borderWidth: 2, borderColor: on ? deep(f.h) : colors.border, backgroundColor: on ? tint(f.h) : '#fff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 4 }}>
              <Emoji size={32}>{f.emoji}</Emoji>
              <T bold size={14}>
                {f.label}
              </T>
            </Pressable>
          );
        })}
      </Grid>
      <Input value={note} onChangeText={setNote} placeholder="Want to add a note? (optional)" />
      {isSelf ? <ShareChoice shared={shared} onChange={setShared} /> : null}
      <Btn
        label={busy ? 'Saving…' : 'Save'}
        size="md"
        disabled={!feel || busy}
        onPress={async () => {
          if (!feel) return;
          setBusy(true);
          if (await app.actions.logFeeling(feel, note, isSelf && !shared)) setSaved(true);
          setBusy(false);
        }}
      />
    </Col>
  );
}

function WellDone({ taskId }: { taskId: string }) {
  const app = useSnap();
  const { snap, idx, today } = app;
  const task = snap.tasks.find((t) => t.id === taskId);
  const strategy = snap.strategies.find((s) => s.task_id === taskId && !s.ended_on);
  const [picking, setPicking] = useState(false);
  const [time, setTime] = useState('19:00');
  if (!task || !strategy) return null;
  const a = AREAS[task.area];
  const left = todayPlan(snap, idx, today).filter((p) => !p.log).length;
  const rem = strategy.reminder;
  return (
    <Col gap={16} style={{ alignItems: 'center' }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: tint(a.h), alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: deep(a.h), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={28} color="#fff" />
        </View>
      </View>
      <Col gap={6} style={{ alignItems: 'center' }}>
        <T heading size={26}>
          {DONE_TITLES[(app.doneCount - 1 + DONE_TITLES.length) % DONE_TITLES.length]}
        </T>
        <T size={17} color="#3D3A34" align="center">
          {left ? `Keep going! ${left} ${left === 1 ? 'task' : 'tasks'} left today.` : 'Everything is done for today.'}
        </T>
      </Col>
      {!app.reminders.shown ? null : !rem ? (
        <View style={{ alignSelf: 'stretch', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, gap: 10 }}>
          <T bold size={16}>
            Want a reminder for {task.title.toLowerCase()} next time?
          </T>
          {picking ? (
            <>
              <TimePicker value={time} onChange={setTime} />
              <Btn
                label={`Remind me at ${formatTime(time)}`}
                size="md"
                onPress={async () => {
                  app.closeSheet();
                  await app.actions.setReminder(strategy.id, time, `Reminder set for ${formatTime(time)}`);
                }}
              />
              {app.reminders.webNote ? <ReminderWebNote /> : null}
            </>
          ) : (
            <Btn label="Choose a time" icon="schedule" variant="secondary" size="md" onPress={() => setPicking(true)} />
          )}
        </View>
      ) : (
        <T size={14} color={colors.muted}>
          Reminder set for {formatTime(rem)}.
        </T>
      )}
      <Btn label={rem || !app.reminders.shown ? 'Done' : 'No thanks'} size="md" style={{ alignSelf: 'stretch' }} onPress={app.closeSheet} />
    </Col>
  );
}

function SwitchSheet({ strategyId }: { strategyId: string }) {
  const app = useSnap();
  const { snap } = app;
  const strategy = snap.strategies.find((s) => s.id === strategyId);
  const task = strategy && snap.tasks.find((t) => t.id === strategy.task_id);
  const [pick, setPick] = useState<string | null>(null);
  const [own, setOwn] = useState({ name: '', desc: '' });
  const [busy, setBusy] = useState(false);
  if (!strategy || !task) return null;
  const options = STRATEGY_LIBRARY.filter((a) => a.name !== strategy.name);
  const chosen = pick === '__own' ? (own.name.trim() ? { name: own.name.trim(), description: own.desc.trim() } : null) : (() => {
    const a = options.find((o) => o.name === pick);
    return a ? { name: a.name, description: a.desc } : null;
  })();
  return (
    <Col gap={12}>
      <T heading size={20}>
        Replace {strategy.name}
      </T>
      <T size={14} color={colors.muted}>
        Starts a new {snap.settings.trial_days}-day trial for {task.title}.
      </T>
      {options.map((a) => (
        <Pressable key={a.name} accessibilityRole="radio" accessibilityState={{ selected: pick === a.name }} onPress={() => setPick(a.name)} style={{ gap: 3, borderWidth: 2, borderColor: pick === a.name ? colors.primary : colors.border, backgroundColor: '#fff', borderRadius: 16, padding: 14 }}>
          <T bold size={16}>
            {a.name}
          </T>
          <T size={13} color={colors.muted} lh={1.4}>
            {a.desc}
          </T>
        </Pressable>
      ))}
      <Pressable accessibilityRole="radio" accessibilityState={{ selected: pick === '__own' }} onPress={() => setPick('__own')} style={{ gap: 8, borderWidth: 2, borderColor: pick === '__own' ? colors.primary : colors.border, backgroundColor: '#fff', borderRadius: 16, padding: 14 }}>
        <T bold size={16}>
          Write a new strategy
        </T>
        {pick === '__own' ? (
          <>
            <Input value={own.name} onChangeText={(t) => setOwn((o) => ({ ...o, name: t }))} placeholder="Strategy name" />
            <Input value={own.desc} onChangeText={(t) => setOwn((o) => ({ ...o, desc: t }))} placeholder="How it works (optional)" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
          </>
        ) : null}
      </Pressable>
      <Btn
        label={busy ? 'Starting…' : 'Start trial'}
        size="md"
        disabled={!chosen || busy}
        onPress={async () => {
          if (!chosen) return;
          setBusy(true);
          const done = await app.actions.switchStrategy(strategy.id, chosen);
          setBusy(false);
          if (done) {
            app.closeSheet();
            app.reset('overview');
          }
        }}
      />
    </Col>
  );
}

/** Shown with reminder settings in the web version (the demo), where phone reminders can't be delivered. */
function ReminderWebNote() {
  return (
    <T size={13} color={colors.muted} lh={1.4}>
      Reminders are sent by the Stepwise phone app. In this web version they are saved but not sent.
    </T>
  );
}
