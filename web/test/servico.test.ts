/* Testes de ponta a ponta das regras de negócio usando o repositório de demonstração. */
import { DemoRepo } from '../src/lib/repo/demo';
import { carregarDados } from '../src/lib/dados';
import { Servico } from '../src/lib/servico';
import { validarFluxo, destinosPermitidos, indicadores } from '../src/lib/regras';
import type { Dados, Perfil } from '../src/lib/types';

let ok = 0, falhas = 0;
const t = (nome: string, cond: boolean, extra = '') => { if (cond) { ok++; console.log('  ✓', nome); } else { falhas++; console.log('  ✗', nome, extra); } };
async function erro(fn: () => Promise<unknown>) { try { await fn(); return ''; } catch (e: any) { return e.message as string; } }

const repo = new DemoRepo();
let dados!: Dados; let eu!: Perfil;
const svc = new Servico(repo, () => ({ dados, eu }));
async function como(email: string) {
  await repo.auth.entrar(email, 'demo123');
  const s = await repo.auth.sessao();
  const ps = await repo.listar('perfis');
  eu = ps.find(p => p.id === s!.userId)!;
  dados = await carregarDados(repo, eu.id);
}
const recarregar = async () => { dados = await carregarDados(repo, eu.id); };
const setor = (n: string) => dados.setores.find(s => s.nome === n)!;
const pessoa = (n: string) => dados.perfis.find(p => p.nome.startsWith(n))!;
const atvs = (titulo: string) => dados.atividades.filter(a => a.titulo === titulo);

(async () => {
  await repo.reiniciarDemo!();
  console.log('\nAutenticação');
  t('senha errada é recusada', (await erro(() => repo.auth.entrar('lucas@empresa.com.br', 'x'))).includes('incorretos'));
  await como('lucas@empresa.com.br');
  t('login demo ok', eu.nome === 'Lucas Ramos');

  console.log('\nSolicitação entre setores com aceite');
  const destinos = destinosPermitidos(eu, dados).map(d => `${d.setor.nome}:${d.modo}`);
  t('Comercial pode enviar para Fiscal e Financeiro (com aceite)', destinos.includes('Fiscal:aceite') && destinos.includes('Financeiro:aceite') && !destinos.some(d => d.startsWith('Contábil')), destinos.join(','));
  const [sol] = await svc.criar({ modo: 'solicitar', titulo: 'Liberação de limite – Cliente Zeta', prioridade: 'alta', setor_id: setor('Financeiro').id, prazo: '2030-01-10' });
  t('solicitação fica aguardando aceite', sol.status === 'aguardando_aceite' && !sol.responsavel_id);
  t('sem vínculo é bloqueado', (await erro(() => svc.criar({ modo: 'solicitar', titulo: 'Teste sem vínculo', prioridade: 'media', setor_id: setor('Contábil').id }))).includes('Não existe vínculo'));
  t('colaborador não atribui a terceiros', (await erro(() => svc.criar({ modo: 'setor', titulo: 'Tarefa interna', prioridade: 'media', setor_id: setor('Comercial').id, responsavel_id: pessoa('Karina').id }))).includes('Somente o gestor'));

  await como('gabriela@empresa.com.br');
  t('gestora recebeu notificação de aceite', dados.notificacoes.some(n => n.atividade_id === sol.id && /aceite/.test(n.titulo)));
  const envios = await repo.listar('envios');
  t('e-mail enfileirado para a gestora', envios.some(e => e.canal === 'email' && e.para_id === eu.id));
  await svc.aceitar(dados.atividades.find(a => a.id === sol.id)!, { responsavel_id: pessoa('Henrique').id });
  await recarregar();
  t('aceite coloca na fila do responsável', dados.atividades.find(a => a.id === sol.id)!.status === 'na_fila');

  await como('lucas@empresa.com.br');
  t('solicitante notificado do aceite', dados.notificacoes.some(n => n.atividade_id === sol.id && n.titulo === 'Solicitação aceita'));

  console.log('\nFluxo de processo linear (Onboarding)');
  await como('karina@empresa.com.br');
  const f1 = dados.fluxos.find(f => f.nome.startsWith('Onboarding'))!;
  t('fluxo modelo é válido', validarFluxo(f1, dados.setores).filter(p => p.nivel === 'erro').length === 0);
  const [e1] = await svc.criar({ modo: 'fluxo', titulo: 'Onboarding – Cliente Teste', prioridade: 'media', fluxo_id: f1.id, responsavel_id: pessoa('Lucas').id });
  t('1ª etapa no próprio setor vai direto para a fila', e1.status === 'na_fila' && e1.setor_id === setor('Comercial').id);
  await como('lucas@empresa.com.br');
  await svc.iniciar(dados.atividades.find(a => a.id === e1.id)!); await recarregar();
  const prev = svc.preverProximos(dados.atividades.find(a => a.id === e1.id)!);
  t('previsão mostra Fiscal com aceite', prev.length === 1 && prev[0].setor?.nome === 'Fiscal' && prev[0].aceite);
  const [e2] = await svc.concluir(dados.atividades.find(a => a.id === e1.id)!, { observacao: 'Contrato ok' });
  t('conclusão cria etapa no Fiscal aguardando aceite', e2?.setor_id === setor('Fiscal').id && e2.status === 'aguardando_aceite' && e2.origem_id === e1.id && e2.processo_id === e1.processo_id);
  await como('ana@empresa.com.br');
  t('recusa exige motivo', (await erro(() => svc.recusar(dados.atividades.find(a => a.id === e2.id)!, 'x'))).includes('motivo'));
  await svc.aceitar(dados.atividades.find(a => a.id === e2.id)!, {});
  await recarregar();
  t('aceite sem responsável vai para "a distribuir"', dados.atividades.find(a => a.id === e2.id)!.status === 'a_distribuir');
  await svc.distribuir(dados.atividades.find(a => a.id === e2.id)!, pessoa('Carla').id); await recarregar();
  t('distribuição coloca na fila da Carla', dados.atividades.find(a => a.id === e2.id)!.responsavel_id === pessoa('Carla').id);
  await como('carla@empresa.com.br');
  const [e3] = await svc.concluir(dados.atividades.find(a => a.id === e2.id)!);
  t('Fiscal → Financeiro (aceite)', e3?.setor_id === setor('Financeiro').id && e3.status === 'aguardando_aceite');
  await como('gabriela@empresa.com.br');
  await svc.aceitar(dados.atividades.find(a => a.id === e3.id)!, { responsavel_id: pessoa('Igor').id });
  await como('igor@empresa.com.br');
  const fim = await svc.concluir(dados.atividades.find(a => a.id === e3.id)!);
  await recarregar();
  t('última etapa encerra o processo', fim.length === 0 && atvs('Onboarding – Cliente Teste').every(a => a.status === 'concluida') && atvs('Onboarding – Cliente Teste').length === 3);

  console.log('\nFluxo com etapas em paralelo e convergência (Fechamento)');
  await como('roberta@empresa.com.br');
  const f2 = dados.fluxos.find(f => f.nome.startsWith('Fechamento'))!;
  const ini = await svc.criar({ modo: 'fluxo', titulo: 'Fechamento – teste', prioridade: 'alta', fluxo_id: f2.id });
  t('início dispara duas etapas em paralelo', ini.length === 2 && ini.every(a => a.status === 'aguardando_aceite'));
  const resolver = async (setorNome: string, gestorEmail: string, execEmail: string, execNome: string) => {
    await como(gestorEmail);
    const a = atvs('Fechamento – teste').find(x => x.setor_id === setor(setorNome).id && x.status === 'aguardando_aceite')!;
    await svc.aceitar(a, { responsavel_id: pessoa(execNome).id });
    await como(execEmail);
    return svc.concluir(dados.atividades.find(x => x.id === a.id)!);
  };
  const r1 = await resolver('Fiscal', 'ana@empresa.com.br', 'bruno@empresa.com.br', 'Bruno');
  const r2 = await resolver('Departamento Pessoal', 'isabela@empresa.com.br', 'joao@empresa.com.br', 'João');
  t('cada ramo cria sua etapa no Contábil', r1.length === 1 && r2.length === 1 && r1[0].etapa_id !== r2[0].etapa_id);
  await como('diego@empresa.com.br');
  const cont = atvs('Fechamento – teste').filter(x => x.setor_id === setor('Contábil').id);
  for (const c of cont) await svc.aceitar(c, { responsavel_id: pessoa('Elisa').id });
  await como('elisa@empresa.com.br');
  const c1 = await svc.concluir(dados.atividades.find(x => x.id === cont[0].id)!);
  t('convergência aguarda o outro ramo', c1.length === 0);
  await recarregar();
  const c2 = await svc.concluir(dados.atividades.find(x => x.id === cont[1].id)!);
  t('segundo ramo libera o Financeiro uma única vez', c2.length === 1 && c2[0].setor_id === setor('Financeiro').id);
  await recarregar();
  t('não duplica etapa convergente', atvs('Fechamento – teste').filter(x => x.setor_id === setor('Financeiro').id).length === 1);

  console.log('\nEncaminhamento avulso e vínculos');
  await como('elisa@empresa.com.br');
  const conc = dados.atividades.find(a => a.titulo === 'Conciliação bancária')!;
  const enc = await svc.concluir(conc);
  t('encaminhar_para cria atividade no Financeiro', enc.length === 1 && enc[0].setor_id === setor('Financeiro').id);
  await como('isabela@empresa.com.br');
  const v = await svc.criarVinculo(setor('Departamento Pessoal').id, setor('Comercial').id, false, 'Comissões');
  await recarregar();
  t('gestor cria vínculo', dados.vinculos.some(x => x.id === v.id));
  const [direto] = await svc.criar({ modo: 'solicitar', titulo: 'Base de comissões', prioridade: 'media', setor_id: setor('Comercial').id });
  t('vínculo sem aceite entra direto para distribuição', direto.status === 'a_distribuir');
  await svc.removerVinculo(dados.vinculos.find(x => x.id === v.id)!); await recarregar();
  t('após remover vínculo a solicitação é bloqueada', (await erro(() => svc.criar({ modo: 'solicitar', titulo: 'Nova base', prioridade: 'media', setor_id: setor('Comercial').id }))).includes('Não existe vínculo'));

  console.log('\nFérias e delegação');
  await como('ana@empresa.com.br');
  const carla = pessoa('Carla'), bruno = pessoa('Bruno');
  const pend = svc.pendentesDe(carla.id);
  t('Carla tem pendências', pend.length >= 2, String(pend.length));
  t('conflito de período é bloqueado', (await erro(() => svc.registrarAusencia({ pessoa_id: carla.id, tipo: 'ferias', inicio: dados.ausencias.find(a => a.pessoa_id === carla.id)!.inicio, fim: '2099-01-01', substituto_id: bruno.id, delegacoes: [] }))).includes('já tem ausência'));
  const aus = dados.ausencias.find(a => a.pessoa_id === carla.id)!;
  await svc.delegar(aus, pend.map(a => ({ atividade_id: a.id, para: bruno.id })));
  await recarregar();
  t('atividades delegadas ao substituto', pend.every(p => dados.atividades.find(a => a.id === p.id)!.responsavel_id === bruno.id));
  t('responsável original guardado', pend.every(p => dados.atividades.find(a => a.id === p.id)!.responsavel_original_id === carla.id));
  const n = await svc.devolver(dados.ausencias.find(a => a.id === aus.id)!);
  await recarregar();
  t('devolução retorna para Carla', n === pend.length && pend.every(p => dados.atividades.find(a => a.id === p.id)!.responsavel_id === carla.id));

  console.log('\nPermissões e indicadores');
  await como('bruno@empresa.com.br');
  const outra = dados.atividades.find(a => a.setor_id === setor('Contábil').id && a.status === 'na_fila')!;
  t('colaborador não distribui', (await erro(() => svc.distribuir(outra, null))).includes('Somente o gestor'));
  const ind = indicadores(dados.atividades);
  t('indicadores calculados', ind.abertas > 0 && ind.concluidas30 > 0 && ind.noPrazoPct >= 0 && ind.noPrazoPct <= 100);
  await como('roberta@empresa.com.br');
  const pend2 = dados.perfis.find(p => !p.ativo)!;
  await svc.salvarPerfil(pend2.id, { ativo: true, setor_id: setor('Comercial').id, papel: 'colaborador' });
  await recarregar();
  t('admin aprova cadastro pendente', dados.perfis.find(p => p.id === pend2.id)!.ativo);

  console.log(`\n${ok} passaram, ${falhas} falharam`);
  (globalThis as any).process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); (globalThis as any).process.exit(1); });
