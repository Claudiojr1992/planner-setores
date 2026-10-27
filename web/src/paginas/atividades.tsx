import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { LuDownload, LuFilterX, LuKanban, LuList, LuSend } from 'react-icons/lu';
import { useDados } from '../app/contexto';
import type { Rota } from '../app/rota';
import type { Atividade, Status } from '../lib/types';
import { PRIORIDADE, STATUS, aberta, atrasada, fmtData, ordenar, ehAdmin, setoresGeridos, gere, podeExecutar, destinosPermitidos, diaDe, addDias } from '../lib/regras';
import { Avatar, Campo, Painel, PillStatus, PontoSetor, Pri, Vazio } from '../ui/base';
import { Cartao, useAcoes } from '../ui/atividade';

const CHAVE_VISAO = 'planner.atividades.visao';

export function Atividades({ rota }: { rota: Rota }) {
  const { dados, eu, abrirAtividade } = useDados();
  const q0 = rota.query;
  const [f, setF] = useState({ q: q0.get('q') || '', setor: q0.get('setor') || '', status: q0.get('f') || 'abertas', resp: q0.get('resp') === 'eu' ? eu.id : q0.get('resp') || '', pri: '', fluxo: '' });
  useEffect(() => { setF(x => ({ ...x, q: q0.get('q') ?? x.q, setor: q0.get('setor') ?? x.setor, status: q0.get('f') ?? x.status, resp: q0.get('resp') === 'eu' ? eu.id : (q0.get('resp') ?? x.resp) })); }, [rota.query.toString()]); // eslint-disable-line
  const visiveis = useMemo(() => {
    // colaborador vê o próprio setor, o que é dele e o que solicitou; gestor/diretoria vê tudo
    if (ehAdmin(eu) || setoresGeridos(eu, dados.setores).length) return dados.atividades;
    return dados.atividades.filter(a => a.setor_id === eu.setor_id || a.responsavel_id === eu.id || a.criado_por === eu.id);
  }, [dados.atividades, eu, dados.setores]);
  const [visao, setVisao] = useState<'quadro' | 'lista'>(() => { try { return (localStorage.getItem(CHAVE_VISAO) as 'quadro' | 'lista') || 'quadro'; } catch { return 'quadro'; } });
  const trocarVisao = (v: 'quadro' | 'lista') => { setVisao(v); try { localStorage.setItem(CHAVE_VISAO, v); } catch { /* */ } };
  const lista = useMemo(() => {
    const t = f.q.trim().toLowerCase().replace(/^#/, '');
    return ordenar(visiveis.filter(a => {
      if (t && !(a.titulo.toLowerCase().includes(t) || String(a.numero) === t || (a.descricao || '').toLowerCase().includes(t))) return false;
      if (f.setor && a.setor_id !== f.setor) return false;
      if (f.resp && a.responsavel_id !== f.resp) return false;
      if (f.pri && a.prioridade !== f.pri) return false;
      if (f.fluxo && a.fluxo_id !== f.fluxo) return false;
      if (visao === 'quadro') return aberta(a) || (a.status === 'concluida' && (diaDe(a.concluido_em) || '') >= addDias(-14));
      if (f.status === 'abertas') return aberta(a);
      if (f.status === 'atrasadas') return atrasada(a);
      if (f.status === 'na_fila') return a.status === 'na_fila' || a.status === 'pausada';
      if (f.status && f.status !== 'todas') return a.status === f.status;
      return true;
    }));
  }, [visiveis, f, visao]);
  const nome = (id: string | null) => dados.perfis.find(p => p.id === id);
  const setor = (id: string | null) => dados.setores.find(s => s.id === id);
  const exportar = () => {
    const linhas = [['Número', 'Título', 'Setor', 'Responsável', 'Status', 'Prioridade', 'Início', 'Prazo', 'Concluída em', 'Solicitante', 'Fluxo']]
      .concat(lista.map(a => [String(a.numero), a.titulo, setor(a.setor_id)?.nome || '', nome(a.responsavel_id)?.nome || '', STATUS[a.status].rotulo, PRIORIDADE[a.prioridade].rotulo, fmtData(a.inicio), fmtData(a.prazo), a.concluido_em ? fmtData(a.concluido_em) : '', nome(a.criado_por)?.nome || '', dados.fluxos.find(x => x.id === a.fluxo_id)?.nome || '']));
    const csv = '﻿' + linhas.map(l => l.map(c => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const el = document.createElement('a'); el.href = u; el.download = `atividades-${new Date().toISOString().slice(0, 10)}.csv`; el.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  const limpo = !f.q && !f.setor && !f.resp && !f.pri && !f.fluxo && f.status === 'abertas';
  return <>
    <div className="cabeca"><div className="t"><h1>Atividades</h1><p>{lista.length} de {visiveis.length} atividades</p></div>
      <div className="sp"><div className="segmento"><button className={visao === 'quadro' ? 'on' : ''} onClick={() => trocarVisao('quadro')}><LuKanban size={14} /> Quadro</button><button className={visao === 'lista' ? 'on' : ''} onClick={() => trocarVisao('lista')}><LuList size={14} /> Lista</button></div>
        <button className="btn" onClick={exportar}><LuDownload size={15} />Exportar CSV</button></div></div>
    <Painel>
      <div className="filtros">
        <Campo rotulo="Buscar" classe="grow"><input className="inp" placeholder="Título, descrição ou número" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} /></Campo>
        {visao === 'lista' && <Campo rotulo="Situação"><select className="inp" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
          <option value="abertas">Todas abertas</option><option value="atrasadas">Atrasadas</option><option value="todas">Todas (inclui encerradas)</option>
          {(Object.keys(STATUS) as Status[]).map(k => <option key={k} value={k}>{STATUS[k].rotulo}</option>)}</select></Campo>}
        <Campo rotulo="Setor"><select className="inp" value={f.setor} onChange={e => setF({ ...f, setor: e.target.value })}><option value="">Todos</option>{dados.setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></Campo>
        <Campo rotulo="Responsável"><select className="inp" value={f.resp} onChange={e => setF({ ...f, resp: e.target.value })}><option value="">Todos</option>{dados.perfis.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.id === eu.id ? `${p.nome} (eu)` : p.nome}</option>)}</select></Campo>
        <Campo rotulo="Prioridade"><select className="inp" value={f.pri} onChange={e => setF({ ...f, pri: e.target.value })}><option value="">Todas</option>{Object.entries(PRIORIDADE).map(([k, p]) => <option key={k} value={k}>{p.rotulo}</option>)}</select></Campo>
        <Campo rotulo="Fluxo"><select className="inp" value={f.fluxo} onChange={e => setF({ ...f, fluxo: e.target.value })}><option value="">Todos</option>{dados.fluxos.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></Campo>
        {!limpo && <button className="btn fant" onClick={() => setF({ q: '', setor: '', status: 'abertas', resp: '', pri: '', fluxo: '' })}><LuFilterX size={15} />Limpar</button>}
      </div>
    </Painel>
    {visao === 'quadro' ? <Quadro lista={lista} /> : <Painel sem>
      {lista.length === 0 ? <div style={{ padding: 18 }}><Vazio>Nenhuma atividade encontrada com estes filtros.</Vazio></div> :
        <div className="tabela-wrap"><table className="tb"><thead><tr><th>Nº</th><th>Atividade</th><th>Setor</th><th>Responsável</th><th>Situação</th><th>Prioridade</th><th>Prazo</th></tr></thead>
          <tbody>{lista.map(a => { const r = nome(a.responsavel_id); const s = setor(a.setor_id); const fx = dados.fluxos.find(x => x.id === a.fluxo_id);
            return <tr key={a.id} className="clic" onClick={() => abrirAtividade(a.id)}>
              <td className="num muted">#{a.numero}</td>
              <td style={{ maxWidth: 380 }}><div style={{ fontWeight: 600 }} className="ellipsis">{a.titulo}</div>{fx && <div className="xs muted ellipsis">{fx.nome}</div>}</td>
              <td><span className="row"><PontoSetor s={s} />{s?.nome}</span></td>
              <td>{r ? <span className="row"><Avatar p={r} setores={dados.setores} tam="p" />{r.nome}</span> : <span className="muted">—</span>}</td>
              <td><PillStatus s={a.status} /></td><td><Pri p={a.prioridade} /></td>
              <td className="num" style={atrasada(a) ? { color: 'var(--red)', fontWeight: 650 } : undefined}>{fmtData(a.prazo)}</td>
            </tr>; })}</tbody></table></div>}
    </Painel>}
  </>;
}

/* ===================== Quadro estilo Trello ===================== */
const COLUNAS: Status[] = ['aguardando_aceite', 'a_distribuir', 'na_fila', 'em_andamento', 'pausada', 'concluida'];
const DICAS: Partial<Record<Status, string>> = {
  aguardando_aceite: 'Chegaram de outros setores', a_distribuir: 'Sem responsável', na_fila: 'Prontas para começar',
  em_andamento: 'Sendo executadas', pausada: 'Interrompidas', concluida: 'Últimos 14 dias',
};

function Quadro({ lista }: { lista: Atividade[] }) {
  const { dados, eu, toast, abrirAtividade } = useDados();
  const ac = useAcoes();
  const [arrastando, setArrastando] = useState<Atividade | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const gestor = (a: Atividade) => gere(eu, a.setor_id, dados.setores);

  /** Se a mudança de coluna é permitida e qual ação ela dispara. */
  const acao = (a: Atividade, para: Status): { ok: boolean; motivo?: string; fazer?: () => void } => {
    const de = a.status;
    if (de === para) return { ok: false };
    if (de === 'concluida') return gestor(a) && para !== 'aguardando_aceite' ? { ok: true, fazer: () => ac.reabrir(a) } : { ok: false, motivo: 'Somente o gestor do setor reabre atividades concluídas.' };
    if (para === 'aguardando_aceite') return { ok: false, motivo: 'Atividades só entram em “Aguardando aceite” quando enviadas por outro setor.' };
    if (de === 'aguardando_aceite') {
      if (!gestor(a)) return { ok: false, motivo: 'Somente o gestor do setor pode aceitar.' };
      if (para === 'a_distribuir' || para === 'na_fila') return { ok: true, fazer: () => ac.aceitar(a) };
      return { ok: false, motivo: 'Aceite a solicitação antes de iniciar.' };
    }
    if (para === 'em_andamento') return ['na_fila', 'pausada', 'a_distribuir'].includes(de) && (podeExecutar(eu, a, dados.setores) || (!a.responsavel_id && eu.setor_id === a.setor_id))
      ? { ok: true, fazer: () => ac.iniciar(a) } : { ok: false, motivo: 'Somente o responsável ou o gestor pode iniciar.' };
    if (para === 'pausada') return de === 'em_andamento' && podeExecutar(eu, a, dados.setores) ? { ok: true, fazer: () => ac.pausar(a) } : { ok: false, motivo: 'Só é possível pausar o que está em andamento.' };
    if (para === 'concluida') return podeExecutar(eu, a, dados.setores) && de !== 'a_distribuir' ? { ok: true, fazer: () => ac.concluir(a) } : { ok: false, motivo: de === 'a_distribuir' ? 'Distribua ou assuma a atividade antes de concluir.' : 'Somente o responsável ou o gestor pode concluir.' };
    if (para === 'a_distribuir') return gestor(a) ? { ok: true, fazer: () => ac.distribuir(a, null) } : { ok: false, motivo: 'Somente o gestor devolve para distribuição.' };
    if (para === 'na_fila') {
      if (de === 'a_distribuir') return gestor(a) ? { ok: true, fazer: () => { toast('Escolha a pessoa em “Distribuir”.', 'info'); abrirAtividade(a.id); } } : { ok: false, motivo: 'Somente o gestor distribui.' };
      return { ok: false, motivo: 'Para voltar à fila, pause a atividade.' };
    }
    return { ok: false };
  };
  const destinos = arrastando ? destinosPermitidos(eu, dados, arrastando.setor_id).filter(d => d.modo !== 'proprio') : [];
  const podeEnviar = (a: Atividade) => aberta(a) && a.status !== 'aguardando_aceite' && (gestor(a) || a.responsavel_id === eu.id);
  const pegar = (e: DragEvent) => { const id = (e.target as HTMLElement).closest?.('[data-atividade]')?.getAttribute('data-atividade'); setArrastando(dados.atividades.find(x => x.id === id) || null); };
  const soltar = () => { setArrastando(null); setAlvo(null); };
  const zona = (chave: string, ok: boolean, executar: () => void) => ({
    onDragOver: (e: DragEvent) => { if (!ok) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setAlvo(chave); },
    onDragLeave: (e: DragEvent) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setAlvo(a => a === chave ? null : a); },
    onDrop: (e: DragEvent) => { e.preventDefault(); soltar(); executar(); },
  });

  return <div className="quadro-wrap" onDragStart={pegar} onDragEnd={soltar}>
    <div className={`faixa-setores ${arrastando ? 'ativa' : ''}`}>
      <span className="row sm" style={{ fontWeight: 650, whiteSpace: 'nowrap' }}><LuSend size={15} />{arrastando ? 'Solte em um setor para enviar:' : 'Arraste um cartão até um setor para enviar'}</span>
      {dados.setores.map(s => {
        const d = destinos.find(x => x.setor.id === s.id);
        const ok = !!arrastando && !!d && podeEnviar(arrastando);
        const proprio = arrastando?.setor_id === s.id;
        return <div key={s.id} className={`setor-alvo ${ok ? 'ok' : arrastando ? 'nao' : ''} ${alvo === 's' + s.id ? 'sobre' : ''}`} style={{ ['--c' as string]: s.cor }}
          title={!arrastando ? s.nome : proprio ? 'Setor atual da atividade' : !d ? 'Sem vínculo com este setor' : !podeEnviar(arrastando) ? 'Somente o gestor ou o responsável pode enviar' : d.modo === 'aceite' ? 'Vai para o aceite do gestor' : 'Entrada direta'}
          {...zona('s' + s.id, ok, () => arrastando && ac.solicitar(arrastando, s.id))}>
          <PontoSetor s={s} />{s.nome}{ok && d && <span className="xs">{d.modo === 'aceite' ? '· aceite' : '· direto'}</span>}
        </div>;
      })}
    </div>
    <div className="quadro">
      {COLUNAS.map(st => {
        const its = ordenar(lista.filter(a => a.status === st));
        const r = arrastando ? acao(arrastando, st) : { ok: false };
        return <div key={st} className={`coluna quadro-col ${arrastando ? (r.ok ? 'pode' : 'nao-pode') : ''}`} title={arrastando && !r.ok && r.motivo ? r.motivo : undefined}>
          <div className="coluna-h"><span className={`pill ponto t-${STATUS[st].tom}`}>{STATUS[st].rotulo}</span><span className="xs muted grow ellipsis">{DICAS[st]}</span><span className="num" style={{ fontWeight: 700 }}>{its.length}</span></div>
          <div className={`coluna-b ${alvo === st ? 'solta' : ''}`} {...zona(st, r.ok, () => { if (arrastando && r.fazer) r.fazer(); })}>
            {its.length ? its.map(a => <Cartao key={a.id} a={a} arrastavel acoes={st !== 'concluida'} mostrarSetor />) : <div className="xs muted" style={{ textAlign: 'center', padding: 18 }}>{arrastando && r.ok ? 'Solte aqui' : 'Nenhuma atividade'}</div>}
            {arrastando && !r.ok && r.motivo && arrastando.status !== st && <div className="xs" style={{ color: 'var(--muted)', textAlign: 'center' }}>{r.motivo}</div>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

