#!/usr/bin/env bash
# Runs the database tests against a throwaway local Postgres (no Supabase account needed).
# Requires Postgres 15+ binaries (initdb, pg_ctl, psql) on this machine.
set -euo pipefail
cd "$(dirname "$0")"
BIN=$(dirname "$(command -v pg_ctl || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")
DIR=$(mktemp -d)
PORT=${PGTEST_PORT:-54329}
trap '"$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
if [ "$(id -u)" = 0 ]; then
  chown -R postgres "$DIR"; RUN="runuser -u postgres --"
else
  RUN=""
fi
$RUN "$BIN/initdb" -D "$DIR/data" -U postgres --auth=trust >/dev/null
$RUN "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
PSQL=("$BIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f supabase_stub.sql >/dev/null
"${PSQL[@]}" -f ../migrations/20261005000000_init.sql >/dev/null
"${PSQL[@]}" -tA -f rls_test.sql 2>&1 | sed "s/^psql:[^:]*:[0-9]*: NOTICE:  /  /" | grep -vE "^(00000000-.*)?$"
