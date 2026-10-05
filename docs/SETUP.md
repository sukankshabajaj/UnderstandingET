# Setting up Stepwise: a step-by-step guide

This guide assumes you have never built an app before. Do the parts in order.
You can stop after **Part 1** just to try the app.

---

## Part 1: Try the app in demo mode (about 15 minutes)

In demo mode the app uses sample data (Sam, 28, and Dr. Okafor) that stays on the device.
Nothing is shared, so it's safe to play with.

### 1. Install the tools on your computer (one time only)

1. **Node.js**: go to <https://nodejs.org>, download the **LTS** version and install it.
2. **Git**: go to <https://git-scm.com/downloads> and install it (Macs often have it already).
3. **A code editor** (optional but helpful): [Visual Studio Code](https://code.visualstudio.com).

### 2. Download the project

Open the **Terminal** app (Mac) or **PowerShell** (Windows) and type these lines, pressing Enter after each:

```bash
git clone https://github.com/sukankshabajaj/UnderstandingET.git
cd UnderstandingET
git checkout claude/client-app-development-ljouj3
npm install
```

`npm install` downloads everything the app needs. It takes a few minutes the first time.

### 3. Open the app

**In your web browser:**

```bash
npm run web
```

A browser tab opens with the app. Tap **Look around with sample data**, then open
**Settings** (the gear icon) to switch between the *Sam*, *Support* and *Therapist* views.

**On your phone:**

1. Install **Expo Go** from the App Store or Google Play.
2. On your computer, run `npm start`. A QR code appears in the terminal.
3. Scan the QR code with your phone's camera (iPhone) or the Expo Go app (Android).
   Your phone and computer must be on the same Wi-Fi.

To stop the app, click in the terminal and press `Ctrl + C`.

---

## Part 2: Connect the real database (about 30 minutes)

To use Stepwise with clients, everyone's phone needs to share one secure database.
We use **Supabase** for this. It provides the database, logins and privacy rules.

### 1. Create a Supabase project

1. Go to <https://supabase.com> and sign up.
2. Click **New project**.
   - **Name**: `stepwise`
   - **Database password**: generate a strong one and save it in your password manager.
   - **Region**: pick the one closest to your clients (e.g. *Mumbai* for India, *London* for the UK).
     Where data is stored matters for privacy law (see Part 5).
3. Wait about 2 minutes while it is created.

### 2. Create the tables and privacy rules

1. In the Supabase dashboard, open **SQL Editor** (left menu) → **New query**.
2. Open the file `supabase/migrations/20261005000000_init.sql` from this project, copy **all** of it,
   paste it into the editor and click **Run**. You should see "Success. No rows returned".
3. Make yourself a clinician (this is what allows you to create client profiles). In a new query, run:

   ```sql
   insert into public.clinicians (email) values ('your.email@example.com');
   ```

   Use the email you will sign up with in the app. Add any other Understanding ET therapists the same way.

### 3. Check the login settings

In **Authentication → Sign In / Providers → Email**:
- Keep **Email** turned on.
- Keep **Confirm email** turned on (new users must click a link in their email).
- Set the minimum password length to 8.

In **Authentication → URL Configuration**, set **Site URL** to where the web app will live
(for now `http://localhost:8081` is fine).

> Supabase's built-in email sender only sends a few emails per hour. Before inviting many clients, connect
> your own email service under **Authentication → Emails → SMTP Settings** (for example Resend, Postmark or Brevo).

### 4. Connect the app to your project

1. In Supabase, go to **Project Settings → API** (or **Data API**). Copy the **Project URL** and the
   **anon / publishable key**. The anon key is designed to be public; your data is protected by the privacy rules
   from step 2. **Never** put the `service_role` / secret key in the app.
2. In the project folder, copy `.env.example` to a new file named `.env` and fill in the two values:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

3. Stop the app (`Ctrl + C`) and start it again with `npm run web` or `npm start`.
   The welcome screen no longer says "Demo mode".

---

## Part 3: Use it with a client

**You (the therapist):**
1. Open the app → **Get started** → create your account (use the email you added as a clinician).
2. Choose **For a client** and fill in the client's first name, age band and needs.
3. On **Invite the team**, type the client's email (and a support person's, if any).
4. The **ready** screen shows a 6-digit code for each person. Tap **Share code** to send it by WhatsApp, SMS or email.
   Codes work once and expire after 7 days. You can make new ones any time in **Settings → Team**.
5. Add the first tasks and strategies with **+ Add task**.

**Your client:**
1. Opens the app → **I have a code from my therapist** → creates an account (they must confirm they are 18+)
   → enters the code. They now see their own **Today** screen.

**Or the client sets it up themselves:** **Get started → For myself**, then they invite you with your email
and send you the code, which you enter with **Join a team with a code**.

**Seeing several clients:** therapists with more than one client get a **Your clients** list.

---

## Part 4: Get the app onto phones properly

Expo Go (Part 1) is for testing. For clients you have two options:

**A. Web app (simplest, free).** Run `npm run build:web`. This creates a `dist` folder you can upload to a free host such as
[Netlify](https://app.netlify.com/drop) (drag and drop the folder) or Vercel. Clients open the link on their phone and use
"Add to Home Screen". Note: phone **reminders do not work** in the web version.

**B. Real App Store / Google Play apps.** Use Expo's build service (EAS):

```bash
npm install -g eas-cli
eas login            # create a free Expo account first at expo.dev
eas build:configure
eas build --platform all
eas submit --platform ios       # needs an Apple Developer account ($99/year)
eas submit --platform android   # needs a Google Play account ($25 once)
```

Put your Supabase values in EAS too (`eas env:create`), or builds will run in demo mode.
Small fixes can later be sent to installed apps without a new store release using `eas update`.

---

## Part 5: Before you store real client information

Stepwise stores health-related information about adults. Please check these with a privacy adviser **before**
real clients use it:

- [ ] **Which laws apply**: India's DPDP Act; UK/EU GDPR if any clients are there (health data is "special category");
      HIPAA if you work with US clients (then use a host that signs a BAA. Supabase does on its Team plan and above).
- [ ] **Data location**: the Supabase region you chose.
- [ ] **Paid plan with backups**: free Supabase projects **pause after a week of no use** and have no point-in-time backups.
      Use the Pro plan for real clients.
- [ ] **Privacy notice**: the in-app summary (shown at sign-up and in Settings) is a starting point, not a full privacy policy.
      Publish a full one and link it.
- [ ] **Data breach plan**: who does what, and reporting within 72 hours.
- [ ] **Retention**: decide how long to keep data after a client finishes, and delete profiles you no longer need.
- [ ] **Turn on multi-factor login** for your Supabase dashboard account.

Already built in: 18+ age check, consent recorded at sign-up, row-level security (each person's data is visible only to
their team), an audit trail of changes in Notes, a log of therapist views, data download, and full deletion.

---

## For developers

| Command | What it does |
|---|---|
| `npm start` / `npm run web` | Run the app (Expo) |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (switch rule, tracker maths) |
| `npm run test:db` | Database privacy tests on a throwaway local Postgres (needs Postgres installed) |
| `SUPABASE_TEST_URL=… SUPABASE_TEST_ANON_KEY=… npm test` | Also runs the live tests against a **test** Supabase project that has `okafor@clinic.com` as a clinician |

**Changing the database later:** never edit the original migration once it has been run. Add a new file in
`supabase/migrations/` and run it in the SQL editor (or use the Supabase CLI: `npx supabase db push`).

**Tuning the switch rule:** edit the single row in the `settings` table (rated check-ins needed, 65% / 45% thresholds,
review day, target line, trial and extension lengths). The app picks it up automatically.
