-- =====================================================================
-- Indicadores e metas: SLA por setor e prioridade, metas por equipe.
-- setor_id nulo = padrão da empresa (vale para setores sem meta própria).
-- =====================================================================
alter table public.atividades add column if not exists aceito_em timestamptz;

create table if not exists public.metas (
  id                  uuid primary key default gen_random_uuid(),
  setor_id            uuid unique references public.setores(id) on delete cascade,
  sla_dias            jsonb not null default '{"urgente":1,"alta":2,"media":5,"baixa":10}'::jsonb,
  sla_aceite_horas    int not null default 8 check (sla_aceite_horas between 1 and 240),
  meta_sla_pct        int not null default 90 check (meta_sla_pct between 1 and 100),
  meta_concluidas_mes int check (meta_concluidas_mes is null or meta_concluidas_mes >= 0),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create unique index if not exists metas_empresa_unica on public.metas ((setor_id is null)) where setor_id is null;
insert into public.metas (setor_id) select null where not exists (select 1 from public.metas where setor_id is null);

grant select, insert, update, delete on public.metas to authenticated;
grant all on public.metas to service_role;
alter table public.metas enable row level security;

-- todos os usuários ativos leem (o SLA aparece nas atividades); o gestor define as do seu setor; a diretoria, todas
drop policy if exists metas_ler on public.metas;
create policy metas_ler on public.metas for select to authenticated using (public.eh_ativo());
drop policy if exists metas_gerir on public.metas;
create policy metas_gerir on public.metas for all to authenticated
  using (public.eh_admin() or (setor_id is not null and public.gestor_do_setor(setor_id)))
  with check (public.eh_admin() or (setor_id is not null and public.gestor_do_setor(setor_id)));
