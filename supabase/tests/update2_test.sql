-- Tests for update 2: private feelings/notes and task editing. Runs after rls_test.sql
-- (which creates the test.* helpers).
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000011', 'mira@example.com',  '{"display_name":"Mira","age_confirmed_18":true}'),
  ('00000000-0000-0000-0000-000000000012', 'ben@example.com',   '{"display_name":"Ben","age_confirmed_18":true}'),
  ('00000000-0000-0000-0000-000000000013', 'rao@clinic.com',    '{"display_name":"Dr. Rao","age_confirmed_18":true}');
insert into public.clinicians (email) values ('rao@clinic.com');

-- Mira sets up her profile and invites support (Ben) and therapist (Dr. Rao)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
set role authenticated;
select public.create_person('Mira', '25-34', true, '{}', '{}', '{daily}', false, false, false, 'self',
  '[{"role":"support","email":"ben@example.com"},{"role":"therapist","email":"rao@clinic.com"}]') as r \gset
select (:'r'::jsonb)->>'person_id' as pid,
       (:'r'::jsonb)->'invites'->0->>'code' as sup_code,
       (:'r'::jsonb)->'invites'->1->>'code' as ther_code \gset
select public.add_task(:'pid', 'Medicines morning', 'daily', 'medication',
  '{"name":"Pill box","steps":["Open box"],"freq_per_week":7,"reminder":"08:00"}') as tid \gset
select id as sid from public.strategies where task_id = :'tid' \gset
insert into public.logs (strategy_id, task_id, person_id, date, helped, created_by)
  values (:'sid', :'tid', :'pid', current_date, 2, auth.uid());

select public.log_feeling(:'pid', 'Worried', 'Exam tomorrow', true);
select public.log_feeling(:'pid', 'Happy', null, false);
insert into public.notes (person_id, author_id, text, private) values (:'pid', auth.uid(), 'My private diary line', true);
insert into public.notes (person_id, author_id, text) values (:'pid', auth.uid(), 'Shared note');
select test.eq((select count(*) from public.notes where kind = 'note'), 4::bigint, 'owner sees all her own entries');
select test.eq((select count(*) from public.feelings), 2::bigint, 'owner sees all her feelings');
update public.people set share_by_default = true where id = :'pid';
select test.eq((select share_by_default from public.people where id = :'pid'), true, 'owner can change her sharing default');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
set role authenticated;
select public.redeem_invite(:'sup_code') is not null as joined \gset
select test.eq((select count(*) from public.notes where kind = 'note'), 2::bigint, 'support sees only shared entries');
select test.eq((select count(*) from public.feelings), 1::bigint, 'support sees only shared feelings');
select test.eq((select count(*) from public.notes where text like '%private diary%' or text = 'Exam tomorrow'), 0::bigint, 'private text is hidden');
select test.fails(format($$insert into public.notes (person_id, author_id, text, private) values (%L, %L, 'x', true)$$, :'pid', auth.uid()), 'row-level security');
select test.fails(format($$select public.edit_task(%L, 'x', 'daily', null, '{"name":"y"}')$$, :'tid'), 'Only the person or their therapist');
update public.people set share_by_default = false where id = :'pid';
reset role;
select test.eq((select share_by_default from public.people where id = :'pid'), true, 'support cannot change her sharing default');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);
set role authenticated;
select public.redeem_invite(:'ther_code') is not null as joined \gset
select test.eq((select count(*) from public.notes where kind = 'note'), 2::bigint, 'therapist sees only shared entries');
select test.fails(format($$update public.people set share_by_default = false where id = %L$$, :'pid'), 'Only the person');
select test.fails(format($$select public.set_note_private((select id from public.notes where text = 'Shared note'), true)$$), 'only change your own');
-- Therapist edits the task: details change, trial and results stay
select public.edit_task(:'tid', 'Medicines (morning)', 'daily', 'pill',
  '{"name":"Pill box by the kettle","description":"Next to the kettle","steps":["Fill kettle","Open box"],"freq_per_week":5,"freq_days":[0,1,2,3,4],"reminder":"07:30"}');
select test.eq((select title from public.tasks where id = :'tid'), 'Medicines (morning)', 'edit renames the task');
select test.eq((select icon from public.tasks where id = :'tid'), 'pill', 'edit changes the icon');
select test.eq((select name from public.strategies where id = :'sid'), 'Pill box by the kettle', 'edit changes the strategy in place');
select test.eq((select freq_days from public.strategies where id = :'sid'), '{0,1,2,3,4}'::int[], 'edit changes the days');
select test.eq((select reminder from public.strategies where id = :'sid'), '07:30', 'edit changes the reminder');
select test.eq((select count(*) from public.strategies where task_id = :'tid'), 1::bigint, 'edit does not start a new trial');
select test.eq((select count(*) from public.logs where strategy_id = :'sid'), 1::bigint, 'edit keeps the results');
select test.eq((select count(*) from public.notes where text = 'Edited "Medicines (morning)".'), 1::bigint, 'edit is written to the audit trail');

-- Mira shares her private worry, then hides it again
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
set role authenticated;
select public.set_note_private((select id from public.notes where text = 'Exam tomorrow'), false);
select public.edit_task(:'tid', 'Medicines', 'daily', 'medication', '{"name":"Pill box"}');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);
set role authenticated;
select test.eq((select count(*) from public.notes where text = 'Exam tomorrow'), 1::bigint, 'a shared entry becomes visible to the team');
select test.eq((select count(*) from public.feelings where feeling = 'Worried'), 1::bigint, 'and its feeling too');
select test.eq((select title from public.tasks where id = :'tid'), 'Medicines', 'the person can edit her own task');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
set role authenticated;
select public.set_note_private((select id from public.notes where text = 'Exam tomorrow'), true);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);
set role authenticated;
select test.eq((select count(*) from public.notes where text = 'Exam tomorrow'), 0::bigint, 'and private again when she changes her mind');
select public.log_feeling(:'pid', 'Calm', 'Therapist check-in', true);
reset role;
select test.eq((select private from public.notes where text = 'Therapist check-in'), false, 'team members cannot log private feelings');
\echo 'All update 2 tests passed.'
