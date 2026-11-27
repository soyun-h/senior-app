begin;

create schema if not exists allit_private;
revoke all on schema allit_private from public;
grant usage on schema allit_private to authenticated;

create table allit_private.account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create function allit_private.active_account(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select uid is not null and uid = auth.uid()
    and exists (select 1 from auth.users where id = uid)
    and (select count(distinct provider) from auth.identities where user_id = uid) <= 1
    and not exists (select 1 from allit_private.account_deletions where user_id = uid);
$$;
revoke all on function allit_private.active_account(uuid) from public;
grant execute on function allit_private.active_account(uuid) to authenticated;

-- Kakao is configured without email. Fail closed if an OAuth provider is
-- subsequently configured in a way that would join two provider identities.
create function allit_private.keep_social_identities_separate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.provider in ('google', 'kakao') then
    perform 1 from auth.users where id = new.user_id for update;
    if exists (select 1 from auth.identities i where i.user_id = new.user_id
      and i.provider <> new.provider) then
      raise exception 'Allit requires one provider per account' using errcode = '23514';
    end if;
  elsif exists (select 1 from auth.identities i where i.user_id = new.user_id
    and i.provider in ('google', 'kakao')) then
    raise exception 'Allit requires one provider per account' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function allit_private.keep_social_identities_separate() from public;
create trigger allit_keep_social_identities_separate before insert or update of user_id, provider on auth.identities
for each row execute function allit_private.keep_social_identities_separate();

create function allit_private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := statement_timestamp(); return new; end;
$$;

create function allit_private.valid_recurrence(rule jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare mode text := rule->>'mode'; first_date text; last_date text;
begin
  if jsonb_typeof(rule) <> 'object' then return false; end if;
  first_date := case when mode = 'once' then rule->>'date' else rule->>'startDate' end;
  if coalesce(first_date,'') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  perform first_date::date;
  if mode = 'once' then return true; end if;
  if mode = 'range' then
    last_date := rule->>'endDate';
    return coalesce(last_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and last_date::date >= first_date::date,false);
  end if;
  if mode = 'weekly' and jsonb_typeof(rule->'weekdays') = 'array' then
    return (select count(*) between 1 and 7 and count(distinct entry) = count(*) and
      coalesce(bool_and(jsonb_typeof(entry) = 'number' and entry::text ~ '^[1-7]$'),false)
      from jsonb_array_elements(rule->'weekdays') as entries(entry));
  end if;
  return false;
exception when invalid_datetime_format or datetime_field_overflow then return false;
end $$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  preferred_title text not null default '' check (char_length(preferred_title) <= 50),
  selected_character_id text not null default 'char1' check (selected_character_id in ('char1','char2','char3','char4','char5')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  speak_replies boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  phone_number text not null check (phone_number ~ '^\+?[0-9]{8,15}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, id), unique (user_id, phone_number)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  schedule_type text not null check (schedule_type in ('medication','general')),
  scheduled_time time(0) not null check (extract(second from scheduled_time) = 0 and scheduled_time < time '24:00'),
  timezone text not null default 'Asia/Seoul' check (timezone = 'Asia/Seoul'),
  recurrence_rule jsonb not null check (allit_private.valid_recurrence(recurrence_rule)),
  reminder_minutes smallint not null check (reminder_minutes in (5,10,30)),
  notification_method text not null check (notification_method in ('alarm','video-call','none')),
  notifications_enabled boolean not null check (notification_method <> 'none' or not notifications_enabled),
  medication_note text check (char_length(medication_note) <= 500),
  guardian_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, guardian_id) references public.guardians(user_id, id) on delete set null (guardian_id)
);

create table public.schedule_occurrences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid not null, occurrence_date date not null, scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','completed')),
  confirmed_at timestamptz, completion_method text check (completion_method in ('check','photo')),
  last_action_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((scheduled_at at time zone 'Asia/Seoul')::date = occurrence_date),
  check ((status = 'completed' and confirmed_at is not null and completion_method is not null) or
         (status = 'pending' and confirmed_at is null and completion_method is null)),
  unique (user_id,id), unique (user_id,schedule_id,occurrence_date),
  foreign key (user_id,schedule_id) references public.schedules(user_id,id) on delete cascade
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null check (character_id in ('char1','char2','char3','char4','char5')),
  started_at timestamptz not null default now(), ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at), unique (user_id,id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null, turn_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(btrim(content)) between 1 and 4096),
  created_at timestamptz not null default now(), unique (user_id,conversation_id,turn_id,role),
  foreign key (user_id,conversation_id) references public.conversations(user_id,id) on delete cascade
);

create table public.photos (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  schedule_occurrence_id uuid, schedule_title text not null check (char_length(schedule_title) between 1 and 80),
  storage_path text not null unique, captured_at timestamptz not null, scheduled_at timestamptz, uploaded_at timestamptz not null default now(),
  file_size integer not null check (file_size between 1 and 1048576), mime_type text not null check (mime_type = 'image/jpeg'),
  guardian_id uuid, message_status text check (message_status in ('opened','failed')),
  message_opened_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (storage_path = user_id::text || '/' || to_char(captured_at at time zone 'Asia/Seoul','YYYY/MM') || '/' || id::text || '.jpg'),
  foreign key (user_id,schedule_occurrence_id) references public.schedule_occurrences(user_id,id) on delete set null (schedule_occurrence_id),
  foreign key (user_id,guardian_id) references public.guardians(user_id,id) on delete set null (guardian_id)
);

create index allit_occurrences_date_idx on public.schedule_occurrences(user_id,occurrence_date desc);
create index allit_conversations_character_idx on public.conversations(user_id,character_id,started_at desc,id desc);
create index allit_messages_conversation_idx on public.messages(user_id,conversation_id,created_at,id);
create index allit_photos_timeline_idx on public.photos(user_id,captured_at desc,id desc);
create index allit_photos_occurrence_idx on public.photos(user_id,schedule_occurrence_id);

do $$
declare tbl text;
begin
  foreach tbl in array array['profiles','user_settings','guardians','schedules','schedule_occurrences','conversations','messages','photos'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on public.%I from anon, public', tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
    execute format('create policy allit_owner on public.%I for all to authenticated using ((select allit_private.active_account(auth.uid())) and user_id = (select auth.uid())) with check ((select allit_private.active_account(auth.uid())) and user_id = (select auth.uid()))', tbl);
  end loop;
  foreach tbl in array array['profiles','user_settings','guardians','schedules','schedule_occurrences','photos'] loop
    execute format('create trigger allit_touch_updated_at before update on public.%I for each row execute function allit_private.touch_updated_at()', tbl);
  end loop;
end $$;

-- Idempotent completion of one local Seoul date, preserving photo evidence
-- when a manual check and an offline photo sync arrive in either order.
create function public.allit_set_occurrence(target_schedule uuid, day date, done boolean, method text default 'check', action_at timestamptz default now())
returns uuid language plpgsql set search_path = '' as $$
declare s public.schedules%rowtype; result uuid;
begin
  if method not in ('check','photo') or day > (now() at time zone 'Asia/Seoul')::date then
    raise exception 'Invalid occurrence';
  end if;
  select * into strict s from public.schedules where id = target_schedule and user_id = auth.uid();
  if (s.recurrence_rule->>'mode' = 'once' and day <> (s.recurrence_rule->>'date')::date)
    or (s.recurrence_rule->>'mode' = 'range' and day not between
      (s.recurrence_rule->>'startDate')::date and (s.recurrence_rule->>'endDate')::date)
    or (s.recurrence_rule->>'mode' = 'weekly' and (day < (s.recurrence_rule->>'startDate')::date
      or not (s.recurrence_rule->'weekdays' @> jsonb_build_array(extract(isodow from day)::int)))) then
    raise exception 'Occurrence outside recurrence';
  end if;
  insert into public.schedule_occurrences as existing (user_id,schedule_id,occurrence_date,scheduled_at,status,confirmed_at,completion_method,last_action_at)
  values (auth.uid(),s.id,day,(day + s.scheduled_time) at time zone s.timezone,
    case when done then 'completed' else 'pending' end, case when done then least(action_at,now()) end, case when done then method end,
    least(action_at,now()))
  on conflict (user_id,schedule_id,occurrence_date) do update set
    status = excluded.status,
    last_action_at = excluded.last_action_at,
    confirmed_at = case when excluded.status = 'completed' then coalesce(existing.confirmed_at,excluded.confirmed_at) end,
    completion_method = case when excluded.status = 'completed' then
      case when existing.completion_method = 'photo' or excluded.completion_method = 'photo' then 'photo' else 'check' end end
  where existing.last_action_at < excluded.last_action_at
  returning id into result;
  if result is null then
    select id into strict result from public.schedule_occurrences
    where user_id=auth.uid() and schedule_id=target_schedule and occurrence_date=day;
  end if;
  return result;
end $$;
revoke all on function public.allit_set_occurrence(uuid,date,boolean,text,timestamptz) from public;
grant execute on function public.allit_set_occurrence(uuid,date,boolean,text,timestamptz) to authenticated;

create function public.allit_save_profile(name text, title text, selected_character text, speak boolean) returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.profiles(user_id,display_name,preferred_title,selected_character_id)
  values (auth.uid(), name, title, selected_character) on conflict (user_id) do update set
    display_name=excluded.display_name, preferred_title=excluded.preferred_title, selected_character_id=excluded.selected_character_id;
  insert into public.user_settings(user_id,speak_replies) values (auth.uid(),speak)
  on conflict (user_id) do update set speak_replies=excluded.speak_replies;
end $$;
revoke all on function public.allit_save_profile(text,text,text,boolean) from public;
grant execute on function public.allit_save_profile(text,text,text,boolean) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('verification-photos','verification-photos',false,1048576,array['image/jpeg']);

create policy allit_photo_read on storage.objects for select to authenticated using (
  bucket_id = 'verification-photos' and owner_id = (select auth.uid()::text)
  and split_part(name,'/',1) = (select auth.uid()::text) and (select allit_private.active_account(auth.uid())));
create policy allit_photo_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'verification-photos' and owner_id = (select auth.uid()::text)
  and split_part(name,'/',1) = (select auth.uid()::text)
  and name ~ '^[0-9a-f-]{36}/[0-9]{4}/(0[1-9]|1[0-2])/[0-9a-f-]{36}\.jpg$'
  and (select allit_private.active_account(auth.uid())));
create policy allit_photo_delete on storage.objects for delete to authenticated using (
  bucket_id = 'verification-photos' and owner_id = (select auth.uid()::text)
  and split_part(name,'/',1) = (select auth.uid()::text) and (select allit_private.active_account(auth.uid())));

create function public.allit_begin_account_deletion(target uuid) returns void
language sql security definer set search_path = '' as $$
  insert into allit_private.account_deletions(user_id) values (target) on conflict do nothing;
$$;
create function public.allit_account_photo_paths(target uuid) returns setof text
language sql security definer set search_path = '' as $$
  select name from storage.objects
  where bucket_id = 'verification-photos' and split_part(name,'/',1) = target::text
  order by name limit 100;
$$;
revoke all on function public.allit_begin_account_deletion(uuid), public.allit_account_photo_paths(uuid) from public, anon, authenticated;
grant execute on function public.allit_begin_account_deletion(uuid), public.allit_account_photo_paths(uuid) to service_role;

commit;
