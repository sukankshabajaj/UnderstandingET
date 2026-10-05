// Opening flow: Welcome → (sign in) → Who → About → What's hard → Accessibility → Team → Ready.
import React, { useState } from 'react';
import { Image, Pressable, Share, View } from 'react-native';
import { useApp } from '../state/app';
import { AGE_BANDS, AREAS, AREA_KEYS, CONSENT_VERSION, DX_OPTS, NEED_OPTS } from '../constants';
import { colors, deep, tint } from '../theme';
import { BackLink, Btn, Card, Checkbox, Choice, Col, Field, Grid, Heading, Icon, InfoBox, Input, Row, StepHeader, T, Toggle } from '../ui/kit';
import { DemoBackend } from '../data/demoBackend';
import { friendlyError } from '../data/backend';
import type { Area } from '../types';

const Spacer = () => <View style={{ flex: 1, minHeight: 12 }} />;

export function Welcome() {
  const app = useApp();
  const demo = app.backend instanceof DemoBackend ? app.backend : null;
  const signedIn = !!app.user && !demo;
  const start = () => {
    app.setDraft((d) => ({ ...d, who: null }));
    if (app.user) app.go('ob-who');
    else {
      app.setIntent('start');
      app.go('auth', { authMode: 'signup' });
    }
  };
  const code = () => {
    if (app.user) app.go('join');
    else {
      app.setIntent('join');
      app.go('auth', { authMode: 'signup' });
    }
  };
  return (
    <View style={{ flex: 1, gap: 36, paddingTop: 36, paddingHorizontal: 4 }}>
      <Col gap={16}>
        <Image source={require('../../assets/logo-mark.png')} accessibilityIgnoresInvertColors style={{ width: 110, height: 80, marginLeft: -6 }} resizeMode="contain" />
        <T heading size={38} color={colors.primary} lh={1.05}>
          Stepwise
        </T>
        <T size={14} color={colors.muted} style={{ marginTop: -10 }}>
          by Understanding ET
        </T>
        <T size={19} lh={1.45} color={colors.body}>
          Try a strategy, see if it helps, and know when it is time to switch.
        </T>
      </Col>
      <Col gap={14}>
        {(
          [
            ['checklist', 'Track everyday tasks', 135],
            ['insights', 'See which strategies help', 300],
            ['groups', 'Share progress with your team', 210],
          ] as const
        ).map(([icon, label, h]) => (
          <Row key={label} gap={14}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: tint(h), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={26} color={deep(h)} />
            </View>
            <T bold size={16}>
              {label}
            </T>
          </Row>
        ))}
      </Col>
      <Spacer />
      <Col gap={10}>
        {demo ? <InfoBox icon="info">Demo mode: everything stays on this device. Connect Supabase to use Stepwise with clients (see docs/SETUP.md).</InfoBox> : null}
        <Btn label="Get started" onPress={start} />
        <Btn label="I have a code from my therapist" variant="secondary" size="lg" onPress={code} />
        {demo ? (
          <Btn label="Look around with sample data" variant="ghost" onPress={async () => { await demo.startSample('self'); await app.enter(); }} />
        ) : signedIn ? (
          <Btn label={`Sign out (${app.user!.email})`} variant="ghost" onPress={() => app.backend.signOut()} />
        ) : (
          <Btn label="I already have an account" variant="ghost" onPress={() => { app.setIntent(null); app.go('auth', { authMode: 'signin' }); }} />
        )}
      </Col>
    </View>
  );
}

export function Auth() {
  const app = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>(app.route.params?.authMode ?? 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const canSubmit = mode === 'signin' ? emailOk && password.length > 0 : !!name.trim() && emailOk && password.length >= 8 && adult && consent;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signup') {
        const res = await app.backend.signUp({ email, password, displayName: name, ageConfirmed: adult, consentVersion: CONSENT_VERSION });
        if (res.needsConfirmation) {
          setMode('signin');
          setMessage(`We sent a link to ${email.trim()}. Open it to confirm your email, then sign in here.`);
          return;
        }
      } else {
        await app.backend.signIn(email, password);
      }
      await app.enter(app.intent);
      app.setIntent(null);
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!emailOk) return setMessage('Type your email above first, then tap "Forgot password?" again.');
    try {
      await app.backend.resetPassword(email);
      setMessage('If that email has an account, a reset link is on its way.');
    } catch (e) {
      setMessage(friendlyError(e));
    }
  };

  return (
    <View style={{ flex: 1, gap: 20 }}>
      <BackLink onPress={app.back} />
      <Heading
        title={mode === 'signup' ? 'Create your account' : 'Sign in'}
        sub={mode === 'signup' ? 'Your team will see the name you use here.' : 'Welcome back.'}
      />
      {mode === 'signup' ? (
        <Field label="Your name">
          <Input value={name} onChangeText={setName} placeholder="e.g. Sam or Dr. Okafor" autoComplete="name" textContentType="name" />
        </Field>
      ) : null}
      <Field label="Email">
        <Input value={email} onChangeText={setEmail} placeholder="name@email.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      </Field>
      <Field label="Password">
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
          secureTextEntry
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signup' ? 'newPassword' : 'password'}
          onSubmitEditing={submit}
        />
      </Field>
      {mode === 'signup' ? (
        <Col gap={4}>
          <Checkbox on={adult} onPress={() => setAdult(!adult)} label="I confirm I am 18 or older" />
          <Checkbox on={consent} onPress={() => setConsent(!consent)} label="I agree that Stepwise can store my information and share it with the team I choose" />
          <Pressable onPress={() => setShowPrivacy(!showPrivacy)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <T bold size={14} color={colors.primary}>
              {showPrivacy ? 'Hide' : 'What is stored and who sees it?'}
            </T>
          </Pressable>
          {showPrivacy ? <PrivacySummary /> : null}
        </Col>
      ) : null}
      {message ? <InfoBox icon="info">{message}</InfoBox> : null}
      <Spacer />
      <Col gap={8}>
        <Btn label={busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'} disabled={!canSubmit || busy} onPress={submit} />
        <Btn
          variant="ghost"
          label={mode === 'signup' ? 'I already have an account' : 'Create a new account'}
          onPress={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup');
            setMessage(null);
          }}
        />
        {mode === 'signin' ? <Btn variant="ghost" size="md" label="Forgot password?" onPress={forgot} /> : null}
      </Col>
    </View>
  );
}

export function PrivacySummary() {
  return (
    <Card gap={8} style={{ backgroundColor: colors.infoBox, borderWidth: 0 }}>
      <T size={14} lh={1.5} color={colors.body}>
        • What we store: your name and email, the profile details you enter (first name, age band, optional diagnosis or support needs), tasks, strategies, check-ins, feelings and notes.
      </T>
      <T size={14} lh={1.5} color={colors.body}>
        • Why: so you and your team can see which strategies help.
      </T>
      <T size={14} lh={1.5} color={colors.body}>
        • Who sees it: only the people on your team: you, the support people you invite, and your Understanding ET therapist. You can remove a support person at any time.
      </T>
      <T size={14} lh={1.5} color={colors.body}>
        • Your choices: you can download your data or delete your profile from Settings. Deleting removes everything.
      </T>
    </Card>
  );
}

export function Join() {
  const app = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const demo = app.backend instanceof DemoBackend;
  const join = async () => {
    if (code.length < 6 || busy) return;
    setBusy(true);
    try {
      const personId = await app.backend.redeemInvite(code);
      await app.openPerson(personId);
      app.toast('You joined the team');
    } catch (e) {
      app.toast(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1, gap: 20 }}>
      <Row>
        <BackLink onPress={() => (app.stackLen > 1 ? app.back() : app.reset('welcome'))} />
      </Row>
      <Heading title="Join a team" sub="Enter the 6-digit code from the person who made the profile." />
      <Input
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        accessibilityLabel="6-digit code"
        style={{ fontSize: 30, letterSpacing: 9, textAlign: 'center', fontFamily: 'AtkinsonHyperlegible_700Bold' }}
        onSubmitEditing={join}
      />
      <T size={14} color={colors.muted}>
        {demo ? "In demo mode, any 6 digits joins Sam's team as a support person." : 'Codes work once and expire after 7 days.'}
      </T>
      <Spacer />
      <Btn label={busy ? 'Joining…' : 'Join'} disabled={code.length < 6 || busy} onPress={join} />
    </View>
  );
}

// --- Set-up steps ---------------------------------------------------------------------------

const STEPS = ['ob-who', 'ob-profile', 'ob-needs', 'ob-access', 'ob-team'] as const;

function useStep(name: (typeof STEPS)[number]) {
  const app = useApp();
  const i = STEPS.indexOf(name);
  return {
    app,
    d: app.draft,
    set: (p: Partial<typeof app.draft>) => app.setDraft((d) => ({ ...d, ...p })),
    toggle: <K extends 'dx' | 'needs' | 'areas'>(k: K, v: string) =>
      app.setDraft((d) => {
        const arr = d[k] as string[];
        return { ...d, [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
      }),
    header: <StepHeader step={i} onBack={() => (app.stackLen > 1 ? app.back() : app.reset('welcome'))} />,
    next: () => app.go(i < STEPS.length - 1 ? STEPS[i + 1] : 'ob-ready'),
    nameOr: app.draft.name.trim() || (app.draft.who === 'client' ? 'your client' : 'you'),
  };
}

function StepFrame({ header, children, cta }: { header: React.ReactNode; children: React.ReactNode; cta: React.ReactNode }) {
  return (
    <View style={{ flex: 1, gap: 20 }}>
      {header}
      {children}
      <Spacer />
      {cta}
    </View>
  );
}

export function ObWho() {
  const { d, set, header, next, app } = useStep('ob-who');
  const [clinician, setClinician] = useState<boolean | null>(null);
  React.useEffect(() => {
    if (app.backend instanceof DemoBackend) setClinician(true);
    else app.backend.isClinician().then(setClinician).catch(() => setClinician(false));
  }, [app.backend]);
  const opts = [
    { k: 'self' as const, label: 'For myself', icon: 'person', sub: 'Set up and manage your own strategies', h: 135, enabled: true },
    {
      k: 'client' as const,
      label: 'For a client',
      icon: 'medical_services',
      sub: clinician === false ? 'For Understanding ET clinicians. Ask the clinic to add your email.' : 'You will be the therapist on their team',
      h: 300,
      enabled: clinician !== false,
    },
  ];
  return (
    <StepFrame header={header} cta={<Btn label="Continue" disabled={!d.who} onPress={next} />}>
      <Heading title="Who is this profile for?" sub="You can add more people later." />
      <Col gap={10}>
        {opts.map((o) => (
          <Choice key={o.k} selected={d.who === o.k} onPress={() => o.enabled && set({ who: o.k })} style={{ borderRadius: 18, padding: 16, alignItems: 'stretch', opacity: o.enabled ? 1 : 0.6 }} a11yLabel={o.label}>
            <Row gap={14}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: tint(o.h), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={o.icon} size={28} color={deep(o.h)} />
              </View>
              <Col gap={3} style={{ flex: 1 }}>
                <T bold size={17}>
                  {o.label}
                </T>
                <T size={14} color={colors.muted} lh={1.4}>
                  {o.sub}
                </T>
              </Col>
            </Row>
          </Choice>
        ))}
      </Col>
      <InfoBox>Stepwise is for adults 18 and over. Adults can set up their own profile and choose who to invite, or a therapist can set it up with them.</InfoBox>
    </StepFrame>
  );
}

export function ObProfile() {
  const { d, set, toggle, header, next } = useStep('ob-profile');
  const ok = !!d.name.trim() && !!d.age && d.ageConfirmed;
  return (
    <StepFrame header={header} cta={<Btn label="Continue" disabled={!ok} onPress={next} />}>
      <Heading title={d.who === 'client' ? 'About your client' : 'About you'} />
      <Field label="First name">
        <Input value={d.name} onChangeText={(t) => set({ name: t })} placeholder="e.g. Sam" autoComplete="given-name" />
      </Field>
      <Field label="Age">
        <Grid cols={4}>
          {AGE_BANDS.map((a) => (
            <Choice key={a.value} selected={d.age === a.value} onPress={() => set({ age: a.value })} style={{ minHeight: 48, paddingHorizontal: 4 }}>
              <T bold size={15} color={d.age === a.value ? colors.pickBorder : colors.secondary}>
                {a.label}
              </T>
            </Choice>
          ))}
        </Grid>
        <Checkbox on={d.ageConfirmed} onPress={() => set({ ageConfirmed: !d.ageConfirmed })} label={d.who === 'client' ? 'I confirm my client is 18 or older' : 'I confirm I am 18 or older'} />
      </Field>
      <Field label="Diagnosis or support needs" optional>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {DX_OPTS.map((x) => (
            <Choice key={x} selected={d.dx.includes(x)} onPress={() => toggle('dx', x)} style={{ paddingHorizontal: 14 }}>
              <T bold size={15} color={d.dx.includes(x) ? colors.pickBorder : colors.secondary}>
                {x}
              </T>
            </Choice>
          ))}
        </Row>
      </Field>
    </StepFrame>
  );
}

function IconChoice({ on, onPress, icon, label }: { on: boolean; onPress: () => void; icon: string; label: string }) {
  return (
    <Choice selected={on} onPress={onPress} style={{ borderRadius: 14, padding: 12, minHeight: 56, alignItems: 'flex-start' }} a11yLabel={label}>
      <Row gap={10}>
        <Icon name={icon} size={24} color={on ? colors.pickBorder : colors.secondary} />
        <T bold size={15} style={{ flex: 1 }}>
          {label}
        </T>
      </Row>
    </Choice>
  );
}

export function ObNeeds() {
  const { d, toggle, header, next } = useStep('ob-needs');
  return (
    <StepFrame header={header} cta={<Btn label="Continue" onPress={next} />}>
      <Heading title="What's hard right now?" sub="Pick any that apply. This helps choose the first strategies to try." />
      <Grid cols={2} gap={8}>
        {NEED_OPTS.map(([label, icon]) => (
          <IconChoice key={label} on={d.needs.includes(label)} onPress={() => toggle('needs', label)} icon={icon} label={label} />
        ))}
      </Grid>
      <T bold size={14} style={{ paddingTop: 4 }}>
        What should we track?
      </T>
      <Grid cols={2} gap={8}>
        {AREA_KEYS.map((k) => (
          <IconChoice key={k} on={d.areas.includes(k)} onPress={() => toggle('areas', k)} icon={AREAS[k].icon} label={AREAS[k].name} />
        ))}
      </Grid>
    </StepFrame>
  );
}

export function AccessRow({ icon, label, sub, on, onPress }: { icon: string; label: string; sub: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 18, padding: 14 }}>
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.infoBox, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} />
      </View>
      <Col gap={2} style={{ flex: 1 }}>
        <T bold size={16}>
          {label}
        </T>
        <T size={13} color={colors.muted} lh={1.4}>
          {sub}
        </T>
      </Col>
      <Toggle on={on} />
    </Pressable>
  );
}

export const ACCESS_OPTS = [
  { k: 'pics', field: 'picture_mode', label: 'Picture mode', icon: 'image', sub: 'Big icons and fewer words, for people who prefer pictures' },
  { k: 'read', field: 'read_aloud', label: 'Read aloud', icon: 'volume_up', sub: 'A speaker button reads tasks and steps out loud' },
  { k: 'motion', field: 'reduce_motion', label: 'Reduce motion', icon: 'motion_photos_off', sub: 'No moving or flashing effects' },
] as const;

export function ObAccess() {
  const { d, set, header, next, nameOr } = useStep('ob-access');
  return (
    <StepFrame header={header} cta={<Btn label="Continue" onPress={next} />}>
      <Heading title={`How should the app work for ${nameOr}?`} sub="You can change these any time in settings." />
      <Col gap={10}>
        {ACCESS_OPTS.map((o) => (
          <AccessRow key={o.k} icon={o.icon} label={o.label} sub={o.sub} on={d[o.k]} onPress={() => set({ [o.k]: !d[o.k] })} />
        ))}
      </Col>
    </StepFrame>
  );
}

export function ObTeam() {
  const { d, set, header, app } = useStep('ob-team');
  const [busy, setBusy] = useState(false);
  const forClient = d.who === 'client';
  const finish = async (withInvites: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const invites = withInvites
        ? [
            { role: forClient ? ('self' as const) : ('therapist' as const), email: d.email1 },
            { role: 'support' as const, email: d.email2 },
          ].filter((i) => i.email.trim())
        : [];
      const res = await app.backend.createPerson({
        first_name: d.name.trim(),
        age_band: d.age!,
        age_confirmed: d.ageConfirmed,
        dx_tags: d.dx,
        needs: d.needs,
        tracked_areas: d.areas as Area[],
        picture_mode: d.pics,
        read_aloud: d.read,
        reduce_motion: d.motion,
        my_role: forClient ? 'therapist' : 'self',
        invites,
      });
      app.setCreated(res);
      app.go('ob-ready');
    } catch (e) {
      app.toast(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <StepFrame
      header={header}
      cta={
        <Col gap={8}>
          <Btn label={busy ? 'Setting up…' : 'Continue'} disabled={busy} onPress={() => finish(true)} />
          <Btn label="Skip for now" variant="ghost" size="md" disabled={busy} onPress={() => finish(false)} />
        </Col>
      }
    >
      <Heading title="Invite the team" sub="They'll get a code to join. You can also do this later." />
      <Field label={forClient ? "Your client's email" : "Therapist's email"}>
        <Input value={d.email1} onChangeText={(t) => set({ email1: t })} placeholder={forClient ? 'name@email.com' : 'name@clinic.com'} autoCapitalize="none" keyboardType="email-address" />
      </Field>
      <Field label="Support person's email (optional)">
        <Input value={d.email2} onChangeText={(t) => set({ email2: t })} placeholder="name@email.com" autoCapitalize="none" keyboardType="email-address" />
      </Field>
      <InfoBox icon="visibility">Everyone on the team can see tasks, check-ins, feelings and notes, and can add tasks.</InfoBox>
    </StepFrame>
  );
}

export function ObReady() {
  const app = useApp();
  const d = app.draft;
  const nameOr = d.name.trim() || 'Your';
  const invites = app.created?.invites ?? [];
  const rows = [
    ['Profile for', `${d.name.trim() || '–'}${d.age ? ' · ' + AGE_BANDS.find((a) => a.value === d.age)!.label : ''}`],
    ['Tracking', d.areas.map((a) => AREAS[a as Area].name).join(', ') || '–'],
    ['Picture mode', d.pics ? 'On' : 'Off'],
    ['Read aloud', d.read ? 'On' : 'Off'],
    ['Invited', `${invites.length} ${invites.length === 1 ? 'person' : 'people'}`],
  ];
  const roleName = (r: string) => (r === 'self' ? d.name.trim() || 'Client' : r === 'support' ? 'Support person' : 'Therapist');
  return (
    <View style={{ flex: 1, gap: 20 }}>
      <Col gap={16} style={{ paddingTop: 40 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: tint(150), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={44} color={deep(150)} />
        </View>
        <T heading size={26} lh={1.2}>
          {nameOr}'s profile is ready
        </T>
      </Col>
      <Card pad={0} gap={0} radius={18} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {rows.map(([k, v], i) => (
          <Row key={k} justify="space-between" gap={12} style={{ paddingVertical: 12, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: colors.divider }}>
            <T size={15} color={colors.muted}>
              {k}
            </T>
            <T bold size={15} align="right" style={{ flexShrink: 1 }}>
              {v}
            </T>
          </Row>
        ))}
      </Card>
      {invites.length ? (
        <Col gap={8}>
          <T bold size={15}>
            Send each person their code
          </T>
          <T size={14} color={colors.muted} lh={1.45}>
            Each code works once and expires in 7 days. They sign up in Stepwise and tap "I have a code".
          </T>
          {invites.map((inv) => (
            <Card key={inv.code} pad={14} gap={8} radius={16}>
              <Row justify="space-between">
                <Col gap={2} style={{ flex: 1 }}>
                  <T bold size={15}>
                    {roleName(inv.role)}
                  </T>
                  <T size={13} color={colors.muted}>
                    {inv.email}
                  </T>
                </Col>
                <T bold size={24} style={{ letterSpacing: 4 }}>
                  {inv.code}
                </T>
              </Row>
              <Btn
                label="Share code"
                icon="ios_share"
                variant="secondary"
                size="sm"
                onPress={() => Share.share({ message: `Join ${d.name.trim()}'s team on Stepwise (by Understanding ET). Open the app, tap "I have a code from my therapist" and enter ${inv.code}. The code expires in 7 days.` }).catch(() => {})}
              />
            </Card>
          ))}
        </Col>
      ) : null}
      <Spacer />
      <Btn
        label="Open Stepwise"
        onPress={async () => {
          if (!app.created) return;
          await app.openPerson(app.created.personId);
          app.setDraft(() => ({ ...d, who: null, name: '', age: null, ageConfirmed: false, dx: [], needs: [], email1: '', email2: '' }));
        }}
      />
    </View>
  );
}
