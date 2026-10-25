import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  LuArrowRight, LuCheck, LuPlay, LuPause, LuX, LuPaperclip, LuMessageSquare, LuHistory, LuFileText, LuTrash2,
  LuDownload, LuPencil, LuRotateCcw, LuUpload, LuCalendar, LuUser, LuGitBranch, LuSend, LuWorkflow, LuBuilding2,
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
import { Avatar, Aviso, Campo, Modal, PillStatus, PontoSetor, Pri, Suspenso, Vazio, tamanhoArquivo } from './base';

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

/* ===================== cartão ===================== */
export function Cartao({ a, arrastavel = false, acoes = true, mostrarSetor = false, mostrarResp = true }: { a: Atividade; arrastavel?: boolean; acoes?: boolean; mostrarSetor?: boolean; mostrarResp?: boolean }) {
  const { dados, abrirAtividade } = useDados();
  const s = dados.setores.find(x => x.id === a.setor_id);
  const r = dados.perfis.find(x => x.id === a.responsavel_id);
  const o = a.origem_id ? dados.atividades.find(x => x.id === a.origem_id) : null;
  const f = a.fluxo_id ? dados.fluxos.find(x => x.id === a.fluxo_id) : null;
  const etapa = f && a.etapa_id ? f.definicao.nos.find(n => n.id === a.etapa_id) : null;
  const prox = f && a.etapa_id ? proximosNos(f, a.etapa_id) : a.encaminhar_para ? [{ id: 'x', setor_id: a.encaminhar_para, titulo: '' }] : [];
  const late = atrasada(a), hj = venceHoje(a);
  const aus = r ? ausenciaAtiva(dados.ausencias, r.id) : null;
  return (
    <div className="cartao" style={{ ['--c' as string]: s?.cor }} draggable={arrastavel || undefined} data-atividade={a.id}
      onDragStart={e => { e.dataTransfer.setData('text/atividade', a.id); e.dataTransfer.effectAllowed = 'move'; (e.currentTarget as HTMLElement).classList.add('arrastando'); }}
      onDragEnd={e => (e.currentTarget as HTMLElement).classList.remove('arrastando')}
      onClick={() => abrirAtividade(a.id)}>
      <div className="topo"><span className="numero">#{a.numero}</span><PillStatus s={a.status} /><span className="sp" /><Pri p={a.prioridade} /></div>
      <div className="titulo">{a.titulo}</div>
      {(mostrarSetor || etapa) && <div className="meta">{mostrarSetor && <><PontoSetor s={s} />{s?.nome}</>}{etapa && <span className="ellipsis">{mostrarSetor ? '· ' : ''}Etapa: {etapa.titulo}</span>}</div>}
      {(o || prox.length > 0 || f) && <div className="rota">
        {f && <span className="fx" title={`Fluxo: ${f.nome}`}><LuWorkflow size={11} />{f.nome}</span>}
        {o && o.setor_id !== a.setor_id && <span className="de" title="Veio de">↩ {dados.setores.find(x => x.id === o.setor_id)?.nome}</span>}
        {prox.map(n => <span key={n.id} title="Próxima etapa">→ {dados.setores.find(x => x.id === n.setor_id)?.nome}</span>)}
      </div>}
      <div className="meta">
        {mostrarResp && (r ? <><Avatar p={r} setores={dados.setores} tam="p" /><span>{primeiroNome(r.nome)}</span>{aus && <span className="pill t-purple">ausente</span>}</> : <span>Sem responsável</span>)}
        <span className={`prazo ${late ? 'atraso' : hj ? 'hoje' : ''}`}><LuCalendar size={12} />{late ? 'Atrasada · ' : hj ? 'Hoje · ' : ''}{fmtDataCurta(a.prazo)}</span>
      </div>
      {acoes && <AcoesRapidas a={a} />}
    </div>
  );
}

function AcoesRapidas({ a }: { a: Atividade }) {
  const { dados, eu } = useDados();
  const ac = useAcoes();
  const b: ReactNode[] = [];
  const pare = (fn: () => void) => (e: { stopPropagation(): void }) => { e.stopPropagation(); fn(); };
  const gestor = gere(eu, a.setor_id, dados.setores);
  if (a.status === 'aguardando_aceite') {
    if (gestor) b.push(<button key="ac" className="btn p pri" onClick={pare(() => ac.aceitar(a))}><LuCheck size={14} />Aceitar</button>,
      <button key="rc" className="btn p" onClick={pare(() => ac.recusar(a))}>Recusar</button>);
  } else if (a.status === 'a_distribuir') {
    if (gestor) b.push(<span key="d" onClick={e => e.stopPropagation()}><MenuDistribuir a={a} /></span>);
    if (eu.setor_id === a.setor_id) b.push(<button key="pg" className="btn p" onClick={pare(() => ac.iniciar(a))}><LuPlay size={13} />Assumir e iniciar</button>);
  } else if (podeExecutar(eu, a, dados.setores)) {
    if (a.status === 'na_fila' || a.status === 'pausada') b.push(<button key="i" className="btn p" onClick={pare(() => ac.iniciar(a))}><LuPlay size={13} />{a.status === 'pausada' ? 'Retomar' : 'Iniciar'}</button>);
    if (a.status === 'em_andamento') b.push(<button key="p" className="btn p" onClick={pare(() => ac.pausar(a))}><LuPause size={13} />Pausar</button>);
    if (aberta(a)) b.push(<button key="c" className={`btn p ${a.status === 'em_andamento' ? 'pri' : ''}`} onClick={pare(() => ac.concluir(a))}><LuCheck size={14} />Concluir</button>);
  }
  if (aberta(a) && a.status !== 'aguardando_aceite' && (gestor || a.responsavel_id === eu.id)) b.push(<span key="env" onClick={e => e.stopPropagation()}><MenuEnviar a={a} /></span>);
  return b.length ? <div className="acoes">{b}</div> : null;
}

/** Envia (vincula) a atividade para outro setor com vínculo a partir do setor dela. */
export function MenuEnviar({ a }: { a: Atividade }) {
  const { dados, eu } = useDados();
  const ac = useAcoes();
  const destinos = destinosPermitidos(eu, dados, a.setor_id).filter(d => d.modo !== 'proprio');
  if (!destinos.length) return null;
  return <Suspenso alinhar="esq" gatilho={abrir => <button className="btn p" title="Enviar para outro setor" onClick={abrir}><LuSend size={13} />Enviar</button>}>
    {fechar => <>
      <div className="xs muted" style={{ padding: '4px 10px' }}>Enviar para o setor</div>
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
      <div className="xs muted" style={{ padding: '4px 10px' }}>Atribuir a</div>
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

  const s = dados.setores.find(x => x.id === a.setor_id);
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
          <div className="row sm muted wrap"><PontoSetor s={s} />{s?.nome}{etapa && <> · Etapa “{etapa.titulo}”</>}{f && <> · <LuWorkflow size={13} />{f.nome}</>}</div>
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
          {a.status === 'aguardando_aceite' && <Aviso tipo="atencao">Enviada por <b>{pessoa(a.criado_por)?.nome}</b>{a.solicitante_setor_id && <> ({dados.setores.find(x => x.id === a.solicitante_setor_id)?.nome})</>}. {gestor ? 'Aceite para colocar na fila do setor ou recuse explicando o motivo.' : `Aguardando o aceite de ${pessoa(s?.gestor_id)?.nome || 'gestor do setor'}.`}</Aviso>}
          {a.status === 'recusada' && a.motivo && <Aviso tipo="erro"><b>Recusada:</b> {a.motivo}</Aviso>}
          {a.status === 'pausada' && a.motivo && <Aviso tipo="info"><b>Pausada:</b> {a.motivo}</Aviso>}
          {a.status === 'cancelada' && a.motivo && <Aviso tipo="erro"><b>Cancelada:</b> {a.motivo}</Aviso>}
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
  const arqRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<typeof v>) => setV(x => ({ ...x, ...p }));
  const trocarModo = (m: NovaAtividade['modo']) => {
    setModo(m);
    if (m === 'setor') set({ setor_id: eu.setor_id && proprios.some(p => p.setor.id === eu.setor_id) ? eu.setor_id : proprios[0]?.setor.id || '', responsavel_id: '' });
    if (m === 'solicitar') set({ setor_id: externos[0]?.setor.id || '', responsavel_id: '' });
  };
  const setorExec = dados.setores.find(s => s.id === v.setor_id);
  const destinoSel = destinos.find(d => d.setor.id === v.setor_id);
  const fluxo = dados.fluxos.find(f => f.id === v.fluxo_id);
  const etapas = fluxo ? etapasEmOrdem(fluxo) : [];
  const saidas = destinosPermitidos(eu, dados, v.setor_id || null).filter(d => d.modo !== 'proprio');
  const gestorExec = dados.perfis.find(p => p.id === setorExec?.gestor_id);

  let resumo: ReactNode = null;
  if (modo === 'fluxo' && fluxo) resumo = <>O processo <b>{fluxo.nome}</b> começa em {etapas.length ? <b>{dados.setores.find(s => s.id === etapas[0].setor_id)?.nome}</b> : '—'} e passa por {etapas.length} etapa(s). Cada setor recebe a atividade automaticamente quando a etapa anterior for concluída{etapas.some(e => e.requer_aceite !== false) ? ', com aceite do gestor quando configurado' : ''}.</>;
  else if (modo === 'solicitar' && destinoSel) resumo = destinoSel.modo === 'aceite'
    ? <>A solicitação vai para o <b>aceite de {gestorExec?.nome || 'gestor'}</b> ({setorExec?.nome}). Você será avisado quando for aceita ou recusada.</>
    : <>A solicitação entra direto em <b>{setorExec?.nome}</b> para distribuição pelo gestor.</>;
  else if (modo === 'setor') resumo = v.responsavel_id ? <>A atividade vai para a fila de <b>{dados.perfis.find(p => p.id === v.responsavel_id)?.nome}</b>.</> : <>A atividade fica <b>a distribuir</b> no painel de {setorExec?.nome} até o gestor atribuir.</>;

  const submeter = async () => {
    setSalvando(true);
    const t = await enviar({ modo, titulo: v.titulo, descricao: v.descricao, prioridade: v.prioridade, inicio: v.inicio, prazo: v.prazo,
      setor_id: modo === 'fluxo' ? null : v.setor_id, responsavel_id: v.responsavel_id || null, fluxo_id: modo === 'fluxo' ? v.fluxo_id : null,
      encaminhar_para: modo === 'setor' ? v.encaminhar_para || null : null, arquivos });
    setSalvando(false);
    if (t) toast(t);
  };
  const podeResp = modo === 'setor' || (modo === 'fluxo' && etapas[0] && (etapas[0].setor_id === eu.setor_id || gere(eu, etapas[0].setor_id, dados.setores)));
  const setorResp = modo === 'fluxo' ? etapas[0]?.setor_id || '' : v.setor_id;
  const invalido = v.titulo.trim().length < 3 || (modo !== 'fluxo' && !v.setor_id) || (modo === 'fluxo' && !fluxo);

  return <Modal titulo="Nova solicitação" sub="Escolha como a demanda vai entrar no fluxo de trabalho" onFechar={onFechar} tam="largo"
    rodape={<><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" disabled={invalido || salvando} onClick={submeter}>{salvando ? 'Enviando…' : modo === 'solicitar' ? <><LuSend size={14} />Enviar solicitação</> : modo === 'fluxo' ? <><LuWorkflow size={15} />Iniciar processo</> : <><LuCheck size={15} />Criar atividade</>}</button></>}>
    <div className="opcoes">
      <button className={`opcao ${modo === 'setor' ? 'on' : ''}`} disabled={!proprios.length} style={!proprios.length ? { opacity: .5 } : undefined} onClick={() => trocarModo('setor')}><span className="ic"><LuInbox size={17} /></span><b>Atividade do meu setor</b><span>Entra na fila do seu setor para distribuição.</span></button>
      <button className={`opcao ${modo === 'solicitar' ? 'on' : ''}`} disabled={!externos.length} style={!externos.length ? { opacity: .5 } : undefined} onClick={() => trocarModo('solicitar')}><span className="ic"><LuBuilding2 size={17} /></span><b>Solicitar a outro setor</b><span>{externos.length ? 'Enviada ao gestor do setor vinculado.' : 'Seu setor ainda não tem vínculos.'}</span></button>
      <button className={`opcao ${modo === 'fluxo' ? 'on' : ''}`} disabled={!fluxos.length} style={!fluxos.length ? { opacity: .5 } : undefined} onClick={() => trocarModo('fluxo')}><span className="ic"><LuWorkflow size={17} /></span><b>Iniciar um processo</b><span>{fluxos.length ? 'Segue um fluxo desenhado entre setores.' : 'Nenhum fluxo publicado.'}</span></button>
    </div>
    <div className="grade">
      {modo === 'fluxo' ? <Campo rotulo="Fluxo de processo" classe="full"><select className="inp" value={v.fluxo_id} onChange={e => set({ fluxo_id: e.target.value })}>{fluxos.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></Campo>
        : <Campo rotulo={modo === 'setor' ? 'Setor' : 'Para qual setor?'} classe="full"><select className="inp" value={v.setor_id} onChange={e => set({ setor_id: e.target.value, responsavel_id: '', encaminhar_para: '' })}>
          {(modo === 'setor' ? proprios : externos).map(d => <option key={d.setor.id} value={d.setor.id}>{d.setor.nome}{modo === 'solicitar' ? (d.modo === 'aceite' ? ' — requer aceite' : ' — entrada direta') : ''}</option>)}</select></Campo>}
      {modo === 'fluxo' && fluxo && <div className="full trilha">{etapas.map((e, i) => <span key={e.id} className="row" style={{ gap: 4 }}>{i > 0 && <span className="sep"><LuChevronRight size={14} /></span>}<span className="chip"><PontoSetor s={dados.setores.find(s => s.id === e.setor_id)} />{dados.setores.find(s => s.id === e.setor_id)?.nome}<span className="muted">· {e.titulo}{e.prazo_dias ? ` · ${e.prazo_dias}d` : ''}</span></span></span>)}</div>}
      <Campo rotulo={modo === 'fluxo' ? 'Nome desta execução *' : 'Título *'} classe="full"><input className="inp" autoFocus value={v.titulo} onChange={e => set({ titulo: e.target.value })} placeholder={modo === 'fluxo' ? `Ex.: ${fluxo?.nome || 'Processo'} – Cliente X` : 'Ex.: Apuração de ICMS de outubro'} /></Campo>
      <Campo rotulo="Descrição" classe="full"><textarea className="inp" value={v.descricao} onChange={e => set({ descricao: e.target.value })} placeholder="O que precisa ser feito, informações e critérios de aceite" /></Campo>
    </div>
    <div className="grade g3">
      <Campo rotulo="Prioridade"><select className="inp" value={v.prioridade} onChange={e => set({ prioridade: e.target.value as Prioridade })}>{Object.entries(PRIORIDADE).map(([k, p]) => <option key={k} value={k}>{p.rotulo}</option>)}</select></Campo>
      <Campo rotulo="Início"><input type="date" className="inp" value={v.inicio} onChange={e => set({ inicio: e.target.value })} /></Campo>
      <Campo rotulo="Prazo" ajuda={modo === 'fluxo' ? 'Etapas com prazo próprio usam o definido no fluxo.' : undefined}><input type="date" className="inp" value={v.prazo} onChange={e => set({ prazo: e.target.value })} /></Campo>
    </div>
    <div className="grade">
      {podeResp && setorResp && (gere(eu, setorResp, dados.setores)
        ? <Campo rotulo="Responsável"><SelecaoPessoa setorId={setorResp} valor={v.responsavel_id} onChange={x => set({ responsavel_id: x })} vazio="— distribuir depois —" /></Campo>
        : <Campo rotulo="Responsável"><select className="inp" value={v.responsavel_id} onChange={e => set({ responsavel_id: e.target.value })}><option value="">— gestor distribui —</option><option value={eu.id}>Eu mesmo ({eu.nome})</option></select></Campo>)}
      {modo === 'setor' && <Campo rotulo="Encaminhar ao concluir para (opcional)" ajuda={saidas.length ? undefined : 'Este setor não tem vínculos de saída.'}><select className="inp" value={v.encaminhar_para} onChange={e => set({ encaminhar_para: e.target.value })}>
        <option value="">Não encaminhar</option>{saidas.map(d => <option key={d.setor.id} value={d.setor.id}>{d.setor.nome} — {d.modo === 'aceite' ? 'requer aceite' : 'entrada direta'}</option>)}</select></Campo>}
    </div>
    <div className="col">
      <span className="rotulo">Anexos</span>
      <div className="drop" onClick={() => arqRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); setArquivos(x => [...x, ...(Array.from(e.dataTransfer.files) as File[])]); }}>
        <LuPaperclip size={16} /> <b>Adicionar arquivos</b> <span className="xs">(clique ou arraste)</span></div>
      <input ref={arqRef} type="file" multiple hidden onChange={e => { setArquivos(x => [...x, ...(Array.from(e.target.files || []) as File[])]); e.target.value = ''; }} />
      {arquivos.length > 0 && <div className="row wrap">{arquivos.map((f, i) => <span key={i} className="chip"><LuPaperclip size={12} />{f.name} <span className="muted xs">{tamanhoArquivo(f.size)}</span><button className="btn fant icone p" onClick={() => setArquivos(x => x.filter((_, j) => j !== i))}><LuX size={12} /></button></span>)}</div>}
    </div>
    {resumo && <Aviso tipo={modo === 'solicitar' && destinoSel?.modo === 'aceite' ? 'atencao' : 'info'}><b>O que vai acontecer: </b>{resumo}</Aviso>}
  </Modal>;
}

export function ResumoPrazo({ a }: { a: Atividade }) {
  return <span className={`sm ${atrasada(a) ? '' : 'muted'}`} style={atrasada(a) ? { color: 'var(--red)', fontWeight: 650 } : undefined}><LuClock size={12} /> {fmtData(a.prazo)}</span>;
}
