import { useEffect, useState } from 'react';
import {
  LuPlus, LuWorkflow, LuPencil, LuPlay, LuCopy, LuTrash2, LuSave, LuArrowLeft, LuCircleCheck, LuTriangleAlert, LuCircleAlert,
  LuFlag, LuCircleDot, LuSquare, LuWandSparkles, LuChevronRight, LuX,
} from 'react-icons/lu';
import { useDados } from '../app/contexto';
import { navegar } from '../app/rota';
import type { Fluxo, FluxoAresta, FluxoDefinicao, FluxoNo, TipoNo } from '../lib/types';
import { FINAIS, etapasEmOrdem, uuid, validarFluxo, fmtDataHora } from '../lib/regras';
import { Aviso, Campo, PontoSetor, Toggle, Vazio } from '../ui/base';
import { Grafo, type GAresta, type GNo, type Selecao } from '../ui/grafo';

const TAM: Record<TipoNo, { w: number; h: number }> = { inicio: { w: 130, h: 48 }, fim: { w: 130, h: 48 }, etapa: { w: 220, h: 84 } };

export function ListaFluxos() {
  const { dados, svc, executar, confirmar, abrirNova } = useDados();
  const duplicar = (f: Fluxo) => {
    const mapa = new Map(f.definicao.nos.map(n => [n.id, uuid()]));
    const def: FluxoDefinicao = { nos: f.definicao.nos.map(n => ({ ...n, id: mapa.get(n.id)! })), arestas: f.definicao.arestas.map(a => ({ ...a, id: uuid(), de: mapa.get(a.de)!, para: mapa.get(a.para)! })) };
    executar(() => svc.salvarFluxo({ nome: `${f.nome} (cópia)`, descricao: f.descricao, ativo: false, definicao: def }), 'Fluxo duplicado (inativo)');
  };
  return <>
    <div className="cabeca"><div className="t"><h1>Fluxos de processo</h1><p>Desenhe o caminho de uma demanda entre os setores. Cada etapa é criada automaticamente quando a anterior é concluída.</p></div>
      <div className="sp"><button className="btn pri" onClick={() => navegar('/fluxos/novo')}><LuPlus size={16} />Novo fluxo</button></div></div>
    {dados.fluxos.length === 0 ? <Vazio icone={<LuWorkflow size={30} />}>Nenhum fluxo criado. Comece desenhando o processo mais comum entre seus setores.</Vazio> :
      <div className="grade-cartoes" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>{dados.fluxos.map(f => {
        const prob = validarFluxo(f, dados.setores); const erros = prob.filter(p => p.nivel === 'erro');
        const etapas = etapasEmOrdem(f); const emCurso = dados.atividades.filter(a => a.fluxo_id === f.id && !FINAIS.includes(a.status)).length;
        return <div key={f.id} className="painel"><div className="painel-b col" style={{ gap: 10 }}>
          <div className="row"><span className="logo-pad" style={{ width: 32, height: 32 }}><LuWorkflow size={16} /></span><div className="grow" style={{ minWidth: 0 }}><h2 className="ellipsis">{f.nome}</h2><div className="xs muted">Atualizado em {fmtDataHora(f.atualizado_em)}</div></div>
            <span className={`pill ${f.ativo ? 't-green' : 't-gray'}`}>{f.ativo ? 'Ativo' : 'Inativo'}</span></div>
          {f.descricao && <p className="sm muted">{f.descricao}</p>}
          <div className="trilha">{etapas.map((e, i) => <span key={e.id} className="row" style={{ gap: 4 }}>{i > 0 && <span className="sep"><LuChevronRight size={13} /></span>}<span className="chip"><PontoSetor s={dados.setores.find(s => s.id === e.setor_id)} />{dados.setores.find(s => s.id === e.setor_id)?.nome || '?'}</span></span>)}</div>
          <div className="row sm">{erros.length ? <span className="row" style={{ color: 'var(--red)' }}><LuCircleAlert size={14} />{erros.length} pendência(s)</span> : <span className="row" style={{ color: 'var(--green)' }}><LuCircleCheck size={14} />Pronto para uso</span>}<span className="muted">· {etapas.length} etapas · {emCurso} em andamento</span></div>
          <div className="row wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <button className="btn p pri" onClick={() => navegar(`/fluxos/${f.id}`)}><LuPencil size={13} />Editar</button>
            <button className="btn p" disabled={!f.ativo || erros.length > 0} onClick={() => abrirNova({ modo: 'fluxo', fluxo_id: f.id })}><LuPlay size={13} />Iniciar</button>
            <button className="btn p" onClick={() => duplicar(f)}><LuCopy size={13} />Duplicar</button>
            <span className="sp" />
            <Toggle marcado={f.ativo} onChange={v => executar(() => svc.salvarFluxo({ ...f, ativo: v }), v ? 'Fluxo ativado' : 'Fluxo desativado')} />
            <button className="btn p fant perigo" title="Excluir" onClick={async () => { if (await confirmar({ titulo: 'Excluir fluxo', perigo: true, ok: 'Excluir', texto: <>Excluir o fluxo <b>{f.nome}</b>? Atividades já concluídas são mantidas.</> })) executar(() => svc.excluirFluxo(f), 'Fluxo excluído'); }}><LuTrash2 size={14} /></button>
          </div>
        </div></div>;
      })}</div>}
  </>;
}

function organizar(def: FluxoDefinicao): FluxoDefinicao {
  const ini = def.nos.find(n => n.tipo === 'inicio'); if (!ini) return def;
  const nivel = new Map<string, number>([[ini.id, 0]]); const fila = [ini.id];
  while (fila.length) { const id = fila.shift()!; for (const a of def.arestas.filter(x => x.de === id)) if (!nivel.has(a.para)) { nivel.set(a.para, (nivel.get(id) || 0) + 1); fila.push(a.para); } }
  let max = Math.max(0, ...nivel.values());
  def.nos.forEach(n => { if (!nivel.has(n.id)) nivel.set(n.id, n.tipo === 'fim' ? max + 1 : ++max); });
  const fimNivel = Math.max(...def.nos.filter(n => n.tipo !== 'fim').map(n => nivel.get(n.id) || 0)) + 1;
  def.nos.filter(n => n.tipo === 'fim').forEach(n => nivel.set(n.id, fimNivel));
  const porNivel = new Map<number, FluxoNo[]>(); def.nos.forEach(n => porNivel.set(nivel.get(n.id)!, [...(porNivel.get(nivel.get(n.id)!) || []), n]));
  const nos = def.nos.map(n => { const l = nivel.get(n.id)!; const irmaos = porNivel.get(l)!; const i = irmaos.indexOf(n); const t = TAM[n.tipo];
    return { ...n, x: 40 + l * 280, y: Math.round(220 + (i - (irmaos.length - 1) / 2) * 130 - t.h / 2) }; });
  return { ...def, nos };
}

export function EditorFluxo({ id }: { id: string }) {
  const { dados, svc, executar, confirmar, abrirNova, toast } = useDados();
  const original = id === 'novo' ? null : dados.fluxos.find(f => f.id === id) || null;
  const [fluxoId] = useState(() => original?.id || uuid());
  const [nome, setNome] = useState(original?.nome || 'Novo fluxo');
  const [descricao, setDescricao] = useState(original?.descricao || '');
  const [ativo, setAtivo] = useState(original?.ativo ?? true);
  const [def, setDef] = useState<FluxoDefinicao>(() => original ? JSON.parse(JSON.stringify(original.definicao)) : {
    nos: [{ id: uuid(), tipo: 'inicio', x: 40, y: 196, titulo: 'Início' }, { id: uuid(), tipo: 'fim', x: 600, y: 196, titulo: 'Fim' }], arestas: [],
  });
  const [sel, setSel] = useState<Selecao>(null);
  const [sujo, setSujo] = useState(id === 'novo');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { const f = (e: BeforeUnloadEvent) => { if (sujo) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', f); return () => window.removeEventListener('beforeunload', f); }, [sujo]);
  if (id !== 'novo' && !original) return <Vazio>Fluxo não encontrado. <a href="#/fluxos">Voltar</a></Vazio>;

  const mudar = (fn: (d: FluxoDefinicao) => FluxoDefinicao) => { setDef(d => fn(JSON.parse(JSON.stringify(d)))); setSujo(true); };
  const fluxoAtual: Fluxo = { id: fluxoId, nome, descricao, ativo, definicao: def, criado_por: null, criado_em: '', atualizado_em: '' };
  const problemas = validarFluxo(fluxoAtual, dados.setores);
  const comErro = new Set(problemas.filter(p => p.nivel === 'erro' && p.noId).map(p => p.noId));
  const emCurso = dados.atividades.filter(a => a.fluxo_id === fluxoId && !FINAIS.includes(a.status));
  const orfas = emCurso.filter(a => a.etapa_id && !def.nos.some(n => n.id === a.etapa_id));
  const setor = (sid?: string | null) => dados.setores.find(s => s.id === sid);

  const adicionar = (tipo: TipoNo, x?: number, y?: number, setorId?: string) => {
    if (tipo === 'inicio' && def.nos.some(n => n.tipo === 'inicio')) { toast('O fluxo já possui um Início.', 'erro'); return; }
    const t = TAM[tipo]; const n: FluxoNo = { id: uuid(), tipo, x: Math.round((x ?? 300) - t.w / 2), y: Math.round((y ?? 200) - t.h / 2), titulo: tipo === 'etapa' ? (setorId ? `Etapa ${setor(setorId)?.nome}` : 'Nova etapa') : tipo === 'fim' ? 'Fim' : 'Início', ...(tipo === 'etapa' ? { setor_id: setorId || null, prazo_dias: 3, requer_aceite: true } : {}) };
    mudar(d => ({ ...d, nos: [...d.nos, n] })); setSel({ tipo: 'no', id: n.id });
  };
  const conectar = (de: string, para: string) => {
    const A = def.nos.find(n => n.id === de), B = def.nos.find(n => n.id === para);
    if (!A || !B) return;
    if (B.tipo === 'inicio') return toast('O Início não pode receber conexões.', 'erro');
    if (A.tipo === 'fim') return toast('O Fim não pode ter saídas.', 'erro');
    if (def.arestas.some(a => a.de === de && a.para === para)) return toast('Esta conexão já existe.', 'erro');
    const nova: FluxoAresta = { id: uuid(), de, para };
    mudar(d => ({ ...d, arestas: [...d.arestas, nova] })); setSel({ tipo: 'aresta', id: nova.id });
  };
  const excluir = (s: NonNullable<Selecao>) => {
    if (s.tipo === 'aresta') mudar(d => ({ ...d, arestas: d.arestas.filter(a => a.id !== s.id) }));
    else mudar(d => ({ nos: d.nos.filter(n => n.id !== s.id), arestas: d.arestas.filter(a => a.de !== s.id && a.para !== s.id) }));
    setSel(null);
  };
  const salvar = async () => {
    setSalvando(true);
    const r = await executar(() => svc.salvarFluxo({ id: fluxoId, nome, descricao, ativo, definicao: def }), problemas.some(p => p.nivel === 'erro') ? 'Fluxo salvo como rascunho (há pendências)' : 'Fluxo salvo — as regras já valem para as próximas etapas');
    setSalvando(false);
    if (r) { setSujo(false); if (id === 'novo') navegar(`/fluxos/${fluxoId}`, true); }
  };
  const voltar = async () => { if (sujo && !(await confirmar({ titulo: 'Descartar alterações?', texto: 'Há alterações não salvas neste fluxo.', ok: 'Descartar', perigo: true }))) return; navegar('/fluxos'); };

  const nos: GNo[] = def.nos.map(n => {
    const t = TAM[n.tipo]; const s = setor(n.setor_id); const qtd = emCurso.filter(a => a.etapa_id === n.id).length;
    const conteudo = n.tipo === 'etapa'
      ? <div className="caixa-no no-etapa" style={{ ['--c' as string]: s?.cor || 'var(--border-strong)' }}><div className="t">{n.titulo || 'Sem título'}</div>
        <div className="s"><PontoSetor s={s} />{s?.nome || <span style={{ color: 'var(--red)' }}>Defina o setor</span>}</div>
        <div className="s">{n.prazo_dias ? `${n.prazo_dias} dia(s)` : 'sem prazo'} · {n.requer_aceite !== false ? 'com aceite' : 'entrada direta'}{qtd ? <b style={{ color: 'var(--blue)' }}> · {qtd} em curso</b> : ''}</div></div>
      : <div className={`caixa-no no-terminal ${n.tipo}`}>{n.tipo === 'inicio' ? <LuCircleDot size={16} /> : <LuFlag size={15} />}{n.titulo}</div>;
    return { id: n.id, x: n.x, y: n.y, w: t.w, h: t.h, conteudo, classe: comErro.has(n.id) ? 'erro' : '', entrada: n.tipo !== 'inicio', saida: n.tipo !== 'fim' };
  });
  const arestas: GAresta[] = def.arestas.map(a => ({ id: a.id, de: a.de, para: a.para, rotulo: a.rotulo || undefined }));
  const noSel = sel?.tipo === 'no' ? def.nos.find(n => n.id === sel.id) : null;
  const arSel = sel?.tipo === 'aresta' ? def.arestas.find(a => a.id === sel.id) : null;
  const editarNo = (p: Partial<FluxoNo>) => noSel && mudar(d => ({ ...d, nos: d.nos.map(n => n.id === noSel.id ? { ...n, ...p } : n) }));
  const erros = problemas.filter(p => p.nivel === 'erro');

  return <>
    <div className="cabeca">
      <div className="t"><a href="#/fluxos" className="row sm" onClick={e => { e.preventDefault(); voltar(); }}><LuArrowLeft size={14} />Fluxos de processo</a>
        <div className="row"><h1>{nome || 'Sem nome'}</h1>{sujo ? <span className="pill t-amber">alterações não salvas</span> : <span className="pill t-green">salvo</span>}</div></div>
      <div className="sp">
        <button className="btn" onClick={() => mudar(organizar)}><LuWandSparkles size={15} />Organizar</button>
        <button className="btn" disabled={sujo || !!erros.length || !ativo} title={sujo ? 'Salve antes de iniciar' : undefined} onClick={() => abrirNova({ modo: 'fluxo', fluxo_id: fluxoId })}><LuPlay size={15} />Iniciar processo</button>
        <button className="btn pri" disabled={salvando} onClick={salvar}><LuSave size={15} />{salvando ? 'Salvando…' : 'Salvar fluxo'}</button>
      </div>
    </div>
    {emCurso.length > 0 && <Aviso tipo="atencao">Há <b>{emCurso.length} atividade(s) em andamento</b> neste fluxo. Ao salvar, as novas ligações passam a valer na próxima conclusão de cada etapa.{orfas.length > 0 && <> <b>{orfas.length}</b> estão em etapas que você removeu: elas serão concluídas sem gerar próxima etapa.</>}</Aviso>}
    <div className="editor">
      <div className="paleta painel" style={{ padding: 12 }}>
        <span className="secao-titulo">Elementos</span>
        {([['inicio', 'Início', LuCircleDot], ['etapa', 'Etapa', LuSquare], ['fim', 'Fim', LuFlag]] as const).map(([t, r, I]) =>
          <div key={t} className="peca" draggable onDragStart={e => { e.dataTransfer.setData('text/no', t); }} onClick={() => adicionar(t)}><I size={16} />{r}</div>)}
        <span className="secao-titulo" style={{ marginTop: 10 }}>Etapa por setor</span>
        {dados.setores.map(s => <div key={s.id} className="peca" draggable onDragStart={e => { e.dataTransfer.setData('text/no', 'etapa'); e.dataTransfer.setData('text/setor', s.id); }} onClick={() => adicionar('etapa', undefined, undefined, s.id)}><PontoSetor s={s} />{s.nome}</div>)}
        <p className="xs muted" style={{ marginTop: 8 }}>Arraste para o quadro ou clique para adicionar. Ligue os elementos puxando a bolinha azul da direita até o próximo. Selecione uma ligação e pressione Delete para desvincular.</p>
      </div>
      <Grafo nos={nos} arestas={arestas} selecao={sel} onSelecionar={setSel} editavel altura="100%"
        onMover={(nid, x, y) => mudar(d => ({ ...d, nos: d.nos.map(n => n.id === nid ? { ...n, x, y } : n) }))}
        onConectar={conectar} onExcluir={excluir}
        aceitaSoltar={dt => dt.types.includes('text/no')}
        onSoltarExterno={(dt, p) => { const t = dt.getData('text/no') as TipoNo; if (t) adicionar(t, p.x, p.y, dt.getData('text/setor') || undefined); }} />
      <div className="props painel" style={{ padding: 14 }}>
        {noSel ? <div className="col" style={{ gap: 14 }}>
          <div className="row"><h2 className="grow">{noSel.tipo === 'etapa' ? 'Etapa' : noSel.tipo === 'inicio' ? 'Início' : 'Fim'}</h2><button className="btn fant icone p" onClick={() => setSel(null)}><LuX size={16} /></button></div>
          <Campo rotulo="Nome"><input className="inp" value={noSel.titulo} onChange={e => editarNo({ titulo: e.target.value })} /></Campo>
          {noSel.tipo === 'etapa' && <>
            <Campo rotulo="Setor responsável"><select className="inp" value={noSel.setor_id || ''} onChange={e => editarNo({ setor_id: e.target.value || null })}><option value="">Selecione…</option>{dados.setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></Campo>
            <Campo rotulo="Prazo da etapa (dias)" ajuda="Contado a partir da chegada no setor."><input className="inp" type="number" min={0} max={365} value={noSel.prazo_dias ?? ''} onChange={e => editarNo({ prazo_dias: e.target.value ? Number(e.target.value) : null })} /></Campo>
            <Toggle marcado={noSel.requer_aceite !== false} onChange={v => editarNo({ requer_aceite: v })} rotulo="Exigir aceite do gestor ao chegar" />
            <div className="col" style={{ gap: 4 }}><span className="secao-titulo">Ligações</span>
              <span className="sm">Recebe de: {def.arestas.filter(a => a.para === noSel.id).map(a => def.nos.find(n => n.id === a.de)?.titulo).join(', ') || '—'}</span>
              <span className="sm">Envia para: {def.arestas.filter(a => a.de === noSel.id).map(a => def.nos.find(n => n.id === a.para)?.titulo).join(', ') || '—'}</span>
              {def.arestas.filter(a => a.para === noSel.id).length > 1 && <span className="xs muted">Esta etapa só é liberada quando todas as anteriores forem concluídas.</span>}</div>
          </>}
          <button className="btn perigo" onClick={() => excluir({ tipo: 'no', id: noSel.id })}><LuTrash2 size={14} />Remover elemento</button>
        </div> : arSel ? <div className="col" style={{ gap: 14 }}>
          <div className="row"><h2 className="grow">Ligação</h2><button className="btn fant icone p" onClick={() => setSel(null)}><LuX size={16} /></button></div>
          <div className="trilha"><span className="passo">{def.nos.find(n => n.id === arSel.de)?.titulo}</span><span className="sep">→</span><span className="passo">{def.nos.find(n => n.id === arSel.para)?.titulo}</span></div>
          <Campo rotulo="Rótulo (opcional)" ajuda="Ex.: “aprovado”, “documentos ok”."><input className="inp" value={arSel.rotulo || ''} onChange={e => mudar(d => ({ ...d, arestas: d.arestas.map(a => a.id === arSel.id ? { ...a, rotulo: e.target.value } : a) }))} /></Campo>
          <button className="btn perigo" onClick={() => excluir({ tipo: 'aresta', id: arSel.id })}><LuTrash2 size={14} />Remover ligação (desvincular)</button>
        </div> : <div className="col" style={{ gap: 14 }}>
          <h2>Propriedades do fluxo</h2>
          <Campo rotulo="Nome"><input className="inp" value={nome} onChange={e => { setNome(e.target.value); setSujo(true); }} /></Campo>
          <Campo rotulo="Descrição"><textarea className="inp" value={descricao} onChange={e => { setDescricao(e.target.value); setSujo(true); }} /></Campo>
          <Toggle marcado={ativo} onChange={v => { setAtivo(v); setSujo(true); }} rotulo="Disponível para iniciar" />
          <div className="col" style={{ gap: 8 }}><span className="secao-titulo">Verificação</span>
            {problemas.length === 0 ? <Aviso tipo="ok">Fluxo válido e pronto para uso.</Aviso> : problemas.map((p, i) =>
              <div key={i} className={`aviso ${p.nivel === 'erro' ? 'erro' : 'atencao'}`} style={{ cursor: p.noId ? 'pointer' : undefined }} onClick={() => p.noId && setSel({ tipo: 'no', id: p.noId })}>{p.nivel === 'erro' ? <LuCircleAlert size={15} /> : <LuTriangleAlert size={15} />}<div>{p.texto}</div></div>)}
          </div>
          <div className="col" style={{ gap: 4 }}><span className="secao-titulo">Como funciona</span>
            <span className="sm muted">• Ao iniciar, as etapas ligadas ao Início são criadas.<br />• Ao concluir uma etapa, todas as ligações de saída disparam (etapas em paralelo).<br />• Quando várias etapas chegam na mesma, ela espera todas terminarem.<br />• Etapas “com aceite” chegam para o gestor aceitar ou recusar.</span></div>
        </div>}
      </div>
    </div>
  </>;
}
