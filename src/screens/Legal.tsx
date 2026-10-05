// Privacy Policy / Terms of Use pages, links to them, and the screen asking people to agree.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp } from '../state/app';
import { colors } from '../theme';
import { BackLink, Btn, Card, Checkbox, Col, Heading, InfoBox, Row, T } from '../ui/kit';
import { ORG, POLICY_DATE, POLICY_VERSION, PRIVACY, TERMS, type LegalDoc } from '../legal';
import { friendlyError } from '../data/backend';

export function LegalScreen() {
  const app = useApp();
  const doc: LegalDoc = app.route.params?.doc === 'terms' ? TERMS : PRIVACY;
  return (
    <Col gap={18}>
      <BackLink onPress={app.back} />
      <Col gap={6}>
        <T heading size={28}>
          {doc.title}
        </T>
        <T size={13} color={colors.muted}>
          Stepwise by {ORG.name} · Last updated {POLICY_DATE}
        </T>
      </Col>
      <T size={16} lh={1.5}>
        {doc.intro}
      </T>
      {doc.sections.map((s) => (
        <Col key={s.heading} gap={8}>
          <T bold size={18}>
            {s.heading}
          </T>
          {s.body.map((b, i) =>
            typeof b === 'string' ? (
              <T key={i} size={15} lh={1.55} color={colors.body}>
                {b}
              </T>
            ) : (
              <Col key={i} gap={6}>
                {b.map((item) => (
                  <Row key={item} gap={8} align="flex-start">
                    <T size={15} lh={1.55} color={colors.body}>
                      •
                    </T>
                    <T size={15} lh={1.55} color={colors.body} style={{ flex: 1 }}>
                      {item}
                    </T>
                  </Row>
                ))}
              </Col>
            ),
          )}
        </Col>
      ))}
      <Btn label="Back" variant="secondary" size="md" onPress={app.back} />
    </Col>
  );
}

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={6} style={{ minHeight: 44, justifyContent: 'center' }}>
      <T bold size={15} color={colors.primary} style={{ textDecorationLine: 'underline' }}>
        {label}
      </T>
    </Pressable>
  );
}

/** "Privacy Policy · Terms of Use" links. */
export function LegalLinks() {
  const app = useApp();
  return (
    <Row gap={16} style={{ flexWrap: 'wrap' }}>
      <LinkText label="Privacy Policy" onPress={() => app.go('legal', { doc: 'privacy' })} />
      <LinkText label="Terms of Use" onPress={() => app.go('legal', { doc: 'terms' })} />
    </Row>
  );
}

/** The two agreements everyone gives at sign-up (and again when the policy changes). */
export function ConsentChecks({ terms, health, setTerms, setHealth }: { terms: boolean; health: boolean; setTerms: (v: boolean) => void; setHealth: (v: boolean) => void }) {
  return (
    <Col gap={4}>
      <Checkbox on={terms} onPress={() => setTerms(!terms)} label="I have read and agree to the Privacy Policy and Terms of Use" />
      <Checkbox
        on={health}
        onPress={() => setHealth(!health)}
        label="I agree that Stepwise can store information about my health and wellbeing (such as support needs, check-ins and feelings) and share it with the team I choose"
      />
      <LegalLinks />
    </Col>
  );
}

/** Shown after sign-in when this account hasn't agreed to the current version of the policy. */
export function ConsentScreen() {
  const app = useApp();
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  const agree = async () => {
    if (!terms || !health || busy) return;
    setBusy(true);
    try {
      await app.backend.acceptConsent(POLICY_VERSION);
      await app.enter(app.route.params?.intent ?? null);
    } catch (e) {
      app.toast(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1, gap: 20, paddingTop: 24 }}>
      <Heading
        title="Before you continue"
        sub="We've updated our Privacy Policy and Terms of Use. Please read them and agree to keep using Stepwise."
      />
      <InfoBox icon="lock">
        Your information is only shared with your team, and you can download or delete it at any time in Settings.
      </InfoBox>
      <ConsentChecks terms={terms} health={health} setTerms={setTerms} setHealth={setHealth} />
      <View style={{ flex: 1, minHeight: 12 }} />
      <Col gap={8}>
        <Btn label={busy ? 'Please wait…' : 'Agree and continue'} disabled={!terms || !health || busy} onPress={agree} />
        <Btn label="Sign out" variant="ghost" size="md" onPress={() => app.backend.signOut()} />
        <T size={13} color={colors.muted} align="center">
          Questions? {ORG.email}
        </T>
      </Col>
    </View>
  );
}

/** Short summary card used in Settings. */
export function PrivacyCard() {
  return (
    <Card gap={8} style={{ backgroundColor: colors.infoBox, borderWidth: 0 }}>
      <T size={14} lh={1.5} color={colors.body}>
        Only your team can see your information. It is stored securely by our database provider and never sold or used for adverts.
      </T>
      <T size={14} lh={1.5} color={colors.body}>
        Privacy questions or requests: {ORG.contactName}, {ORG.email}
      </T>
      <LegalLinks />
    </Card>
  );
}
