// Privacy Policy and Terms of Use shown in the app (Settings, sign-up and the consent screen).
//
// DRAFT: written as a plain-language starting point. Have it reviewed by a lawyer or privacy
// adviser before real clients use Stepwise. `npm run legal:export` writes these texts to
// docs/legal/ as Markdown so they can be reviewed, shared or put on a website.
//
// When you change either document in a way people should agree to, change POLICY_VERSION.
// Everyone is then asked to read and agree again the next time they open the app.
// This file must not import anything (the export script runs it directly with Node).

export const POLICY_VERSION = '2026-10-05';
export const POLICY_DATE = '5 October 2026';

export const ORG = {
  name: 'Understanding ET',
  city: 'Bengaluru (Bangalore), Karnataka, India',
  contactName: 'Sukanksha',
  email: 'sukanksha@understandinget.com',
};

/**
 * Where the Supabase database is hosted. Must match the region chosen when the Supabase project
 * is created (docs/SETUP.md recommends Mumbai, India). Update this if you choose another region.
 */
export const DATA_LOCATION = 'Mumbai, India';

/** A paragraph, or a bulleted list when it is an array. */
export type LegalBlock = string | string[];

export interface LegalDoc {
  title: string;
  intro: string;
  sections: { heading: string; body: LegalBlock[] }[];
}

export const CRISIS_LINES: { country: string; text: string }[] = [
  { country: 'India', text: 'Emergency 112 · Tele-MANAS mental health helpline 14416 (24 hours, free)' },
  { country: 'United Kingdom', text: 'Emergency 999 · Samaritans 116 123 (24 hours, free)' },
  { country: 'Canada', text: 'Emergency 911 · Suicide Crisis Helpline 988 (call or text, 24 hours)' },
  { country: 'Singapore', text: 'Emergency 995 · SOS 24-hour hotline 1767' },
];

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  intro:
    `This policy explains what information Stepwise keeps about you, why, who can see it, and the choices you have. ` +
    `Stepwise is provided by ${ORG.name}, based in ${ORG.city}. We are responsible for your information ` +
    `(the "Data Fiduciary" under India's Digital Personal Data Protection Act, and the "controller" under UK data protection law).`,
  sections: [
    {
      heading: 'The short version',
      body: [
        [
          'We only collect what Stepwise needs to work.',
          'Only the people on your team can see your information: you, the support people you invite, and your Understanding ET therapist.',
          'Your information is stored securely by our database provider, Supabase, on servers in ' + DATA_LOCATION + '.',
          'We never sell your information, show you adverts, or use tracking tools.',
          'You can download your information, or delete it, at any time in Settings.',
        ],
      ],
    },
    {
      heading: 'What we collect',
      body: [
        'When you create an account:',
        ['Your name and email address, and a password (stored in scrambled form; we can never see it).', 'That you confirmed you are 18 or older, and when you agreed to this policy.'],
        'About the person the profile is for:',
        [
          'First name and age range.',
          'Optional: a diagnosis or support needs (for example ADHD or Anxiety, or "Prefer not to say"), and what is hard right now.',
          'Which areas of life you want to track, and settings like picture mode and read aloud.',
        ],
        'As you use Stepwise:',
        [
          'Tasks, the strategies being tried, and their steps, frequency and reminder times.',
          'When tasks are done, how they felt (Easy, Okay or Hard), and whether the strategy helped.',
          'Feelings you log, and notes written by anyone on the team.',
          'Who is on the team, the email addresses invites were made for, and invite codes.',
          'A record of changes (for example "Switched strategy") and of when a therapist opened the profile, so you can see who did what.',
        ],
        'Some of this is information about your health and wellbeing. We treat it with extra care.',
        'We do not collect your location, contacts, photos or anything from other apps. We do not use analytics or advertising tools. Reminders are set on your own phone.',
      ],
    },
    {
      heading: 'Why we use it',
      body: [
        [
          'To run Stepwise for you and your team: showing tasks, check-ins and progress.',
          'To help you and your therapist see which strategies help and when to try something else.',
          'To keep your account secure, and to fix problems.',
          'To meet our legal obligations.',
        ],
        'We use your information because you have given your consent. For health information, we ask for your explicit consent when you sign up. ' +
          'We will not use your information for research, marketing or anything else without asking you separately first.',
      ],
    },
    {
      heading: 'Who can see it',
      body: [
        [
          'Your team: everyone on a profile\'s team can see its tasks, check-ins, feelings and notes, and the names of the other team members.',
          'Understanding ET staff, only when needed to support you or to fix a problem.',
          'Our service providers, who store and process information only on our instructions: Supabase (database and sign-in; data stored in ' +
            DATA_LOCATION +
            '), the company that sends sign-in emails, and the company that hosts the web version of Stepwise.',
          'Authorities, only if the law requires us to share it.',
        ],
        'If you download Stepwise from the App Store or Google Play, Apple or Google know you installed it, but they do not receive your Stepwise information.',
      ],
    },
    {
      heading: 'If you live outside India',
      body: [
        `Stepwise is used by people in India, Singapore, Canada, the United Kingdom and elsewhere. Your information is stored in ${DATA_LOCATION}. ` +
          'When information is transferred from your country, we use safeguards required by the law there, such as contract terms with our providers that protect your information.',
        'You have the rights in the next section wherever you live, and any extra rights your local law gives you.',
      ],
    },
    {
      heading: 'Your rights and choices',
      body: [
        [
          'See and download your information: Settings → Download data.',
          'Correct it: change it in the app, or ask us.',
          'Delete it: Settings → Delete this profile removes the profile and everything on it. Settings → Delete my account removes your account too.',
          'Withdraw your consent at any time. It is as easy as giving it: delete your account in Settings, or email us. We then stop using your information and delete it.',
          'Choose your team: invite people, or remove a support person at any time.',
          'Nominate someone (in India) to use your rights if you cannot, by emailing us.',
          'Complain to us, and if you are not happy with our answer, to your regulator (see below).',
        ],
        `To use any of these rights, email ${ORG.email}. We will reply within 7 days and act within 30 days.`,
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'We keep your information while you use Stepwise. If a profile is not used for 12 months, or 12 months after you finish working with Understanding ET, we delete it.',
        'When something is deleted, it is removed straight away from Stepwise and from our backups within 30 days.',
      ],
    },
    {
      heading: 'How we protect it',
      body: [
        [
          'Information is encrypted while it travels and while it is stored.',
          'Database rules make sure each person\'s information can only be opened by their own team.',
          'Every change is recorded, and therapist views are logged.',
          'Only a small number of Understanding ET staff can manage the system.',
        ],
        'If there is ever a data breach that affects you, we will tell you and the authorities as the law requires (in the UK, within 72 hours).',
      ],
    },
    {
      heading: 'Adults only',
      body: ['Stepwise is only for people aged 18 and over. If we learn that someone under 18 is using it, we will delete their information.'],
    },
    {
      heading: 'Contact and complaints',
      body: [
        `${ORG.name}, ${ORG.city}.`,
        `Grievance Officer and privacy contact: ${ORG.contactName}, ${ORG.email}.`,
        'You can also complain to the regulator where you live:',
        [
          'India: the Data Protection Board of India.',
          'United Kingdom: the Information Commissioner\'s Office (ico.org.uk).',
          'Singapore: the Personal Data Protection Commission (pdpc.gov.sg).',
          'Canada: the Office of the Privacy Commissioner of Canada (priv.gc.ca), or your provincial commissioner.',
        ],
      ],
    },
    {
      heading: 'Changes to this policy',
      body: [`If we change this policy, we will show you the new version in the app and ask you to agree before you continue. Last updated: ${POLICY_DATE}.`],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of Use',
  intro: `These terms are the agreement between you and ${ORG.name} (${ORG.city}) for using Stepwise. Please read them with our Privacy Policy.`,
  sections: [
    {
      heading: 'What Stepwise is',
      body: [
        'Stepwise helps adults track everyday tasks, try support strategies, and share progress with the people supporting them, including an Understanding ET therapist.',
      ],
    },
    {
      heading: 'Stepwise is not emergency or medical care',
      body: [
        'Stepwise supports your work with your therapist. It does not replace professional advice, diagnosis or treatment. ' +
          'Your team is not watching the app all the time, so notes and feelings may not be seen straight away.',
        'If you are in crisis or might harm yourself, contact emergency services or a helpline now:',
        CRISIS_LINES.map((c) => `${c.country}: ${c.text}`),
      ],
    },
    {
      heading: 'Who can use Stepwise',
      body: [
        [
          'You must be 18 or older.',
          'Stepwise is offered to clients of Understanding ET and the people they invite to their team.',
          'Use your own account, give accurate information, and keep your password private. Tell us straight away if you think someone else has used your account.',
        ],
      ],
    },
    {
      heading: 'Your team',
      body: [
        [
          'The person a profile is for chooses who is on their team and can remove a support person at any time.',
          'Everything logged on a profile can be seen by everyone on its team.',
          'If you are a support person, you must keep what you see private and only use it to support the person.',
          'Only the therapist can switch or extend a strategy. Anyone on the team can add tasks.',
        ],
      ],
    },
    {
      heading: 'Using Stepwise fairly',
      body: [
        'Please do not:',
        [
          'post anything unlawful, threatening or abusive;',
          'try to see information that is not shared with you, or interfere with how Stepwise works;',
          'copy, resell or reverse-engineer Stepwise.',
        ],
        'We may pause or close an account that breaks these terms, and we will tell you why.',
      ],
    },
    {
      heading: 'Your information',
      body: [
        'What you put into Stepwise belongs to you. You allow us to store it and show it to your team so Stepwise can work. Our Privacy Policy explains how we look after it.',
      ],
    },
    {
      heading: 'Changes and availability',
      body: [
        'We keep improving Stepwise, so features may change. We try to keep it running all the time but cannot promise it will never be unavailable or free of errors.',
        'If we make important changes to these terms, we will show you the new version in the app and ask you to agree.',
      ],
    },
    {
      heading: 'Responsibility',
      body: [
        'We provide Stepwise with care, but as far as the law allows, we are not responsible for indirect losses, or for decisions made using Stepwise without professional advice. ' +
          'Nothing in these terms limits any responsibility that cannot be limited by law, or any rights you have as a consumer where you live.',
      ],
    },
    {
      heading: 'Ending',
      body: ['You can stop using Stepwise and delete your account at any time in Settings.'],
    },
    {
      heading: 'Law',
      body: [
        'These terms are governed by the laws of India, and the courts of Bengaluru have jurisdiction. If you live in another country, you also keep the protections of its laws.',
      ],
    },
    {
      heading: 'Contact',
      body: [`${ORG.contactName}, ${ORG.name}: ${ORG.email}. Last updated: ${POLICY_DATE}.`],
    },
  ],
};
