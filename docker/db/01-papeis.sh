#!/bin/sh
# Prepara um PostgreSQL puro para o login (GoTrue) e a API (PostgREST). Roda só na criação do banco.
set -e
psql -v ON_ERROR_STOP=1 -v pw="$POSTGRES_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
-- papel administrativo esperado por algumas migrações do serviço de login
create role supabase_admin nologin createrole createdb replication bypassrls;
-- papéis usados pelas regras de acesso (RLS)
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
-- usuário da API REST: troca para o papel do token a cada requisição
create role authenticator login noinherit password :'pw';
grant anon, authenticated, service_role to authenticator;
-- usuário do serviço de login: dono do esquema auth
create role supabase_auth_admin login createrole noinherit password :'pw';
create schema if not exists auth authorization supabase_auth_admin;
grant create on database postgres to supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
grant usage on schema auth to anon, authenticated, service_role;
-- extensões
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role, supabase_auth_admin;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
alter database postgres set search_path = "$user", public, extensions;
EOSQL
echo "[planner-db] papéis e esquemas criados"
