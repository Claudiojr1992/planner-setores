-- Cenário de teste: 3 usuários (admin, gestor, colaborador), 2 setores, vínculo e atividades.
-- Executado por CRIAR-USUARIOS-TESTE.bat depois que os usuários se cadastram pelo login.
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
