-- Privacy and permission tests for the Stepwise schema.
-- Run with: npm run test:db   (needs a local Postgres; see supabase/tests/run.sh)
\set ON_ERROR_STOP 1
\set QUIET 1

create schema test;
grant usage on schema test to authenticated, anon;

-- Passes only if running q raises an error whose message matches pat.
create function test.fails(q text, pat text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm !~* pat then
      raise exception 'Expected error like "%" but got "%" for: %', pat, sqlerrm, q;
    end if;
    return;
  end;
  raise exception 'Expected this to fail but it worked: %', q;
end $$;

create function test.eq(got anyelement, want anyelement, what text) returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL %: got %, want %', what, got, want;
  end if;
  raise notice 'ok - %', what;
end $$;
grant execute on all functions in schema test to authenticated, anon;

-- Users (inserting into auth.users fires the profile trigger, like a real sign-up)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'sam@example.com',   '{"display_name":"Sam","age_confirmed_18":true,"consent_version":"2026-10"}'),
  ('00000000-0000-0000-0000-000000000002', 'alex@example.com',  '{"display_name":"Alex","age_confirmed_18":true,"consent_version":"2026-10"}'),
  ('00000000-0000-0000-0000-000000000003', 'okafor@clinic.com', '{"display_name":"Dr. Okafor","age_confirmed_18":true,"consent_version":"2026-10"}'),
  ('00000000-0000-0000-0000-000000000004', 'eve@example.com',   '{"display_name":"Eve","age_confirmed_18":true,"consent_version":"2026-10"}'),
  ('00000000-0000-0000-0000-000000000005', 'young@example.com', '{"display_name":"Young","age_confirmed_18":false}');
insert into public.clinicians (email) values ('OKAFOR@clinic.com');

select test.eq((select count(*) from public.profiles), 5::bigint, 'sign-up creates a profile');
select test.eq((select count(*) from public.consents), 4::bigint, 'sign-up records consent');

-- ---------------------------------------------------------------- Sam (self)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;

select public.create_person('Sam', '25-34', true, '{ADHD}', '{Remembering}', '{daily,work}', false, true, false, 'self',
  '[{"role":"support","email":"alex@example.com","relation_label":"Partner"},{"role":"therapist","email":"okafor@clinic.com"}]') as r \gset
select (:'r'::jsonb)->>'person_id' as pid,
       (:'r'::jsonb)->'invites'->0->>'code' as sup_code,
       (:'r'::jsonb)->'invites'->1->>'code' as ther_code \gset
select test.eq(jsonb_array_length((:'r'::jsonb)->'invites'), 2, 'create_person makes one code per invited email');
select test.eq(:'sup_code' ~ '^[0-9]{6}$', true, 'invite code is 6 digits');
select test.eq(public.member_role(:'pid'), 'self', 'creator of own profile is self');
select test.fails($$select public.create_person('Sam', '25-34', false, '{}', '{}', '{}', false, false, false, 'self')$$, '18');
select test.fails($$select public.create_person('Kai', '25-34', true, '{}', '{}', '{}', false, false, false, 'therapist')$$, 'clinician');

select public.add_task(:'pid', 'Took medicine', 'daily', 'medication',
  '{"name":"Alarm + pill organizer","description":"Organizer by the kettle","steps":["Alarm goes off","Take meds"],"freq_per_week":7,"freq_days":[0,1,2,3,4],"reminder":"morning"}') as tid \gset
select id as sid from public.strategies where task_id = :'tid' \gset
select test.eq((select freq_days from public.strategies where id = :'sid'), '{0,1,2,3,4}'::int[], 'add_task stores chosen days');
select test.eq((select trial_length_days from public.strategies where id = :'sid'), 14, 'trial length comes from settings');
insert into public.logs (strategy_id, task_id, person_id, date, feel, helped, created_by)
  values (:'sid', :'tid', :'pid', current_date, 'Easy', 2, auth.uid());
select test.eq((select count(*) from public.logs where person_id = :'pid'), 1::bigint, 'self can log a task');
select test.fails(format($$insert into public.logs (strategy_id, task_id, person_id, date, created_by)
  values (%L, %L, %L, current_date, %L)$$, :'sid', :'tid', :'pid', auth.uid()), 'duplicate key');

insert into public.notes (person_id, author_id, author_name, text) values (:'pid', auth.uid(), 'Dr. Fake', 'Posting feels like a wall.');
select test.eq((select author_name from public.notes where text = 'Posting feels like a wall.'), 'Sam', 'note author name cannot be spoofed');
select test.fails(format($$insert into public.notes (person_id, author_id, text, kind) values (%L, %L, 'x', 'system')$$, :'pid', auth.uid()), 'row-level security');
select public.log_feeling(:'pid', 'Overwhelmed', null);
select test.eq((select text from public.notes where feeling = 'Overwhelmed'), 'Feeling overwhelmed.', 'logging a feeling posts a note');
select test.fails(format($$select public._system_note(%L, 'fake audit entry')$$, :'pid'), 'permission denied');
select test.fails($$select public.set_flag((select id from public.strategies limit 1), true)$$, 'support or the therapist');

-- ---------------------------------------------------------------- Eve (stranger)
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
set role authenticated;
select test.eq((select count(*) from public.people), 0::bigint, 'stranger sees no people');
select test.eq((select count(*) from public.tasks), 0::bigint, 'stranger sees no tasks');
select test.eq((select count(*) from public.notes), 0::bigint, 'stranger sees no notes');
select test.eq((select count(*) from public.logs), 0::bigint, 'stranger sees no logs');
select test.eq((select count(*) from public.invites), 0::bigint, 'stranger sees no invite codes');
select test.eq((select count(*) from public.profiles), 1::bigint, 'stranger sees only own profile');
select test.fails(format($$insert into public.logs (strategy_id, task_id, person_id, date, created_by)
  values (%L, %L, %L, current_date - 1, %L)$$, :'sid', :'tid', :'pid', auth.uid()), 'row-level security');
select test.fails(format($$select public.add_task(%L, 'x', 'daily', null, '{"name":"y"}')$$, :'pid'), 'Not on this person');
select test.fails(format($$select public.create_invite(%L, 'support')$$, :'pid'), 'Not on this person');
update public.people set first_name = 'Hacked' where id = :'pid';
reset role;
select test.eq((select first_name from public.people where id = :'pid'), 'Sam', 'stranger cannot edit a person');

set role authenticated;
update public.tasks set active = false where id = :'tid';
select test.fails(format($$select public.archive_task(%L)$$, :'tid'), 'Not on this person');
reset role;
select test.eq((select active from public.tasks where id = :'tid'), true, 'stranger cannot archive a task');

-- ---------------------------------------------------------------- Young (under 18)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
set role authenticated;
select test.fails($$select public.create_person('Kid', '18-24', true, '{}', '{}', '{}', false, false, false, 'self')$$, '18');
select test.fails(format($$select public.redeem_invite(%L)$$, :'sup_code'), '18');

-- ---------------------------------------------------------------- Alex (support)
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;
select test.fails($$select public.redeem_invite('000000')$$, 'not valid');
select test.eq(public.redeem_invite(:'sup_code'), :'pid'::uuid, 'support joins with code');
select test.eq((select relation_label from public.team_memberships where user_id = auth.uid()), 'Partner', 'relation label carried over');
select test.eq((select count(*) from public.tasks), 1::bigint, 'support now sees tasks');
select test.eq((select count(*) from public.profiles), 2::bigint, 'support sees teammate profiles');
select test.eq((select count(*) from public.invites), 0::bigint, 'support cannot see invite codes');
select test.fails(format($$select public.redeem_invite(%L)$$, :'sup_code'), 'not valid');
select test.fails(format($$select public.create_invite(%L, 'support')$$, :'pid'), 'cannot invite');
select test.fails(format($$select public.switch_strategy(%L, '{"name":"Other"}')$$, :'sid'), 'Only the therapist');
select test.fails(format($$select public.extend_trial(%L)$$, :'sid'), 'Only the therapist');
select public.set_flag(:'sid', true);
select public.set_flag(:'sid', true);
select test.eq((select count(*) from public.flags where resolved_at is null), 1::bigint, 'support can flag (once)');
select public.set_reminder(:'sid', 'evening');
select test.eq((select reminder from public.strategies where id = :'sid'), 'evening', 'any member can set a reminder');

-- ---------------------------------------------------------------- Dr. Okafor (therapist)
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
set role authenticated;
select test.eq(public.redeem_invite(:'ther_code'), :'pid'::uuid, 'therapist joins with code');
select public.record_view(:'pid');
select test.eq((select count(*) from public.view_logs), 1::bigint, 'therapist views are logged');
select public.extend_trial(:'sid');
select test.eq((select trial_length_days from public.strategies where id = :'sid'), 21, 'extend adds 7 days');
select test.eq((select count(*) from public.flags where resolved_at is null), 0::bigint, 'extending resolves the flag');
select public.switch_strategy(:'sid', '{"name":"Token board","description":"Earn a token per part"}') as nsid \gset
select test.eq((select end_reason from public.strategies where id = :'sid'), 'switched', 'old strategy ends as switched');
select test.eq((select replaced_strategy_id from public.strategies where id = :'nsid'), :'sid'::uuid, 'new strategy links the old one');
select test.eq((select steps from public.strategies where id = :'nsid'), '{"Alarm goes off","Take meds"}'::text[], 'steps carry over when not given');
select test.eq((select reminder from public.strategies where id = :'nsid'), 'evening', 'reminder carries over');
select test.fails(format($$select public.switch_strategy(%L, '{"name":"Again"}')$$, :'sid'), 'already ended');
select test.eq((select count(*) from public.notes where kind = 'system' and text like 'Switched%'), 1::bigint, 'switch is written to the notes audit trail');

-- Therapist sets up a client who joins later
select (public.create_person('Jo', '35-49', true, '{}', '{}', '{work}', true, true, true, 'therapist',
  '[{"role":"self","email":"eve@example.com"}]')) as r2 \gset
select (:'r2'::jsonb)->>'person_id' as pid2, (:'r2'::jsonb)->'invites'->0->>'code' as self_code \gset
select test.fails(format($$select public.create_invite(%L, 'self')$$, :'pid'), 'already has its owner');
update public.people set picture_mode = true where id = :'pid';
select test.eq((select picture_mode from public.people where id = :'pid'), true, 'therapist can change accessibility settings');

-- ---------------------------------------------------------------- Eve joins as Jo's account
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
set role authenticated;
select test.eq(public.redeem_invite(:'self_code'), :'pid2'::uuid, 'client claims a therapist-made profile');
select test.eq((select count(*) from public.people), 1::bigint, 'client sees only their own profile');
select test.eq((select count(*) from public.view_logs), 0::bigint, 'no views of Jo yet');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
set role authenticated;
select test.fails(format($$select public.delete_person(%L)$$, :'pid2'), 'Only the profile owner');
select public.record_view(:'pid2');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
set role authenticated;
select test.eq((select count(*) from public.view_logs), 1::bigint, 'client can see therapist views');

-- ---------------------------------------------------------------- Removing people
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;
select test.fails(format($$select public.remove_member((select id from public.team_memberships where person_id = %L and role = 'therapist'))$$, :'pid'), 'cannot remove');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;
select test.fails(format($$select public.remove_member((select id from public.team_memberships where person_id = %L and role = 'self'))$$, :'pid'), 'cannot be removed');
select public.remove_member((select id from public.team_memberships where person_id = :'pid' and role = 'support'));

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;
select test.eq((select count(*) from public.tasks), 0::bigint, 'removed support loses access');

-- Expired codes
reset role;
insert into public.invites (person_id, code, role, expires_at) values (:'pid', '123456', 'support', now() - interval '1 minute');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;
select test.fails($$select public.redeem_invite('123456')$$, 'expired');

-- Archiving a task keeps its history and writes an audit note
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;
update public.tasks set active = false where id = :'tid';
select test.eq((select active from public.tasks where id = :'tid'), true, 'tasks cannot be edited directly');
select public.archive_task(:'tid');
select test.eq((select active from public.tasks where id = :'tid'), false, 'archive_task takes a task off the plan');
select test.eq((select count(*) from public.logs where task_id = :'tid'), 1::bigint, 'archived task keeps its logs');

-- Deleting a profile removes everything
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;
select public.delete_person(:'pid');
reset role;
select test.eq((select count(*) from public.tasks where person_id = :'pid'), 0::bigint, 'delete removes tasks');
select test.eq((select count(*) from public.notes where person_id = :'pid'), 0::bigint, 'delete removes notes');
select test.eq((select count(*) from public.logs where person_id = :'pid'), 0::bigint, 'delete removes logs');

-- Signed-out (anon) can do nothing
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select test.fails($$select public.redeem_invite('123456')$$, 'permission denied');
select test.eq((select count(*) from public.people), 0::bigint, 'anon sees no people');
reset role;

\echo 'All database tests passed.'
