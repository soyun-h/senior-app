#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
bin=$(pg_config --bindir)
fixture=$(mktemp -d /tmp/allit-rls.XXXXXX)
cleanup() { "$bin/pg_ctl" -D "$fixture/db" -m fast -w stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$bin/initdb" -D "$fixture/db" --auth=trust -U postgres --no-locale >/dev/null
"$bin/pg_ctl" -D "$fixture/db" -w -o "-c listen_addresses='' -k $fixture" -l "$fixture/postgres.log" start >/dev/null
if [[ $("$bin/psql" -XAt -h "$fixture" -U postgres -d postgres -c "select count(*) from pg_available_extensions where name = 'vector'") != 1 ]]; then
  printf 'Install the pgvector extension for the PostgreSQL version selected by pg_config.\n' >&2
  exit 1
fi
"$bin/psql" -X -v ON_ERROR_STOP=1 -h "$fixture" -U postgres -d postgres -f "$root/tests/postgres-fixture.sql" >/dev/null
for migration in "$root"/migrations/*.sql; do
  "$bin/psql" -X -v ON_ERROR_STOP=1 -h "$fixture" -U postgres -d postgres -f "$migration" >/dev/null
done
"$bin/psql" -X -v ON_ERROR_STOP=1 -h "$fixture" -U postgres -d postgres -f "$root/tests/rls.sql"
