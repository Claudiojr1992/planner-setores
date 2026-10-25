-- =====================================================================
-- Planner de Setores — usuários de TESTE no Supabase na nuvem (opcional)
-- Cole no SQL Editor do Supabase DEPOIS da migração inicial.
-- Cria 3 logins já confirmados (senha Planner@2026), setores Fiscal e Financeiro,
-- o vínculo entre eles e 4 atividades de exemplo. Pode ser executado de novo sem duplicar.
-- ATENÇÃO: a senha é pública (está na documentação). Bloqueie ou apague estes
-- usuários antes de usar o sistema com a equipe (Authentication → Users).
-- =====================================================================
do $$
declare
  u record; novo uuid;
begin
  for u in select * from (values
    ('admin@planner.local', 'Administrador Teste'),
    ('gestor@planner.local', 'Gestor Fiscal Teste'),
    ('colaborador@planner.local', 'Colaborador Fiscal Teste')) as t(email, nome)
  loop
    if not exists (select 1 from auth.users where email = u.email) then
      novo := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', novo, 'authenticated', 'authenticated', u.email,
        extensions.crypt('Planner@2026', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nome', u.nome), now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), novo, novo::text, 'email',
        jsonb_build_object('sub', novo::text, 'email', u.email, 'email_verified', true), now(), now(), now());
    end if;
  end loop;
end $$;

do $$
declare a uuid; g uuid; c uuid; fis uuid; fin uuid;
begin
  select id into a from public.perfis where email = 'admin@planner.local';
  select id into g from public.perfis where email = 'gestor@planner.local';
  select id into c from public.perfis where email = 'colaborador@planner.local';
  if a is null or g is null or c is null then raise exception 'Usuários de teste não encontrados (o cadastro falhou?)'; end if;

  select id into fis from public.setores where nome = 'Fiscal';
  if fis is null then insert into public.setores (nome, cor, descricao, pos_x, pos_y)
    values ('Fiscal', '#2563eb', 'Apuração de tributos e obrigações (teste)', 80, 80) returning id into fis; end if;
  select id into fin from public.setores where nome = 'Financeiro';
  if fin is null then insert into public.setores (nome, cor, descricao, pos_x, pos_y)
    values ('Financeiro', '#059669', 'Contas a pagar e a receber (teste)', 460, 220) returning id into fin; end if;

  update public.perfis set papel = 'admin', ativo = true, setor_id = null, nome = 'Administrador Teste', cargo = 'Diretoria' where id = a;
  update public.perfis set papel = 'gestor', ativo = true, setor_id = fis, nome = 'Gestor Fiscal Teste', cargo = 'Coordenador Fiscal' where id = g;
  update public.perfis set papel = 'colaborador', ativo = true, setor_id = fis, nome = 'Colaborador Fiscal Teste', cargo = 'Analista Fiscal' where id = c;
  update public.setores set gestor_id = g where id = fis;
  update public.setores set gestor_id = a where id = fin and gestor_id is null;

  insert into public.vinculos (origem_id, destino_id, requer_aceite, descricao, criado_por)
  values (fis, fin, true, 'Guias e pagamentos (teste)', a) on conflict (origem_id, destino_id) do nothing;

  if not exists (select 1 from public.atividades where titulo like '[Teste]%') then
    insert into public.atividades (titulo, descricao, setor_id, responsavel_id, status, prioridade, inicio, prazo, criado_por, solicitante_setor_id) values
      ('[Teste] Apuração de ICMS', 'Apurar o ICMS do mês e gerar a guia.', fis, c, 'na_fila', 'alta', current_date, current_date + 3, g, fis),
      ('[Teste] Conferência de notas de entrada', 'Conferir as notas recebidas na semana.', fis, c, 'em_andamento', 'media', current_date - 1, current_date + 1, g, fis),
      ('[Teste] Revisão de NCM', 'Revisar a classificação fiscal dos produtos novos.', fis, null, 'a_distribuir', 'baixa', current_date, current_date + 7, g, fis),
      ('[Teste] Obrigação acessória atrasada', 'Exemplo de atividade atrasada.', fis, c, 'na_fila', 'urgente', current_date - 5, current_date - 1, g, fis);
    insert into public.historico (atividade_id, texto, autor_id)
      select id, 'Atividade criada (dados de teste)', g from public.atividades where titulo like '[Teste]%';
  end if;
  raise notice 'Cenário de teste pronto.';
end $$;
