#!/bin/sh
# Aplica as migrações do Planner depois que o serviço de login (GoTrue) criou o esquema auth.
set -e
export PGHOST=db PGUSER=postgres PGDATABASE=postgres PGPASSWORD="$POSTGRES_PASSWORD"
echo "[migrador] aguardando o banco e o serviço de login criarem a estrutura..."
i=0
until [ "$(psql -tAc "select to_regclass('auth.users') is not null and exists(select 1 from pg_proc where proname='uid' and pronamespace='auth'::regnamespace)" 2>/dev/null)" = "t" ]; do
  i=$((i+1)); [ $i -gt 150 ] && { echo "[migrador] tempo esgotado esperando o serviço de login (auth)"; exit 1; }
  sleep 2
done
for f in /migrations/*.sql; do
  echo "[migrador] aplicando $(basename "$f")"
  PGOPTIONS='--client-min-messages=warning' psql -q -v ON_ERROR_STOP=1 -f "$f" || { echo "[migrador] ERRO ao aplicar $f"; exit 1; }
done
psql -qc "NOTIFY pgrst, 'reload schema'"
echo "[migrador] banco pronto."
