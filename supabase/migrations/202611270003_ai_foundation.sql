begin;

-- Some hosted projects grant anon execute by default in public.
revoke execute on function public.allit_save_profile(text,text,text,boolean),
  public.allit_set_occurrence(uuid,date,boolean,text,timestamptz) from anon;

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- Keep the future AI store private until a server-side retrieval API is added.
create schema allit_ai;
revoke all on schema allit_ai from public, anon, authenticated;
grant usage on schema allit_ai to service_role;

create table allit_ai.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null check (char_length(btrim(source_key)) between 1 and 256),
  created_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, source_key)
);

create table allit_ai.chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  document_id uuid not null,
  ordinal integer not null check (ordinal >= 0),
  content text not null check (char_length(btrim(content)) between 1 and 8192),
  embedding_model text check (char_length(btrim(embedding_model)) between 1 and 128),
  embedding extensions.vector,
  created_at timestamptz not null default now(),
  unique (user_id, document_id, ordinal),
  foreign key (user_id, document_id) references allit_ai.documents(user_id, id) on delete cascade,
  check ((embedding is null) = (embedding_model is null))
);

alter table allit_ai.documents enable row level security;
alter table allit_ai.chunks enable row level security;
revoke all on all tables in schema allit_ai from public, anon, authenticated;
grant select, insert, update, delete on allit_ai.documents, allit_ai.chunks to service_role;

commit;
