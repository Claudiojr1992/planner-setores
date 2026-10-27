import { useMemo, useState } from 'react';
import { LuLink, LuUnlink, LuSearch, LuMousePointer2 } from 'react-icons/lu';
import { useDados } from '../app/contexto';
import type { Atividade, Vinculo } from '../lib/types';
import { aberta, atrasada, gere, indicadores, ordenar, vinculoEntre } from '../lib/regras';
import { Avatar, Aviso, Campo, Modal, Painel, PontoSetor, Toggle, Vazio } from '../ui/base';
import { Cartao, Trilha, useAcoes } from '../ui/atividade';
import { Indicadores } from '../ui/painel';
import { Grafo, type GNo, type GAresta, type Selecao } from '../ui/grafo';

export function GestaoEmpresa() {
  const { dados, eu, svc, executar, confirmar, abrirAtividade } = useDados();
  const ac = useAcoes();
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const [sel, setSel] = useState<Selecao>(null);
  const [nova, setNova] = useState<{ de: string; para: string } | null>(null);
  const [busca, setBusca] = useState('');
  const abertas = dados.atividades.filter(aberta);
  // fluxo real por rota: atividades abertas que chegaram de outro setor
  const rota = (v: Vinculo) => abertas.filter(a => a.setor_id === v.destino_id && (a.solicitante_setor_id === v.origem_id || dados.atividades.find(x => x.id === a.origem_id)?.setor_id === v.origem_id));

  const nos: GNo[] = dados.setores.map(s => {
    const ab = abertas.filter(a => a.setor_id === s.id);
    const g = dados.perfis.find(p => p.id === s.gestor_id);
    const p = pos[s.id] || { x: s.pos_x, y: s.pos_y };
    return { id: s.id, x: p.x, y: p.y, w: 236, h: 138, conteudo: <div className="caixa-no no-setor" style={{ ['--c' as string]: s.cor }}>
      <div className="cab"><PontoSetor s={s} /><span className="ellipsis">{s.nome}</span></div>
      <div className="row xs muted">{g ? <><Avatar p={g} setores={dados.setores} tam="p" />{g.nome}</> : 'Sem gestor'} · {dados.perfis.filter(x => x.setor_id === s.id && x.ativo).length} pessoas</div>
      <div className="est4"><div><b>{ab.filter(a => ['na_fila', 'pausada', 'a_distribuir'].includes(a.status)).length}</b><span>fila</span></div><div><b>{ab.filter(a => a.status === 'em_andamento').length}</b><span>andamento</span></div>
        <div className="a"><b>{ab.filter(a => a.status === 'aguardando_aceite').length}</b><span>aceite</span></div><div className="r"><b>{ab.filter(a => atrasada(a)).length}</b><span>atraso</span></div></div>
    </div> };
  });
  const arestas: GAresta[] = dados.vinculos.map(v => {
    const r = rota(v); const pend = r.filter(a => a.status === 'aguardando_aceite').length;
    return { id: v.id, de: v.origem_id, para: v.destino_id, rotulo: `${v.requer_aceite ? 'aceite' : 'direto'}${r.length ? ` · ${r.length} em curso` : ''}${pend ? ` · ${pend} pend.` : ''}`, classe: `${pend ? 'quente' : ''} ${v.requer_aceite ? '' : 'tracejada'}` };
  });
  const vSel = sel?.tipo === 'aresta' ? dados.vinculos.find(v => v.id === sel.id) : null;
  const sSel = sel?.tipo === 'no' ? dados.setores.find(s => s.id === sel.id) : null;
  const nomeS = (id: string) => dados.setores.find(s => s.id === id);
  const editavel = dados.setores.some(s => gere(eu, s.id, dados.setores));
  const lista = ordenar(abertas.filter(a => (gere(eu, a.setor_id, dados.setores) || a.responsavel_id === eu.id) && (!busca || a.titulo.toLowerCase().includes(busca.toLowerCase()) || String(a.numero) === busca.replace('#', ''))));
  const processos = useMemo(() => {
    const m = new Map<string, typeof dados.atividades>();
    dados.atividades.forEach(a => m.set(a.processo_id, [...(m.get(a.processo_id) || []), a]));
    return [...m.values()].filter(l => l.some(aberta) && (l.length > 1 || l.some(a => a.fluxo_id))).map(l => l.sort((a, b) => a.criado_em.localeCompare(b.criado_em)));
  }, [dados.atividades]);

  const remover = async (v: Vinculo) => {
    const r = rota(v).length;
    if (await confirmar({ titulo: 'Remover vínculo', perigo: true, ok: 'Remover', texto: <>Remover <b>{nomeS(v.origem_id)?.nome} → {nomeS(v.destino_id)?.nome}</b>? Novas solicitações por este caminho serão bloqueadas.{r > 0 && <> As {r} atividade(s) em curso não são afetadas.</>} Os gestores serão notificados.</> })) {
      await executar(() => svc.removerVinculo(v), 'Vínculo removido — gestores notificados'); setSel(null);
    }
  };

  return <>
    <div className="cabeca"><div className="t"><h1>Gestão da empresa</h1><p>{dados.setores.length} setores · {dados.vinculos.length} vínculos · {abertas.length} atividades abertas</p></div></div>
    <Indicadores lista={dados.atividades} />
    <Painel titulo="Mapa de setores e vínculos" sub="desenhe os caminhos permitidos entre os setores" acoes={<div className="legenda"><span><i />exige aceite</span><span><i className="d" />entrada direta</span><span><i className="q" />com pendência de aceite</span></div>}>
      <div className="mapa-emp">
        <div className="col" style={{ minHeight: 0 }}>
          <div style={{ position: 'relative' }}><LuSearch size={15} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--muted)' }} /><input className="inp" style={{ paddingLeft: 32 }} placeholder="Buscar atividade…" value={busca} onChange={e => setBusca(e.target.value)} /></div>
          <span className="xs muted">Arraste uma atividade até um setor para vinculá-la e notificar o gestor.</span>
          <div className="lista-cartoes" style={{ maxHeight: 548, overflowY: 'auto', paddingRight: 4 }}>{lista.length ? lista.map(a => <Cartao key={a.id} a={a} arrastavel acoes={false} mostrarSetor />) : <Vazio>Nenhuma atividade sua ou do seu setor em aberto.</Vazio>}</div>
        </div>
        <Grafo nos={nos} arestas={arestas} selecao={sel} onSelecionar={setSel} editavel={editavel} altura={640}
          dica={editavel ? <span><LuMousePointer2 size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Puxe a bolinha <b style={{ color: 'var(--accent)' }}>●</b> do lado direito de um setor até outro para criar um vínculo.</span> : undefined}
          onMover={(id, x, y) => { if (gere(eu, id, dados.setores)) setPos(p => ({ ...p, [id]: { x, y } })); }}
          onMoverFim={(id, x, y) => { svc.moverSetor(id, x, y).catch(() => undefined); }}
          onConectar={(de, para) => { if (vinculoEntre(dados.vinculos, de, para)) { setSel({ tipo: 'aresta', id: vinculoEntre(dados.vinculos, de, para)!.id }); return; } setNova({ de, para }); }}
          onExcluir={s => { if (s.tipo === 'aresta') { const v = dados.vinculos.find(x => x.id === s.id); if (v) remover(v); } }}
          aceitaSoltar={dt => dt.types.includes('text/atividade')}
          onSoltarExterno={(dt, _p, noId) => { const a = dados.atividades.find(x => x.id === dt.getData('text/atividade')); if (a && noId) ac.solicitar(a, noId); }} />
        <div className="props">
          {vSel ? <PainelVinculo v={vSel} emCurso={rota(vSel)} onRemover={() => remover(vSel)} />
            : sSel ? <PainelSetorResumo id={sSel.id} />
              : <div className="row sm muted"><LuLink size={16} />Clique numa ligação para ver as atividades em curso, mudar a regra de aceite ou remover (tecla Delete). Clique num setor para ver entradas, saídas e equipe.</div>}
        </div>
      </div>
    </Painel>
    <div className="duas iguais">
      <Painel titulo="Desempenho por setor" sem><div className="tabela-wrap"><table className="tb"><thead><tr><th>Setor</th><th className="d">Abertas</th><th className="d">Aceite</th><th className="d">Atrasadas</th><th className="d">Concl. 30d</th><th className="d">No prazo</th></tr></thead>
        <tbody>{dados.setores.map(s => { const i = indicadores(dados.atividades.filter(a => a.setor_id === s.id)); return <tr key={s.id} className="clic" onClick={() => setSel({ tipo: 'no', id: s.id })}>
          <td><span className="row"><PontoSetor s={s} /><b>{s.nome}</b></span></td><td className="d num">{i.abertas}</td><td className="d num">{i.aguardando || '—'}</td>
          <td className="d num" style={i.atrasadas ? { color: 'var(--red)', fontWeight: 650 } : undefined}>{i.atrasadas || '—'}</td><td className="d num">{i.concluidas30}</td><td className="d num">{i.noPrazoPct}%</td></tr>; })}</tbody></table></div></Painel>
      <Painel titulo="Processos em andamento" sub="cadeia completa entre setores" sem>
        {processos.length ? <div className="tabela-wrap"><table className="tb"><tbody>{processos.slice(0, 20).map(l => { const ref = l.find(aberta) || l[0]; return <tr key={ref.processo_id}><td style={{ width: '38%' }}><b>{ref.titulo}</b><div className="xs muted">{dados.fluxos.find(f => f.id === ref.fluxo_id)?.nome || 'Encaminhamento avulso'}</div></td><td><Trilha a={ref} onAbrir={abrirAtividade} /></td></tr>; })}</tbody></table></div>
          : <div style={{ padding: 18 }}><Vazio>Nenhum processo multissetor em andamento.</Vazio></div>}
      </Painel>
    </div>
    {nova && <ModalNovoVinculo de={nova.de} para={nova.para} onFechar={() => setNova(null)} onCriado={id => setSel({ tipo: 'aresta', id })} />}
  </>;
}

function PainelVinculo({ v, emCurso, onRemover }: { v: Vinculo; emCurso: Atividade[]; onRemover: () => void }) {
  const { dados, eu, svc, executar } = useDados();
  const o = dados.setores.find(s => s.id === v.origem_id), d = dados.setores.find(s => s.id === v.destino_id);
  const pode = gere(eu, v.origem_id, dados.setores) || gere(eu, v.destino_id, dados.setores);
  const [desc, setDesc] = useState(v.descricao || '');
  return <>
    <div className="trilha"><span className="passo"><PontoSetor s={o} />{o?.nome}</span><span className="sep">→</span><span className="passo"><PontoSetor s={d} />{d?.nome}</span></div>
    <Toggle marcado={v.requer_aceite} desab={!pode} onChange={x => executar(() => svc.atualizarVinculo(v, { requer_aceite: x }), x ? 'Agora exige aceite do gestor' : 'Agora com entrada direta')} rotulo={<span><b>Exige aceite</b> do gestor de {d?.nome}</span>} />
    <Campo rotulo="Descrição / quando usar"><textarea className="inp" disabled={!pode} value={desc} onChange={e => setDesc(e.target.value)} onBlur={() => desc !== (v.descricao || '') && executar(() => svc.atualizarVinculo(v, { descricao: desc }), 'Descrição salva')} /></Campo>
    <span className="secao-titulo">Em curso por este caminho ({emCurso.length})</span>
    <div className="lista-cartoes" style={{ maxHeight: 300, overflowY: 'auto' }}>{emCurso.length ? emCurso.map(a => <Cartao key={a.id} a={a} acoes={false} />) : <span className="sm muted">Nenhuma atividade em curso.</span>}</div>
    {pode && <button className="btn perigo" onClick={onRemover}><LuUnlink size={15} />Remover vínculo</button>}
  </>;
}

function PainelSetorResumo({ id }: { id: string }) {
  const { dados } = useDados();
  const s = dados.setores.find(x => x.id === id)!;
  const sai = dados.vinculos.filter(v => v.origem_id === id), ent = dados.vinculos.filter(v => v.destino_id === id);
  const n = (x: string) => dados.setores.find(y => y.id === x);
  return <>
    <div className="row"><PontoSetor s={s} /><h2>{s.nome}</h2></div>
    {s.descricao && <p className="sm muted">{s.descricao}</p>}
    <span className="secao-titulo">Recebe de</span>
    <div className="row wrap">{ent.length ? ent.map(v => <span key={v.id} className="chip"><PontoSetor s={n(v.origem_id)} />{n(v.origem_id)?.nome}</span>) : <span className="sm muted">Nenhum setor</span>}</div>
    <span className="secao-titulo">Envia para</span>
    <div className="row wrap">{sai.length ? sai.map(v => <span key={v.id} className="chip"><PontoSetor s={n(v.destino_id)} />{n(v.destino_id)?.nome}</span>) : <span className="sm muted">Nenhum setor</span>}</div>
    <span className="secao-titulo">Equipe</span>
    <div className="col" style={{ gap: 6 }}>{dados.perfis.filter(p => p.setor_id === id && p.ativo).map(p => <span key={p.id} className="row sm"><Avatar p={p} setores={dados.setores} tam="p" />{p.nome}{p.id === s.gestor_id && <span className="pill t-accent">gestor</span>}</span>)}</div>
  </>;
}

function ModalNovoVinculo({ de, para, onFechar, onCriado }: { de: string; para: string; onFechar: () => void; onCriado: (id: string) => void }) {
  const { dados, svc, executar } = useDados();
  const [aceite, setAceite] = useState(true); const [desc, setDesc] = useState('');
  const o = dados.setores.find(s => s.id === de), d = dados.setores.find(s => s.id === para);
  return <Modal titulo="Criar vínculo entre setores" onFechar={onFechar}
    rodape={<><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" onClick={async () => { const v = await executar(() => svc.criarVinculo(de, para, aceite, desc), 'Vínculo criado — gestores notificados'); onFechar(); if (v) onCriado(v.id); }}><LuLink size={15} />Criar vínculo</button></>}>
    <div className="trilha"><span className="passo"><PontoSetor s={o} />{o?.nome}</span><span className="sep">→</span><span className="passo atual"><PontoSetor s={d} />{d?.nome}</span></div>
    <Aviso>Com este vínculo, <b>{o?.nome}</b> passa a poder solicitar atividades e encaminhar entregas para <b>{d?.nome}</b>.</Aviso>
    <Toggle marcado={aceite} onChange={setAceite} rotulo={<span><b>Exigir aceite</b> do gestor de {d?.nome} antes de entrar na fila</span>} />
    <Campo rotulo="Descrição (opcional)"><input className="inp" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: guias de impostos, documentos de admissão" /></Campo>
  </Modal>;
}
