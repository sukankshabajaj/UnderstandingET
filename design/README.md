# Handoff: Stepwise (by Understanding ET)

## Overview
Stepwise is a mobile app for neurodivergent **adults (18+)**. v1 does not support children. Each task (e.g. "Took medicine", "Math homework") has a **strategy** (e.g. "Pill organizer + alarm", "First–Then board"). The person ticks tasks off and rates whether the strategy helped; their team (parent/support person and therapist) sees whether tasks are being done, whether each strategy is working, and when it's time to switch strategy.

First release audience: **clients of Understanding ET only** (therapist-led). The therapist creates or invites each client; general public sign-up is not required yet.

## About the Design Files
The files in `design/` are **design references built in HTML** — an interactive prototype showing intended look and behavior. They are not production code. Recreate them in a real app stack. No codebase exists yet; recommended stack:

- **React Native + Expo** (iOS, Android and web from one codebase; over-the-air updates for non-native changes)
- **Supabase** (Postgres, auth, row-level security, storage, edge functions) — or Firebase if preferred
- **Expo Notifications** for reminders; `expo-speech` for read-aloud

Open `design/Stepwise App v2.dc.html` in a browser to click through. The left panel switches Person/Support/Therapist view, replays the opening screens, and toggles picture mode.

## Fidelity
**High-fidelity.** Colors, type, spacing, copy and interactions are final for v1. Sample data (Sam, 28; Dr. Okafor) is placeholder. The prototype code still contains an unused child dataset (`INIT_CHILD`) — ignore it.

---

## Roles & Permissions

| Role | Who | Can |
|---|---|---|
| **Person** (adult client, 18+) | The neurodivergent user | See own tasks, tick tasks, do check-ins, log feelings, post notes, add tasks, view own Tracker/My week |
| **Support** | Partner, family member, coach or carer the adult invites | Everything above for the linked person + Overview dashboard, flag a strategy for review |
| **Therapist** | Understanding ET clinician | Everything Support can + extend a trial, switch strategy, create profiles, invite team members, manage multiple clients |

Rules:
- Adults only. An adult creates their own profile (or a therapist sets it up with them, with their consent) and chooses who to invite.
- Sign-up must include an "I confirm I am 18 or older" check; block under-18 sign-ups.
- Joining a team is by **6-digit invite code** (expires after 7 days, single use) or email invite.
- Every team member can add tasks; every add/switch/extend/flag writes an automatic note to the shared Notes feed (audit trail).
- An adult can remove a support person at any time. Therapist access is removed only by the adult themselves or by the therapist/clinic.
- Enforce with Postgres row-level security: a user can read/write a person's data only if they hold a `team_membership` row for that person.

---

## Data Model (Postgres)

```
users            id, email, display_name, role_default, created_at
people           id, first_name, age_band ('18-24'|'25-34'|'35-49'|'50+'), age_confirmed_18 (bool),
                 dx_tags text[] (optional), needs text[], tracked_areas text[],
                 picture_mode bool, read_aloud bool, reduce_motion bool, created_by → users
team_memberships id, person_id → people, user_id → users, role ('self'|'support'|'therapist'),
                 relation_label ('Parent','Partner','Coach'…), created_at
invites          id, person_id, code (6 digits), role, email?, expires_at, used_at
tasks            id, person_id, title, area ('daily'|'school'|'work'|'chores'), icon (Material Symbol name),
                 active bool, created_by → users, created_at
strategies       id, task_id, name, description, steps text[] (optional), timer_minutes (0 = none),
                 freq_per_week int (1–7), freq_days int[] (0=Mon…6=Sun, optional; overrides freq_per_week),
                 reminder ('morning'|'afternoon'|'evening'|null), trial_length_days (default 14),
                 started_on date, ended_on date?, end_reason ('switched'|'completed'|null),
                 replaced_strategy_id?, created_by
logs             id, strategy_id, task_id, person_id, date, done bool,
                 feel ('Easy'|'Okay'|'Hard'|null), helped (0|1|2|null)  -- 2=yes 1=a little 0=no; null=ticked not rated
                 created_by, created_at        -- one row per strategy per day
feelings         id, person_id, feeling ('Calm'|'Happy'|'Tired'|'Worried'|'Frustrated'|'Overwhelmed'),
                 note text?, created_by, created_at
notes            id, person_id, author_id, text, feeling? , kind ('note'|'system'), created_at
flags            id, strategy_id, flagged_by, created_at, resolved_at
```

---

## Strategy Switch Rules
- A strategy runs as a **trial** (default 14 days, therapist can extend by 7).
- **Helped rate** = sum(helped) / (2 × number of rated logs). Unrated ticks count as "done" but not toward the rate.
- Status:
  - **Too early**: fewer than 5 rated logs
  - **Working**: rate ≥ 65%
  - **Mixed**: 45–64%
  - **Not working**: < 45%
- **Review alert** fires when status is *Not working* AND trial day ≥ 10, OR a support member flagged it. Shown at the top of Overview for Support and Therapist ("Time to review" / "Flagged by parent").
- Target line on the chart = 60%. Rule copy: "Review if 'helped' stays under 60% after 10 days."
- Only the Therapist can **Switch strategy** (pick from library or write new → starts a new 14-day trial, old strategy ends with `end_reason='switched'`) or **Extend 7 days**. Support can **Flag for therapist review**.
- Make thresholds configurable per clinic (store in a `settings` table).

---

## Notifications / Reminders
- Per strategy: Morning 8:00, Afternoon 3:00, Evening 7:00 (local time), only on scheduled days (`freq_days`) or daily if none.
- After ticking a task with no reminder, the "Well done!" sheet asks "Want a reminder for X next time?" → sets the reminder.
- Team notifications: review alert fired; strategy flagged; strategy switched; feeling logged as Worried/Overwhelmed (support + therapist, opt-in).
- Respect quiet hours (default 9pm–7am) and reduce-motion setting. Never put sensitive detail in lock-screen text ("Time for your task", not the diagnosis or task name, if the person chooses private notifications).

---

## Privacy & Compliance Notes
Adults only (18+), so children's-data rules (DPDP Rule 10 parental consent, COPPA) do not apply. Wellbeing/diagnosis data about adults is still personal data under India's DPDP Act and sensitive health data under GDPR (UK/EU clients). Before launch:
- Determine applicable law: **COPPA** (US, under 13), **HIPAA** (US clinical use), **GDPR / UK GDPR** (EU/UK, special-category health data), **Australian Privacy Act / PIPEDA** etc. as relevant.
- Clear consent screen at sign-up (what is stored, why, who sees it); record consent; withdraw consent = as easy as giving it.
- Hard 18+ age gate.
- Remove names before any research analysis across clients.
- Breach notification plan (DPDP: report within 72 hours).
- Encrypt in transit (TLS) and at rest; use a BAA-capable host if HIPAA applies.
- Diagnosis field is optional and includes "Prefer not to say".
- Data export and full deletion on request; retention policy for ended clients.
- Audit log of who viewed/changed what (the notes "system" entries cover changes; add view logs for therapists).
- No analytics/ads SDKs that collect child data.

---

## Screens / Views
Phone frame in prototype: 390 × 844, content padding 20px horizontal. Bottom nav: 3–4 items, icon in 56×30 pill (active pill `#E4E0D7`, active color primary, inactive `#8A857B`), label 14px bold.

### Opening flow (hidden bottom nav)
1. **Welcome** – logo mark (110px wide), "Stepwise" (Quicksand 38/700, primary), "by Understanding ET" (14px muted), tagline "Try a strategy, see if it helps, and know when it is time to switch." (19px). Three feature rows (48px icon tile + 16px bold label): Track everyday tasks / See which strategies help / Share progress with your team. Buttons: **Get started** (primary), **I have a code from my therapist** (secondary outline).
2. **Join a team** – 6-digit numeric input (30px, letter-spacing .3em, centered). Join enabled at 6 digits.
3. **Who is this profile for?** (step 1/5) – cards: For myself / For a client (you become Therapist). Info box: "Stepwise is for adults 18 and over. Adults can set up their own profile and choose who to invite, or a therapist can set it up with them."
4. **About you / your child / your client** (2/5) – First name (required), Age band (required: 18–24, 25–34, 35–49, 50+) + 18+ confirmation checkbox in production, Diagnosis or support needs chips (optional: ADHD, Autism, Dyslexia, Anxiety, Dyspraxia, Other, Prefer not to say).
5. **What's hard right now?** (3/5) – multi-select icon chips: Starting tasks, Remembering, Changes in routine, Staying focused, Noise and senses, Big feelings, Sleep, Getting organised. Then "What should we track?": Daily life, Academics, Work, Chores.
6. **How should the app work for {name}?** (4/5) – toggles: Picture mode (big icons, fewer words), Read aloud (speaker buttons), Reduce motion.
7. **Invite the team** (5/5) – Therapist email, Support/parent email (label varies by who), visibility note. Continue / Skip for now.
8. **Profile ready** – summary rows; **Open Stepwise** → Person lands on Today; Support/Therapist land on Overview.

Step header: 44px back arrow + 5-segment progress bar (6px tall, done = primary, todo = `#E4E0D7`). Continue disabled color `#B9B4AA`.

### Person views (nav: Today · Tracker · My week · Notes)
- **Today** – date (15px muted), "Hi {name}" (Quicksand 30/700); "x of y done" + segmented progress bar; **How are you feeling?** card (3×2 grid of feeling chips, icon + label, tinted); **Up next** card (tinted by area, 24px radius, title 24px, "Strategy: …", Start button; speaker button if read-aloud); **Today's plan** list with "+ Add task". Row: 44px icon tile, title 16 bold, strategy 13 muted (hidden in picture mode), 48px tick target with 28px circle. Done rows 65% opacity.
- **Task** – area chip, title 28, strategy card (name 18 bold, description, "{frequency} · Reminder 7:00 pm"), optional work timer (40px tabular digits, Start/Pause), steps as checkable rows (min 56px), Read aloud, **I'm done** → Check-in.
- **Check-in** – "How did it go?" Easy/Okay/Hard (icon tiles), "Did '{strategy}' help?" Yes, it helped / A little / No (thumb icons). Save enabled when both chosen → Well-done sheet.
- **Well-done sheet** – check badge, rotating title (Well done! / Nice work! / You did it! / Great job!), "Keep going! N tasks left today." Reminder question if none set (Morning/Afternoon/Evening chips), "No thanks"/"Done".
- **Feeling sheet** – 6 feelings, optional note, Save → instant feedback: title, short supportive text, "Try this" tip, "Saved to Notes. Your team can see it." Feedback copy per feeling is in `FEELS` in the prototype.
- **Tracker** – Week | Month toggle. **Week**: prev/next week (max 3 back), "This week · Oct 5 – Oct 11 · x of y done", day header with today circled; one card per task: title, "strategy · frequency", "dn of target"; 7 square cells: done (area color, or helped color for adults/team), missed (white, grey border), today pending (dashed), future (`#F0EDE6`), not scheduled / before start ("–"). Legend below. **Month**: calendar grid with completion bar per day; tap a day to see that day's tasks and Done/Missed.
- **My week** – per-area 7-day blocks + "What's helping you" list of Working strategies.
- **Notes** – shared feed; "Log a feeling" button; post input; feeling tag on entries.

### Support / Therapist views (nav: Overview · Tracker · Notes)
- **Overview** – avatar + "{name}, {age}" + "Parent view"/"Therapist view · Dr. X"; review alerts (red tint `oklch(0.93 0.04 25)`); **Today** card (feelings logged chips + each task with result "Felt okay · strategy helped a little" / "Ticked done · not rated" / "Not logged yet"); **Strategies** list with status chip (Working / Mixed / Not working / Too early), 14-day spark bar, "Day x of 14 · Helped 62%"; "+ Add task".
- **Strategy detail** – task · area, strategy name 26, status chip, "Started Sep 22 · replaced …", trial progress bar, "Did it help?" bar chart (bar heights 30/62/100% for no/little/yes, grey 10% for missed, dashed outline for today, dashed 60% target line), stat tiles (Days done, Helped %, Target 60%), Switch rule box with verdict. Therapist: **Extend 7 days**, **Switch strategy** (bottom sheet with alternatives → Start trial). Parent: **Flag for therapist review** (toggle).

### Add task sheet (all roles)
Fields: Task (required), Area (Daily life / Academics / Work / Chores), Strategy to try (required), Steps to follow (optional, add/remove rows), How often (Every day / 5× a week / 3× a week / Once a week), Choose days (optional M–S toggles; overrides how often), Reminder (No reminder / Morning 8:00 / Afternoon 3:00 / Evening 7:00). Sheet max-height 88%, scrolls.

---

## Interactions & Behavior
- Bottom sheets slide up over a `rgba(30,28,24,.4)` scrim; tap scrim to close. Radius 28px top.
- Toasts: dark pill above nav, 2.6s.
- Picture mode: hides secondary text in task rows, enables read-aloud buttons. Read aloud uses TTS rate 0.9.
- Reduce motion: disable all transitions.
- Tap the tick circle to toggle done (untick allowed same day). Ticking opens Well-done sheet.
- Minimum touch target 44px everywhere; most primary buttons 56px.

## Design Tokens
Colors
- Background off-white `#FAF9F6`; page/outer `#EEF0E8`; card `#FFFFFF`; card border `#E4E0D7`; input border `#D6D1C6`
- Text `#2E2A35`; muted text `#6B665D`; secondary text `#55514A`; disabled `#B9B4AA`
- Brand purple `#9B85B5` (logo, accents); **primary action purple `#6E5893`** (buttons, active nav, selected — chosen for ≥4.5:1 contrast with white)
- Brand sage `#AFC69D`
- Area hues (OKLCH, tint L0.94 C0.035 / mid L0.68 C0.09 / deep L0.42 C0.08): Daily life h135 (sage), Academics h300 (lavender), Work h70 (warm yellow), Chores h210 (soft blue)
- Helped scale: Yes `oklch(0.68 0.11 150)`, A little `oklch(0.78 0.11 75)`, No `oklch(0.68 0.12 25)`, Missed `#DCD8CF`
- Feelings hues: Calm 150, Happy 95, Tired 300, Worried 300, Frustrated 40, Overwhelmed 25

Typography
- Headings: **Quicksand** 700 (20–38px)
- Body/UI: **Atkinson Hyperlegible** 400/700 (12–19px)
- Scale used: 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 38

Radius: 8 (chips), 10–12 (small buttons/cells), 14–16 (inputs/buttons), 18–20 (cards), 24 (hero card), 28 (sheets)
Spacing: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24
Shadows: segmented-control active `0 1px 3px rgba(0,0,0,.1)` only.

## Assets
- `assets/logo-mark.png`, `assets/logo-full.png` — cropped from the Understanding ET logo (transparent background). Ask the client for the original vector (SVG) for production.
- Icons: **Material Symbols Rounded** (Google Fonts, weight 500). Names used are in the prototype (e.g. `medication`, `checkroom`, `calendar_month`, `sentiment_stressed`).
- No illustrations in v1 (client chose icon-only).

## Files
- `design/Stepwise App v2.dc.html` — branded prototype (current)
- `design/Stepwise App.dc.html` — pre-brand version (reference only)
- `design/support.js` — prototype runtime, needed only to open the HTML
- `design/assets/` — logo files

Prototype logic of interest (in the `<script>` of the v2 file): `stats()` = switch rule, `INIT_CHILD` / `INIT_ADULT` = sample data shapes, `FEELS` = feelings + feedback copy, `freqText()` = frequency labels, `obFinish()` = onboarding → role mapping.

## Suggested Build Order
1. Auth + people + team memberships + invites (RLS)
2. Tasks/strategies CRUD + Add task sheet
3. Today, tick, check-in, Well-done sheet
4. Tracker week/month
5. Overview + strategy detail + switch/extend/flag
6. Feelings + notes
7. Reminders/notifications
8. Onboarding, picture mode, read aloud
