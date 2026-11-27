-- Read-only deployment inspection. Returns schema metadata and a count,
-- with no account identifiers, application rows, or Storage object names.
with expected_tables(schema_name, table_name) as (
  values
    ('public', 'profiles'), ('public', 'user_settings'), ('public', 'guardians'),
    ('public', 'schedules'), ('public', 'schedule_occurrences'),
    ('public', 'conversations'), ('public', 'messages'), ('public', 'photos'),
    ('allit_private', 'account_deletions'), ('allit_ai', 'documents'), ('allit_ai', 'chunks')
), app_tables as (
  select t.schema_name, t.table_name, c.oid, c.relkind, c.relrowsecurity
  from expected_tables t
  left join pg_namespace n on n.nspname = t.schema_name
  left join pg_class c on c.relnamespace = n.oid and c.relname = t.table_name
), expected_rpcs(signature) as (
  values
    ('public.allit_save_profile(text,text,text,boolean)'),
    ('public.allit_set_occurrence(uuid,date,boolean,text,timestamptz)'),
    ('public.allit_begin_account_deletion(uuid)'),
    ('public.allit_account_photo_paths(uuid)')
), app_rpcs as (
  select signature, to_regprocedure(signature) as procedure_oid
  from expected_rpcs
)
select jsonb_build_object(
  'postgres_version', current_setting('server_version'),
  'internal_schemas', (select coalesce(jsonb_agg(nspname order by nspname), '[]'::jsonb)
    from pg_namespace where nspname in ('allit_private', 'allit_ai')),
  'rag_api_hidden', (select not has_schema_privilege('anon', oid, 'usage')
    and not has_schema_privilege('authenticated', oid, 'usage')
    from pg_namespace where nspname = 'allit_ai'),
  'vector_available', exists (select 1 from pg_available_extensions where name = 'vector'),
  'vector_schema', (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector'),
  'tables', (select jsonb_agg(jsonb_build_object(
    'schema', schema_name, 'table', table_name, 'exists', oid is not null,
    'relation_type', relkind, 'rls', relrowsecurity
  ) order by schema_name, table_name) from app_tables),
  'indexes', coalesce((select jsonb_agg(jsonb_build_object(
    'table', t.table_name, 'name', c.relname, 'valid', i.indisvalid,
    'definition', pg_get_indexdef(c.oid)
  ) order by t.table_name, c.relname)
    from app_tables t join pg_index i on i.indrelid = t.oid
    join pg_class c on c.oid = i.indexrelid), '[]'::jsonb),
  'policies', coalesce((select jsonb_agg(to_jsonb(p) order by p.schemaname, p.tablename, p.policyname)
    from pg_policies p
    where (p.schemaname = 'storage' and p.tablename = 'objects')
      or exists (select 1 from app_tables t where t.schema_name = p.schemaname and t.table_name = p.tablename)
  ), '[]'::jsonb),
  'bucket', (select jsonb_build_object('name', name, 'public', public,
    'size_limit', file_size_limit, 'mime_types', allowed_mime_types)
    from storage.buckets where id = 'verification-photos'),
  'rpcs', (select jsonb_agg(jsonb_build_object(
    'signature', signature, 'exists', procedure_oid is not null,
    'anon_execute', has_function_privilege('anon', procedure_oid::oid, 'execute'),
    'authenticated_execute', has_function_privilege('authenticated', procedure_oid::oid, 'execute'),
    'service_role_execute', has_function_privilege('service_role', procedure_oid::oid, 'execute')
  ) order by signature) from app_rpcs),
  'onboarding_column', exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'onboarding_completed_at'),
  'social_identity_trigger', exists (select 1 from pg_trigger
    where tgrelid = 'auth.identities'::regclass and tgname = 'allit_keep_social_identities_separate'
      and tgenabled in ('O', 'A')),
  'existing_multi_provider_accounts', (select count(*) from (
    select user_id from auth.identities group by user_id
    having count(distinct provider) > 1 and bool_or(provider in ('google', 'kakao'))
  ) linked),
  'storage_owner_id_type', (select data_type from information_schema.columns
    where table_schema = 'storage' and table_name = 'objects' and column_name = 'owner_id'),
  'storage_rls', (select relrowsecurity from pg_class where oid = to_regclass('storage.objects'))
) as catalog;
