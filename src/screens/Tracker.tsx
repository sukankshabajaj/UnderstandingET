// Tracker: Week (one row of 7 cells per task) and Month (calendar with a completion bar per day).
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSnap } from '../state/app';
import { AREAS, DAY_LETTER, HELP_LABEL, MONTHS, MONTHS_LONG, WEEKDAYS_LONG } from '../constants';
import { colors, deep, mid, HELP } from '../theme';
import { Btn, Card, Col, Row, Segmented, T } from '../ui/kit';
import { addDays, fromISO, mondayOf, shortDate, toISO, weekdayMon0 } from '../logic/dates';
import { dayInfo, freqText, weekRows, weeklyTarget, type DayValue } from '../logic/stats';

function NavBtn({ label, onPress, dim }: { label: string; onPress: () => void; dim?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label === '‹' ? 'Previous' : 'Next'} onPress={onPress} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.35 : 1 }}>
      <T heading size={20}>
        {label}
      </T>
    </Pressable>
  );
}

function cellLook(v: DayValue, areaHue: number, team: boolean) {
  if (v === 'future') return { bg: colors.future, border: 'transparent', mark: '' };
  if (v === 'today') return { bg: '#fff', border: colors.primary, dashed: true, mark: '' };
  if (v === 'none') return { bg: 'transparent', border: 'transparent', mark: '–', fg: colors.disabled };
  if (v === 'missed') return { bg: '#fff', border: colors.inputBorder, mark: '' };
  if (v === 'nr' || !team) return { bg: deep(areaHue), border: 'transparent', mark: '✓' };
  return { bg: HELP[v], border: 'transparent', mark: '✓' };
}

export function Tracker() {
  const app = useSnap();
  const { snap, idx, today } = app;
  const team = snap.me.role !== 'self';
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [wk, setWk] = useState(0);
  const [mo, setMo] = useState(0);
  const [sel, setSel] = useState(today);

  const weekStart = addDays(mondayOf(today), wk * 7);
  const week = weekRows(snap, idx, weekStart, today);
  const legend = team
    ? [
        { label: 'Helped', bg: HELP[2] },
        { label: 'A little', bg: HELP[1] },
        { label: 'Did not help', bg: HELP[0] },
        { label: 'Missed', bg: '#fff', border: colors.inputBorder },
        { label: 'Today', bg: '#fff', border: colors.primary, dashed: true },
      ]
    : [
        { label: 'Done', bg: deep(175) },
        { label: 'Missed', bg: '#fff', border: colors.inputBorder },
        { label: 'Today', bg: '#fff', border: colors.primary, dashed: true },
      ];

  // Month grid (Monday first)
  const t = fromISO(today);
  const first = toISO(new Date(t.getFullYear(), t.getMonth() + mo, 1));
  const firstD = fromISO(first);
  const gridStart = mondayOf(first);
  const lastDay = toISO(new Date(firstD.getFullYear(), firstD.getMonth() + 1, 0));
  const cells: string[] = [];
  for (let d = gridStart; d <= lastDay || cells.length % 7; d = addDays(d, 1)) cells.push(d);
  const selInfo = dayInfo(snap, idx, sel, today);

  return (
    <Col gap={16}>
      <Col gap={4} style={{ paddingTop: 8 }}>
        <T heading size={28}>
          Tracker
        </T>
        <T size={14} color={colors.muted}>
          How often each strategy got done
        </T>
      </Col>
      <Segmented options={[['week', 'Week'], ['month', 'Month']]} value={mode} onChange={setMode} />
      {mode === 'week' ? (
        <Col gap={12}>
          <Row justify="space-between">
            <NavBtn label="‹" dim={wk <= -3} onPress={() => setWk(Math.max(-3, wk - 1))} />
            <Col gap={2} style={{ alignItems: 'center' }}>
              <T bold size={17}>
                {wk === 0 ? 'This week' : wk === -1 ? 'Last week' : `${-wk} weeks ago`}
              </T>
              <T size={13} color={colors.muted}>
                {shortDate(weekStart)} – {shortDate(addDays(weekStart, 6))} · {week.done} of {week.possible} done
              </T>
            </Col>
            <NavBtn label="›" dim={wk >= 0} onPress={() => setWk(Math.min(0, wk + 1))} />
          </Row>
          <Row gap={6} style={{ paddingHorizontal: 15 }}>
            {DAY_LETTER.map((l, j) => {
              const d = addDays(weekStart, j);
              const isT = d === today;
              return (
                <Col key={j} gap={3} style={{ flex: 1, alignItems: 'center' }}>
                  <T size={12} color={colors.muted}>
                    {l}
                  </T>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isT ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    <T bold size={13} color={isT ? '#fff' : colors.muted}>
                      {fromISO(d).getDate()}
                    </T>
                  </View>
                </Col>
              );
            })}
          </Row>
          {week.rows.map((r) => {
            const a = AREAS[r.task.area];
            return (
              <Card key={r.task.id} pad={14} gap={10} radius={18}>
                <Row justify="space-between" align="flex-start" gap={8}>
                  <Row gap={10} align="flex-start" style={{ flex: 1 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: mid(a.h) }} />
                    <Col gap={2} style={{ flex: 1 }}>
                      <T bold size={16}>
                        {r.task.title}
                      </T>
                      <T size={13} color={colors.muted}>
                        {r.strategy.name} · {freqText(r.strategy)}
                      </T>
                    </Col>
                  </Row>
                  <T bold size={15}>
                    {r.done} of {weeklyTarget(r.strategy)}
                  </T>
                </Row>
                <Row gap={6}>
                  {r.cells.map((v, j) => {
                    const c = cellLook(v, a.h, team);
                    return (
                      <View key={j} accessibilityLabel={`${WEEKDAYS_LONG[j]}: ${v === 'missed' ? 'missed' : typeof v === 'number' ? HELP_LABEL[v] : v === 'nr' ? 'done' : v}`} style={{ flex: 1, aspectRatio: 1, borderRadius: 10, backgroundColor: c.bg, borderWidth: c.dashed ? 1.5 : c.border === 'transparent' ? 0 : 1.5, borderColor: c.border, borderStyle: c.dashed ? 'dashed' : 'solid', alignItems: 'center', justifyContent: 'center' }}>
                        <T bold size={14} color={c.fg ?? '#fff'}>
                          {c.mark}
                        </T>
                      </View>
                    );
                  })}
                </Row>
              </Card>
            );
          })}
          <Row gap={12} style={{ flexWrap: 'wrap' }}>
            {legend.map((g) => (
              <Row key={g.label} gap={5}>
                <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: g.bg, borderWidth: g.border ? 1.5 : 0, borderColor: g.border, borderStyle: g.dashed ? 'dashed' : 'solid' }} />
                <T size={12} color={colors.secondary}>
                  {g.label}
                </T>
              </Row>
            ))}
          </Row>
        </Col>
      ) : (
        <Col gap={14}>
          <Row justify="space-between">
            <NavBtn label="‹" dim={mo <= -5} onPress={() => setMo(Math.max(-5, mo - 1))} />
            <T bold size={17}>
              {MONTHS_LONG[firstD.getMonth()]} {firstD.getFullYear()}
            </T>
            <NavBtn label="›" dim={mo >= 0} onPress={() => setMo(Math.min(0, mo + 1))} />
          </Row>
          <View style={{ gap: 4 }}>
            <Row gap={4}>
              {DAY_LETTER.map((w, i) => (
                <T key={i} size={12} color={colors.muted} align="center" style={{ flex: 1, paddingBottom: 4 }}>
                  {w}
                </T>
              ))}
            </Row>
            {Array.from({ length: cells.length / 7 }).map((_, r) => (
              <Row key={r} gap={4}>
                {cells.slice(r * 7, r * 7 + 7).map((d) => {
                  const info = dayInfo(snap, idx, d, today);
                  const p = d > today || !info.total ? 0 : info.done / info.total;
                  const isSel = d === sel;
                  const isT = d === today;
                  const inMonth = fromISO(d).getMonth() === firstD.getMonth();
                  return (
                    <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${shortDate(d)}, ${info.done} of ${info.total} done`} onPress={() => setSel(d)} style={{ flex: 1, aspectRatio: 1 / 1.1, borderRadius: 12, borderWidth: isT && !isSel ? 1.5 : 1, borderColor: isT && !isSel ? colors.primary : 'transparent', backgroundColor: isSel ? colors.primary : isT ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: inMonth ? 1 : 0.4 }}>
                      <T bold size={15} color={isSel ? '#fff' : colors.primary}>
                        {fromISO(d).getDate()}
                      </T>
                      <View style={{ width: '60%', height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
                        <View style={{ width: `${Math.round(p * 100)}%`, height: 4, backgroundColor: p >= 0.8 ? HELP[2] : p >= 0.5 ? HELP[1] : HELP[0] }} />
                      </View>
                    </Pressable>
                  );
                })}
              </Row>
            ))}
          </View>
          <Row justify="space-between" align="baseline">
            <T bold size={17}>
              {WEEKDAYS_LONG[weekdayMon0(sel)].slice(0, 3)}, {MONTHS[fromISO(sel).getMonth()]} {fromISO(sel).getDate()}
            </T>
            <T size={14} color={colors.muted}>
              {sel > today ? 'Planned' : `${selInfo.done} of ${selInfo.total} done`}
            </T>
          </Row>
          {selInfo.rows.map((r) => (
            <Row key={r.task.id} gap={12} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
              <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: mid(AREAS[r.task.area].h) }} />
              <Col gap={2} style={{ flex: 1 }}>
                <T bold size={15}>
                  {r.task.title}
                </T>
                <T size={12} color={colors.muted}>
                  {r.strategy.name}
                  {team && typeof r.value === 'number' ? ` · ${HELP_LABEL[r.value]}` : ''}
                </T>
              </Col>
              <T bold size={13} color={r.state === 'Done' ? deep(150) : r.state === 'Missed' ? deep(25) : colors.muted}>
                {r.state}
              </T>
            </Row>
          ))}
          {!selInfo.rows.length ? (
            <T size={14} color={colors.muted}>
              Nothing planned on this day.
            </T>
          ) : null}
        </Col>
      )}
      <Btn label="+ Add task" variant="dashed" size="md" onPress={() => app.openSheet({ kind: 'add' })} />
    </Col>
  );
}
