import { useMemo, useState } from 'react';
import { LuPlus, LuTreePalm, LuUndo2, LuTrash2, LuArrowRight, LuUsers } from 'react-icons/lu';
import { useDados } from '../app/contexto';
import type { Atividade, Ausencia, TipoAusencia } from '../lib/types';
import { addDias, ausenciaNoPeriodo, fmtData, ordenar, setoresGeridos, situacaoAusencia, TIPO_AUSENCIA } from '../lib/regras';
import type { Delegacao } from '../lib/servico';
import { Avatar, Aviso, Campo, Modal, Painel, PillStatus, Vazio } from '../ui/base';

export function Ausencias() {
  const { dados, eu, svc, executar, confirmar } = useDados();
  const geridos = setoresGeridos(eu, dados.setores);
  const equipe = dados.perfis.filter(p => p.ativo && p.setor_id && geridos.includes(p.setor_id));
  const [filtro, setFiltro] = useState<'ativas' | 'todas'>('ativas');
  const [nova, setNova] = useState(false);
  const [delegar, setDelegar] = useState<Ausencia | null>(null);
  const lista = dados.ausencias.filter(a => equipe.some(p => p.id === a.pessoa_id) && (filtro === 'todas' || situacaoAusencia(a) !== 'encerrada' || (a.delegado && !a.devolvido)))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const pessoa = (id: string | null) => dados.perfis.find(p => p.id === id);
  return <>
    <div className="cabeca"><div className="t"><h1>Férias e delegação</h1><p>Programe ausências da equipe e redistribua as atividades pendentes, a iniciar e em andamento.</p></div>
      <div className="sp"><div className="segmento"><button className={filtro === 'ativas' ? 'on' : ''} onClick={() => setFiltro('ativas')}>Programadas e em curso</button><button className={filtro === 'todas' ? 'on' : ''} onClick={() => setFiltro('todas')}>Histórico</button></div>
        <button className="btn pri" onClick={() => setNova(true)} disabled={!equipe.length}><LuPlus size={16} />Programar ausência</button></div></div>
    <Painel sem>
      {lista.length === 0 ? <div style={{ padding: 18 }}><Vazio icone={<LuTreePalm size={28} />}>Nenhuma ausência {filtro === 'ativas' ? 'programada' : 'registrada'}.</Vazio></div> :
        <div className="tabela-wrap"><table className="tb"><thead><tr><th>Pessoa</th><th>Tipo</th><th>Período</th><th>Substituto</th><th>Situação</th><th>Atividades</th><th /></tr></thead>
          <tbody>{lista.map(a => {
            const p = pessoa(a.pessoa_id); const sit = situacaoAusencia(a);
            const pend = svc.pendentesDe(a.pessoa_id).length; const deleg = svc.delegadasDe(a).length;
            return <tr key={a.id}>
              <td><span className="row"><Avatar p={p} setores={dados.setores} /><span><b>{p?.nome}</b><div className="xs muted">{dados.setores.find(s => s.id === p?.setor_id)?.nome}</div></span></span></td>
              <td>{TIPO_AUSENCIA[a.tipo]}</td>
              <td className="num">{fmtData(a.inicio)} → {fmtData(a.fim)}<div className="xs muted">{Math.round((new Date(a.fim).getTime() - new Date(a.inicio).getTime()) / 86400000) + 1} dias</div></td>
              <td>{pessoa(a.substituto_id)?.nome || <span className="muted">—</span>}</td>
              <td><span className={`pill ${sit === 'em_curso' ? 't-purple' : sit === 'programada' ? 't-blue' : 't-gray'}`}>{sit === 'em_curso' ? 'Em curso' : sit === 'programada' ? 'Programada' : 'Encerrada'}</span></td>
              <td className="sm">{deleg > 0 ? <span className="pill t-accent">{deleg} delegada(s)</span> : a.devolvido ? <span className="muted">devolvidas</span> : pend > 0 && sit !== 'encerrada' ? <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{pend} com a pessoa</span> : <span className="muted">—</span>}</td>
              <td className="d"><div className="row" style={{ justifyContent: 'flex-end' }}>
                {pend > 0 && sit !== 'encerrada' && <button className="btn p pri" onClick={() => setDelegar(a)}><LuUsers size={13} />Delegar</button>}
                {deleg > 0 && <button className="btn p" onClick={async () => { if (await confirmar({ titulo: 'Devolver atividades', texto: <>Devolver {deleg} atividade(s) para <b>{p?.nome}</b>?</>, ok: 'Devolver' })) executar(() => svc.devolver(a), 'Atividades devolvidas'); }}><LuUndo2 size={13} />Devolver</button>}
                <button className="btn p fant perigo" title="Excluir" onClick={async () => { if (await confirmar({ titulo: 'Excluir ausência', perigo: true, ok: 'Excluir', texto: deleg ? 'As atividades delegadas continuarão com os substitutos. Use “Devolver” antes, se necessário.' : 'Remover este registro de ausência?' })) executar(() => svc.excluirAusencia(a), 'Ausência excluída'); }}><LuTrash2 size={14} /></button>
              </div></td>
            </tr>; })}</tbody></table></div>}
    </Painel>
    {nova && <ModalAusencia onFechar={() => setNova(false)} />}
    {delegar && <ModalDelegar aus={delegar} onFechar={() => setDelegar(null)} />}
  </>;
}

function TabelaDelegacao({ atividades, setorPessoa, pessoaId, padrao, inicio, fim, valor, onChange }: {
  atividades: Atividade[]; setorPessoa: string | null; pessoaId: string; padrao: string; inicio: string; fim: string;
  valor: Record<string, string | undefined>; onChange: (v: Record<string, string | undefined>) => void;
}) {
  const { dados } = useDados();
  const colegas = dados.perfis.filter(p => p.ativo && p.setor_id === setorPessoa && p.id !== pessoaId);
  if (!atividades.length) return <Aviso tipo="ok">Esta pessoa não tem atividades pendentes, a iniciar ou em andamento.</Aviso>;
  return <div className="col" style={{ gap: 8 }}>
    <div className="row"><span className="secao-titulo grow">Atividades com a pessoa ({atividades.length})</span>
      <button className="btn p fant" onClick={() => onChange(Object.fromEntries(atividades.map(a => [a.id, padrao || ''])))}>Todas para o substituto</button>
      <button className="btn p fant" onClick={() => onChange({})}>Nenhuma</button></div>
    <div className="tabela-wrap" style={{ border: '1px solid var(--border)', borderRadius: 10 }}><table className="tb"><thead><tr><th>Atividade</th><th>Situação</th><th>Prazo</th><th>Delegar para</th></tr></thead>
      <tbody>{atividades.map(a => <tr key={a.id}>
        <td><b>#{a.numero}</b> {a.titulo}</td><td><PillStatus s={a.status} /></td><td className="num">{fmtData(a.prazo)}</td>
        <td><select className="inp" style={{ minWidth: 190 }} value={valor[a.id] ?? 'manter'} onChange={e => { const n = { ...valor }; if (e.target.value === 'manter') delete n[a.id]; else n[a.id] = e.target.value; onChange(n); }}>
          <option value="manter">Manter com a pessoa</option><option value="">Devolver para distribuição</option>
          {colegas.map(c => { const conf = ausenciaNoPeriodo(dados.ausencias, c.id, inicio, fim); return <option key={c.id} value={c.id}>{c.nome}{conf ? ' (também ausente)' : ''}</option>; })}
        </select></td></tr>)}</tbody></table></div>
    {atividades.some(a => a.status === 'em_andamento' && valor[a.id]) && <span className="xs muted">Atividades em andamento delegadas voltam para “Na fila” do substituto.</span>}
  </div>;
}
const paraDelegacoes = (v: Record<string, string | undefined>): Delegacao[] => Object.entries(v).filter(([, x]) => x !== undefined).map(([atividade_id, para]) => ({ atividade_id, para: para || null }));

function ModalAusencia({ onFechar }: { onFechar: () => void }) {
  const { dados, eu, svc, executar } = useDados();
  const geridos = setoresGeridos(eu, dados.setores);
  const equipe = dados.perfis.filter(p => p.ativo && p.setor_id && geridos.includes(p.setor_id));
  const [v, setV] = useState({ pessoa_id: equipe[0]?.id || '', tipo: 'ferias' as TipoAusencia, inicio: addDias(1), fim: addDias(30), substituto_id: '', observacao: '' });
  const [deleg, setDeleg] = useState<Record<string, string | undefined>>({});
  const p = dados.perfis.find(x => x.id === v.pessoa_id);
  const pend = useMemo(() => ordenar(svc.pendentesDe(v.pessoa_id)), [v.pessoa_id, dados.atividades]); // eslint-disable-line
  const colegas = dados.perfis.filter(x => x.ativo && x.setor_id === p?.setor_id && x.id !== v.pessoa_id);
  const conflito = v.pessoa_id ? ausenciaNoPeriodo(dados.ausencias, v.pessoa_id, v.inicio, v.fim) : null;
  const trocarPessoa = (id: string) => { setV({ ...v, pessoa_id: id, substituto_id: '' }); setDeleg({}); };
  const trocarSubst = (id: string) => { setV({ ...v, substituto_id: id }); setDeleg(Object.fromEntries(pend.map(a => [a.id, id || '']))); };
  return <Modal titulo="Programar ausência" sub="Registre o período e decida o que acontece com as atividades da pessoa" tam="largo" onFechar={onFechar}
    rodape={<><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" disabled={!v.pessoa_id || !!conflito || v.fim < v.inicio} onClick={async () => {
      const r = await executar(() => svc.registrarAusencia({ ...v, substituto_id: v.substituto_id || null, delegacoes: paraDelegacoes(deleg) }), `Ausência registrada${Object.keys(deleg).length ? ` e ${Object.keys(deleg).length} atividade(s) delegadas` : ''}`);
      if (r) onFechar();
    }}><LuTreePalm size={15} />Salvar{Object.keys(deleg).length ? ' e delegar' : ''}</button></>}>
    <div className="grade">
      <Campo rotulo="Pessoa"><select className="inp" value={v.pessoa_id} onChange={e => trocarPessoa(e.target.value)}>{equipe.map(x => <option key={x.id} value={x.id}>{x.nome} — {dados.setores.find(s => s.id === x.setor_id)?.nome}</option>)}</select></Campo>
      <Campo rotulo="Tipo"><select className="inp" value={v.tipo} onChange={e => setV({ ...v, tipo: e.target.value as TipoAusencia })}>{Object.entries(TIPO_AUSENCIA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></Campo>
      <Campo rotulo="Início"><input type="date" className="inp" value={v.inicio} onChange={e => setV({ ...v, inicio: e.target.value })} /></Campo>
      <Campo rotulo="Fim (último dia)"><input type="date" className="inp" value={v.fim} onChange={e => setV({ ...v, fim: e.target.value })} /></Campo>
      <Campo rotulo="Substituto principal" ajuda="Pré-seleciona a delegação de todas as atividades."><select className="inp" value={v.substituto_id} onChange={e => trocarSubst(e.target.value)}><option value="">— sem substituto —</option>{colegas.map(c => <option key={c.id} value={c.id}>{c.nome}{ausenciaNoPeriodo(dados.ausencias, c.id, v.inicio, v.fim) ? ' (também ausente)' : ''}</option>)}</select></Campo>
      <Campo rotulo="Observação"><input className="inp" value={v.observacao} onChange={e => setV({ ...v, observacao: e.target.value })} /></Campo>
    </div>
    {conflito && <Aviso tipo="erro">{p?.nome} já tem {TIPO_AUSENCIA[conflito.tipo].toLowerCase()} de {fmtData(conflito.inicio)} a {fmtData(conflito.fim)}.</Aviso>}
    {v.fim < v.inicio && <Aviso tipo="erro">A data de fim deve ser igual ou posterior ao início.</Aviso>}
    <TabelaDelegacao atividades={pend} setorPessoa={p?.setor_id || null} pessoaId={v.pessoa_id} padrao={v.substituto_id} inicio={v.inicio} fim={v.fim} valor={deleg} onChange={setDeleg} />
  </Modal>;
}

function ModalDelegar({ aus, onFechar }: { aus: Ausencia; onFechar: () => void }) {
  const { dados, svc, executar } = useDados();
  const p = dados.perfis.find(x => x.id === aus.pessoa_id);
  const pend = ordenar(svc.pendentesDe(aus.pessoa_id));
  const [deleg, setDeleg] = useState<Record<string, string | undefined>>(() => Object.fromEntries(pend.map(a => [a.id, aus.substituto_id || ''])));
  return <Modal titulo={`Delegar atividades de ${p?.nome}`} sub={`${TIPO_AUSENCIA[aus.tipo]} de ${fmtData(aus.inicio)} a ${fmtData(aus.fim)}`} tam="largo" onFechar={onFechar}
    rodape={<><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" disabled={!Object.keys(deleg).length} onClick={async () => { await executar(() => svc.delegar(aus, paraDelegacoes(deleg)), 'Atividades delegadas — substitutos notificados'); onFechar(); }}><LuArrowRight size={15} />Delegar {Object.keys(deleg).length} atividade(s)</button></>}>
    <TabelaDelegacao atividades={pend} setorPessoa={p?.setor_id || null} pessoaId={aus.pessoa_id} padrao={aus.substituto_id || ''} inicio={aus.inicio} fim={aus.fim} valor={deleg} onChange={setDeleg} />
    <span className="xs muted">O responsável original fica registrado e você pode devolver as atividades no retorno com um clique.</span>
  </Modal>;
}
