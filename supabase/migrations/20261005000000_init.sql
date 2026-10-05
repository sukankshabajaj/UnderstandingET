-- Stepwise (by Understanding ET) — database schema, privacy rules and server actions.
--
-- How to use: open your Supabase project → SQL Editor → paste this whole file → Run.
-- It is safe to run once on a new project. See docs/SETUP.md for the full guide.
--
-- Privacy model: a user can only read or change a person's data if they hold a
-- team_memberships row for that person. This is enforced by Postgres row-level
-- security (RLS), so it holds even if the app has a bug.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per signed-up user (mirrors auth.users, filled by a trigger below).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  age_confirmed_18 boolean not null default false,
  created_at timestamptz not null default now()
);

-- Clinicians allowed to create client profiles (you add rows yourself, see SETUP.md).
create table public.clinicians (
  email text primary key,
  clinic_name text not null default 'Understanding ET',
  added_at timestamptz not null default now()
);

-- Switch-rule thresholds. A single row; edit it to tune the rule for the clinic.
create table public.settings (
  id int primary key default 1 check (id = 1),
  min_rated_logs int not null default 5,
  working_rate numeric not null default 0.65,
  mixed_rate numeric not null default 0.45,
  review_day int not null default 10,
  target_rate numeric not null default 0.60,
  trial_days int not null default 14,
  extend_days int not null default 7
);
insert into public.settings (id) values (1);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) > 0),
  age_band text not null check (age_band in ('18-24', '25-34', '35-49', '50+')),
  age_confirmed_18 boolean not null check (age_confirmed_18),
  dx_tags text[] not null default '{}',
  needs text[] not null default '{}',
  tracked_areas text[] not null default '{}',
  picture_mode boolean not null default false,
  read_aloud boolean not null default false,
  reduce_motion boolean not null default false,
  private_notifications boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('self', 'support', 'therapist')),
  relation_label text,
  created_at timestamptz not null default now(),
  unique (person_id, user_id)
);
-- At most one "self" (the adult client) per person.
create unique index team_memberships_one_self on public.team_memberships (person_id) where role = 'self';

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{6}$'),
  role text not null check (role in ('self', 'support', 'therapist')),
  email text,
  relation_label text,
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
-- A code is only unique among invites that can still be used.
create unique index invites_open_code on public.invites (code) where used_at is null;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  area text not null check (area in ('daily', 'school', 'work', 'chores')),
  icon text,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  steps text[] not null default '{}',
  timer_minutes int not null default 0 check (timer_minutes >= 0),
  freq_per_week int not null default 7 check (freq_per_week between 1 and 7),
  freq_days int[] not null default '{}',
  reminder text check (reminder in ('morning', 'afternoon', 'evening')),
  trial_length_days int not null default 14 check (trial_length_days > 0),
  started_on date not null default current_date,
  ended_on date,
  end_reason text check (end_reason in ('switched', 'completed')),
  replaced_strategy_id uuid references public.strategies (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
-- Only one running strategy per task.
create unique index strategies_one_active on public.strategies (task_id) where ended_on is null;

create table public.logs (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  date date not null,
  done boolean not null default true,
  feel text check (feel in ('Easy', 'Okay', 'Hard')),
  helped int check (helped in (0, 1, 2)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (strategy_id, date)
);

create table public.feelings (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  feeling text not null check (feeling in ('Calm', 'Happy', 'Tired', 'Worried', 'Frustrated', 'Overwhelmed')),
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null default '',
  author_role text check (author_role in ('self', 'support', 'therapist')),
  text text not null check (length(trim(text)) > 0),
  feeling text check (feeling in ('Calm', 'Happy', 'Tired', 'Worried', 'Frustrated', 'Overwhelmed')),
  kind text not null default 'note' check (kind in ('note', 'system')),
  created_at timestamptz not null default now()
);

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  flagged_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Consent given at sign-up (and withdrawn later, if ever).
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

-- Audit log of therapists opening a client's data.
create table public.view_logs (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  viewer_id uuid references public.profiles (id) on delete set null,
  viewed_at timestamptz not null default now()
);

create index on public.team_memberships (user_id);
create index on public.tasks (person_id);
create index on public.strategies (person_id);
create index on public.logs (person_id, date);
create index on public.notes (person_id, created_at desc);
create index on public.feelings (person_id, created_at desc);
create index on public.flags (strategy_id) where resolved_at is null;

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------

create function public.member_role(p_person uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.team_memberships where person_id = p_person and user_id = auth.uid()
$$;

create function public.is_member(p_person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_memberships where person_id = p_person and user_id = auth.uid())
$$;

create function public.shares_person(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_memberships a
    join public.team_memberships b on a.person_id = b.person_id
    where a.user_id = auth.uid() and b.user_id = p_user)
$$;

create function public.is_clinician() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinicians c join public.profiles p on lower(p.email) = lower(c.email)
    where p.id = auth.uid())
$$;

-- Writes an audit entry to the shared Notes feed as the current user.
create function public._system_note(p_person uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_member(p_person);
  insert into public.notes (person_id, author_id, author_name, author_role, text, kind)
  select p_person, auth.uid(), coalesce(pr.display_name, ''), public.member_role(p_person), p_text, 'system'
  from public.profiles pr where pr.id = auth.uid();
end $$;

create function public._require_member(p_person uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare r text;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  r := public.member_role(p_person);
  if r is null then raise exception 'Not on this person''s team' using errcode = '42501'; end if;
  return r;
end $$;

create function public._new_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare c text;
begin
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.invites where code = c and used_at is null);
  end loop;
  return c;
end $$;

-- ---------------------------------------------------------------------------
-- New user → profile (+ consent record)
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, display_name, age_confirmed_18)
  values (new.id, new.email, coalesce(meta->>'display_name', ''),
          coalesce((meta->>'age_confirmed_18')::boolean, false));
  if meta ? 'consent_version' then
    insert into public.consents (user_id, version) values (new.id, meta->>'consent_version');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clinicians enable row level security;
alter table public.settings enable row level security;
alter table public.people enable row level security;
alter table public.team_memberships enable row level security;
alter table public.invites enable row level security;
alter table public.tasks enable row level security;
alter table public.strategies enable row level security;
alter table public.logs enable row level security;
alter table public.feelings enable row level security;
alter table public.notes enable row level security;
alter table public.flags enable row level security;
alter table public.consents enable row level security;
alter table public.view_logs enable row level security;

create policy "own or teammate profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_person(id));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "clinician sees own row" on public.clinicians for select to authenticated
  using (lower(email) = lower((select email from public.profiles where id = auth.uid())));

create policy "anyone signed in reads settings" on public.settings for select to authenticated using (true);

create policy "team reads person" on public.people for select to authenticated
  using (public.is_member(id));
create policy "self or therapist updates person" on public.people for update to authenticated
  using (public.member_role(id) in ('self', 'therapist'))
  with check (public.member_role(id) in ('self', 'therapist'));

create policy "team reads memberships" on public.team_memberships for select to authenticated
  using (public.is_member(person_id));

create policy "team reads invites" on public.invites for select to authenticated
  using (public.member_role(person_id) in ('self', 'therapist'));

create policy "team reads tasks" on public.tasks for select to authenticated
  using (public.is_member(person_id));

create policy "team reads strategies" on public.strategies for select to authenticated
  using (public.is_member(person_id));

create policy "team reads logs" on public.logs for select to authenticated
  using (public.is_member(person_id));
create policy "team writes logs" on public.logs for insert to authenticated
  with check (
    public.is_member(person_id) and created_by = auth.uid()
    and exists (select 1 from public.strategies s
                where s.id = strategy_id and s.task_id = logs.task_id and s.person_id = logs.person_id));
create policy "team updates logs" on public.logs for update to authenticated
  using (public.is_member(person_id))
  with check (
    public.is_member(person_id)
    and exists (select 1 from public.strategies s
                where s.id = strategy_id and s.task_id = logs.task_id and s.person_id = logs.person_id));
create policy "team deletes logs" on public.logs for delete to authenticated
  using (public.is_member(person_id));

create policy "team reads feelings" on public.feelings for select to authenticated
  using (public.is_member(person_id));

create policy "team reads notes" on public.notes for select to authenticated
  using (public.is_member(person_id));
create policy "team posts notes" on public.notes for insert to authenticated
  with check (public.is_member(person_id) and author_id = auth.uid() and kind = 'note' and feeling is null);

create policy "team reads flags" on public.flags for select to authenticated
  using (public.is_member(person_id));

create policy "own consents" on public.consents for select to authenticated using (user_id = auth.uid());
create policy "add own consent" on public.consents for insert to authenticated with check (user_id = auth.uid());
create policy "withdraw own consent" on public.consents for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "client and viewer read view logs" on public.view_logs for select to authenticated
  using (viewer_id = auth.uid() or public.member_role(person_id) = 'self');

-- Fill in author name/role on posted notes so the app can't spoof them.
create function public.notes_fill_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'note' then
    new.author_name := coalesce((select display_name from public.profiles where id = new.author_id), '');
    new.author_role := public.member_role(new.person_id);
  end if;
  return new;
end $$;
create trigger notes_fill_author before insert on public.notes
  for each row execute function public.notes_fill_author();


-- ---------------------------------------------------------------------------
-- Server actions (called from the app with supabase.rpc)
-- ---------------------------------------------------------------------------

-- Onboarding: create a profile for yourself ('self') or for a client ('therapist').
-- p_invites: [{ "role": "support", "email": "x@y.com", "relation_label": "Partner" }, ...]
create function public.create_person(
  p_first_name text, p_age_band text, p_age_confirmed boolean, p_dx_tags text[], p_needs text[],
  p_tracked_areas text[], p_picture_mode boolean, p_read_aloud boolean, p_reduce_motion boolean,
  p_my_role text, p_invites jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid; inv jsonb; out_invites jsonb := '[]'::jsonb; c text;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if not coalesce(p_age_confirmed, false) then
    raise exception 'Stepwise is for adults 18 and over' using errcode = '22023';
  end if;
  if p_my_role = 'self' then
    if not (select age_confirmed_18 from public.profiles where id = auth.uid()) then
      raise exception 'Stepwise is for adults 18 and over' using errcode = '22023';
    end if;
  elsif p_my_role = 'therapist' then
    if not public.is_clinician() then
      raise exception 'Only Understanding ET clinicians can create client profiles' using errcode = '42501';
    end if;
  else
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  insert into public.people (first_name, age_band, age_confirmed_18, dx_tags, needs, tracked_areas,
                             picture_mode, read_aloud, reduce_motion, created_by)
  values (trim(p_first_name), p_age_band, true, coalesce(p_dx_tags, '{}'), coalesce(p_needs, '{}'),
          coalesce(p_tracked_areas, '{}'), coalesce(p_picture_mode, false), coalesce(p_read_aloud, false),
          coalesce(p_reduce_motion, false), auth.uid())
  returning id into pid;

  insert into public.team_memberships (person_id, user_id, role) values (pid, auth.uid(), p_my_role);
  perform public._system_note(pid, 'Created ' || trim(p_first_name) || '''s profile.');

  for inv in select * from jsonb_array_elements(coalesce(p_invites, '[]'::jsonb)) loop
    if coalesce(trim(inv->>'email'), '') <> '' then
      c := public.create_invite(pid, inv->>'role', inv->>'email', inv->>'relation_label');
      out_invites := out_invites || jsonb_build_object('role', inv->>'role', 'email', inv->>'email', 'code', c);
    end if;
  end loop;

  return jsonb_build_object('person_id', pid, 'invites', out_invites);
end $$;

-- Make a 6-digit, single-use code that expires after 7 days.
create function public.create_invite(p_person uuid, p_role text, p_email text default null,
                                     p_relation text default null) returns text
language plpgsql security definer set search_path = public as $$
declare r text; c text;
begin
  r := public._require_member(p_person);
  if p_role not in ('self', 'support', 'therapist') then raise exception 'Invalid role' using errcode = '22023'; end if;
  -- The adult chooses who to invite; a therapist can invite anyone; support cannot invite.
  if r = 'support' then raise exception 'Support members cannot invite people' using errcode = '42501'; end if;
  if p_role = 'self' and (r <> 'therapist' or exists (
       select 1 from public.team_memberships where person_id = p_person and role = 'self')) then
    raise exception 'This profile already has its owner' using errcode = '42501';
  end if;
  c := public._new_code();
  insert into public.invites (person_id, code, role, email, relation_label, created_by)
  values (p_person, c, p_role, nullif(trim(p_email), ''), nullif(trim(p_relation), ''), auth.uid());
  perform public._system_note(p_person, 'Created an invite code for a new '
    || case p_role when 'self' then 'profile owner' when 'support' then 'support person' else 'therapist' end || '.');
  return c;
end $$;

-- Join a team with a code.
create function public.redeem_invite(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.invites; who text;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if not (select age_confirmed_18 from public.profiles where id = auth.uid()) then
    raise exception 'Stepwise is for adults 18 and over' using errcode = '22023';
  end if;
  select * into inv from public.invites
    where code = trim(p_code) and used_at is null and expires_at > now()
    for update;
  if inv.id is null then raise exception 'That code is not valid or has expired' using errcode = 'P0002'; end if;
  if exists (select 1 from public.team_memberships where person_id = inv.person_id and user_id = auth.uid()) then
    raise exception 'You are already on this team' using errcode = '23505';
  end if;
  if inv.role = 'therapist' and not public.is_clinician() then
    raise exception 'Only Understanding ET clinicians can join as therapist' using errcode = '42501';
  end if;
  insert into public.team_memberships (person_id, user_id, role, relation_label)
  values (inv.person_id, auth.uid(), inv.role, inv.relation_label);
  update public.invites set used_at = now(), used_by = auth.uid() where id = inv.id;
  select display_name into who from public.profiles where id = auth.uid();
  perform public._system_note(inv.person_id, coalesce(nullif(who, ''), 'Someone') || ' joined the team'
    || case inv.role when 'self' then '.' when 'support' then ' as support.' else ' as therapist.' end);
  return inv.person_id;
end $$;

-- Add a task together with its first strategy.
-- p_strategy: { name, description, steps[], timer_minutes, freq_per_week, freq_days[], reminder }
create function public.add_task(p_person uuid, p_title text, p_area text, p_icon text, p_strategy jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid; s public.settings;
begin
  perform public._require_member(p_person);
  select * into s from public.settings where id = 1;
  insert into public.tasks (person_id, title, area, icon, created_by)
  values (p_person, trim(p_title), p_area, p_icon, auth.uid()) returning id into tid;
  insert into public.strategies (task_id, person_id, name, description, steps, timer_minutes, freq_per_week,
                                 freq_days, reminder, trial_length_days, created_by)
  values (tid, p_person, trim(p_strategy->>'name'), coalesce(p_strategy->>'description', ''),
          coalesce(array(select jsonb_array_elements_text(p_strategy->'steps')), '{}'),
          coalesce((p_strategy->>'timer_minutes')::int, 0), coalesce((p_strategy->>'freq_per_week')::int, 7),
          coalesce(array(select jsonb_array_elements_text(p_strategy->'freq_days')::int), '{}'),
          nullif(p_strategy->>'reminder', ''), s.trial_days, auth.uid());
  perform public._system_note(p_person, 'Added "' || trim(p_title) || '" with strategy "' || trim(p_strategy->>'name') || '".');
  return tid;
end $$;

-- Any team member: take a task off the plan (its history is kept).
create function public.archive_task(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task;
  if t.id is null then raise exception 'Task not found' using errcode = 'P0002'; end if;
  perform public._require_member(t.person_id);
  update public.tasks set active = false where id = t.id;
  perform public._system_note(t.person_id, 'Removed "' || t.title || '" from the plan.');
end $$;

-- Therapist only: end the current strategy and start a new trial.
create function public.switch_strategy(p_strategy uuid, p_new jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare old public.strategies; nid uuid; s public.settings; t text;
begin
  select * into old from public.strategies where id = p_strategy for update;
  if old.id is null then raise exception 'Strategy not found' using errcode = 'P0002'; end if;
  if public._require_member(old.person_id) <> 'therapist' then
    raise exception 'Only the therapist can switch a strategy' using errcode = '42501';
  end if;
  if old.ended_on is not null then raise exception 'That strategy has already ended' using errcode = '22023'; end if;
  select * into s from public.settings where id = 1;
  update public.strategies set ended_on = current_date, end_reason = 'switched' where id = old.id;
  insert into public.strategies (task_id, person_id, name, description, steps, timer_minutes, freq_per_week,
                                 freq_days, reminder, trial_length_days, replaced_strategy_id, created_by)
  values (old.task_id, old.person_id, trim(p_new->>'name'), coalesce(p_new->>'description', ''),
          case when p_new ? 'steps' then array(select jsonb_array_elements_text(p_new->'steps')) else old.steps end,
          coalesce((p_new->>'timer_minutes')::int, 0), old.freq_per_week, old.freq_days, old.reminder,
          s.trial_days, old.id, auth.uid())
  returning id into nid;
  update public.flags set resolved_at = now() where strategy_id = old.id and resolved_at is null;
  select title into t from public.tasks where id = old.task_id;
  perform public._system_note(old.person_id, 'Switched ' || lower(t) || ' from ' || old.name || ' to '
    || trim(p_new->>'name') || '. New ' || s.trial_days || '-day trial.');
  return nid;
end $$;

-- Therapist only: give the trial more time.
create function public.extend_trial(p_strategy uuid) returns void
language plpgsql security definer set search_path = public as $$
declare st public.strategies; s public.settings;
begin
  select * into st from public.strategies where id = p_strategy;
  if st.id is null then raise exception 'Strategy not found' using errcode = 'P0002'; end if;
  if public._require_member(st.person_id) <> 'therapist' then
    raise exception 'Only the therapist can extend a trial' using errcode = '42501';
  end if;
  select * into s from public.settings where id = 1;
  update public.strategies set trial_length_days = trial_length_days + s.extend_days where id = st.id;
  update public.flags set resolved_at = now() where strategy_id = st.id and resolved_at is null;
  perform public._system_note(st.person_id, 'Extended the ' || st.name || ' trial by ' || s.extend_days || ' days.');
end $$;

-- Support or therapist: ask for a review (or undo).
create function public.set_flag(p_strategy uuid, p_flagged boolean) returns void
language plpgsql security definer set search_path = public as $$
declare st public.strategies;
begin
  select * into st from public.strategies where id = p_strategy;
  if st.id is null then raise exception 'Strategy not found' using errcode = 'P0002'; end if;
  if public._require_member(st.person_id) not in ('support', 'therapist') then
    raise exception 'Only support or the therapist can flag a strategy' using errcode = '42501';
  end if;
  if p_flagged then
    if not exists (select 1 from public.flags where strategy_id = st.id and resolved_at is null) then
      insert into public.flags (strategy_id, person_id, flagged_by) values (st.id, st.person_id, auth.uid());
      perform public._system_note(st.person_id, 'Flagged ' || st.name || ' for review.');
    end if;
  else
    update public.flags set resolved_at = now() where strategy_id = st.id and resolved_at is null;
  end if;
end $$;

-- Any team member: set the reminder time for a strategy.
create function public.set_reminder(p_strategy uuid, p_reminder text) returns void
language plpgsql security definer set search_path = public as $$
declare st public.strategies;
begin
  select * into st from public.strategies where id = p_strategy;
  if st.id is null then raise exception 'Strategy not found' using errcode = 'P0002'; end if;
  perform public._require_member(st.person_id);
  update public.strategies set reminder = nullif(p_reminder, '') where id = st.id;
end $$;

-- Log a feeling; it also appears in the shared Notes feed.
create function public.log_feeling(p_person uuid, p_feeling text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_member(p_person);
  insert into public.feelings (person_id, feeling, note, created_by)
  values (p_person, p_feeling, nullif(trim(p_note), ''), auth.uid());
  insert into public.notes (person_id, author_id, author_name, author_role, text, feeling, kind)
  select p_person, auth.uid(), pr.display_name, public.member_role(p_person),
         coalesce(nullif(trim(p_note), ''), 'Feeling ' || lower(p_feeling) || '.'), p_feeling, 'note'
  from public.profiles pr where pr.id = auth.uid();
end $$;

-- Remove someone from a team.
-- The adult can remove anyone; a therapist can remove therapists; anyone can leave.
create function public.remove_member(p_membership uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.team_memberships; r text; who text;
begin
  select * into m from public.team_memberships where id = p_membership;
  if m.id is null then raise exception 'Not found' using errcode = 'P0002'; end if;
  r := public._require_member(m.person_id);
  if m.role = 'self' then raise exception 'The profile owner cannot be removed' using errcode = '42501'; end if;
  if not (m.user_id = auth.uid() or r = 'self' or (r = 'therapist' and m.role = 'therapist')) then
    raise exception 'You cannot remove this person' using errcode = '42501';
  end if;
  select display_name into who from public.profiles where id = m.user_id;
  perform public._system_note(m.person_id,
    case when m.user_id = auth.uid() then 'Left the team.' else 'Removed ' || coalesce(nullif(who, ''), 'a member') || ' from the team.' end);
  delete from public.team_memberships where id = m.id;
end $$;

-- Delete a person and everything about them (right to erasure).
-- The adult can always do this; a therapist can do it only before the adult has joined.
create function public.delete_person(p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := public._require_member(p_person);
  if not (r = 'self' or (r = 'therapist' and not exists (
      select 1 from public.team_memberships where person_id = p_person and role = 'self'))) then
    raise exception 'Only the profile owner can delete this profile' using errcode = '42501';
  end if;
  delete from public.people where id = p_person;
end $$;

-- Therapist opened a client's data: write to the audit log.
create function public.record_view(p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public._require_member(p_person) = 'therapist' then
    insert into public.view_logs (person_id, viewer_id) values (p_person, auth.uid());
  end if;
end $$;

-- Lock down: helper functions are internal; actions are for signed-in users only.
-- (Supabase grants EXECUTE on new functions to anon and authenticated by default.)
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.member_role(uuid), public.is_member(uuid), public.shares_person(uuid), public.is_clinician(),
  public.create_person(text, text, boolean, text[], text[], text[], boolean, boolean, boolean, text, jsonb),
  public.create_invite(uuid, text, text, text), public.redeem_invite(text),
  public.add_task(uuid, text, text, text, jsonb), public.archive_task(uuid), public.switch_strategy(uuid, jsonb),
  public.extend_trial(uuid), public.set_flag(uuid, boolean), public.set_reminder(uuid, text),
  public.log_feeling(uuid, text, text), public.remove_member(uuid), public.delete_person(uuid),
  public.record_view(uuid)
to authenticated;
