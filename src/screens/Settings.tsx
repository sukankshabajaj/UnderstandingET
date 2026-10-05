// Settings: accessibility, team (invite / remove), your data (export / delete) and account.
import React, { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { useSnap } from '../state/app';
import { colors } from '../theme';
import { BackLink, Btn, Card, Col, Row, Segmented, T } from '../ui/kit';
import { AccessRow, ACCESS_OPTS } from './Onboarding';
import { PrivacyCard } from './Legal';
import { roleLabel } from './Team';
import { DemoBackend, type DemoRole } from '../data/demoBackend';
import { confirm } from '../confirm';
import { friendlyError } from '../data/backend';
import type { Member, Role } from '../types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Col gap={10}>
      <T bold size={13} upper color={colors.secondary}>
        {title}
      </T>
      {children}
    </Col>
  );
}

export function Settings() {
  const app = useSnap();
  const { snap } = app;
  const me = snap.me;
  const demo = app.backend instanceof DemoBackend ? app.backend : null;
  const [code, setCode] = useState<{ role: Role; code: string } | null>(null);
  const canEdit = me.role !== 'support';
  const canInvite = me.role !== 'support';
  const hasSelf = snap.members.some((m) => m.role === 'self');
  const canDelete = me.role === 'self' || (me.role === 'therapist' && !hasSelf);

  const canRemove = (m: Member) => m.role !== 'self' && (m.user_id === me.user_id || me.role === 'self' || (me.role === 'therapist' && m.role === 'therapist'));

  const invite = async (role: Role) => {
    const c = await app.actions.createInvite(role);
    if (c) setCode({ role, code: c });
  };

  const exportData = async () => {
    const json = JSON.stringify({ exported_at: new Date().toISOString(), ...snap }, null, 2);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `stepwise-${snap.person.first_name.toLowerCase()}.json`;
      a.click();
    } else {
      await Share.share({ message: json, title: 'Stepwise data' }).catch(() => {});
    }
  };

  return (
    <Col gap={24}>
      <BackLink onPress={app.back} />
      <T heading size={28}>
        Settings
      </T>

      {demo ? (
        <Section title="Demo">
          <T size={14} color={colors.muted} lh={1.45}>
            See the app the way each person on the team sees it.
          </T>
          <Segmented<DemoRole>
            options={[
              ['self', snap.person.first_name],
              ['support', 'Support'],
              ['therapist', 'Therapist'],
            ]}
            value={app.demoRole as DemoRole}
            onChange={async (r) => {
              await demo.setDemoRole(r);
              await app.enter();
            }}
          />
          <Btn label="Start the demo again" variant="ghost" size="md" onPress={() => demo.reset().then(() => app.enter())} />
        </Section>
      ) : null}

      <Section title={`How the app works for ${snap.person.first_name}`}>
        {ACCESS_OPTS.map((o) => (
          <AccessRow key={o.k} icon={o.icon} label={o.label} sub={o.sub} on={snap.person[o.field]} onPress={() => (canEdit ? app.actions.updatePerson({ [o.field]: !snap.person[o.field] }) : app.toast(`Only ${snap.person.first_name} or their therapist can change this`))} />
        ))}
        {app.reminders.shown ? (
        <AccessRow
          icon="lock"
          label="Private reminders"
          sub={'Reminders say "Time for your task" instead of the task name'}
          on={snap.person.private_notifications}
          onPress={() => (canEdit ? app.actions.updatePerson({ private_notifications: !snap.person.private_notifications }) : app.toast('Only the person or their therapist can change this'))}
        />
        ) : null}
      </Section>

      <Section title="Team">
        <Card pad={0} gap={0} radius={18} style={{ paddingHorizontal: 16 }}>
          {snap.members.map((m, i) => (
            <Row key={m.id} gap={12} style={{ paddingVertical: 12, borderBottomWidth: i < snap.members.length - 1 ? 1 : 0, borderBottomColor: colors.divider }}>
              <Col gap={2} style={{ flex: 1 }}>
                <T bold size={15}>
                  {m.display_name}
                  {m.user_id === me.user_id ? ' (you)' : ''}
                </T>
                <T size={13} color={colors.muted}>
                  {roleLabel(m)}
                </T>
              </Col>
              {canRemove(m) ? (
                <Btn
                  label={m.user_id === me.user_id ? 'Leave' : 'Remove'}
                  variant="ghost"
                  size="sm"
                  color={colors.alertFg}
                  onPress={async () => {
                    const self = m.user_id === me.user_id;
                    if (!(await confirm(self ? 'Leave this team?' : `Remove ${m.display_name}?`, self ? 'You will no longer see this profile.' : 'They will no longer see anything on this profile.', self ? 'Leave' : 'Remove'))) return;
                    if (await app.actions.removeMember(m.id, self ? 'You left the team' : `${m.display_name} was removed`)) {
                      if (self) await app.enter();
                    }
                  }}
                />
              ) : null}
            </Row>
          ))}
        </Card>
        {canInvite ? (
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Btn label="Invite support" icon="person_add" variant="secondary" size="sm" onPress={() => invite('support')} />
            <Btn label="Invite therapist" icon="person_add" variant="secondary" size="sm" onPress={() => invite('therapist')} />
            {me.role === 'therapist' && !hasSelf ? <Btn label={`Invite ${snap.person.first_name}`} icon="person_add" variant="secondary" size="sm" onPress={() => invite('self')} /> : null}
          </Row>
        ) : null}
        {code ? (
          <Card gap={8} radius={16} pad={14}>
            <T size={14} color={colors.muted}>
              Code for a new {code.role === 'self' ? 'profile owner' : code.role === 'support' ? 'support person' : 'therapist'} (works once, expires in 7 days)
            </T>
            <T bold size={30} style={{ letterSpacing: 6 }}>
              {code.code}
            </T>
            <Btn
              label="Share code"
              icon="ios_share"
              size="sm"
              onPress={() => Share.share({ message: `Join ${snap.person.first_name}'s team on Stepwise (by Understanding ET). Open the app, tap "I have a code from my therapist" and enter ${code.code}. It expires in 7 days.` }).catch(() => {})}
            />
          </Card>
        ) : null}
      </Section>

      <Section title="Privacy and your data">
        <PrivacyCard />
        <Btn label="Download data" icon="download" variant="secondary" size="md" onPress={exportData} />
        {canDelete ? (
          <Btn
            label="Delete this profile"
            icon="delete"
            variant="ghost"
            size="md"
            color={colors.alertFg}
            onPress={async () => {
              if (await confirm(`Delete ${snap.person.first_name}'s profile?`, 'This permanently deletes all tasks, check-ins, feelings and notes for everyone on the team. It cannot be undone.', 'Delete')) {
                await app.actions.deletePerson();
              }
            }}
          />
        ) : null}
      </Section>

      {!demo ? (
        <Section title="Account">
          <T size={14} color={colors.muted}>
            Signed in as {app.user?.email}
          </T>
          {app.people.length > 1 ? <Btn label="Switch profile" variant="secondary" size="md" onPress={() => app.reset('clients')} /> : null}
          <Btn label="Sign out" icon="logout" variant="ghost" size="md" onPress={() => app.backend.signOut()} />
          <Btn
            label="Delete my account"
            icon="delete"
            variant="ghost"
            size="md"
            color={colors.alertFg}
            onPress={async () => {
              const ok = await confirm(
                'Delete your account?',
                'This withdraws your consent and permanently deletes your account. Profiles you own are deleted with everything on them, and you leave every other team. This cannot be undone.',
                'Delete',
              );
              if (!ok) return;
              try {
                await app.backend.deleteAccount();
                app.toast('Your account has been deleted');
              } catch (e) {
                app.toast(friendlyError(e));
              }
            }}
          />
        </Section>
      ) : null}
      <View style={{ height: 8 }} />
    </Col>
  );
}
