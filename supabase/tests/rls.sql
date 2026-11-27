-- Run against a disposable Supabase or the local PostgreSQL fixture. Rolls back.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
insert into auth.identities(id,user_id,provider,provider_id,identity_data) values
 ('a1111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','google','test-a','{"sub":"test-a"}'),
 ('a2222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','kakao','test-b','{"sub":"test-b"}');
do $$begin
  begin
    insert into auth.identities(id,user_id,provider,provider_id,identity_data) values
    ('a3333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','kakao','test-linked','{"sub":"test-linked"}');
    raise exception 'provider merge accepted';
  exception when check_violation then null;
  end;
end$$;
set local role service_role;
insert into allit_ai.documents (id, user_id, source_key)
values ('99999999-9999-4999-8999-999999999996','22222222-2222-4222-8222-222222222222','fixture');
insert into allit_ai.chunks (user_id, document_id, ordinal, content, embedding_model, embedding)
values ('22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999996',0,'fixture','fixture-model','[0,1]');
do $$begin
  begin
    insert into allit_ai.chunks (user_id, document_id, ordinal, content)
    values ('11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999996',1,'wrong owner');
    raise exception 'cross-owner AI document accepted';
  exception when foreign_key_violation then null;
  end;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into public.guardians(id,user_id,name,phone_number) values ('99999999-9999-4999-8999-999999999991', auth.uid(),'B guardian','01000000000');
insert into public.schedules(id,user_id,title,schedule_type,scheduled_time,recurrence_rule,reminder_minutes,notification_method,notifications_enabled)
values ('99999999-9999-4999-8999-999999999992',auth.uid(),'B schedule','general','10:00','{"mode":"once","date":"2026-11-20"}',5,'alarm',true);
insert into public.conversations(id,user_id,character_id) values ('99999999-9999-4999-8999-999999999993',auth.uid(),'char1');
insert into public.messages(user_id,conversation_id,turn_id,role,content) values (auth.uid(),'99999999-9999-4999-8999-999999999993',gen_random_uuid(),'user','B message');
insert into storage.objects(bucket_id,owner_id,name) values ('verification-photos',auth.uid()::text,
 '22222222-2222-4222-8222-222222222222/2026/11/99999999-9999-4999-8999-999999999994.jpg');
insert into public.photos (id,user_id,schedule_title,storage_path,captured_at,file_size,mime_type)
values ('99999999-9999-4999-8999-999999999994',auth.uid(),'B photo',
 '22222222-2222-4222-8222-222222222222/2026/11/99999999-9999-4999-8999-999999999994.jpg','2026-11-20T01:00:00+09',300,'image/jpeg');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$declare affected int; first_id uuid; second_id uuid; begin
  begin perform * from allit_ai.chunks; raise exception 'client AI read';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.schedules) or exists (select 1 from public.messages) or exists (select 1 from public.photos)
    or exists (select 1 from storage.objects where bucket_id='verification-photos') then raise exception 'cross-owner read'; end if;
  update public.schedules set title='Modified' where id='99999999-9999-4999-8999-999999999992';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'cross-owner update'; end if;
  delete from public.schedules where id='99999999-9999-4999-8999-999999999992';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'cross-owner delete'; end if;
  begin
    insert into public.guardians(user_id,name,phone_number) values ('22222222-2222-4222-8222-222222222222','Wrong owner','01000000001');
    raise exception 'cross-owner insert';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.schedules(user_id,title,schedule_type,scheduled_time,recurrence_rule,reminder_minutes,notification_method,notifications_enabled,guardian_id)
    values (auth.uid(),'Cross-owner guardian','general','10:00','{"mode":"once","date":"2026-11-20"}',5,'alarm',true,'99999999-9999-4999-8999-999999999991');
    raise exception 'cross-owner parent';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into storage.objects(bucket_id,owner_id,name) values ('verification-photos',auth.uid()::text,
      '22222222-2222-4222-8222-222222222222/2026/11/99999999-9999-4999-8999-999999999995.jpg');
    raise exception 'cross-owner storage path';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.allit_begin_account_deletion('22222222-2222-4222-8222-222222222222');
    raise exception 'client deletion admin function';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.allit_set_occurrence('99999999-9999-4999-8999-999999999992','2026-11-20',true);
    raise exception 'cross-owner completion RPC';
  exception when no_data_found then null;
  end;
  insert into public.schedules(id,user_id,title,schedule_type,scheduled_time,recurrence_rule,reminder_minutes,notification_method,notifications_enabled)
  values ('99999999-9999-4999-8999-999999999990',auth.uid(),'A schedule','general','10:00','{"mode":"once","date":"2026-11-20"}',5,'alarm',true);
  first_id := public.allit_set_occurrence('99999999-9999-4999-8999-999999999990','2026-11-20',true,'photo');
  second_id := public.allit_set_occurrence('99999999-9999-4999-8999-999999999990','2026-11-20',true,'check');
  if first_id is null or first_id <> second_id or (select completion_method from public.schedule_occurrences where id=first_id) <> 'photo' then
    raise exception 'completion must be idempotent';
  end if;
  perform public.allit_save_profile('A','Hello','char2',false);
  if (select selected_character_id from public.profiles where user_id=auth.uid()) <> 'char2'
    or (select speak_replies from public.user_settings where user_id=auth.uid()) is distinct from false
    or (select onboarding_completed_at from public.profiles where user_id=auth.uid()) is null then
    raise exception 'account profile and settings write';
  end if;
  begin
    update public.schedules set recurrence_rule='{"mode":"weekly","startDate":"2026-11-20","weekdays":[5,5]}'
      where id='99999999-9999-4999-8999-999999999990';
    raise exception 'duplicates in weekly recurrence';
  exception when check_violation then null;
  end;
end$$;
set local role anon;
do $$begin
  if has_function_privilege('public.allit_save_profile(text,text,text,boolean)', 'execute')
    or has_function_privilege('public.allit_set_occurrence(uuid,date,boolean,text,timestamptz)', 'execute') then
    raise exception 'anonymous app RPC execution';
  end if;
  begin perform * from public.photos; raise exception 'anonymous photo read';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from storage.objects where bucket_id='verification-photos') then raise exception 'anonymous private bucket read'; end if;
end$$;
reset role;
select public.allit_begin_account_deletion('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$begin
  if exists(select 1 from public.schedules) or exists(select 1 from storage.objects where bucket_id='verification-photos') then
    raise exception 'pending deletion must close normal access';
  end if;
end$$;
reset role;
-- The real Edge Function removes Storage objects via Storage API first.
delete from auth.users where id='22222222-2222-4222-8222-222222222222';
do $$begin
  if exists(select 1 from public.photos where user_id='22222222-2222-4222-8222-222222222222')
    or exists(select 1 from public.messages where user_id='22222222-2222-4222-8222-222222222222')
    or exists(select 1 from allit_ai.documents where user_id='22222222-2222-4222-8222-222222222222')
    or exists(select 1 from allit_ai.chunks where user_id='22222222-2222-4222-8222-222222222222')
    or not exists(select 1 from public.schedules where user_id='11111111-1111-4111-8111-111111111111') then
    raise exception 'incorrect deletion cascade';
  end if;
end$$;
rollback;
