-- =====================================================================
-- Planner de Setores — estrutura inicial do banco (Supabase / PostgreSQL)
-- Executado automaticamente por `supabase start` / `supabase db reset`
-- ou colado no SQL Editor de um projeto Supabase na nuvem.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.empresa (
  id            int primary key default 1 check (id = 1),
  nome          text not null default 'Minha Empresa',
  logo_url      text,
  atualizado_em timestamptz not null default now()
);
insert into public.empresa (id) values (1) on conflict (id) do nothing;

create table if not exists public.setores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cor        text not null default '#2563eb',
  descricao  text,
  gestor_id  uuid,
  pos_x      int not null default 80,
  pos_y      int not null default 80,
  criado_em  timestamptz not null default now()
);

create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  email       text not null,
  cargo       text,
  setor_id    uuid references public.setores(id) on delete set null,
  papel       text not null default 'colaborador' check (papel in ('admin','gestor','colaborador')),
  ativo       boolean not null default false,
  notif_email boolean not null default true,
  notif_teams boolean not null default true,
  criado_em   timestamptz not null default now()
);

alter table public.setores
  drop constraint if exists setores_gestor_fk,
  add constraint setores_gestor_fk foreign key (gestor_id) references public.perfis(id) on delete set null;

create table if not exists public.vinculos (
  id            uuid primary key default gen_random_uuid(),
  origem_id     uuid not null references public.setores(id) on delete cascade,
  destino_id    uuid not null references public.setores(id) on delete cascade,
  requer_aceite boolean not null default true,
  descricao     text,
  criado_por    uuid references public.perfis(id) on delete set null,
  criado_em     timestamptz not null default now(),
  constraint vinculo_unico unique (origem_id, destino_id),
  constraint vinculo_distinto check (origem_id <> destino_id)
);

create table if not exists public.fluxos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  descricao     text,
  ativo         boolean not null default true,
  definicao     jsonb not null default '{"nos":[],"arestas":[]}'::jsonb,
  criado_por    uuid references public.perfis(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.atividades (
  id                      uuid primary key default gen_random_uuid(),
  numero                  bigint generated always as identity,
  titulo                  text not null,
  descricao               text,
  setor_id                uuid not null references public.setores(id) on delete restrict,
  responsavel_id          uuid references public.perfis(id) on delete set null,
  status                  text not null default 'a_distribuir'
                          check (status in ('aguardando_aceite','a_distribuir','na_fila','em_andamento','pausada','concluida','recusada','cancelada')),
  prioridade              text not null default 'media' check (prioridade in ('baixa','media','alta','urgente')),
  inicio                  date,
  prazo                   date,
  criado_por              uuid references public.perfis(id) on delete set null,
  solicitante_setor_id    uuid references public.setores(id) on delete set null,
  origem_id               uuid references public.atividades(id) on delete set null,
  processo_id             uuid not null default gen_random_uuid(),
  fluxo_id                uuid references public.fluxos(id) on delete set null,
  etapa_id                text,
  encaminhar_para         uuid references public.setores(id) on delete set null,
  motivo                  text,
  responsavel_original_id uuid references public.perfis(id) on delete set null,
  iniciado_em             timestamptz,
  concluido_em            timestamptz,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);
create index if not exists atividades_setor_idx on public.atividades(setor_id);
create index if not exists atividades_resp_idx on public.atividades(responsavel_id);
create index if not exists atividades_proc_idx on public.atividades(processo_id);
create index if not exists atividades_status_idx on public.atividades(status);

create table if not exists public.historico (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  texto        text not null,
  autor_id     uuid references public.perfis(id) on delete set null,
  criado_em    timestamptz not null default now()
);
create index if not exists historico_atv_idx on public.historico(atividade_id);

create table if not exists public.comentarios (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  texto        text not null,
  autor_id     uuid references public.perfis(id) on delete set null,
  criado_em    timestamptz not null default now()
);
create index if not exists comentarios_atv_idx on public.comentarios(atividade_id);

create table if not exists public.anexos (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  nome         text not null,
  caminho      text not null,
  tamanho      bigint not null default 0,
  tipo         text,
  autor_id     uuid references public.perfis(id) on delete set null,
  criado_em    timestamptz not null default now()
);
create index if not exists anexos_atv_idx on public.anexos(atividade_id);

create table if not exists public.notificacoes (
  id           uuid primary key default gen_random_uuid(),
  para_id      uuid not null references public.perfis(id) on delete cascade,
  titulo       text not null,
  texto        text,
  atividade_id uuid references public.atividades(id) on delete cascade,
  lida         boolean not null default false,
  criado_em    timestamptz not null default now()
);
create index if not exists notificacoes_para_idx on public.notificacoes(para_id, lida);

create table if not exists public.ausencias (
  id            uuid primary key default gen_random_uuid(),
  pessoa_id     uuid not null references public.perfis(id) on delete cascade,
  tipo          text not null default 'ferias' check (tipo in ('ferias','licenca','folga','outro')),
  inicio        date not null,
  fim           date not null,
  substituto_id uuid references public.perfis(id) on delete set null,
  observacao    text,
  delegado      boolean not null default false,
  devolvido     boolean not null default false,
  criado_por    uuid references public.perfis(id) on delete set null,
  criado_em     timestamptz not null default now(),
  constraint ausencia_periodo check (fim >= inicio)
);

create table if not exists public.integracoes (
  id            int primary key default 1 check (id = 1),
  email_ativo   boolean not null default false,
  teams_ativo   boolean not null default false,
  app_url       text not null default 'http://localhost:8080',
  atualizado_em timestamptz not null default now()
);
insert into public.integracoes (id) values (1) on conflict (id) do nothing;

-- URLs de webhook do Teams são segredos: só o admin lê/escreve.
create table if not exists public.teams_webhooks (
  id        uuid primary key default gen_random_uuid(),
  setor_id  uuid unique references public.setores(id) on delete cascade, -- null = canal geral
  url       text not null,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists teams_webhook_geral_unico on public.teams_webhooks ((setor_id is null)) where setor_id is null;

-- Fila de saída processada pelo serviço "notificador" (e-mail e Teams)
create table if not exists public.envios (
  id         uuid primary key default gen_random_uuid(),
  canal      text not null check (canal in ('email','teams')),
  para_id    uuid references public.perfis(id) on delete set null,
  setor_id   uuid references public.setores(id) on delete set null,
  assunto    text not null,
  corpo      text,
  link       text,
  status     text not null default 'pendente' check (status in ('pendente','enviado','erro','ignorado')),
  erro       text,
  tentativas int not null default 0,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em  timestamptz not null default now(),
  enviado_em timestamptz
);
create index if not exists envios_status_idx on public.envios(status, criado_em);

-- ---------------------------------------------------------------------
-- Funções auxiliares de permissão
-- ---------------------------------------------------------------------
create or replace function public.eh_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and ativo);
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and ativo and papel = 'admin');
$$;

create or replace function public.gestor_do_setor(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.setores where id = s and gestor_id = auth.uid())
         and public.eh_ativo();
$$;

create or replace function public.meu_setor() returns uuid
language sql stable security definer set search_path = public as $$
  select setor_id from public.perfis where id = auth.uid() and ativo;
$$;

create or replace function public.eh_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_admin() or (public.eh_ativo() and exists (select 1 from public.setores where gestor_id = auth.uid()));
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
-- Novo usuário do Supabase Auth => perfil. O primeiro vira admin ativo;
-- os demais ficam aguardando aprovação do admin.
create or replace function public.ao_criar_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare primeiro boolean;
begin
  perform pg_advisory_xact_lock(4815162342);
  select not exists (select 1 from public.perfis) into primeiro;
  insert into public.perfis (id, nome, email, papel, ativo)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'nome',''), split_part(new.email,'@',1)),
          new.email,
          case when primeiro then 'admin' else 'colaborador' end,
          primeiro)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists trg_ao_criar_usuario on auth.users;
create trigger trg_ao_criar_usuario after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- Somente admin altera papel, ativo, setor e e-mail de um perfil.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- service_role / SQL direto
  if not public.eh_admin() then
    new.papel    := old.papel;
    new.ativo    := old.ativo;
    new.setor_id := old.setor_id;
    new.email    := old.email;
  end if;
  return new;
end $$;
drop trigger if exists trg_proteger_perfil on public.perfis;
create trigger trg_proteger_perfil before update on public.perfis
  for each row execute function public.proteger_perfil();

-- Gestor de setor não pode trocar o gestor (só o admin).
create or replace function public.proteger_setor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.eh_admin() then return new; end if;
  new.gestor_id := old.gestor_id;
  return new;
end $$;
drop trigger if exists trg_proteger_setor on public.setores;
create trigger trg_proteger_setor before update on public.setores
  for each row execute function public.proteger_setor();

create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists trg_atv_atualizado on public.atividades;
create trigger trg_atv_atualizado before update on public.atividades
  for each row execute function public.tocar_atualizado_em();
drop trigger if exists trg_fluxo_atualizado on public.fluxos;
create trigger trg_fluxo_atualizado before update on public.fluxos
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------
-- Permissões (RLS)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.empresa to anon;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.eh_ativo(), public.eh_admin(), public.gestor_do_setor(uuid), public.eh_gestor(), public.meu_setor() to anon, authenticated;

alter table public.empresa        enable row level security;
alter table public.perfis         enable row level security;
alter table public.setores        enable row level security;
alter table public.vinculos       enable row level security;
alter table public.fluxos         enable row level security;
alter table public.atividades     enable row level security;
alter table public.historico      enable row level security;
alter table public.comentarios    enable row level security;
alter table public.anexos         enable row level security;
alter table public.notificacoes   enable row level security;
alter table public.ausencias      enable row level security;
alter table public.integracoes    enable row level security;
alter table public.teams_webhooks enable row level security;
alter table public.envios         enable row level security;

-- empresa: todos leem (tela de login mostra logo); admin altera
drop policy if exists empresa_ler on public.empresa;
create policy empresa_ler on public.empresa for select to anon, authenticated using (true);
drop policy if exists empresa_admin on public.empresa;
create policy empresa_admin on public.empresa for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- perfis
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated using (public.eh_ativo() or id = auth.uid());
drop policy if exists perfis_editar on public.perfis;
create policy perfis_editar on public.perfis for update to authenticated
  using (id = auth.uid() or public.eh_admin()) with check (id = auth.uid() or public.eh_admin());
drop policy if exists perfis_excluir on public.perfis;
create policy perfis_excluir on public.perfis for delete to authenticated using (public.eh_admin() and id <> auth.uid());

-- setores
drop policy if exists setores_ler on public.setores;
create policy setores_ler on public.setores for select to authenticated using (public.eh_ativo());
drop policy if exists setores_criar on public.setores;
create policy setores_criar on public.setores for insert to authenticated with check (public.eh_admin());
drop policy if exists setores_editar on public.setores;
create policy setores_editar on public.setores for update to authenticated
  using (public.eh_admin() or public.gestor_do_setor(id)) with check (public.eh_admin() or public.gestor_do_setor(id));
drop policy if exists setores_excluir on public.setores;
create policy setores_excluir on public.setores for delete to authenticated using (public.eh_admin());

-- vínculos entre setores
drop policy if exists vinculos_ler on public.vinculos;
create policy vinculos_ler on public.vinculos for select to authenticated using (public.eh_ativo());
drop policy if exists vinculos_gerir on public.vinculos;
create policy vinculos_gerir on public.vinculos for all to authenticated
  using (public.eh_admin() or public.gestor_do_setor(origem_id) or public.gestor_do_setor(destino_id))
  with check (public.eh_admin() or public.gestor_do_setor(origem_id) or public.gestor_do_setor(destino_id));

-- fluxos de processo
drop policy if exists fluxos_ler on public.fluxos;
create policy fluxos_ler on public.fluxos for select to authenticated using (public.eh_ativo());
drop policy if exists fluxos_gerir on public.fluxos;
create policy fluxos_gerir on public.fluxos for all to authenticated using (public.eh_gestor()) with check (public.eh_gestor());

-- atividades
drop policy if exists atividades_ler on public.atividades;
create policy atividades_ler on public.atividades for select to authenticated using (public.eh_ativo());
drop policy if exists atividades_criar on public.atividades;
create policy atividades_criar on public.atividades for insert to authenticated
  with check (public.eh_ativo() and criado_por = auth.uid());
drop policy if exists atividades_editar on public.atividades;
create policy atividades_editar on public.atividades for update to authenticated
  using (public.eh_admin() or public.gestor_do_setor(setor_id) or responsavel_id = auth.uid() or criado_por = auth.uid()
         or (responsavel_id is null and setor_id = public.meu_setor()))  -- assumir atividade "a distribuir" do próprio setor
  with check (public.eh_ativo());
drop policy if exists atividades_excluir on public.atividades;
create policy atividades_excluir on public.atividades for delete to authenticated
  using (public.eh_admin() or public.gestor_do_setor(setor_id));

-- histórico, comentários, anexos
drop policy if exists historico_ler on public.historico;
create policy historico_ler on public.historico for select to authenticated using (public.eh_ativo());
drop policy if exists historico_criar on public.historico;
create policy historico_criar on public.historico for insert to authenticated with check (public.eh_ativo() and autor_id = auth.uid());

drop policy if exists comentarios_ler on public.comentarios;
create policy comentarios_ler on public.comentarios for select to authenticated using (public.eh_ativo());
drop policy if exists comentarios_criar on public.comentarios;
create policy comentarios_criar on public.comentarios for insert to authenticated with check (public.eh_ativo() and autor_id = auth.uid());
drop policy if exists comentarios_excluir on public.comentarios;
create policy comentarios_excluir on public.comentarios for delete to authenticated using (autor_id = auth.uid() or public.eh_admin());

drop policy if exists anexos_ler on public.anexos;
create policy anexos_ler on public.anexos for select to authenticated using (public.eh_ativo());
drop policy if exists anexos_criar on public.anexos;
create policy anexos_criar on public.anexos for insert to authenticated with check (public.eh_ativo() and autor_id = auth.uid());
drop policy if exists anexos_excluir on public.anexos;
create policy anexos_excluir on public.anexos for delete to authenticated
  using (autor_id = auth.uid() or public.eh_admin()
         or exists (select 1 from public.atividades a where a.id = atividade_id and public.gestor_do_setor(a.setor_id)));

-- notificações: cada um vê as suas
drop policy if exists notif_ler on public.notificacoes;
create policy notif_ler on public.notificacoes for select to authenticated using (para_id = auth.uid());
drop policy if exists notif_criar on public.notificacoes;
create policy notif_criar on public.notificacoes for insert to authenticated with check (public.eh_ativo());
drop policy if exists notif_editar on public.notificacoes;
create policy notif_editar on public.notificacoes for update to authenticated using (para_id = auth.uid()) with check (para_id = auth.uid());
drop policy if exists notif_excluir on public.notificacoes;
create policy notif_excluir on public.notificacoes for delete to authenticated using (para_id = auth.uid());

-- ausências (férias/licenças): gestor do setor da pessoa ou admin
drop policy if exists ausencias_ler on public.ausencias;
create policy ausencias_ler on public.ausencias for select to authenticated using (public.eh_ativo());
drop policy if exists ausencias_gerir on public.ausencias;
create policy ausencias_gerir on public.ausencias for all to authenticated
  using (public.eh_admin() or exists (select 1 from public.perfis p where p.id = pessoa_id and public.gestor_do_setor(p.setor_id)))
  with check (public.eh_admin() or exists (select 1 from public.perfis p where p.id = pessoa_id and public.gestor_do_setor(p.setor_id)));

-- integrações
drop policy if exists integ_ler on public.integracoes;
create policy integ_ler on public.integracoes for select to authenticated using (public.eh_ativo());
drop policy if exists integ_admin on public.integracoes;
create policy integ_admin on public.integracoes for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists teams_admin on public.teams_webhooks;
create policy teams_admin on public.teams_webhooks for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- fila de envios: qualquer usuário ativo enfileira; só admin consulta o log.
drop policy if exists envios_criar on public.envios;
create policy envios_criar on public.envios for insert to authenticated with check (public.eh_ativo() and criado_por = auth.uid());
drop policy if exists envios_ler on public.envios;
create policy envios_ler on public.envios for select to authenticated using (public.eh_admin());

-- ---------------------------------------------------------------------
-- Armazenamento de arquivos
-- Com o Supabase Storage (nuvem), cria os buckets e as regras de acesso.
-- Na instalação Docker, os arquivos ficam no serviço "arquivos" e este bloco é ignorado.
-- ---------------------------------------------------------------------
do $storage$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'storage.* não existe: arquivos gerenciados pelo serviço "arquivos" do Docker';
    return;
  end if;
  insert into storage.buckets (id, name, public) values ('anexos', 'anexos', false), ('marca', 'marca', true)
  on conflict (id) do nothing;
  execute 'drop policy if exists "planner anexos ler" on storage.objects';
  execute 'create policy "planner anexos ler" on storage.objects for select to authenticated using (bucket_id = ''anexos'' and public.eh_ativo())';
  execute 'drop policy if exists "planner anexos enviar" on storage.objects';
  execute 'create policy "planner anexos enviar" on storage.objects for insert to authenticated with check (bucket_id = ''anexos'' and public.eh_ativo())';
  execute 'drop policy if exists "planner anexos apagar" on storage.objects';
  execute 'create policy "planner anexos apagar" on storage.objects for delete to authenticated using (bucket_id = ''anexos'' and public.eh_ativo())';
  execute 'drop policy if exists "planner marca ler" on storage.objects';
  execute 'create policy "planner marca ler" on storage.objects for select to anon, authenticated using (bucket_id = ''marca'')';
  execute 'drop policy if exists "planner marca enviar" on storage.objects';
  execute 'create policy "planner marca enviar" on storage.objects for insert to authenticated with check (bucket_id = ''marca'' and public.eh_admin())';
  execute 'drop policy if exists "planner marca alterar" on storage.objects';
  execute 'create policy "planner marca alterar" on storage.objects for update to authenticated using (bucket_id = ''marca'' and public.eh_admin())';
  execute 'drop policy if exists "planner marca apagar" on storage.objects';
  execute 'create policy "planner marca apagar" on storage.objects for delete to authenticated using (bucket_id = ''marca'' and public.eh_admin())';
end
$storage$;
