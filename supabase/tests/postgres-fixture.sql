-- Minimal Auth and Storage schema fixture for a local standalone PostgreSQL server.
create role anon;
create role authenticated;
create role service_role bypassrls;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create schema auth;
create schema storage;
create table auth.users (id uuid primary key);
create table auth.identities (id uuid primary key, user_id uuid references auth.users(id) on delete cascade,
  provider text not null, provider_id text not null, identity_data jsonb not null, unique(provider,provider_id));
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid;
$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects (bucket_id text references storage.buckets(id), owner_id text, name text, primary key(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema auth, storage to authenticated, anon;
grant select, insert, delete on storage.objects to authenticated;
grant select on storage.objects to anon;
