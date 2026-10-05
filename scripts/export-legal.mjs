// Writes the in-app Privacy Policy and Terms of Use (src/legal.ts) to docs/legal/ as Markdown,
// so they can be reviewed by a lawyer, shared, or published on a website.
// Run: npm run legal:export
import { mkdirSync, writeFileSync } from 'node:fs';
import { PRIVACY, TERMS, ORG, POLICY_DATE, POLICY_VERSION } from '../src/legal.ts';

function toMarkdown(doc) {
  const out = [`# ${doc.title}`, '', `*Stepwise by ${ORG.name} · Last updated ${POLICY_DATE} (version ${POLICY_VERSION})*`, '', doc.intro, ''];
  for (const s of doc.sections) {
    out.push(`## ${s.heading}`, '');
    for (const b of s.body) out.push(...(typeof b === 'string' ? [b] : b.map((x) => `- ${x}`)), '');
  }
  return out.join('\n');
}

mkdirSync('docs/legal', { recursive: true });
writeFileSync('docs/legal/privacy-policy.md', toMarkdown(PRIVACY));
writeFileSync('docs/legal/terms-of-use.md', toMarkdown(TERMS));
console.log('Wrote docs/legal/privacy-policy.md and docs/legal/terms-of-use.md');
