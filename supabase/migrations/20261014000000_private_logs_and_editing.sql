-- Stepwise update 2: private feelings/notes, task editing, task icons.
--
-- How to use: Supabase → SQL Editor → paste this whole file → Run. Run it once, after the
-- first file (20261005000000_init.sql). It keeps all existing data.
--
-- What changes:
--  1. The person a profile is for can keep feelings and notes private (a personal log).
--     Private entries are only visible to the person who wrote them, enforced by the database.
--  2. Tasks and their current strategy can be edited without restarting the trial.

-- ---------------------------------------------------------------------------
-- 1. Private feelings and notes
-- ---------------------------------------------------------------------------

alter table public.notes add column private boolean not null default false;
alter table public.feelings add column private boolean not null default false;
alter table public.feelings add column note_id uuid references public.notes (id) on delete cascade;
-- The person's own choice for new entries (off = private by default).
alter table public.people add column share_by_default boolean not null default false;

drop policy "team reads notes" on public.notes;
create policy "team reads notes" on public.notes for select to authenticated
  using (public.is_member(person_id) and (not private or author_id = auth.uid()));

-- Only the person the profile is for can keep entries private (team notes stay visible to them).
drop policy "team posts notes" on public.notes;
create policy "team posts notes" on public.notes for insert to authenticated
  with check (
    public.is_member(person_id) and author_id = auth.uid() and kind = 'note' and feeling is null
    and (not private or public.member_role(person_id) = 'self'));

drop policy "team reads feelings" on public.feelings;
create policy "team reads feelings" on public.feelings for select to authenticated
  using (public.is_member(person_id) and (not private or created_by = auth.uid()));

-- Log a feeling; it also appears in Notes (privately unless shared).
drop function public.log_feeling(uuid, text, text);
create function public.log_feeling(p_person uuid, p_feeling text, p_note text default null, p_private boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare r text; nid uuid; priv boolean;
begin
  r := public._require_member(p_person);
  priv := coalesce(p_private, false) and r = 'self';
  insert into public.notes (person_id, author_id, author_name, author_role, text, feeling, kind, private)
  select p_person, auth.uid(), pr.display_name, r,
         coalesce(nullif(trim(p_note), ''), 'Feeling ' || lower(p_feeling) || '.'), p_feeling, 'note', priv
  from public.profiles pr where pr.id = auth.uid()
  returning id into nid;
  insert into public.feelings (person_id, feeling, note, created_by, private, note_id)
  values (p_person, p_feeling, nullif(trim(p_note), ''), auth.uid(), priv, nid);
end $$;

-- Share a private entry with the team, or make a shared one private again (author only).
create function public.set_note_private(p_note uuid, p_private boolean) returns void
language plpgsql security definer set search_path = public as $$
declare n public.notes;
begin
  select * into n from public.notes where id = p_note;
  if n.id is null or n.author_id is distinct from auth.uid() then
    raise exception 'You can only change your own entries' using errcode = '42501';
  end if;
  if p_private and public.member_role(n.person_id) <> 'self' then
    raise exception 'Only the profile owner can keep entries private' using errcode = '42501';
  end if;
  if n.kind <> 'note' then raise exception 'Updates cannot be made private' using errcode = '22023'; end if;
  update public.notes set private = p_private where id = n.id;
  update public.feelings set private = p_private where note_id = n.id;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Editing a task and its current strategy (keeps the trial and its results)
-- ---------------------------------------------------------------------------

-- p_strategy: { name, description, steps[], timer_minutes, freq_per_week, freq_days[], reminder }
create function public.edit_task(p_task uuid, p_title text, p_area text, p_icon text, p_strategy jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare t public.tasks; r text;
begin
  select * into t from public.tasks where id = p_task;
  if t.id is null then raise exception 'Task not found' using errcode = 'P0002'; end if;
  r := public._require_member(t.person_id);
  if r not in ('self', 'therapist') then
    raise exception 'Only the person or their therapist can edit a task' using errcode = '42501';
  end if;
  update public.tasks set title = trim(p_title), area = p_area, icon = p_icon where id = t.id;
  update public.strategies set
    name = trim(p_strategy->>'name'),
    description = coalesce(p_strategy->>'description', ''),
    steps = coalesce(array(select jsonb_array_elements_text(p_strategy->'steps')), '{}'),
    timer_minutes = coalesce((p_strategy->>'timer_minutes')::int, 0),
    freq_per_week = coalesce((p_strategy->>'freq_per_week')::int, 7),
    freq_days = coalesce(array(select jsonb_array_elements_text(p_strategy->'freq_days')::int), '{}'),
    reminder = nullif(p_strategy->>'reminder', '')
  where task_id = t.id and ended_on is null;
  perform public._system_note(t.person_id, 'Edited "' || trim(p_title) || '".');
end $$;

revoke execute on function public.log_feeling(uuid, text, text, boolean), public.set_note_private(uuid, boolean),
  public.edit_task(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.log_feeling(uuid, text, text, boolean), public.set_note_private(uuid, boolean),
  public.edit_task(uuid, text, text, text, jsonb) to authenticated;

-- Only the person themselves can change whether their entries are shared by default.
create function public.people_guard_sharing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.share_by_default is distinct from old.share_by_default and public.member_role(new.id) is distinct from 'self' then
    raise exception 'Only the person can change their sharing setting' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger people_guard_sharing before update on public.people
  for each row execute function public.people_guard_sharing();
revoke execute on function public.people_guard_sharing() from public, anon, authenticated;
