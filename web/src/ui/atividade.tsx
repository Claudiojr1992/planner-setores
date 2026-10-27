import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  LuArrowRight, LuCheck, LuPlay, LuPause, LuX, LuPaperclip, LuMessageSquare, LuHistory, LuFileText, LuTrash2,
  LuDownload, LuPencil, LuRotateCcw, LuUpload, LuCalendar, LuUser, LuGitBranch, LuSend, LuWorkflow,
  LuInbox, LuChevronRight, LuCircleStop, LuUndo2, LuClock, LuEllipsis,
} from 'react-icons/lu';
import type { Anexo, Atividade, Dados, Perfil, Prioridade } from '../lib/types';
import {
  FINAIS, PRIORIDADE, STATUS, aberta, addDias, atividadesDoProcesso, atrasada, ausenciaAtiva, destinosPermitidos,
  etapasEmOrdem, fmtData, fmtDataCurta, fmtDataHora, gere, hoje, podeExecutar, primeiroNome, proximosNos, tempoRelativo, venceHoje,
  validarFluxo,
} from '../lib/regras';
import type { Detalhe, NovaAtividade } from '../lib/servico';
import { useApp, useDados } from '../app/contexto';
import { Avatar, Aviso, Campo, Elo, Kbd, Modal, PillStatus, PontoSetor, Pri, Suspenso, Vazio, tamanhoArquivo, type NoElo } from './base';

/* ===================== modais de ação (host global) ===================== */
type AcaoModal = { tipo: 'aceitar' | 'concluir' | 'editar'; a: Atividade } | { tipo: 'solicitar'; a: Atividade; destino: string };
let abrirModalAcao: (x: AcaoModal) => void = () => undefined;

export function useAcoes() {
  const { svc, executar, confirmar, dados, eu } = useDados();
  return {
    iniciar: (a: Atividade) => executar(() => svc.iniciar(a), a.status === 'pausada' ? 'Atividade retomada' : 'Atividade iniciada'),
    pausar: async (a: Atividade) => {
      const m = await confirmar({ titulo: 'Pausar atividade', texto: `“${a.titulo}” ficará pausada até ser retomada.`, ok: 'Pausar', campo: { rotulo: 'Motivo (opcional)', placeholder: 'Ex.: aguardando documento do cliente' } });
      if (m !== false) executar(() => svc.pausar(a, m.trim()), 'Atividade pausada');
    },
    concluir: (a: Atividade) => abrirModalAcao({ tipo: 'concluir', a }),
    aceitar: (a: Atividade) => abrirModalAcao({ tipo: 'aceitar', a }),
    editar: (a: Atividade) => abrirModalAcao({ tipo: 'editar', a }),
    solicitar: (a: Atividade, destino: string) => abrirModalAcao({ tipo: 'solicitar', a, destino }),
    recusar: async (a: Atividade) => {
      const m = await confirmar({ titulo: 'Recusar solicitação', texto: <>O solicitante será avisado e o fluxo deste ramo será encerrado.</>, ok: 'Recusar', perigo: true, campo: { rotulo: 'Motivo da recusa', obrigatorio: true, min: 5, placeholder: 'Explique o que falta ou por que não é deste setor' } });
      if (m !== false) executar(() => svc.recusar(a, m), 'Solicitação recusada — solicitante notificado');
    },
    distribuir: (a: Atividade, p: string | null) => executar(() => svc.distribuir(a, p), p ? `Distribuída para ${primeiroNome(dados.perfis.find(x => x.id === p)?.nome)}` : 'Devolvida para distribuição'),
    cancelar: async (a: Atividade) => {
      const m = await confirmar({ titulo: 'Cancelar atividade', texto: 'A atividade será encerrada sem conclusão.', ok: 'Cancelar atividade', perigo: true, campo: { rotulo: 'Motivo', obrigatorio: true, min: 3 } });
      if (m !== false) executar(() => svc.cancelar(a, m), 'Atividade cancelada');
    },
    reabrir: (a: Atividade) => executar(() => svc.reabrir(a), 'Atividade reaberta'),
    excluir: async (a: Atividade, depois?: () => void) => {
      if (await confirmar({ titulo: 'Excluir atividade', texto: <>Excluir <b>#{a.numero} {a.titulo}</b> com histórico, comentários e anexos? Esta ação não pode ser desfeita.</>, ok: 'Excluir', perigo: true })) {
        await executar(() => svc.excluir(a), 'Atividade excluída'); depois?.();
      }
    },
    podeGerir: (a: Atividade) => gere(eu, a.setor_id, dados.setores),
  };
}

/* ===================== trilho de passagem da atividade ===================== */
/** Setor de onde veio → setor atual → próximos setores (fluxo ou encaminhamento). */
export function nosDaAtividade(a: Atividade, dados: Dados, abrir?: (id: string) => void): NoElo[] {
  const setor = (id?: string | null) => dados.setores.find(x => x.id === id) || null;
  const o = a.origem_id ? dados.atividades.find(x => x.id === a.origem_id) : null;
  const deOnde = o && o.setor_id !== a.setor_id ? o.setor_id : a.solicitante_setor_id && a.solicitante_setor_id !== a.setor_id ? a.solicitante_setor_id : null;
  const f = a.fluxo_id ? dados.fluxos.find(x => x.id === a.fluxo_id) : null;
  const prox = aberta(a) ? (f && a.etapa_id ? proximosNos(f, a.etapa_id).map(n => n.setor_id) : a.encaminhar_para ? [a.encaminhar_para] : []) : [];
  const nos: NoElo[] = [];
  if (deOnde) nos.push({ setor: setor(deOnde), titulo: 'Veio deste setor', onClick: o && abrir ? () => abrir(o.id) : undefined });
  nos.push({ setor: setor(a.setor_id), atual: true, titulo: 'Está neste setor' });
  [...new Set(prox)].filter(Boolean).slice(0, 2).forEach(id => nos.push({ setor: setor(id), previsto: true, titulo: 'Segue para este setor ao concluir' }));
  return nos;
}

/* ===================== ações: uma principal, o resto no menu ===================== */
interface Op { k: string; rotulo: string; Ic: typeof LuCheck; fn: () => void; perigo?: boolean }
function opcoesDe(a: Atividade, eu: Perfil, dados: Dados, ac: ReturnType<typeof useAcoes>) {
  const gestor = gere(eu, a.setor_id, dados.setores);
  const exec = podeExecutar(eu, a, dados.setores);
  const ops: Op[] = [];
  let distribuir = false;
  if (a.status === 'aguardando_aceite') {
    if (gestor) ops.push({ k: 'aceitar', rotulo: 'Aceitar', Ic: LuCheck, fn: () => ac.aceitar(a) }, { k: 'recusar', rotulo: 'Recusar', Ic: LuX, fn: () => ac.recusar(a), perigo: true });
  } else if (a.status === 'a_distribuir') {
    if (gestor) distribuir = true;
    if (eu.setor_id === a.setor_id) ops.push({ k: 'assumir', rotulo: 'Assumir e iniciar', Ic: LuPlay, fn: () => ac.iniciar(a) });
  } else if (exec && aberta(a)) {
    if (a.status === 'em_andamento') ops.push({ k: 'concluir', rotulo: 'Concluir', Ic: LuCheck, fn: () => ac.concluir(a) }, { k: 'pausar', rotulo: 'Pausar', Ic: LuPause, fn: () => ac.pausar(a) });
    else ops.push({ k: 'iniciar', rotulo: a.status === 'pausada' ? 'Retomar' : 'Iniciar', Ic: LuPlay, fn: () => ac.iniciar(a) }, { k: 'concluir', rotulo: 'Concluir', Ic: LuCheck, fn: () => ac.concluir(a) });
  }
  const envia = aberta(a) && a.status !== 'aguardando_aceite' && (gestor || a.responsavel_id === eu.id);
  const destinos = envia ? destinosPermitidos(eu, dados, a.setor_id).filter(d => d.modo !== 'proprio') : [];
  return { ops, distribuir, destinos };
}

/* ===================== cartão ===================== */
export function Cartao({ a, arrastavel = false, acoes = true, mostrarSetor = false, mostrarResp = true }: { a: Atividade; arrastavel?: boolean; acoes?: boolean; mostrarSetor?: boolean; mostrarResp?: boolean }) {
  const { dados, abrirAtividade } = useDados();
  const s = dados.setores.find(x => x.id === a.setor_id);
  const r = dados.perfis.find(x => x.id === a.responsavel_id);
  const f = a.fluxo_id ? dados.fluxos.find(x => x.id === a.fluxo_id) : null;
  const etapa = f && a.etapa_id ? f.definicao.nos.find(n => n.id === a.etapa_id) : null;
  const nos = nosDaAtividade(a, dados, abrirAtividade);
  const aus = r ? ausenciaAtiva(dados.ausencias, r.id) : null;
  return (
    <div className="cartao" style={{ ['--c' as string]: s?.cor }} draggable={arrastavel || undefined} data-atividade={a.id}
      onDragStart={e => { e.dataTransfer.setData('text/atividade', a.id); e.dataTransfer.effectAllowed = 'move'; (e.currentTarget as HTMLElement).classList.add('arrastando'); }}
      onDragEnd={e => (e.currentTarget as HTMLElement).classList.remove('arrastando')}
      onClick={() => abrirAtividade(a.id)}>
      <div className="topo"><span className="numero">#{a.numero}</span><PillStatus s={a.status} /><span className="sp" /><Pri p={a.prioridade} /></div>
      <div className="titulo">{a.titulo}</div>
      {(nos.length > 1 || mostrarSetor) && <div className="meta"><Elo nos={nos} /></div>}
      {etapa && <div className="meta ellipsis" title={f?.nome}><LuWorkflow size={12} />{etapa.titulo}</div>}
      <div className="meta">
        {mostrarResp && (r ? <><Avatar p={r} setores={dados.setores} tam="p" /><span>{primeiroNome(r.nome)}</span>{aus && <span className="pill t-purple">ausente</span>}</> : <span>Sem responsável</span>)}
        <Prazo a={a} />
      </div>
      {acoes && <AcoesRapidas a={a} />}
    </div>
  );
}

export function Prazo({ a }: { a: Atividade }) {
  if (!a.prazo) return <span className="prazo">sem prazo</span>;
  const late = atrasada(a), hj = venceHoje(a);
  return <span className={`prazo ${late ? 'atraso' : hj ? 'hoje' : ''}`} title={`Prazo: ${fmtData(a.prazo)}`}><LuCalendar size={12} />{late ? 'Atrasada · ' : hj ? 'Hoje' : ''}{hj ? '' : fmtDataCurta(a.prazo)}</span>;
}

/** Linha compacta para as filas do dia a dia. */
export function LinhaAtividade({ a, mostrarResp = false, acoes = true }: { a: Atividade; mostrarResp?: boolean; acoes?: boolean }) {
  const { dados, abrirAtividade } = useDados();
  const s = dados.setores.find(x => x.id === a.setor_id);
  const r = dados.perfis.find(x => x.id === a.responsavel_id);
  const nos = nosDaAtividade(a, dados, abrirAtividade);
  return <div className="linha-at" style={{ ['--c' as string]: s?.cor }} onClick={() => abrirAtividade(a.id)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && abrirAtividade(a.id)}>
    <span className="cor" />
    <div className="corpo">
      <div className="l1"><span className="numero">#{a.numero}</span><span className="t" title={a.titulo}>{a.titulo}</span><Pri p={a.prioridade} /></div>
      <div className="l2">{a.status !== 'em_andamento' && a.status !== 'na_fila' && <PillStatus s={a.status} />}<Elo nos={nos} />{mostrarResp && <span className="row" style={{ gap: 5 }}><Avatar p={r} setores={dados.setores} tam="p" />{r ? primeiroNome(r.nome) : 'sem responsável'}</span>}<Prazo a={a} /></div>
    </div>
    {acoes && <div className="fim" onClick={e => e.stopPropagation()}><AcoesRapidas a={a} compacto /></div>}
  </div>;
}

function AcoesRapidas({ a, compacto = false }: { a: Atividade; compacto?: boolean }) {
  const { dados, eu, abrirAtividade } = useDados();
  const ac = useAcoes();
  const { ops, distribuir, destinos } = opcoesDe(a, eu, dados, ac);
  const pare = (fn: () => void) => (e: { stopPropagation(): void }) => { e.stopPropagation(); fn(); };
  const prim: Op | undefined = distribuir ? undefined : ops[0];
  const resto: Op[] = distribuir ? ops : ops.slice(1);
  if (!prim && !distribuir && !resto.length && !destinos.length) return null;
  const principal = distribuir ? <span onClick={e => e.stopPropagation()}><MenuDistribuir a={a} /></span>
    : prim && <button className={`btn p ${['aceitar', 'concluir'].includes(prim.k) || compacto ? 'pri' : ''}`} onClick={pare(prim.fn)}><prim.Ic size={14} />{prim.rotulo}</button>;
  const menu = (resto.length > 0 || destinos.length > 0) && <span onClick={e => e.stopPropagation()}><Suspenso gatilho={(abrir, aberto) => <button className={`btn p fant icone ${aberto ? 'on' : ''}`} title="Mais ações" aria-label="Mais ações" onClick={abrir}><LuEllipsis size={16} /></button>}>
    {fechar => <>
      {resto.map(o => <button key={o.k} className={`mi ${o.perigo ? 'perigo' : ''}`} onClick={() => { fechar(); o.fn(); }}><o.Ic size={15} />{o.rotulo}</button>)}
      {destinos.length > 0 && <>{resto.length > 0 && <hr />}<div className="rot-menu">Enviar para outro setor</div>
        {destinos.map(d => <button key={d.setor.id} className="mi" onClick={() => { fechar(); ac.solicitar(a, d.setor.id); }}><PontoSetor s={d.setor} /><span className="grow">{d.setor.nome}</span><span className="xs muted">{d.modo === 'aceite' ? 'com aceite' : 'direto'}</span></button>)}</>}
      <hr /><button className="mi" onClick={() => { fechar(); abrirAtividade(a.id); }}><LuFileText size={15} />Abrir detalhes</button>
    </>}
  </Suspenso></span>;
  return compacto ? <>{principal}{menu}</> : <div className="acoes">{principal}<span className="sp" />{menu}</div>;
}

/** Envia (vincula) a atividade para outro setor com vínculo a partir do setor dela. */
export function MenuEnviar({ a }: { a: Atividade }) {
  const { dados, eu } = useDados();
  const ac = useAcoes();
  const destinos = destinosPermitidos(eu, dados, a.setor_id).filter(d => d.modo !== 'proprio');
  if (!destinos.length) return null;
  return <Suspenso alinhar="esq" gatilho={abrir => <button className="btn" title="Enviar para outro setor" onClick={abrir}><LuSend size={14} />Enviar para setor</button>}>
    {fechar => <>
      <div className="rot-menu">Enviar para o setor</div>
      {destinos.map(d => <button key={d.setor.id} className="mi" onClick={() => { fechar(); ac.solicitar(a, d.setor.id); }}>
        <PontoSetor s={d.setor} /><span className="grow">{d.setor.nome}</span><span className="xs muted">{d.modo === 'aceite' ? 'com aceite' : 'direto'}</span></button>)}
    </>}
  </Suspenso>;
}

export function MenuDistribuir({ a, rotulo = 'Distribuir' }: { a: Atividade; rotulo?: string }) {
  const { dados } = useDados();
  const ac = useAcoes();
  const membros = dados.perfis.filter(p => p.setor_id === a.setor_id && p.ativo);
  return <Suspenso alinhar="esq" gatilho={abrir => <button className="btn p pri" onClick={abrir}><LuUser size={13} />{rotulo}</button>}>
    {fechar => <>
      <div className="rot-menu">Atribuir a</div>
      {membros.map(p => {
        const aus = ausenciaAtiva(dados.ausencias, p.id);
        const carga = dados.atividades.filter(x => x.responsavel_id === p.id && aberta(x)).length;
        return <button key={p.id} className="mi" onClick={() => { fechar(); ac.distribuir(a, p.id); }} disabled={p.id === a.responsavel_id}>
          <Avatar p={p} setores={dados.setores} tam="p" /><span className="grow">{p.nome}{aus && <span className="pill t-purple" style={{ marginLeft: 6 }}>ausente</span>}</span><span className="xs muted">{carga} abertas</span>
        </button>;
      })}
      {a.responsavel_id && <><hr /><button className="mi" onClick={() => { fechar(); ac.distribuir(a, null); }}><LuUndo2 size={15} />Devolver para distribuição</button></>}
    </>}
  </Suspenso>;
}

/* ===================== trilha do processo ===================== */
export function Trilha({ a, onAbrir }: { a: Atividade; onAbrir?: (id: string) => void }) {
  const { dados } = useDados();
  const passos = atividadesDoProcesso(dados.atividades, a.processo_id);
  const nomeS = (id?: string | null) => dados.setores.find(s => s.id === id);
  const previstos: { id: string; setor?: string | null; titulo: string }[] = [];
  const f = a.fluxo_id ? dados.fluxos.find(x => x.id === a.fluxo_id) : null;
  if (f) {
    const criadas = new Set(passos.map(p => p.etapa_id));
    for (const n of etapasEmOrdem(f)) if (!criadas.has(n.id)) previstos.push({ id: n.id, setor: n.setor_id, titulo: n.titulo });
  } else {
    const ult = passos.filter(aberta).slice(-1)[0];
    if (ult?.encaminhar_para) previstos.push({ id: 'enc', setor: ult.encaminhar_para, titulo: 'Encaminhamento previsto' });
  }
  const itens: ReactNode[] = [];
  passos.forEach(p => {
    const s = nomeS(p.setor_id);
    itens.push(<span key={p.id} className={`passo s-${p.status} ${p.id === a.id ? 'atual' : ''}`} title={`#${p.numero} · ${STATUS[p.status].rotulo}${p.etapa_id && f ? ' · ' + (f.definicao.nos.find(n => n.id === p.etapa_id)?.titulo || '') : ''}`}
      onClick={() => onAbrir?.(p.id)}><PontoSetor s={s} />{s?.nome}<span className="xs muted">{STATUS[p.status].rotulo}</span></span>);
  });
  previstos.forEach(p => itens.push(<span key={p.id} className="passo prev" title={p.titulo}><PontoSetor s={nomeS(p.setor)} />{nomeS(p.setor)?.nome}<span className="xs">previsto</span></span>));
  return <div className="trilha">{itens.map((x, i) => <span key={i} className="row" style={{ gap: 4 }}>{i > 0 && <span className="sep"><LuChevronRight size={14} /></span>}{x}</span>)}</div>;
}

/* ===================== detalhe (gaveta) ===================== */
export function DetalheAtividade() {
  const { dados, eu, atividadeAberta, abrirAtividade, svc, executar, toast, recarregar } = useDados();
  const a = dados.atividades.find(x => x.id === atividadeAberta);
  const [aba, setAba] = useState<'resumo' | 'coment' | 'anexos' | 'hist'>('resumo');
  const [det, setDet] = useState<Detalhe | null>(null);
  const [coment, setComent] = useState('');
  const [enviando, setEnviando] = useState(false);
  const arqRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const ac = useAcoes();
  const versao = a ? `${a.id}|${a.atualizado_em}|${a.status}` : '';
  useEffect(() => { if (!a) return; let vivo = true; svc.detalhe(a.id).then(d => vivo && setDet(d)).catch(() => undefined); return () => { vivo = false; }; }, [versao]); // eslint-disable-line
  useEffect(() => { setAba('resumo'); setComent(''); }, [atividadeAberta]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && abrirAtividade(null); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [abrirAtividade]);
  if (!atividadeAberta) return null;
  if (!a) return <><div className="gaveta-veu" onClick={() => abrirAtividade(null)} /><aside className="gaveta"><div className="gaveta-h"><h2 className="grow">Atividade não encontrada</h2><button className="btn fant icone" onClick={() => abrirAtividade(null)}><LuX size={18} /></button></div><div className="gaveta-b" style={{ padding: 20 }}><Vazio>Ela pode ter sido excluída ou você não tem acesso.</Vazio></div></aside></>;

  const pessoa = (id?: string | null) => dados.perfis.find(p => p.id === id);
  const f = a.fluxo_id ? dados.fluxos.find(x => x.id === a.fluxo_id) : null;
  const etapa = f && a.etapa_id ? f.definicao.nos.find(n => n.id === a.etapa_id) : null;
  const gestor = gere(eu, a.setor_id, dados.setores);
  const exec = podeExecutar(eu, a, dados.setores);
  const recarregarDet = async () => { setDet(await svc.detalhe(a.id)); };
  const anexar = async (lista: FileList | File[] | null) => {
    if (!lista || !lista.length) return; setEnviando(true);
    await executar(() => svc.anexar(a, Array.from(lista)), `${lista.length} arquivo(s) anexado(s)`); await recarregarDet(); setEnviando(false);
  };
  const baixar = async (x: Anexo) => {
    try { const u = await svc.urlAnexo(x); const l = document.createElement('a'); l.href = u; l.download = x.nome; l.target = '_blank'; l.rel = 'noopener'; document.body.appendChild(l); l.click(); l.remove(); }
    catch (e: any) { toast(e.message, 'erro'); }
  };
  const prox = aberta(a) ? svc.preverProximos(a) : [];
  const o = a.origem_id ? dados.atividades.find(x => x.id === a.origem_id) : null;

  return <>
    <div className="gaveta-veu" onClick={() => abrirAtividade(null)} />
    <aside className="gaveta" role="dialog" aria-label={a.titulo}>
      <div className="gaveta-h">
        <div className="grow col" style={{ gap: 6 }}>
          <div className="row wrap"><span className="numero muted num">#{a.numero}</span><PillStatus s={a.status} /><Pri p={a.prioridade} />{atrasada(a) && <span className="pill t-red">Atrasada</span>}</div>
          <h2 style={{ fontSize: 19 }}>{a.titulo}</h2>
          <div className="row wrap" style={{ gap: 10 }}><Elo nos={nosDaAtividade(a, dados, abrirAtividade)} />{f && <span className="sm muted row" style={{ gap: 5 }}><LuWorkflow size={13} />{f.nome}{etapa && <> · {etapa.titulo}</>}</span>}</div>
        </div>
        <button className="btn fant icone" onClick={() => abrirAtividade(null)} aria-label="Fechar"><LuX size={18} /></button>
      </div>
      <div className="abas">
        <button className={aba === 'resumo' ? 'on' : ''} onClick={() => setAba('resumo')}><LuFileText size={15} />Resumo</button>
        <button className={aba === 'coment' ? 'on' : ''} onClick={() => setAba('coment')}><LuMessageSquare size={15} />Comentários<span className="c">{det?.comentarios.length ?? 0}</span></button>
        <button className={aba === 'anexos' ? 'on' : ''} onClick={() => setAba('anexos')}><LuPaperclip size={15} />Anexos<span className="c">{det?.anexos.length ?? 0}</span></button>
        <button className={aba === 'hist' ? 'on' : ''} onClick={() => setAba('hist')}><LuHistory size={15} />Histórico</button>
      </div>
      <div className="gaveta-b">
        {aba === 'resumo' && <div className="col" style={{ padding: 20, gap: 18 }}>
          <ProximoPasso a={a} />
          {a.responsavel_original_id && <Aviso tipo="info">Delegada temporariamente — responsável original: <b>{pessoa(a.responsavel_original_id)?.nome}</b>.</Aviso>}
          <div className="col"><span className="secao-titulo">Descrição</span>
            <div style={{ whiteSpace: 'pre-wrap', color: a.descricao ? 'var(--text)' : 'var(--muted)' }}>{a.descricao || 'Sem descrição.'}</div></div>
          <dl className="dl">
            <dt>Responsável</dt><dd className="row">{pessoa(a.responsavel_id) ? <><Avatar p={pessoa(a.responsavel_id)} setores={dados.setores} tam="p" />{pessoa(a.responsavel_id)?.nome}</> : <span className="muted">Sem responsável</span>}</dd>
            <dt>Início / prazo</dt><dd>{fmtData(a.inicio)} → <b style={{ color: atrasada(a) ? 'var(--red)' : undefined }}>{fmtData(a.prazo)}</b></dd>
            <dt>Solicitado por</dt><dd>{pessoa(a.criado_por)?.nome || '—'}{a.solicitante_setor_id && a.solicitante_setor_id !== a.setor_id && <> · {dados.setores.find(x => x.id === a.solicitante_setor_id)?.nome}</>}</dd>
            <dt>Criada em</dt><dd>{fmtDataHora(a.criado_em)}</dd>
            {a.iniciado_em && <><dt>Iniciada em</dt><dd>{fmtDataHora(a.iniciado_em)}</dd></>}
            {a.concluido_em && <><dt>Concluída em</dt><dd>{fmtDataHora(a.concluido_em)}</dd></>}
            {o && <><dt>Veio de</dt><dd><a href="#" onClick={e => { e.preventDefault(); abrirAtividade(o.id); }}>#{o.numero} · {dados.setores.find(x => x.id === o.setor_id)?.nome}</a></dd></>}
          </dl>
          <div className="col"><span className="secao-titulo">Fluxo do processo entre setores</span><Trilha a={a} onAbrir={id => abrirAtividade(id)} /></div>
          {aberta(a) && <div className="col"><span className="secao-titulo">Ao concluir</span>
            {prox.length ? prox.map((p, i) => <div key={i} className="row sm"><LuArrowRight size={14} /><PontoSetor s={p.setor} /><b>{p.setor?.nome}</b>{p.etapa && <span className="muted">· {p.etapa.titulo}</span>}
              <span className={`pill ${p.aceite ? 't-amber' : 't-cyan'}`}>{p.aceite ? 'requer aceite' : 'entrada direta'}</span>{p.aguardando?.length ? <span className="muted xs">aguarda: {p.aguardando.join(', ')}</span> : null}</div>)
              : <span className="sm muted">{f ? 'Esta é a última etapa do fluxo.' : 'Nenhum encaminhamento definido — você poderá escolher ao concluir.'}</span>}
          </div>}
        </div>}
        {aba === 'coment' && <div className="col" style={{ padding: 20 }}>
          {!det ? <div className="giro" /> : det.comentarios.length === 0 ? <Vazio icone={<LuMessageSquare size={26} />}>Nenhum comentário ainda.</Vazio> :
            det.comentarios.map(c => <div key={c.id} className="coment"><Avatar p={pessoa(c.autor_id)} setores={dados.setores} tam="m" /><div className="grow"><div className="row"><b>{pessoa(c.autor_id)?.nome || '—'}</b><span className="xs muted">{tempoRelativo(c.criado_em)}</span></div><div style={{ whiteSpace: 'pre-wrap' }}>{c.texto}</div></div></div>)}
          <div className="col" style={{ marginTop: 6 }}>
            <textarea className="inp" placeholder="Escreva um comentário… (o responsável e o gestor serão avisados)" value={coment} onChange={e => setComent(e.target.value)} />
            <div className="row"><span className="sp" /><button className="btn pri" disabled={!coment.trim()} onClick={async () => { await executar(() => svc.comentar(a, coment), 'Comentário publicado'); setComent(''); await recarregarDet(); }}><LuSend size={14} />Comentar</button></div>
          </div>
        </div>}
        {aba === 'anexos' && <div className="col" style={{ padding: 20 }}>
          <div className={`drop ${arrastando ? 'on' : ''}`} onClick={() => arqRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
            onDrop={e => { e.preventDefault(); setArrastando(false); anexar(e.dataTransfer.files); }}>
            <LuUpload size={20} /><div><b>{enviando ? 'Enviando…' : 'Clique ou arraste arquivos aqui'}</b></div><div className="xs">PDF, planilhas, imagens e documentos</div>
          </div>
          <input ref={arqRef} type="file" multiple hidden onChange={e => { anexar(e.target.files); e.target.value = ''; }} />
          {!det ? <div className="giro" /> : det.anexos.length === 0 ? <span className="sm muted">Nenhum anexo.</span> :
            det.anexos.map(x => <div key={x.id} className="anexo"><span className="ic"><LuPaperclip size={16} /></span>
              <div className="grow"><div className="ellipsis" style={{ fontWeight: 600 }}>{x.nome}</div><div className="xs muted">{tamanhoArquivo(x.tamanho)} · {pessoa(x.autor_id)?.nome} · {fmtDataHora(x.criado_em)}</div></div>
              <button className="btn p" onClick={() => baixar(x)}><LuDownload size={14} />Baixar</button>
              {(x.autor_id === eu.id || gestor) && <button className="btn p fant perigo" title="Remover" onClick={async () => { await executar(() => svc.removerAnexo(x), 'Anexo removido'); await recarregarDet(); }}><LuTrash2 size={14} /></button>}
            </div>)}
        </div>}
        {aba === 'hist' && <div style={{ padding: 20 }}>
          {!det ? <div className="giro" /> : <div className="linha-tempo">{det.historico.slice().sort((x, y) => y.criado_em.localeCompare(x.criado_em)).map(h => <div key={h.id} className="ev"><span className="marca" /><div><div>{h.texto}</div><time>{fmtDataHora(h.criado_em)}{h.autor_id && ` · ${pessoa(h.autor_id)?.nome || ''}`}</time></div></div>)}</div>}
        </div>}
      </div>
      <div className="gaveta-f">
        {a.status === 'aguardando_aceite' && gestor && <><button className="btn pri" onClick={() => ac.aceitar(a)}><LuCheck size={15} />Aceitar</button><button className="btn" onClick={() => ac.recusar(a)}>Recusar</button></>}
        {a.status === 'a_distribuir' && gestor && <MenuDistribuir a={a} />}
        {aberta(a) && a.status !== 'aguardando_aceite' && (exec || (!a.responsavel_id && eu.setor_id === a.setor_id)) && <>
          {['na_fila', 'pausada', 'a_distribuir'].includes(a.status) && <button className="btn" onClick={() => ac.iniciar(a)}><LuPlay size={14} />{a.status === 'pausada' ? 'Retomar' : a.status === 'a_distribuir' ? 'Assumir e iniciar' : 'Iniciar'}</button>}
          {a.status === 'em_andamento' && <button className="btn" onClick={() => ac.pausar(a)}><LuPause size={14} />Pausar</button>}
          {exec && a.status !== 'a_distribuir' && <button className="btn pri" onClick={() => ac.concluir(a)}><LuCheck size={15} />Concluir</button>}
        </>}
        {gestor && aberta(a) && !['aguardando_aceite', 'a_distribuir'].includes(a.status) && <MenuDistribuir a={a} rotulo="Redistribuir" />}
        <span className="sp" />
        <Suspenso gatilho={abrir => <button className="btn" onClick={abrir}><LuEllipsis size={16} />Mais</button>}>
          {fechar => <>
            {aberta(a) && (gestor || a.criado_por === eu.id || a.responsavel_id === eu.id) && <button className="mi" onClick={() => { fechar(); ac.editar(a); }}><LuPencil size={15} />Editar dados</button>}
            {(gestor || a.criado_por === eu.id) && aberta(a) && <button className="mi perigo" onClick={() => { fechar(); ac.cancelar(a); }}><LuCircleStop size={15} />Cancelar atividade</button>}
            {gestor && FINAIS.includes(a.status) && <button className="mi" onClick={() => { fechar(); ac.reabrir(a); }}><LuRotateCcw size={15} />Reabrir</button>}
            {gestor && <><hr /><button className="mi perigo" onClick={() => { fechar(); ac.excluir(a, () => abrirAtividade(null)); }}><LuTrash2 size={15} />Excluir</button></>}
            <button className="mi" onClick={() => { fechar(); recarregar(); recarregarDet(); }}><LuRotateCcw size={15} />Atualizar</button>
          </>}
        </Suspenso>
      </div>
    </aside>
  </>;
}

/** Diz em uma frase o que precisa acontecer agora, com a ação certa ao lado. */
function ProximoPasso({ a }: { a: Atividade }) {
  const { dados, eu, svc } = useDados();
  const ac = useAcoes();
  const { ops, distribuir } = opcoesDe(a, eu, dados, ac);
  const pessoa = (id?: string | null) => dados.perfis.find(p => p.id === id);
  const s = dados.setores.find(x => x.id === a.setor_id);
  const gestor = gere(eu, a.setor_id, dados.setores);
  const prox = aberta(a) ? svc.preverProximos(a) : [];
  const destino = prox.map(p => p.setor?.nome).filter(Boolean).join(' e ');
  const minha = a.responsavel_id === eu.id;
  let titulo = '', texto = '';
  switch (a.status) {
    case 'aguardando_aceite': titulo = gestor ? 'Decida se o seu setor aceita' : 'Aguardando aceite'; texto = gestor ? 'Aceite para colocar na fila (e já escolher quem faz) ou recuse explicando o motivo.' : `${pessoa(s?.gestor_id)?.nome || 'O gestor de ' + (s?.nome || 'destino')} precisa aceitar a solicitação.`; break;
    case 'a_distribuir': titulo = gestor ? 'Escolha quem vai fazer' : 'Ainda sem responsável'; texto = gestor ? `Distribua para alguém de ${s?.nome}.` : eu.setor_id === a.setor_id ? 'Você pode assumir e começar agora.' : `O gestor de ${s?.nome} vai distribuir.`; break;
    case 'na_fila': titulo = minha ? 'Na sua fila' : `Na fila de ${primeiroNome(pessoa(a.responsavel_id)?.nome)}`; texto = minha ? 'Inicie quando começar a trabalhar nela.' : 'Ainda não foi iniciada.'; break;
    case 'em_andamento': titulo = minha ? 'Você está fazendo' : `Em andamento com ${primeiroNome(pessoa(a.responsavel_id)?.nome)}`; texto = destino ? `Ao concluir, segue para ${destino}.` : 'Conclua quando terminar.'; break;
    case 'pausada': titulo = 'Pausada'; texto = a.motivo ? `Motivo: ${a.motivo}` : 'Retome quando puder continuar.'; break;
    case 'concluida': titulo = 'Concluída'; texto = a.concluido_em ? `Em ${fmtDataHora(a.concluido_em)}.` : ''; break;
    case 'recusada': titulo = 'Recusada'; texto = a.motivo || ''; break;
    case 'cancelada': titulo = 'Cancelada'; texto = a.motivo || ''; break;
  }
  const p = ops[0];
  return <div className="proximo-passo" style={{ borderColor: a.status === 'aguardando_aceite' ? 'color-mix(in srgb, var(--amber) 40%, var(--border))' : undefined }}>
    <div className="txt"><b>{titulo}</b>{texto && <span>{texto}</span>}</div>
    {distribuir ? <MenuDistribuir a={a} /> : p && <button className={`btn ${p.perigo ? '' : 'pri'}`} onClick={p.fn}><p.Ic size={15} />{p.rotulo}</button>}
  </div>;
}

/* ===================== modais ===================== */
export function ModaisAtividade() {
  const [m, setM] = useState<AcaoModal | null>(null);
  abrirModalAcao = setM;
  const { dados } = useApp();
  if (!m || !dados) return null;
  const a = dados.atividades.find(x => x.id === m.a.id) || m.a;
  const fechar = () => setM(null);
  if (m.tipo === 'aceitar') return <ModalAceitar a={a} onFechar={fechar} />;
  if (m.tipo === 'concluir') return <ModalConcluir a={a} onFechar={fechar} />;
  if (m.tipo === 'editar') return <ModalEditar a={a} onFechar={fechar} />;
  return <ModalSolicitar a={a} destino={(m as { destino: string }).destino} onFechar={fechar} />;
}

function SelecaoPessoa({ setorId, valor, onChange, vazio = '— definir depois —' }: { setorId: string; valor: string; onChange: (v: string) => void; vazio?: string }) {
  const { dados } = useDados();
  const membros = dados.perfis.filter(p => p.setor_id === setorId && p.ativo);
  return <select className="inp" value={valor} onChange={e => onChange(e.target.value)}>
    <option value="">{vazio}</option>
    {membros.map(p => { const aus = ausenciaAtiva(dados.ausencias, p.id); const c = dados.atividades.filter(x => x.responsavel_id === p.id && aberta(x)).length;
      return <option key={p.id} value={p.id}>{p.nome} — {c} abertas{aus ? ' (ausente)' : ''}</option>; })}
  </select>;
}

function ModalAceitar({ a, onFechar }: { a: Atividade; onFechar: () => void }) {
  const { dados, svc, executar } = useDados();
  const [resp, setResp] = useState(''); const [prazo, setPrazo] = useState(a.prazo || addDias(3));
  const aus = resp ? ausenciaAtiva(dados.ausencias, resp) : null;
  return <Modal titulo="Aceitar solicitação" sub={`#${a.numero} · ${a.titulo}`} onFechar={onFechar}
    rodape={<><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" onClick={async () => { await executar(() => svc.aceitar(a, { responsavel_id: resp || null, prazo }), resp ? 'Aceita e colocada na fila' : 'Aceita — aguardando distribuição'); onFechar(); }}><LuCheck size={15} />Aceitar</button></>}>
    <Aviso>Vinda de <b>{dados.setores.find(s => s.id === a.solicitante_setor_id)?.nome || dados.perfis.find(p => p.id === a.criado_por)?.nome}</b>. Defina já o responsável ou deixe para distribuir depois no painel do setor.</Aviso>
    <div className="grade">
      <Campo rotulo="Responsável"><SelecaoPessoa setorId={a.setor_id} valor={resp} onChange={setResp} vazio="— distribuir depois —" /></Campo>
      <Campo rotulo="Prazo"><input type="date" className="inp" value={prazo} onChange={e => setPrazo(e.target.value)} /></Campo>
    </div>
    {aus && <Aviso tipo="atencao">Esta pessoa está ausente até {fmtData(aus.fim)}.</Aviso>}
  </Modal>;
}

function ModalConcluir({ a, onFechar }: { a: Atividade; onFechar: () => void }) {
  const { dados, eu, svc, executar } = useDados();
  const [obs, setObs] = useState('');
  const [dest, setDest] = useState(a.encaminhar_para || '');
  const prox = svc.preverProximos(a);
  const destinos = destinosPermitidos(eu, dados, a.setor_id).filter(d => d.modo !== 'proprio');
  const comFluxo = !!(a.fluxo_id && a.etapa_id);
  return <Modal titulo="Concluir atividade" sub={`#${a.numero} · ${a.titulo}`} onFechar={onFechar}
    rodape={<><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn sucesso" onClick={async () => {
      const r = await executar(() => svc.concluir(a, { observacao: obs, encaminhar_para: comFluxo ? undefined : dest || null }));
      if (r) { onFechar(); }
    }}><LuCheck size={15} />{(comFluxo ? prox.length : dest) ? 'Concluir e encaminhar' : 'Concluir'}</button></>}>
    {comFluxo ? (prox.length ? <div className="col"><span className="secao-titulo">Próximas etapas do fluxo</span>
      {prox.map((p, i) => <div key={i} className="aviso info"><LuArrowRight size={16} /><div><b>{p.setor?.nome}</b> — {p.etapa?.titulo}. {p.aguardando?.length ? <>Será liberada quando concluir: {p.aguardando.join(', ')}.</> : p.aceite ? <>Irá para o <b>aceite</b> de {dados.perfis.find(x => x.id === p.setor?.gestor_id)?.nome || 'gestor do setor'}.</> : 'Entrará direto para distribuição.'}</div></div>)}</div>
      : <Aviso tipo="ok">Esta é a última etapa do fluxo — o processo será encerrado.</Aviso>)
      : <Campo rotulo="Encaminhar para outro setor (opcional)" ajuda={destinos.length ? 'Somente setores com vínculo a partir deste setor.' : 'Não há vínculos de saída para este setor.'}>
        <select className="inp" value={dest} onChange={e => setDest(e.target.value)}>
          <option value="">Não encaminhar — encerrar aqui</option>
          {destinos.map(d => <option key={d.setor.id} value={d.setor.id}>{d.setor.nome} — {d.modo === 'aceite' ? 'requer aceite' : 'entrada direta'}</option>)}
        </select></Campo>}
    <Campo rotulo="Observação para o próximo setor / histórico"><textarea className="inp" value={obs} onChange={e => setObs(e.target.value)} placeholder="O que foi feito, pendências, onde estão os documentos…" /></Campo>
  </Modal>;
}

function ModalEditar({ a, onFechar }: { a: Atividade; onFechar: () => void }) {
  const { dados, eu, svc, executar } = useDados();
  const [v, setV] = useState({ titulo: a.titulo, descricao: a.descricao || '', prioridade: a.prioridade, inicio: a.inicio || '', prazo: a.prazo || '', encaminhar_para: a.encaminhar_para || '' });
  const destinos = destinosPermitidos(eu, dados, a.setor_id).filter(d => d.modo !== 'proprio');
  return <Modal titulo="Editar atividade" sub={`#${a.numero}`} onFechar={onFechar}
    rodape={<><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" onClick={async () => {
      await executar(() => svc.editar(a, { titulo: v.titulo, descricao: v.descricao || null, prioridade: v.prioridade, inicio: v.inicio || null, prazo: v.prazo || null, ...(a.fluxo_id ? {} : { encaminhar_para: v.encaminhar_para || null }) }), 'Atividade atualizada'); onFechar();
    }}>Salvar</button></>}>
    <Campo rotulo="Título"><input className="inp" value={v.titulo} onChange={e => setV({ ...v, titulo: e.target.value })} /></Campo>
    <Campo rotulo="Descrição"><textarea className="inp" value={v.descricao} onChange={e => setV({ ...v, descricao: e.target.value })} /></Campo>
    <div className="grade g3">
      <Campo rotulo="Prioridade"><select className="inp" value={v.prioridade} onChange={e => setV({ ...v, prioridade: e.target.value as Prioridade })}>{Object.entries(PRIORIDADE).map(([k, p]) => <option key={k} value={k}>{p.rotulo}</option>)}</select></Campo>
      <Campo rotulo="Início"><input type="date" className="inp" value={v.inicio} onChange={e => setV({ ...v, inicio: e.target.value })} /></Campo>
      <Campo rotulo="Prazo"><input type="date" className="inp" value={v.prazo} onChange={e => setV({ ...v, prazo: e.target.value })} /></Campo>
    </div>
    {!a.fluxo_id && <Campo rotulo="Encaminhar ao concluir para"><select className="inp" value={v.encaminhar_para} onChange={e => setV({ ...v, encaminhar_para: e.target.value })}>
      <option value="">Sem encaminhamento</option>{destinos.map(d => <option key={d.setor.id} value={d.setor.id}>{d.setor.nome} — {d.modo === 'aceite' ? 'requer aceite' : 'entrada direta'}</option>)}</select></Campo>}
  </Modal>;
}

function ModalSolicitar({ a, destino, onFechar }: { a: Atividade; destino: string; onFechar: () => void }) {
  const { dados, eu, svc, executar } = useDados();
  const ds = dados.setores.find(s => s.id === destino);
  const origem = dados.setores.find(s => s.id === a.setor_id);
  const regra = destinosPermitidos(eu, dados, a.setor_id).find(d => d.setor.id === destino);
  const [modo, setModo] = useState<'agora' | 'concluir'>(aberta(a) ? 'concluir' : 'agora');
  const [prazo, setPrazo] = useState(addDias(3)); const [obs, setObs] = useState('');
  const gestor = dados.perfis.find(p => p.id === ds?.gestor_id);
  return <Modal titulo="Vincular atividade a outro setor" onFechar={onFechar}
    rodape={<><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" disabled={!regra} onClick={async () => {
      if (modo === 'agora') await executar(() => svc.solicitarParaSetor(a, destino, { prazo, observacao: obs }), `Enviada para ${ds?.nome} — gestor notificado`);
      else await executar(() => svc.editar(a, { encaminhar_para: destino }), `${ds?.nome} definido como próximo setor`);
      onFechar();
    }}><LuSend size={14} />Vincular e notificar</button></>}>
    <div className="trilha"><span className="passo"><PontoSetor s={origem} />{origem?.nome}: #{a.numero} {a.titulo}</span><span className="sep"><LuArrowRight size={14} /></span><span className="passo atual"><PontoSetor s={ds} />{ds?.nome}</span></div>
    {!regra ? <Aviso tipo="erro">Não existe vínculo de <b>{origem?.nome}</b> para <b>{ds?.nome}</b>. Crie o vínculo no mapa (arraste da bolinha azul de um setor até o outro) e tente novamente.</Aviso> : <>
      <Aviso tipo={regra.modo === 'aceite' ? 'atencao' : 'info'}>{regra.modo === 'aceite' ? <>Este vínculo <b>exige aceite</b> de {gestor?.nome || 'gestor do setor'}.</> : <>Este vínculo tem <b>entrada direta</b>: a atividade chega para distribuição.</>}</Aviso>
      <div className="opcoes">
        {aberta(a) && !a.fluxo_id && <button className={`opcao ${modo === 'concluir' ? 'on' : ''}`} onClick={() => setModo('concluir')}><span className="ic"><LuGitBranch size={17} /></span><b>Próxima etapa ao concluir</b><span>Segue automaticamente quando #{a.numero} for concluída.</span></button>}
        <button className={`opcao ${modo === 'agora' ? 'on' : ''}`} onClick={() => setModo('agora')}><span className="ic"><LuSend size={17} /></span><b>Enviar agora</b><span>Cria uma solicitação vinculada em {ds?.nome} imediatamente.</span></button>
      </div>
      {modo === 'agora' && <div className="grade"><Campo rotulo="Prazo sugerido"><input type="date" className="inp" value={prazo} onChange={e => setPrazo(e.target.value)} /></Campo>
        <Campo rotulo="Observação" classe="full"><textarea className="inp" value={obs} onChange={e => setObs(e.target.value)} /></Campo></div>}
    </>}
  </Modal>;
}

/* ===================== nova solicitação ===================== */
export function ModalNovaAtividade() {
  const { dados, eu, nova, fecharNova, svc, executar, abrirAtividade } = useApp();
  if (!nova || !dados || !eu) return null;
  return <FormNova inicial={nova} dados={dados} eu={eu} onFechar={fecharNova} enviar={async e => {
    const r = await executar(() => svc.criar(e));
    if (r && r.length) {
      fecharNova();
      const t = r[0].status === 'aguardando_aceite' ? `Solicitação #${r[0].numero} enviada para aceite` : r.length > 1 ? `${r.length} atividades criadas no fluxo` : `Atividade #${r[0].numero} criada`;
      abrirAtividade(r[0].id);
      return t;
    }
    return null;
  }} />;
}

const PRAZOS_RAPIDOS: [string, number][] = [['Hoje', 0], ['Amanhã', 1], ['Em 3 dias', 3], ['Em 1 semana', 7]];

function FormNova({ inicial, dados, eu, onFechar, enviar }: { inicial: Partial<NovaAtividade>; dados: Dados; eu: Perfil; onFechar: () => void; enviar: (e: NovaAtividade) => Promise<string | null> }) {
  const { toast } = useApp();
  const destinos = useMemo(() => destinosPermitidos(eu, dados), [eu, dados]);
  const proprios = destinos.filter(d => d.modo === 'proprio' || (gere(eu, d.setor.id, dados.setores)));
  const externos = destinos.filter(d => d.modo !== 'proprio');
  const fluxos = dados.fluxos.filter(f => f.ativo && !validarFluxo(f, dados.setores).some(p => p.nivel === 'erro'));
  const modoInicial: NovaAtividade['modo'] = inicial.modo || (inicial.fluxo_id ? 'fluxo' : proprios.length ? 'setor' : 'solicitar');
  const [modo, setModo] = useState<NovaAtividade['modo']>(modoInicial);
  const [v, setV] = useState({
    titulo: inicial.titulo || '', descricao: inicial.descricao || '', prioridade: (inicial.prioridade || 'media') as Prioridade,
    inicio: hoje(), prazo: inicial.prazo || addDias(3),
    setor_id: inicial.setor_id || (modoInicial === 'setor' ? (eu.setor_id && proprios.some(p => p.setor.id === eu.setor_id) ? eu.setor_id : proprios[0]?.setor.id) : externos[0]?.setor.id) || '',
    responsavel_id: inicial.responsavel_id || '', fluxo_id: inicial.fluxo_id || fluxos[0]?.id || '', encaminhar_para: '',
  });
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [mais, setMais] = useState(false);
  const arqRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<typeof v>) => setV(x => ({ ...x, ...p }));
  const trocarModo = (m: NovaAtividade['modo']) => {
    setModo(m);
    if (m === 'setor') set({ setor_id: eu.setor_id && proprios.some(p => p.setor.id === eu.setor_id) ? eu.setor_id : proprios[0]?.setor.id || '', responsavel_id: '' });
    if (m === 'solicitar') set({ setor_id: externos[0]?.setor.id || '', responsavel_id: '' });
  };
  const setor = (id?: string | null) => dados.setores.find(s => s.id === id) || null;
  const setorExec = setor(v.setor_id);
  const destinoSel = destinos.find(d => d.setor.id === v.setor_id);
  const fluxo = dados.fluxos.find(f => f.id === v.fluxo_id);
  const etapas = fluxo ? etapasEmOrdem(fluxo) : [];
  const saidas = destinosPermitidos(eu, dados, v.setor_id || null).filter(d => d.modo !== 'proprio');
  const gestorExec = dados.perfis.find(p => p.id === setorExec?.gestor_id);
  const meuSetor = setor(eu.setor_id);

  let resumo: ReactNode = null;
  let caminho: NoElo[] = [];
  if (modo === 'fluxo' && fluxo) {
    resumo = <>Começa em <b>{setor(etapas[0]?.setor_id)?.nome || '—'}</b> e passa por {etapas.length} etapa(s). Cada setor recebe a atividade quando a etapa anterior for concluída{etapas.some(e => e.requer_aceite !== false) ? ', com aceite do gestor quando configurado' : ''}.</>;
    caminho = etapas.map((e, i) => ({ setor: setor(e.setor_id), atual: i === 0, previsto: i > 0, titulo: e.titulo }));
  } else if (modo === 'solicitar' && destinoSel) {
    resumo = destinoSel.modo === 'aceite' ? <>Vai para o <b>aceite de {gestorExec?.nome || 'gestor'}</b> em {setorExec?.nome}. Você é avisado quando for aceita ou recusada.</> : <>Entra direto em <b>{setorExec?.nome}</b> para o gestor distribuir.</>;
    caminho = [{ setor: meuSetor, rotulo: meuSetor ? `${meuSetor.nome} (você)` : 'Você' }, { setor: setorExec, atual: true }];
  } else if (modo === 'setor') {
    resumo = v.responsavel_id ? <>Vai direto para a fila de <b>{dados.perfis.find(p => p.id === v.responsavel_id)?.nome}</b>.</> : <>Fica <b>a distribuir</b> no painel de {setorExec?.nome} até o gestor escolher quem faz.</>;
    caminho = [{ setor: setorExec, atual: true }, ...(v.encaminhar_para ? [{ setor: setor(v.encaminhar_para), previsto: true }] : [])];
  }

  const podeResp = modo === 'setor' || (modo === 'fluxo' && etapas[0] && (etapas[0].setor_id === eu.setor_id || gere(eu, etapas[0].setor_id, dados.setores)));
  const setorResp = modo === 'fluxo' ? etapas[0]?.setor_id || '' : v.setor_id;
  const invalido = v.titulo.trim().length < 3 || (modo !== 'fluxo' && !v.setor_id) || (modo === 'fluxo' && !fluxo);
  const submeter = async () => {
    if (invalido || salvando) return;
    setSalvando(true);
    const t = await enviar({ modo, titulo: v.titulo, descricao: v.descricao, prioridade: v.prioridade, inicio: v.inicio, prazo: v.prazo,
      setor_id: modo === 'fluxo' ? null : v.setor_id, responsavel_id: v.responsavel_id || null, fluxo_id: modo === 'fluxo' ? v.fluxo_id : null,
      encaminhar_para: modo === 'setor' ? v.encaminhar_para || null : null, arquivos });
    setSalvando(false);
    if (t) toast(t);
  };
  const detalhes = [v.inicio !== hoje() && 'início', v.responsavel_id && 'responsável', v.encaminhar_para && 'encaminhamento', arquivos.length && `${arquivos.length} anexo(s)`].filter(Boolean) as string[];
  const tipos: [NovaAtividade['modo'], string, string, typeof LuInbox, boolean][] = [
    ['setor', 'Para o meu setor', 'Entra na fila do setor', LuInbox, proprios.length > 0],
    ['solicitar', 'Para outro setor', externos.length ? 'O gestor de lá recebe' : 'Seu setor não tem vínculos', LuSend, externos.length > 0],
    ['fluxo', 'Iniciar um processo', fluxos.length ? 'Passa por vários setores' : 'Nenhum fluxo publicado', LuWorkflow, fluxos.length > 0],
  ];

  return <Modal titulo="Nova solicitação" onFechar={onFechar} tam="largo"
    rodape={<><span className="xs muted desk-only" style={{ marginRight: 'auto' }}><Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> para enviar</span>
      <button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" disabled={invalido || salvando} onClick={submeter}>{salvando ? 'Enviando…' : modo === 'solicitar' ? <><LuSend size={14} />Enviar solicitação</> : modo === 'fluxo' ? <><LuWorkflow size={15} />Iniciar processo</> : <><LuCheck size={15} />Criar atividade</>}</button></>}>
    <div onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submeter(); } }} className="col" style={{ gap: 18 }}>
      <div className="campo"><label>Para onde vai?</label>
        <div className="escolha tipos">{tipos.map(([m, t, d, I, ok]) => <button key={m} type="button" className={modo === m ? 'on' : ''} disabled={!ok} onClick={() => trocarModo(m)}><b><I size={16} />{t}</b><span>{d}</span></button>)}</div></div>

      {modo === 'solicitar' && <div className="campo"><label>Qual setor?</label>
        <div className="escolha destinos">{externos.map(d => <button key={d.setor.id} type="button" className={v.setor_id === d.setor.id ? 'on' : ''} style={{ ['--c' as string]: d.setor.cor }} onClick={() => set({ setor_id: d.setor.id, responsavel_id: '' })}>{d.setor.nome}<span className="xs">{d.modo === 'aceite' ? 'com aceite' : 'direto'}</span></button>)}</div></div>}
      {modo === 'setor' && proprios.length > 1 && <div className="campo"><label>Setor</label>
        <div className="escolha destinos">{proprios.map(d => <button key={d.setor.id} type="button" className={v.setor_id === d.setor.id ? 'on' : ''} style={{ ['--c' as string]: d.setor.cor }} onClick={() => set({ setor_id: d.setor.id, responsavel_id: '', encaminhar_para: '' })}>{d.setor.nome}</button>)}</div></div>}
      {modo === 'fluxo' && <Campo rotulo="Qual processo?"><select className="inp" value={v.fluxo_id} onChange={e => set({ fluxo_id: e.target.value })}>{fluxos.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></Campo>}

      <Campo rotulo={modo === 'fluxo' ? 'Nome desta execução' : 'O que precisa ser feito?'}><input className="inp titulo-grande" autoFocus value={v.titulo} onChange={e => set({ titulo: e.target.value })} placeholder={modo === 'fluxo' ? `Ex.: ${fluxo?.nome || 'Processo'} – Cliente X` : 'Ex.: Apuração de ICMS de outubro'} /></Campo>
      <Campo rotulo="Detalhes" ajuda="Informações, documentos necessários e como saber que está pronto."><textarea className="inp" rows={3} value={v.descricao} onChange={e => set({ descricao: e.target.value })} /></Campo>

      <div className="grade">
        <div className="campo"><label>Prazo{modo === 'fluxo' && <span className="muted" style={{ fontWeight: 400 }}> · etapas com prazo próprio usam o do fluxo</span>}</label>
          <div className="escolha">{PRAZOS_RAPIDOS.map(([r, d]) => <button key={r} type="button" className={v.prazo === addDias(d) ? 'on' : ''} onClick={() => set({ prazo: addDias(d) })}>{r}</button>)}
            <input type="date" className="inp data-livre" aria-label="Escolher data do prazo" value={v.prazo} onChange={e => set({ prazo: e.target.value })} /></div></div>
        <div className="campo"><label>Prioridade</label>
          <div className="escolha prioridades">{(Object.keys(PRIORIDADE) as Prioridade[]).map(k => <button key={k} type="button" data-p={k} className={v.prioridade === k ? 'on' : ''} onClick={() => set({ prioridade: k })}>{PRIORIDADE[k].rotulo}</button>)}</div></div>
      </div>

      <div className="col" style={{ gap: 12 }}>
        <button type="button" className={`recolher ${mais ? 'aberto' : ''}`} onClick={() => setMais(!mais)}><LuChevronRight size={15} />Mais opções{!mais && detalhes.length > 0 && <span className="muted" style={{ fontWeight: 400 }}>· {detalhes.join(', ')}</span>}<span className="muted" style={{ fontWeight: 400 }}>{!mais && !detalhes.length && '· início, responsável, encaminhamento e anexos'}</span></button>
        {mais && <>
          <div className="grade g3">
            <Campo rotulo="Início"><input type="date" className="inp" value={v.inicio} onChange={e => set({ inicio: e.target.value })} /></Campo>
            {podeResp && setorResp ? (gere(eu, setorResp, dados.setores)
              ? <Campo rotulo="Responsável"><SelecaoPessoa setorId={setorResp} valor={v.responsavel_id} onChange={x => set({ responsavel_id: x })} vazio="O gestor distribui depois" /></Campo>
              : <Campo rotulo="Responsável"><select className="inp" value={v.responsavel_id} onChange={e => set({ responsavel_id: e.target.value })}><option value="">O gestor distribui</option><option value={eu.id}>Eu mesmo</option></select></Campo>) : <span />}
            {modo === 'setor' && <Campo rotulo="Ao concluir, enviar para" ajuda={saidas.length ? undefined : 'Este setor não tem vínculos de saída.'}><select className="inp" value={v.encaminhar_para} onChange={e => set({ encaminhar_para: e.target.value })}>
              <option value="">Ninguém (termina aqui)</option>{saidas.map(d => <option key={d.setor.id} value={d.setor.id}>{d.setor.nome} — {d.modo === 'aceite' ? 'com aceite' : 'direto'}</option>)}</select></Campo>}
          </div>
          <div className="drop" onClick={() => arqRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); setArquivos(x => [...x, ...(Array.from(e.dataTransfer.files) as File[])]); }}>
            <LuPaperclip size={15} /> <b>Anexar arquivos</b> <span className="xs">clique ou arraste aqui</span></div>
          <input ref={arqRef} type="file" multiple hidden onChange={e => { setArquivos(x => [...x, ...(Array.from(e.target.files || []) as File[])]); e.target.value = ''; }} />
          {arquivos.length > 0 && <div className="row wrap">{arquivos.map((f, i) => <span key={i} className="chip"><LuPaperclip size={12} />{f.name} <span className="muted xs">{tamanhoArquivo(f.size)}</span><button className="btn fant icone p" aria-label={`Remover ${f.name}`} onClick={() => setArquivos(x => x.filter((_, j) => j !== i))}><LuX size={12} /></button></span>)}</div>}
        </>}
      </div>

      {resumo && <div className="proximo-passo" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
        {caminho.length > 0 && <Elo nos={caminho} grande />}
        <span className="sm" style={{ color: 'var(--text-2)' }}>{resumo}</span>
      </div>}
    </div>
  </Modal>;
}

export function ResumoPrazo({ a }: { a: Atividade }) {
  return <span className={`sm ${atrasada(a) ? '' : 'muted'}`} style={atrasada(a) ? { color: 'var(--red)', fontWeight: 650 } : undefined}><LuClock size={12} /> {fmtData(a.prazo)}</span>;
}
