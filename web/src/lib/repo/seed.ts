/* Dados de exemplo do modo demonstração (datas relativas a hoje). */
import type { Atividade, Fluxo, FluxoDefinicao, Meta, NomeTabela, Perfil, Prioridade, Setor, Tabelas } from '../types';
import { addDias, uuid, SLA_PADRAO } from '../regras';

export const SENHA_DEMO = 'demo123';

export function gerarDadosDemo() {
  const iso = (dias: number, hora = 10) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(hora, 0, 0, 0); return d.toISOString(); };
  const S = (nome: string, cor: string, x: number, y: number, descricao: string): Setor =>
    ({ id: uuid(), nome, cor, descricao, gestor_id: null, pos_x: x, pos_y: y, criado_em: iso(-90) });
  const fis = S('Fiscal', '#2563eb', 380, 60, 'Apuração de tributos, obrigações acessórias e parametrização fiscal.');
  const con = S('Contábil', '#7c3aed', 700, 220, 'Escrituração, conciliações e fechamento contábil.');
  const fin = S('Financeiro', '#059669', 1020, 60, 'Contas a pagar e a receber, tesouraria e cobrança.');
  const dp = S('Departamento Pessoal', '#d97706', 380, 380, 'Folha de pagamento, admissões, férias e rescisões.');
  const com = S('Comercial', '#db2777', 60, 220, 'Vendas, propostas e relacionamento com clientes.');
  const setores = [fis, con, fin, dp, com];

  const P = (nome: string, setor: Setor | null, papel: Perfil['papel'], cargo: string, ativo = true): Perfil => ({
    id: uuid(), nome, email: `${nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@empresa.com.br`,
    cargo, setor_id: setor?.id ?? null, papel, ativo, notif_email: true, notif_teams: true, criado_em: iso(-90),
  });
  const roberta = P('Roberta Lima', null, 'admin', 'Diretora de Operações');
  const ana = P('Ana Souza', fis, 'gestor', 'Coordenadora Fiscal'), bruno = P('Bruno Lima', fis, 'colaborador', 'Analista Fiscal'), carla = P('Carla Dias', fis, 'colaborador', 'Analista Fiscal');
  const diego = P('Diego Rocha', con, 'gestor', 'Contador'), elisa = P('Elisa Martins', con, 'colaborador', 'Analista Contábil'), fabio = P('Fábio Nunes', con, 'colaborador', 'Assistente Contábil');
  const gabriela = P('Gabriela Alves', fin, 'gestor', 'Gerente Financeira'), henrique = P('Henrique Costa', fin, 'colaborador', 'Analista Financeiro'), igor = P('Igor Prado', fin, 'colaborador', 'Assistente Financeiro');
  const isabela = P('Isabela Freitas', dp, 'gestor', 'Coordenadora de DP'), joao = P('João Pereira', dp, 'colaborador', 'Analista de DP');
  const karina = P('Karina Melo', com, 'gestor', 'Gerente Comercial'), lucas = P('Lucas Ramos', com, 'colaborador', 'Executivo de Contas');
  const marina = P('Marina Teixeira', null, 'colaborador', '', false);
  const perfis = [roberta, ana, bruno, carla, diego, elisa, fabio, gabriela, henrique, igor, isabela, joao, karina, lucas, marina];
  fis.gestor_id = ana.id; con.gestor_id = diego.id; fin.gestor_id = gabriela.id; dp.gestor_id = isabela.id; com.gestor_id = karina.id;

  const V = (o: Setor, d: Setor, requer_aceite = true, descricao = '') => ({ id: uuid(), origem_id: o.id, destino_id: d.id, requer_aceite, descricao, criado_por: roberta.id, criado_em: iso(-80) });
  const vinculos = [V(com, fis, true, 'Novos clientes e contratos'), V(fis, con), V(con, fin), V(dp, con, true, 'Folha e encargos'), V(fis, fin, false, 'Guias de impostos'), V(com, fin, true, 'Crédito e cobrança'), V(dp, fin, true)];

  // ---- fluxos (modelos de processo) ----
  const no = (tipo: 'inicio' | 'etapa' | 'fim', x: number, y: number, titulo: string, setor?: Setor, prazo_dias = 3, requer_aceite = true) =>
    ({ id: uuid(), tipo, x, y, titulo, setor_id: setor?.id ?? null, prazo_dias: tipo === 'etapa' ? prazo_dias : null, requer_aceite });
  const ar = (de: { id: string }, para: { id: string }, rotulo = '') => ({ id: uuid(), de: de.id, para: para.id, rotulo });
  const f1i = no('inicio', 40, 160, 'Início'), f1a = no('etapa', 220, 140, 'Cadastro e contrato do cliente', com, 3), f1b = no('etapa', 500, 140, 'Parametrização fiscal', fis, 2),
    f1c = no('etapa', 780, 140, 'Cadastro de cobrança', fin, 2), f1f = no('fim', 1060, 160, 'Fim');
  const def1: FluxoDefinicao = { nos: [f1i, f1a, f1b, f1c, f1f], arestas: [ar(f1i, f1a), ar(f1a, f1b), ar(f1b, f1c), ar(f1c, f1f)] };
  const f2i = no('inicio', 40, 200, 'Início'), f2a = no('etapa', 220, 80, 'Apuração de impostos', fis, 5), f2b = no('etapa', 220, 300, 'Folha de pagamento', dp, 5),
    f2c = no('etapa', 500, 80, 'Escrituração e balancete', con, 3), f2d = no('etapa', 500, 300, 'Contabilização da folha', con, 2),
    f2e = no('etapa', 780, 190, 'Pagamento de guias e folha', fin, 2), f2f = no('fim', 1060, 210, 'Fim');
  const def2: FluxoDefinicao = { nos: [f2i, f2a, f2b, f2c, f2d, f2e, f2f], arestas: [ar(f2i, f2a), ar(f2i, f2b), ar(f2a, f2c), ar(f2b, f2d), ar(f2c, f2e), ar(f2d, f2e), ar(f2e, f2f)] };
  const fluxo1: Fluxo = { id: uuid(), nome: 'Onboarding de novo cliente', descricao: 'Do contrato assinado até a cobrança configurada.', ativo: true, definicao: def1, criado_por: roberta.id, criado_em: iso(-60), atualizado_em: iso(-60) };
  const fluxo2: Fluxo = { id: uuid(), nome: 'Fechamento mensal', descricao: 'Apuração fiscal e folha em paralelo, contabilização e pagamentos.', ativo: true, definicao: def2, criado_por: roberta.id, criado_em: iso(-60), atualizado_em: iso(-60) };

  // ---- atividades ----
  let seq = 0;
  const atividades: Atividade[] = [];
  const historico: Tabelas['historico'][] = [];
  const A = (o: Partial<Atividade> & { titulo: string; setor_id: string }, criadoDias = -3): Atividade => {
    const a: Atividade = {
      id: uuid(), numero: ++seq, descricao: '', responsavel_id: null, status: 'a_distribuir', prioridade: 'media',
      inicio: addDias(criadoDias), prazo: addDias(3), criado_por: roberta.id, solicitante_setor_id: null, origem_id: null,
      processo_id: uuid(), fluxo_id: null, etapa_id: null, encaminhar_para: null, motivo: null, responsavel_original_id: null,
      iniciado_em: null, concluido_em: null, criado_em: iso(criadoDias, 9), atualizado_em: iso(criadoDias, 9), ...o,
    } as Atividade;
    if (['em_andamento', 'pausada', 'concluida'].includes(a.status) && !a.iniciado_em) a.iniciado_em = iso(criadoDias, 11);
    atividades.push(a);
    historico.push({ id: uuid(), atividade_id: a.id, texto: 'Atividade criada', autor_id: a.criado_por, criado_em: a.criado_em });
    if (a.responsavel_id) historico.push({ id: uuid(), atividade_id: a.id, texto: `Atribuída a ${perfis.find(p => p.id === a.responsavel_id)?.nome}`, autor_id: a.criado_por, criado_em: iso(criadoDias, 10) });
    if (a.status === 'concluida') historico.push({ id: uuid(), atividade_id: a.id, texto: 'Concluída', autor_id: a.responsavel_id, criado_em: a.concluido_em as string });
    return a;
  };
  // Processo: onboarding Cliente Vértice (fluxo 1)
  const v1 = A({ titulo: 'Onboarding – Cliente Vértice', setor_id: com.id, responsavel_id: karina.id, status: 'concluida', prioridade: 'alta', prazo: addDias(-1), concluido_em: iso(-1, 15), fluxo_id: fluxo1.id, etapa_id: f1a.id, criado_por: karina.id, solicitante_setor_id: com.id, descricao: 'Contrato assinado. Seguir com parametrização e cobrança.' }, -4);
  A({ titulo: 'Onboarding – Cliente Vértice', setor_id: fis.id, status: 'aguardando_aceite', prioridade: 'alta', prazo: addDias(2), fluxo_id: fluxo1.id, etapa_id: f1b.id, origem_id: v1.id, processo_id: v1.processo_id, criado_por: karina.id, solicitante_setor_id: com.id, descricao: v1.descricao }, -1);
  // Processo: onboarding Grupo Horizonte
  A({ titulo: 'Onboarding – Grupo Horizonte', setor_id: com.id, responsavel_id: lucas.id, status: 'em_andamento', prazo: addDias(2), fluxo_id: fluxo1.id, etapa_id: f1a.id, criado_por: karina.id, solicitante_setor_id: com.id }, -2);
  // Processo: fechamento mensal (fluxo 2)
  const fm = A({ titulo: 'Fechamento mensal – outubro', setor_id: fis.id, responsavel_id: bruno.id, status: 'em_andamento', prioridade: 'alta', prazo: addDias(2), fluxo_id: fluxo2.id, etapa_id: f2a.id, criado_por: roberta.id }, -5);
  const fmf = A({ titulo: 'Fechamento mensal – outubro', setor_id: dp.id, responsavel_id: joao.id, status: 'concluida', prioridade: 'alta', prazo: addDias(0), concluido_em: iso(-1, 17), fluxo_id: fluxo2.id, etapa_id: f2b.id, processo_id: fm.processo_id, criado_por: roberta.id }, -5);
  A({ titulo: 'Fechamento mensal – outubro', setor_id: con.id, status: 'a_distribuir', prioridade: 'alta', prazo: addDias(2), fluxo_id: fluxo2.id, etapa_id: f2d.id, processo_id: fm.processo_id, origem_id: fmf.id, criado_por: joao.id, solicitante_setor_id: dp.id }, -1);
  // Fiscal
  A({ titulo: 'Escrituração EFD-Contribuições', setor_id: fis.id, responsavel_id: carla.id, status: 'na_fila', prazo: addDias(5), criado_por: ana.id });
  A({ titulo: 'Conferência de notas fiscais de entrada', setor_id: fis.id, responsavel_id: bruno.id, status: 'na_fila', prioridade: 'urgente', prazo: addDias(-1), criado_por: ana.id }, -6);
  A({ titulo: 'Revisão de NCM dos produtos', setor_id: fis.id, responsavel_id: carla.id, status: 'pausada', prioridade: 'baixa', prazo: addDias(10), criado_por: ana.id, motivo: 'Aguardando lista atualizada do Comercial' }, -7);
  A({ titulo: 'Retificação do SPED Fiscal', setor_id: fis.id, responsavel_id: bruno.id, status: 'concluida', prazo: addDias(-4), concluido_em: iso(-5, 16), criado_por: ana.id }, -9);
  A({ titulo: 'Atendimento à intimação da SEFAZ', setor_id: fis.id, responsavel_id: carla.id, status: 'concluida', prioridade: 'urgente', prazo: addDias(-6), concluido_em: iso(-3, 16), criado_por: ana.id }, -10);
  A({ titulo: 'Parecer sobre novo benefício fiscal', setor_id: fis.id, status: 'a_distribuir', prazo: addDias(6), criado_por: ana.id }, -1);
  const das = A({ titulo: 'Cálculo das guias DAS', setor_id: fis.id, responsavel_id: carla.id, status: 'concluida', prioridade: 'alta', prazo: addDias(-1), concluido_em: iso(-2, 14), criado_por: ana.id, encaminhar_para: fin.id }, -6);
  // Financeiro
  A({ titulo: 'Pagamento das guias DAS', setor_id: fin.id, responsavel_id: igor.id, status: 'em_andamento', prioridade: 'alta', prazo: addDias(1), origem_id: das.id, processo_id: das.processo_id, criado_por: carla.id, solicitante_setor_id: fis.id }, -2);
  A({ titulo: 'Pagamento de fornecedores', setor_id: fin.id, responsavel_id: henrique.id, status: 'na_fila', prioridade: 'alta', prazo: addDias(0), criado_por: gabriela.id });
  A({ titulo: 'Conciliação de cartões', setor_id: fin.id, responsavel_id: gabriela.id, status: 'pausada', prazo: addDias(2), criado_por: gabriela.id });
  A({ titulo: 'Análise de crédito – Cliente Atlas', setor_id: fin.id, status: 'aguardando_aceite', prioridade: 'alta', prazo: addDias(3), criado_por: lucas.id, solicitante_setor_id: com.id, descricao: 'Limite solicitado: R$ 250 mil. Documentos em anexo no CRM.' }, -1);
  A({ titulo: 'Previsão de fluxo de caixa – novembro', setor_id: fin.id, responsavel_id: henrique.id, status: 'concluida', prazo: addDias(-2), concluido_em: iso(-2, 12), criado_por: gabriela.id }, -8);
  // Contábil
  A({ titulo: 'Conciliação bancária', setor_id: con.id, responsavel_id: elisa.id, status: 'em_andamento', prioridade: 'alta', prazo: addDias(1), encaminhar_para: fin.id, criado_por: diego.id });
  A({ titulo: 'Fechamento do balancete', setor_id: con.id, responsavel_id: fabio.id, status: 'na_fila', prazo: addDias(7), criado_por: diego.id });
  A({ titulo: 'Lançamento de provisões', setor_id: con.id, responsavel_id: elisa.id, status: 'concluida', prazo: addDias(-3), concluido_em: iso(-4, 15), criado_por: diego.id }, -7);
  // DP
  A({ titulo: 'Admissão – novo colaborador', setor_id: dp.id, responsavel_id: joao.id, status: 'em_andamento', prazo: addDias(3), encaminhar_para: con.id, criado_por: isabela.id });
  A({ titulo: 'Planejamento de férias coletivas', setor_id: dp.id, responsavel_id: isabela.id, status: 'na_fila', prioridade: 'baixa', prazo: addDias(12), criado_por: isabela.id });
  // Comercial
  A({ titulo: 'Proposta comercial – Cliente Atlas', setor_id: com.id, responsavel_id: lucas.id, status: 'na_fila', prioridade: 'alta', prazo: addDias(4), criado_por: karina.id });
  A({ titulo: 'Relatório de comissões', setor_id: com.id, status: 'a_distribuir', prazo: addDias(6), encaminhar_para: fin.id, criado_por: karina.id });

  // ---- histórico de 9 semanas para os indicadores de SLA (determinístico) ----
  let semente = 7;
  const rnd = () => (semente = (semente * 9301 + 49297) % 233280) / 233280;
  const metas: Meta[] = [
    { id: uuid(), setor_id: null, ...SLA_PADRAO, sla_dias: { ...SLA_PADRAO.sla_dias }, criado_em: iso(-90), atualizado_em: iso(-90) },
    { id: uuid(), setor_id: fis.id, sla_dias: { urgente: 1, alta: 2, media: 4, baixa: 8 }, sla_aceite_horas: 4, meta_sla_pct: 92, meta_concluidas_mes: 14, criado_em: iso(-60), atualizado_em: iso(-60) },
    { id: uuid(), setor_id: dp.id, sla_dias: { urgente: 1, alta: 3, media: 5, baixa: 10 }, sla_aceite_horas: 8, meta_sla_pct: 85, meta_concluidas_mes: 10, criado_em: iso(-60), atualizado_em: iso(-60) },
  ];
  const slaDe = (s: Setor) => (metas.find(m => m.setor_id === s.id) || metas[0]).sla_dias;
  const taxa: Record<string, number> = { [fis.id]: 0.84, [con.id]: 0.93, [fin.id]: 0.96, [dp.id]: 0.74, [com.id]: 0.88 };
  const rotinas: Record<string, string[]> = {
    [fis.id]: ['Conferência de notas de saída', 'Apuração de ISS', 'Escrituração de entradas', 'Revisão de CFOP', 'Guia de ICMS-ST'],
    [con.id]: ['Conciliação bancária', 'Lançamento de despesas', 'Revisão do balancete', 'Provisão de férias', 'Ajuste de estoque'],
    [fin.id]: ['Pagamento de fornecedores', 'Baixa de recebíveis', 'Cobrança de inadimplentes', 'Conferência de boletos', 'Fluxo de caixa semanal'],
    [dp.id]: ['Cálculo de horas extras', 'Admissão de colaborador', 'Rescisão contratual', 'Envio do eSocial', 'Cálculo de férias'],
    [com.id]: ['Proposta para cliente', 'Renovação de contrato', 'Cadastro de cliente', 'Relatório de vendas', 'Atendimento pós-venda'],
  };
  for (const st of setores) {
    const equipe = perfis.filter(p => p.setor_id === st.id && p.ativo);
    for (let w = 9; w >= 1; w--) {
      const n = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const r = rnd();
        const pr: Prioridade = r < 0.1 ? 'urgente' : r < 0.3 ? 'alta' : r < 0.85 ? 'media' : 'baixa';
        const dias = slaDe(st)[pr];
        const criadoDias = -(w * 7) + Math.floor(rnd() * 5);
        const ok = rnd() < taxa[st.id];
        const dur = ok ? 0.25 + rnd() * dias * 0.95 : dias * 1.45 + 1 + rnd() * 3;
        const ini = new Date(iso(criadoDias, 9)).getTime();
        const fimMs = Math.min(ini + dur * 86400000, Date.now() - 3600000);
        const rot = rotinas[st.id];
        const outro = rnd() < 0.45 ? setores.filter(x => x.id !== st.id)[Math.floor(rnd() * 4)] : null;
        A({
          titulo: `${rot[Math.floor(rnd() * rot.length)]} – ${new Date(ini).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
          setor_id: st.id, responsavel_id: equipe[Math.floor(rnd() * equipe.length)]?.id || null, status: 'concluida', prioridade: pr,
          prazo: addDias(criadoDias + Math.ceil(dias * 1.4)), concluido_em: new Date(fimMs).toISOString(),
          criado_por: outro ? (outro.gestor_id || roberta.id) : (st.gestor_id || roberta.id), solicitante_setor_id: outro?.id || st.id,
          aceito_em: outro ? new Date(ini + (0.3 + rnd() * 11) * 3600000).toISOString() : null,
        }, criadoDias);
      }
    }
  }
  // atividades abertas que já passaram pelo aceite do gestor
  for (const a of atividades) if (!a.aceito_em && a.solicitante_setor_id && a.solicitante_setor_id !== a.setor_id && a.status !== 'aguardando_aceite')
    a.aceito_em = new Date(new Date(a.criado_em).getTime() + 3 * 3600000).toISOString();

  const ausencias: Tabelas['ausencias'][] = [
    { id: uuid(), pessoa_id: carla.id, tipo: 'ferias', inicio: addDias(7), fim: addDias(21), substituto_id: bruno.id, observacao: 'Férias programadas', delegado: false, devolvido: false, criado_por: ana.id, criado_em: iso(-10) },
    { id: uuid(), pessoa_id: henrique.id, tipo: 'folga', inicio: addDias(-12), fim: addDias(-11), substituto_id: igor.id, observacao: null, delegado: false, devolvido: false, criado_por: gabriela.id, criado_em: iso(-20) },
  ];
  const byTit = (t: string, s: Setor) => atividades.find(a => a.titulo === t && a.setor_id === s.id)!;
  const N = (para: Perfil, titulo: string, texto: string, atv: Atividade, dias = -1) =>
    ({ id: uuid(), para_id: para.id, titulo, texto, atividade_id: atv.id, lida: false, criado_em: iso(dias, 16) });
  const notificacoes = [
    N(ana, 'Nova solicitação aguardando seu aceite', 'Comercial enviou “Onboarding – Cliente Vértice” (etapa Parametrização fiscal).', byTit('Onboarding – Cliente Vértice', fis)),
    N(gabriela, 'Nova solicitação aguardando seu aceite', 'Comercial solicitou “Análise de crédito – Cliente Atlas”.', byTit('Análise de crédito – Cliente Atlas', fin)),
    N(diego, 'Nova atividade para distribuir', 'Departamento Pessoal concluiu a folha. “Fechamento mensal – outubro” chegou ao Contábil.', byTit('Fechamento mensal – outubro', con)),
    N(bruno, 'Atividade atribuída a você', '“Conferência de notas fiscais de entrada” está atrasada.', byTit('Conferência de notas fiscais de entrada', fis), -2),
  ];

  const senhas: Record<string, string> = {};
  perfis.forEach(p => { senhas[p.email] = SENHA_DEMO; });

  const db: { [K in NomeTabela]: Tabelas[K][] } & { __senhas: Record<string, string>; __seq: number } = {
    empresa: [{ id: 1, nome: 'Grupo Exemplo S.A.', logo_url: null, cor_primaria: null }],
    perfis, setores, vinculos, fluxos: [fluxo1, fluxo2], atividades, historico,
    comentarios: [{ id: uuid(), atividade_id: byTit('Revisão de NCM dos produtos', fis).id, texto: 'Pausei até o Comercial enviar a lista de produtos novos.', autor_id: carla.id, criado_em: iso(-2, 15) }],
    anexos: [], notificacoes, ausencias,
    integracoes: [{ id: 1, email_ativo: true, teams_ativo: false, app_url: typeof location !== 'undefined' ? location.origin + location.pathname : 'http://localhost:8080' }],
    teams_webhooks: [], envios: [], metas,
    __senhas: senhas, __seq: seq,
  };
  return db;
}
