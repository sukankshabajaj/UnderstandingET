// The adult's own views: Today, a task, the check-in and My week.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSnap } from '../state/app';
import { AREAS, AREA_KEYS, FEELINGS, FEEL_OPTS, HELP_OPTS, REMINDERS, DAY_LETTER } from '../constants';
import { colors, deep, mid, tint, HELP_HUE } from '../theme';
import { BackLink, Btn, Card, Col, Grid, Icon, IconBtn, Row, T } from '../ui/kit';
import { longDate, weekdayMon0 } from '../logic/dates';
import { areaWeek, freqText, strategyStats, todayPlan, activeTasks, type TaskDay } from '../logic/stats';
import { speak } from '../speech';
import { confirm } from '../confirm';
import type { Feel, Helped } from '../types';

export function useAccess() {
  const { snap } = useSnap();
  return { words: !snap.person.picture_mode, readAloud: snap.person.read_aloud || snap.person.picture_mode };
}

export function TaskRow({ item, onOpen, onTick }: { item: TaskDay; onOpen: () => void; onTick: () => void }) {
  const { words } = useAccess();
  const a = AREAS[item.task.area];
  const done = !!item.log;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 6, paddingRight: 6, paddingLeft: 14, opacity: done ? 0.65 : 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.task.title}`} onPress={onOpen} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint(a.h), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={item.task.icon ?? a.icon} size={26} color={deep(a.h)} />
        </View>
        <Col gap={2} style={{ flex: 1 }}>
          <T bold size={16}>
            {item.task.title}
          </T>
          {words ? (
            <T size={13} color={colors.muted}>
              {item.strategy.name}
            </T>
          ) : null}
        </Col>
      </Pressable>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`${item.task.title} done`} onPress={onTick} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: done ? deep(a.h) : colors.inputBorder, backgroundColor: done ? deep(a.h) : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {done ? <Icon name="check" size={18} color="#fff" /> : null}
        </View>
      </Pressable>
    </View>
  );
}

export function Today() {
  const app = useSnap();
  const { snap, idx, today } = app;
  const { readAloud } = useAccess();
  const plan = todayPlan(snap, idx, today);
  const done = plan.filter((p) => p.log).length;
  const next = plan.find((p) => !p.log);
  return (
    <Col gap={20}>
      <Row justify="space-between" align="flex-start" style={{ paddingTop: 8 }}>
        <Col gap={4} style={{ flex: 1 }}>
          <T size={15} color={colors.muted}>
            {longDate(today)}
          </T>
          <T heading size={30}>
            Hi {snap.person.first_name}
          </T>
        </Col>
        <IconBtn icon="settings" label="Settings" onPress={() => app.go('settings')} color={colors.secondary} />
      </Row>
      {plan.length ? (
        <Col gap={8}>
          <Row justify="space-between">
            <T bold size={15}>
              {done} of {plan.length} done
            </T>
            <T size={15} color={colors.muted}>
              today
            </T>
          </Row>
          <Row gap={4}>
            {plan.map((p) => (
              <View key={p.task.id} style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: p.log ? deep(AREAS[p.task.area].h) : colors.border }} />
            ))}
          </Row>
        </Col>
      ) : null}
      <Card gap={10} pad={14}>
        <T bold size={15}>
          How are you feeling?
        </T>
        <Grid cols={3}>
          {FEELINGS.map((f) => (
            <Pressable key={f.label} accessibilityRole="button" accessibilityLabel={`Feeling ${f.label}`} onPress={() => app.openSheet({ kind: 'feeling', feeling: f.label })} style={{ alignItems: 'center', gap: 6, backgroundColor: tint(f.h), borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4, minHeight: 56 }}>
              <Icon name={f.icon} size={26} color={deep(f.h)} />
              <T bold size={13} align="center">
                {f.label}
              </T>
            </Pressable>
          ))}
        </Grid>
      </Card>
      {next ? (
        <View style={{ backgroundColor: tint(AREAS[next.task.area].h), borderRadius: 24, padding: 20, gap: 14 }}>
          <Row justify="space-between" style={{ minHeight: 24 }}>
            <T bold size={13} upper color={deep(AREAS[next.task.area].h)}>
              Up next
            </T>
            {readAloud ? <IconBtn icon="volume_up" label="Read aloud" bg="#fff" style={{ marginVertical: -10, marginRight: -6 }} onPress={() => speak(`${next.task.title}. ${next.strategy.name}`)} /> : null}
          </Row>
          <Col gap={4}>
            <T heading size={24}>
              {next.task.title}
            </T>
            <T size={15} color={colors.body}>
              Strategy: {next.strategy.name}
            </T>
          </Col>
          <Btn label="Start" size="md" onPress={() => app.go('task', { taskId: next.task.id })} />
        </View>
      ) : plan.length ? (
        <View style={{ backgroundColor: tint(150), borderRadius: 24, padding: 20 }}>
          <T bold size={18}>
            All done for today.
          </T>
        </View>
      ) : null}
      <Col gap={10}>
        <Row justify="space-between">
          <T bold size={15}>
            Today's plan
          </T>
          <Btn label="+ Add task" size="sm" onPress={() => app.openSheet({ kind: 'add' })} />
        </Row>
        {plan.length ? (
          plan.map((p) => <TaskRow key={p.task.id} item={p} onOpen={() => app.go('task', { taskId: p.task.id })} onTick={() => app.actions.tick(p.task.id)} />)
        ) : (
          <Card>
            <T size={15} lh={1.45} color={colors.secondary}>
              {activeTasks(snap).length
                ? 'Nothing planned for today. Enjoy the day!'
                : 'No tasks yet. Add a task and the strategy you want to try, or wait for your therapist to add one.'}
            </T>
          </Card>
        )}
      </Col>
    </Col>
  );
}

export function TaskScreen() {
  const app = useSnap();
  const { snap, route } = app;
  const { readAloud } = useAccess();
  const task = snap.tasks.find((t) => t.id === route.params?.taskId);
  const strategy = task && snap.strategies.find((s) => s.task_id === task.id && !s.ended_on);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [secs, setSecs] = useState((strategy?.timer_minutes ?? 0) * 60);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);
  if (!task || !strategy) return <BackLink onPress={app.back} />;
  const a = AREAS[task.area];
  return (
    <Col gap={20}>
      <BackLink onPress={app.back} />
      <Col gap={8}>
        <View style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: tint(a.h) }}>
          <T bold size={13} color={deep(a.h)}>
            {a.name}
          </T>
        </View>
        <T heading size={28}>
          {task.title}
        </T>
      </Col>
      <Card gap={4}>
        <T size={13} color={colors.muted}>
          Your strategy
        </T>
        <T bold size={18}>
          {strategy.name}
        </T>
        {strategy.description ? (
          <T size={14} color={colors.secondary} lh={1.45}>
            {strategy.description}
          </T>
        ) : null}
        <T size={13} color={colors.muted} style={{ paddingTop: 4 }}>
          {freqText(strategy)} · {strategy.reminder ? `Reminder ${REMINDERS[strategy.reminder].time}` : 'No reminder'}
        </T>
      </Card>
      {strategy.timer_minutes > 0 ? (
        <Row justify="space-between" style={{ backgroundColor: tint(a.h), borderRadius: 20, padding: 18 }}>
          <Col gap={2}>
            <T bold size={13} color={deep(a.h)}>
              Work timer
            </T>
            <T bold size={40} style={{ fontVariant: ['tabular-nums'] }}>
              {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
            </T>
          </Col>
          <Btn
            label={running ? 'Pause' : secs === 0 ? 'Restart' : 'Start'}
            size="md"
            onPress={() => {
              if (secs === 0) {
                setSecs(strategy.timer_minutes * 60);
                return;
              }
              setRunning(!running);
            }}
          />
        </Row>
      ) : null}
      {strategy.steps.length ? (
        <Col gap={8}>
          <Row justify="space-between">
            <T bold size={15}>
              Steps
            </T>
            {readAloud ? <Btn label="Read aloud" icon="volume_up" variant="secondary" size="sm" style={{ minHeight: 44 }} onPress={() => speak(`${task.title}. ${strategy.steps.map((x, i) => `Step ${i + 1}. ${x}`).join('. ')}`)} /> : null}
          </Row>
          {strategy.steps.map((step, i) => {
            const on = !!checked[i];
            return (
              <Pressable
                key={i}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => setChecked((c) => Object.assign([...c], { [i]: !on }))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 16, padding: 14, minHeight: 56 }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: on ? deep(a.h) : colors.inputBorder, backgroundColor: on ? deep(a.h) : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Icon name="check" size={18} color="#fff" /> : null}
                </View>
                <T size={16} color={on ? colors.muted : colors.primary} style={{ flex: 1, textDecorationLine: on ? 'line-through' : 'none' }}>
                  {step}
                </T>
              </Pressable>
            );
          })}
        </Col>
      ) : null}
      <Btn label="I'm done" onPress={() => app.go('checkin', { taskId: task.id })} />
      <Btn
        label="Remove this task"
        variant="ghost"
        size="md"
        onPress={async () => {
          if (await confirm('Remove this task?', 'It comes off the plan for everyone. Its history is kept.', 'Remove')) {
            if (await app.actions.archiveTask(task.id)) app.reset('today');
          }
        }}
      />
    </Col>
  );
}

export function CheckIn() {
  const app = useSnap();
  const { snap, route } = app;
  const task = snap.tasks.find((t) => t.id === route.params?.taskId);
  const strategy = task && snap.strategies.find((s) => s.task_id === task.id && !s.ended_on);
  const existing = strategy && app.idx.get(strategy.id)?.get(app.today);
  const [feel, setFeel] = useState<Feel | null>(existing?.feel ?? null);
  const [helped, setHelped] = useState<Helped | null>(existing?.helped ?? null);
  const [busy, setBusy] = useState(false);
  if (!task || !strategy) return <BackLink onPress={app.back} />;
  return (
    <Col gap={24}>
      <BackLink onPress={app.back} />
      <T heading size={26} lh={1.2}>
        {task.title}: how did it go?
      </T>
      <Row gap={10}>
        {FEEL_OPTS.map((o) => {
          const on = feel === o.label;
          return (
            <Pressable key={o.label} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setFeel(o.label)} style={{ flex: 1, alignItems: 'center', gap: 10, borderWidth: 2, borderColor: on ? deep(o.h) : colors.border, backgroundColor: on ? tint(o.h) : '#fff', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 6 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: tint(o.h), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={o.icon} size={34} color={deep(o.h)} />
              </View>
              <T bold size={16}>
                {o.label}
              </T>
            </Pressable>
          );
        })}
      </Row>
      <T heading size={20} lh={1.3}>
        Did "{strategy.name}" help?
      </T>
      <Col gap={8}>
        {HELP_OPTS.map((o) => {
          const on = helped === o.value;
          const h = HELP_HUE[o.value];
          return (
            <Pressable key={o.label} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setHelped(o.value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: on ? deep(h) : colors.border, backgroundColor: on ? tint(h) : '#fff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, minHeight: 56 }}>
              <Icon name={o.icon} size={28} color={deep(h)} />
              <T bold size={17}>
                {o.label}
              </T>
            </Pressable>
          );
        })}
      </Col>
      <Btn
        label={busy ? 'Saving…' : 'Save'}
        disabled={!feel || helped == null || busy}
        onPress={async () => {
          if (!feel || helped == null) return;
          setBusy(true);
          await app.actions.checkIn(task.id, feel, helped);
          setBusy(false);
        }}
      />
    </Col>
  );
}

export function MyWeek() {
  const app = useSnap();
  const { snap, idx, today } = app;
  const areas = AREA_KEYS.filter((k) => snap.person.tracked_areas.includes(k) || snap.tasks.some((t) => t.active && t.area === k));
  const helping = activeTasks(snap).filter(({ strategy }) => strategyStats(strategy, idx, snap.settings, today, false).status === 'Working');
  return (
    <Col gap={18}>
      <T heading size={28} style={{ paddingTop: 8 }}>
        My week
      </T>
      {areas.map((k) => {
        const a = AREAS[k];
        const w = areaWeek(snap, idx, k, today);
        return (
          <Card key={k} gap={12}>
            <Row justify="space-between" align="baseline">
              <T bold size={17}>
                {a.name}
              </T>
              <T size={14} color={colors.muted}>
                {w.count} of {w.total} done
              </T>
            </Row>
            <Row gap={6}>
              {w.days.map((d) => (
                <Col key={d.date} gap={6} style={{ flex: 1, alignItems: 'center' }}>
                  <View
                    style={{
                      width: '100%',
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: d.total && d.done === d.total ? mid(a.h) : d.done ? tint(a.h) : '#fff',
                      borderWidth: d.done ? 0 : 1,
                      borderColor: colors.border,
                    }}
                  />
                  <T size={12} color={colors.muted}>
                    {DAY_LETTER[weekdayMon0(d.date)]}
                  </T>
                </Col>
              ))}
            </Row>
          </Card>
        );
      })}
      <Col gap={8}>
        <T bold size={15}>
          What's helping you
        </T>
        {helping.length ? (
          helping.map(({ task, strategy }) => (
            <Row key={strategy.id} gap={12} style={{ backgroundColor: tint(150), borderRadius: 16, padding: 14 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.helpingDot }} />
              <Col gap={2}>
                <T bold size={16}>
                  {strategy.name}
                </T>
                <T size={13} color={colors.body}>
                  for {task.title.toLowerCase()}
                </T>
              </Col>
            </Row>
          ))
        ) : (
          <T size={14} color={colors.muted} lh={1.45}>
            Keep checking in. Strategies that help will show up here.
          </T>
        )}
      </Col>
    </Col>
  );
}

