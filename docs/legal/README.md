# Privacy Policy and Terms of Use: review notes

`privacy-policy.md` and `terms-of-use.md` are exported from the app (`src/legal.ts`), so they always
match what clients see. **They are drafts written in plain language. Please have a lawyer or privacy
adviser review them before real clients use Stepwise.**

To change the wording: edit `src/legal.ts`, then run `npm run legal:export`. If clients need to agree
to the change, also change `POLICY_VERSION` in that file. Everyone is then asked to agree again
the next time they open the app.

## What the app already does

- Sign-up requires three ticks: 18 or older, agree to the Privacy Policy and Terms, and explicit consent
  for health and wellbeing information. The policy version and time are recorded (`consents` table).
- Both documents can be read before signing up (welcome screen), at sign-up, and any time in Settings.
- If the policy version changes, people must agree again before they can continue.
- Settings → Download data (export), Delete this profile, and Delete my account (withdraws consent and
  erases the account and the profiles it owns).
- Only team members can see a profile (enforced by the database). Changes and therapist views are logged.

## Points for the reviewer to check

1. **Laws covered:** India (DPDP Act 2023 and DPDP Rules), UK GDPR / Data Protection Act 2018, Singapore PDPA,
   Canada PIPEDA (and Quebec Law 25 if any clients are in Quebec). Check whether any other country applies.
2. **Data location:** the policy says Mumbai, India (`DATA_LOCATION` in `src/legal.ts`). This must match the
   Supabase region actually chosen. Check the safeguards needed for transfers from the UK, Singapore and Canada,
   for example the UK International Data Transfer Addendum and Supabase's Data Processing Agreement.
3. **Processors:** sign Supabase's DPA. Name the email provider and web host once chosen.
4. **Retention:** the policy promises deletion after 12 months of no use or 12 months after finishing with
   Understanding ET, and removal from backups within 30 days. This is currently done by hand. Set a reminder
   to review, or ask for an automatic clean-up job.
5. **Response times:** the policy promises a reply within 7 days and action within 30 days.
6. **Grievance Officer:** Sukanksha (sukanksha@understandinget.com). Check the DPDP requirements for publishing contact details.
7. **UK representative / ICO fee:** check whether Understanding ET needs a UK representative (UK GDPR Art. 27)
   or must pay the ICO data protection fee.
8. **Crisis numbers** in the Terms: India 112 / Tele-MANAS 14416, UK 999 / Samaritans 116 123,
   Canada 911 / 988, Singapore 995 / SOS 1767. Check these are still current.
9. **Liability and governing law** wording (Terms, "Responsibility" and "Law").
