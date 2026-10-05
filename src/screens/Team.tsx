// Support / therapist views: Overview and Strategy detail. Plus Notes (all roles) and the therapist's client list.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp, useSnap } from '../state/app';
import { AGE_BANDS, AREAS, FEELING, HELP_LABEL } from '../constants';
import { colors, deep, mid, tint, HELP } from '../theme';
import { BackLink, Btn, Card, Col, Icon, IconBtn, Input, Row, T } from '../ui/kit';
import { relativeDay, shortDate } from '../logic/dates';
import { activeTasks, openFlag, pct, strategyStats, todayPlan, verdict, STATUS_HUE, type StrategyStats } from '../logic/stats';
import type { Member, Snapshot, Strategy } from '../types';

export function roleLabel(m: Pick<Member, 'role' | 'relation_label'>) {
  return m.role === 'self' ? 'Client' : m.role === 'therapist' ? 'Therapist' : m.relation_label || 'Support';
}

const ageLabel = (snap: Snapshot) => AGE_BANDS.find((a) => a.value === snap.person.age_band)?.label ?? '';

function StatusChip({ st, size = 12 }: { st: StrategyStats; size?: number }) {
  const hue = STATUS_HUE[st.status];
  return (
    <View style={{ paddingVertical: size > 12 ? 5 : 4, paddingHorizontal: size > 12 ? 12 : 10, borderRadius: 8, backgroundColor: hue ? tint(hue) : '#ECEBE6', alignSelf: 'flex-start' }}>
      <T bold size={size} color={hue ? deep(hue) : colors.secondary}>
        {st.status}
      </T>
    </View>
  );
}

const sparkColor = (v: StrategyStats['history'][number]) =>
  v === 'future' || v === 'none' || v === 'today' ? colors.future : v === 'missed' ? colors.missed : v === 'nr' ? '#CFC6DD' : HELP[v];

export function Overview() {
  const app = useSnap();
  const { snap, idx, today } = app;
  const plan = todayPlan(snap, idx, today);
  const rows = activeTasks(snap).map(({ task, strategy }) => ({ task, strategy, st: strategyStats(strategy, idx, snap.settings, today, !!openFlag(snap, strategy.id)) }));
  const alerts = rows.filter((r) => r.st.review);
  const feelToday = snap.notes.filter((n) => n.feeling && relativeDay(n.created_at, today) === 'Today');
  const flagger = (s: Strategy) => {
    const f = openFlag(snap, s.id);
    const m = f && snap.members.find((x) => x.user_id === f.flagged_by);
    return m ? (m.role === 'therapist' ? 'therapist' : roleLabel(m).toLowerCase()) : 'support';
  };
  const manyClients = app.people.filter((p) => p.role === 'therapist').length > 1 || (snap.me.role === 'therapist' && app.people.length > 1);
  return (
    <Col gap={18}>
      {manyClients ? <BackLink label="All clients" onPress={() => app.reset('clients')} /> : null}
      <Row gap={12} style={{ paddingTop: manyClients ? 0 : 8 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tint(300), alignItems: 'center', justifyContent: 'center' }}>
          <T bold size={18} color={deep(300)}>
            {snap.person.first_name[0]?.toUpperCase()}
          </T>
        </View>
        <Col gap={2} style={{ flex: 1 }}>
          <T heading size={22}>
            {snap.person.first_name}, {ageLabel(snap)}
          </T>
          <T size={13} color={colors.muted}>
            {snap.me.role === 'therapist' ? `Therapist view · ${snap.me.display_name}` : `${roleLabel(snap.me)} view`}
          </T>
        </Col>
        <IconBtn icon="settings" label="Settings" onPress={() => app.go('settings')} color={colors.secondary} />
      </Row>
      {alerts.map(({ task, strategy, st }) => (
        <Pressable key={strategy.id} accessibilityRole="button" onPress={() => app.go('strategy', { strategyId: strategy.id })} style={{ gap: 6, backgroundColor: colors.alertBg, borderRadius: 18, padding: 16 }}>
          <T bold size={13} upper color={colors.alertFg}>
            {st.flagged ? `Flagged by ${flagger(strategy)}` : 'Time to review'}
          </T>
          <T bold size={16} lh={1.35}>
            {st.flagged ? `${strategy.name} for ${task.title.toLowerCase()} needs a look.` : `${strategy.name} helped ${pct(st.rate)} of the time over ${st.day - 1} days. Consider switching.`}
          </T>
          <T bold size={14} color={colors.alertFg}>
            Review evidence →
          </T>
        </Pressable>
      ))}
      <Card gap={12}>
        <Row justify="space-between" align="baseline">
          <T bold size={17}>
            Today
          </T>
          <T size={14} color={colors.muted}>
            {plan.filter((p) => p.log).length} of {plan.length} done
          </T>
        </Row>
        {feelToday.length ? (
          <Row gap={6} style={{ flexWrap: 'wrap', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <T size={13} color={colors.muted}>
              Feelings logged
            </T>
            {feelToday.map((n) => (
              <Row key={n.id} gap={5} style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8, backgroundColor: tint(FEELING[n.feeling!].h) }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mid(FEELING[n.feeling!].h) }} />
                <T bold size={13}>
                  {n.feeling}
                </T>
              </Row>
            ))}
          </Row>
        ) : null}
        {plan.map(({ task, log }) => (
          <Row key={task.id} gap={12}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: log ? (log.helped != null ? HELP[log.helped] : colors.primary) : colors.missed }} />
            <Col gap={1} style={{ flex: 1 }}>
              <T bold size={15}>
                {task.title}
              </T>
              <T size={13} color={colors.muted}>
                {!log ? 'Not logged yet' : log.helped == null ? 'Ticked done · not rated' : `Felt ${log.feel?.toLowerCase() ?? 'okay'} · strategy ${HELP_LABEL[log.helped]}`}
              </T>
            </Col>
          </Row>
        ))}
        {!plan.length ? (
          <T size={14} color={colors.muted}>
            Nothing planned for today.
          </T>
        ) : null}
      </Card>
      <Col gap={8}>
        <Row justify="space-between">
          <T bold size={17}>
            Strategies
          </T>
          <Btn label="+ Add task" size="sm" onPress={() => app.openSheet({ kind: 'add' })} />
        </Row>
        {rows.map(({ task, strategy, st }) => (
          <Pressable key={strategy.id} accessibilityRole="button" onPress={() => app.go('strategy', { strategyId: strategy.id })} style={{ gap: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 18, padding: 14 }}>
            <Row justify="space-between" align="flex-start" gap={8}>
              <Col gap={2} style={{ flex: 1 }}>
                <T bold size={16}>
                  {strategy.name}
                </T>
                <T size={13} color={colors.muted}>
                  {task.title} · {AREAS[task.area].name}
                </T>
              </Col>
              <StatusChip st={st} />
            </Row>
            <Row gap={3}>
              {st.history.slice(0, st.len).map((v, i) => (
                <View key={i} style={{ flex: 1, height: 8, borderRadius: 2, backgroundColor: sparkColor(v) }} />
              ))}
            </Row>
            <Row justify="space-between">
              <T size={12} color={colors.muted}>
                Day {st.day} of {st.len}
              </T>
              <T size={12} color={colors.muted}>
                Helped {st.n ? pct(st.rate) : '–'}
              </T>
            </Row>
          </Pressable>
        ))}
        {!rows.length ? (
          <Card>
            <T size={15} lh={1.45} color={colors.secondary}>
              No tasks yet. Add the first task and the strategy {snap.person.first_name} will try.
            </T>
          </Card>
        ) : null}
      </Col>
    </Col>
  );
}

export function StrategyDetail() {
  const app = useSnap();
  const { snap, idx, today, route } = app;
  const strategy = snap.strategies.find((s) => s.id === route.params?.strategyId);
  const task = strategy && snap.tasks.find((t) => t.id === strategy.task_id);
  if (!strategy || !task) return <BackLink label="Overview" onPress={app.back} />;
  const flag = openFlag(snap, strategy.id);
  const st = strategyStats(strategy, idx, snap.settings, today, !!flag);
  const prev = strategy.replaced_strategy_id && snap.strategies.find((s) => s.id === strategy.replaced_strategy_id);
  const hue = STATUS_HUE[st.status];
  const left = st.len - st.day;
  const target = Math.round(snap.settings.target_rate * 100);
  const role = snap.me.role;
  return (
    <Col gap={18}>
      <BackLink label="Overview" onPress={app.back} />
      <Col gap={6}>
        <T size={13} color={colors.muted}>
          {task.title} · {AREAS[task.area].name}
        </T>
        <T heading size={26} lh={1.15}>
          {strategy.name}
        </T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <StatusChip st={st} size={13} />
          <T size={13} color={colors.muted}>
            Started {shortDate(strategy.started_on)}
            {prev ? ` · replaced ${prev.name}` : ''}
          </T>
        </Row>
      </Col>
      {strategy.description ? (
        <T size={14} color={colors.secondary} lh={1.45}>
          {strategy.description}
        </T>
      ) : null}
      <Col gap={6}>
        <Row justify="space-between">
          <T bold size={13}>
            Trial: day {st.day} of {st.len}
          </T>
          <T size={13} color={colors.muted}>
            {left > 0 ? `${left} days left` : left === 0 ? 'Last day' : 'Trial finished'}
          </T>
        </Row>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${Math.min(100, (st.day / st.len) * 100)}%`, backgroundColor: colors.primary }} />
        </View>
      </Col>
      <Card gap={12}>
        <T bold size={15}>
          Did it help? ({snap.person.first_name}'s rating)
        </T>
        <View style={{ height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: `${target}%`, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: '#9A948A' }} />
          {st.history.map((v, i) => {
            const isFuture = v === 'future' || v === 'today';
            const h = typeof v === 'number' ? ['30%', '62%', '100%'][v] : v === 'nr' ? '45%' : v === 'missed' ? '10%' : v === 'none' ? '4%' : '100%';
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: h as `${number}%`,
                  backgroundColor: typeof v === 'number' ? HELP[v] : v === 'nr' ? '#CFC6DD' : v === 'missed' || v === 'none' ? colors.missed : 'transparent',
                  borderWidth: isFuture ? (v === 'today' ? 1.5 : 1) : 0,
                  borderStyle: v === 'today' ? 'dashed' : 'solid',
                  borderColor: v === 'today' ? '#9A948A' : '#ECE9E2',
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  borderBottomLeftRadius: 2,
                  borderBottomRightRadius: 2,
                }}
              />
            );
          })}
        </View>
        <Row gap={12} style={{ flexWrap: 'wrap' }}>
          {[
            ['Yes', HELP[2]],
            ['A little', HELP[1]],
            ['No', HELP[0]],
            ['Not done', colors.missed],
            ...(st.history.includes('nr') ? [['Done, not rated', '#CFC6DD']] : []),
          ].map(([l, c]) => (
            <Row key={l} gap={5}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} />
              <T size={12} color={colors.secondary}>
                {l}
              </T>
            </Row>
          ))}
          <Row gap={5}>
            <View style={{ width: 14, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: '#9A948A' }} />
            <T size={12} color={colors.secondary}>
              Target
            </T>
          </Row>
        </Row>
      </Card>
      <Row gap={8}>
        {[
          [`${st.doneDays}/${Math.min(st.day, st.history.length)}`, 'Days done', colors.primary],
          [st.n ? pct(st.rate) : '–', 'Helped', hue ? deep(hue) : colors.primary],
          [`${target}%`, 'Target', colors.primary],
        ].map(([v, l, c]) => (
          <Card key={l} pad={12} gap={2} radius={16} style={{ flex: 1 }}>
            <T heading size={22} color={c}>
              {v}
            </T>
            <T size={12} color={colors.muted}>
              {l}
            </T>
          </Card>
        ))}
      </Row>
      <View style={{ backgroundColor: hue ? tint(hue) : '#ECEBE6', borderRadius: 18, padding: 16, gap: 6 }}>
        <T bold size={13} upper color={colors.secondary}>
          Switch rule
        </T>
        <T size={15} lh={1.45}>
          Review if "helped" stays under {target}% after {snap.settings.review_day} days.
        </T>
        <T bold size={15} lh={1.4}>
          {verdict(st, snap.settings)}
        </T>
      </View>
      {role === 'therapist' ? (
        <Row gap={10}>
          <Btn label={`Extend ${snap.settings.extend_days} days`} variant="secondary" size="md" style={{ flex: 1 }} onPress={() => app.actions.extendTrial(strategy.id, snap.settings.extend_days)} />
          <Btn label="Switch strategy" size="md" style={{ flex: 1 }} onPress={() => app.openSheet({ kind: 'switch', strategyId: strategy.id })} />
        </Row>
      ) : null}
      {role === 'support' ? (
        <Btn
          label={flag ? 'Flagged for therapist · Undo' : 'Flag for therapist review'}
          size="md"
          onPress={() => app.actions.setFlag(strategy.id, !flag, flag ? undefined : 'Your therapist will see this')}
        />
      ) : null}
    </Col>
  );
}

export function Notes() {
  const app = useSnap();
  const { snap, today } = app;
  const [text, setText] = useState('');
  const others = snap.members.filter((m) => m.user_id !== snap.me.user_id).map((m) => m.display_name);
  const sub = others.length ? `Shared with ${others.length === 1 ? others[0] : `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}`}` : 'Only you can see these until you invite your team.';
  const post = async () => {
    if (!text.trim()) return;
    if (await app.actions.addNote(text)) setText('');
  };
  return (
    <Col gap={14}>
      <T heading size={28} style={{ paddingTop: 8 }}>
        Notes
      </T>
      <T size={14} color={colors.muted}>
        {sub}
      </T>
      <Btn label="Log a feeling" variant="secondary" size="md" onPress={() => app.openSheet({ kind: 'feeling', feeling: null })} />
      <Row gap={8} align="stretch">
        <Input value={text} onChangeText={setText} placeholder="Add a note…" style={{ flex: 1, fontSize: 15 }} onSubmitEditing={post} returnKeyType="send" />
        <Btn label="Post" size="md" disabled={!text.trim()} onPress={post} />
      </Row>
      {snap.notes.map((n) => {
        const color = n.author_role === 'therapist' ? deep(255) : deep(175);
        return (
          <Card key={n.id} pad={14} gap={6} radius={18} style={n.kind === 'system' ? { backgroundColor: colors.bg } : undefined}>
            <Row justify="space-between">
              <T bold size={13} color={color}>
                {n.author_name || 'Team member'}
              </T>
              <T size={13} color={colors.muted}>
                {relativeDay(n.created_at, today)}
              </T>
            </Row>
            {n.feeling ? (
              <Row gap={6} style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: tint(FEELING[n.feeling].h) }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mid(FEELING[n.feeling].h) }} />
                <T bold size={13}>
                  Feeling {n.feeling.toLowerCase()}
                </T>
              </Row>
            ) : null}
            <T size={15} lh={1.45} color={n.kind === 'system' ? colors.secondary : colors.text}>
              {n.text}
            </T>
          </Card>
        );
      })}
    </Col>
  );
}

export function Clients() {
  const app = useApp();
  const list = app.people;
  return (
    <Col gap={18}>
      <Row justify="space-between" style={{ paddingTop: 8 }}>
        <T heading size={28}>
          Your clients
        </T>
        <IconBtn icon="logout" label="Sign out" color={colors.secondary} onPress={() => app.backend.signOut()} />
      </Row>
      {list.map(({ person, role }) => (
        <Pressable key={person.id} accessibilityRole="button" onPress={() => app.openPerson(person.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 18, padding: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tint(300), alignItems: 'center', justifyContent: 'center' }}>
            <T bold size={17} color={deep(300)}>
              {person.first_name[0]?.toUpperCase()}
            </T>
          </View>
          <Col gap={2} style={{ flex: 1 }}>
            <T bold size={16}>
              {person.first_name}
            </T>
            <T size={13} color={colors.muted}>
              {AGE_BANDS.find((a) => a.value === person.age_band)?.label} · {roleLabel({ role, relation_label: null })} view
            </T>
          </Col>
          <Icon name="chevron_right" color={colors.muted} />
        </Pressable>
      ))}
      <Btn
        label="+ Add client"
        variant="dashed"
        size="md"
        onPress={() => {
          app.setDraft((d) => ({ ...d, who: 'client' }));
          app.go('ob-who');
        }}
      />
      <Btn label="Join a team with a code" variant="ghost" size="md" onPress={() => app.go('join')} />
    </Col>
  );
}
