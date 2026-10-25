import { useLayoutEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { LuTreePalm, LuPlus, LuInbox, LuHourglass } from 'react-icons/lu';
import { useDados } from '../app/contexto';
import { navegar } from '../app/rota';
import type { Atividade } from '../lib/types';
import { aberta, atrasada, ausenciaAtiva, fmtData, ordenar, setoresGeridos, situacaoAusencia, TIPO_AUSENCIA } from '../lib/regras';
import { Avatar, Painel, Vazio, PontoSetor } from '../ui/base';
import { Cartao, useAcoes } from '../ui/atividade';
import { Calendario, Indicadores } from '../ui/painel';

export function PainelSetor() {
  const { dados, eu, abrirNova } = useDados();
  const geridos = setoresGeridos(eu, dados.setores);
  const [sel, setSel] = useState(() => (eu.setor_id && geridos.includes(eu.setor_id) ? eu.setor_id : geridos[0]));
  const sid = geridos.includes(sel) ? sel : geridos[0];
  const s = dados.setores.find(x => x.id === sid);
  const ac = useAcoes();
  const [alvo, setAlvo] = useState<string | null>(null);
  if (!s) return <Vazio>Você não gerencia nenhum setor.</Vazio>;
  const ats = dados.atividades.filter(a => a.setor_id === sid);
  const membros = dados.perfis.filter(p => p.setor_id === sid && p.ativo);
  const aguardando = ordenar(ats.filter(a => a.status === 'aguardando_aceite'));
  const distribuir = ordenar(ats.filter(a => a.status === 'a_distribuir'));
  const ausEquipe = dados.ausencias.filter(a => membros.some(m => m.id === a.pessoa_id) && situacaoAusencia(a) !== 'encerrada').sort((a, b) => a.inicio.localeCompare(b.inicio));
  const soltar = (pessoa: string | null) => (e: DragEvent) => {
    e.preventDefault(); setAlvo(null);
    const id = e.dataTransfer.getData('text/atividade'); const a = dados.atividades.find(x => x.id === id);
    if (!a || a.setor_id !== sid || (a.responsavel_id || null) === pessoa) return;
    if (a.status === 'aguardando_aceite') return ac.aceitar(a);
    ac.distribuir(a, pessoa);
  };
  const zona = (k: string, pessoa: string | null) => ({
    onDragOver: (e: DragEvent) => { e.preventDefault(); setAlvo(k); },
    onDragLeave: (e: DragEvent) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setAlvo(null); },
    onDrop: soltar(pessoa),
  });

  return <>
    <div className="cabeca">
      <div className="t"><div className="row"><PontoSetor s={s} /><h1>{s.nome}</h1></div><p>Gestor: {dados.perfis.find(p => p.id === s.gestor_id)?.nome || '—'} · {membros.length} pessoas{s.descricao ? ` · ${s.descricao}` : ''}</p></div>
      <div className="sp">
        {geridos.length > 1 && <select className="inp" style={{ width: 'auto' }} value={sid} onChange={e => setSel(e.target.value)}>{geridos.map(id => <option key={id} value={id}>{dados.setores.find(x => x.id === id)?.nome}</option>)}</select>}
        <button className="btn" onClick={() => navegar('/ausencias')}><LuTreePalm size={15} />Programar férias</button>
        <button className="btn pri" onClick={() => abrirNova({ modo: 'setor', setor_id: sid })}><LuPlus size={16} />Nova atividade</button>
      </div>
    </div>
    <Indicadores lista={ats} onFiltro={f => navegar(`/atividades?setor=${sid}&f=${f}`)} />
    <Painel titulo="Mapa da equipe" sub="entradas de outros setores → equipe → saídas previstas" sem>
      <div style={{ padding: 16 }}><MapaEquipe setorId={sid} ats={ats} /></div>
    </Painel>
    <div className="duas iguais">
      <Painel id="aguardando" titulo={<span className="row"><LuHourglass size={17} />Aguardando aceite</span>} sub={`${aguardando.length} solicitações de outros setores`}>
        {aguardando.length ? <div className="lista-cartoes">{aguardando.map(a => <Cartao key={a.id} a={a} />)}</div> : <Vazio>Nenhuma solicitação aguardando aceite.</Vazio>}
      </Painel>
      <Painel titulo={<span className="row"><LuInbox size={17} />A distribuir</span>} sub="arraste para a fila de uma pessoa ou use “Distribuir”">
        <div className={`lista-cartoes ${alvo === 'sem' ? 'solta' : ''}`} style={{ minHeight: 80, borderRadius: 10 }} {...zona('sem', null)}>
          {distribuir.length ? distribuir.map(a => <Cartao key={a.id} a={a} arrastavel />) : <Vazio>Tudo distribuído. Solte aqui para devolver uma atividade à distribuição.</Vazio>}</div>
      </Painel>
    </div>
    <Painel titulo="Filas por pessoa" sub="arraste os cartões entre as colunas para redistribuir">
      <div className="kanban">{membros.map(p => {
        const its = ordenar(ats.filter(a => a.responsavel_id === p.id && aberta(a) && a.status !== 'aguardando_aceite'));
        const aus = ausenciaAtiva(dados.ausencias, p.id);
        const and = its.filter(a => a.status === 'em_andamento').length;
        return <div key={p.id} className={`coluna ${aus ? 'ausente' : ''}`}>
          <div className="coluna-h"><Avatar p={p} setores={dados.setores} tam="m" /><div className="grow" style={{ minWidth: 0 }}><div className="n ellipsis">{p.nome}{p.id === s.gestor_id && <span className="muted xs"> · gestor</span>}</div>
            <div className="s">{aus ? <span style={{ color: 'var(--purple)', fontWeight: 600 }}>{TIPO_AUSENCIA[aus.tipo]} até {fmtData(aus.fim)}</span> : <>{and} em andamento · {its.length - and} na fila{its.some(atrasada) ? <b style={{ color: 'var(--red)' }}> · {its.filter(atrasada).length} atrasada(s)</b> : ''}</>}</div></div></div>
          <div className={`coluna-b ${alvo === p.id ? 'solta' : ''}`} {...zona(p.id, p.id)}>{its.length ? its.map(a => <Cartao key={a.id} a={a} arrastavel mostrarResp={false} />) : <div className="xs muted" style={{ textAlign: 'center', padding: 18 }}>Solte atividades aqui</div>}</div>
        </div>;
      })}</div>
    </Painel>
    <div className="duas lateral">
      <Painel><Calendario lista={ats} ausencias={dados.ausencias.filter(a => membros.some(m => m.id === a.pessoa_id))} titulo="Calendário do setor" dados={dados} /></Painel>
      <Painel titulo="Ausências da equipe" acoes={<button className="btn p" onClick={() => navegar('/ausencias')}>Gerenciar</button>}>
        {ausEquipe.length ? <div className="col" style={{ gap: 10 }}>{ausEquipe.map(a => { const p = dados.perfis.find(x => x.id === a.pessoa_id); const sit = situacaoAusencia(a);
          return <div key={a.id} className="row" style={{ alignItems: 'flex-start' }}><Avatar p={p} setores={dados.setores} /><div className="grow"><b>{p?.nome}</b><div className="xs muted">{TIPO_AUSENCIA[a.tipo]} · {fmtData(a.inicio)} a {fmtData(a.fim)}</div></div>
            <span className={`pill ${sit === 'em_curso' ? 't-purple' : 't-slate'}`}>{sit === 'em_curso' ? 'em curso' : 'programada'}</span></div>; })}</div>
          : <Vazio icone={<LuTreePalm size={26} />}>Nenhuma ausência programada.</Vazio>}
      </Painel>
    </div>
  </>;
}

/* Canvas da equipe: entradas → setor → pessoas → saídas, com ligações em SVG. */
function MapaEquipe({ setorId, ats }: { setorId: string; ats: Atividade[] }) {
  const { dados, abrirAtividade } = useDados();
  const ref = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const s = dados.setores.find(x => x.id === setorId)!;
  const membros = dados.perfis.filter(p => p.setor_id === setorId && p.ativo);
  const abertas = ats.filter(aberta);
  const origens = new Map<string, number>();
  abertas.forEach(a => { const o = a.origem_id ? dados.atividades.find(x => x.id === a.origem_id) : null; const sid = o?.setor_id || (a.solicitante_setor_id !== setorId ? a.solicitante_setor_id : null); if (sid && sid !== setorId) origens.set(sid, (origens.get(sid) || 0) + 1); });
  const saidas = new Map<string, { n: number; donos: Set<string> }>();
  abertas.forEach(a => {
    const f = a.fluxo_id ? dados.fluxos.find(x => x.id === a.fluxo_id) : null;
    const dest = f && a.etapa_id ? f.definicao.arestas.filter(x => x.de === a.etapa_id).map(x => f.definicao.nos.find(n => n.id === x.para)?.setor_id).filter(Boolean) as string[] : a.encaminhar_para ? [a.encaminhar_para] : [];
    dest.filter(d => d !== setorId).forEach(d => { const e = saidas.get(d) || { n: 0, donos: new Set() }; e.n++; if (a.responsavel_id) e.donos.add(a.responsavel_id); saidas.set(d, e); });
  });
  const aguardando = abertas.filter(a => a.status === 'aguardando_aceite').length;
  const maxCarga = Math.max(1, ...membros.map(p => abertas.filter(a => a.responsavel_id === p.id).length));
  const chave = JSON.stringify([...origens.entries(), [...saidas.keys()], membros.map(m => m.id), aguardando, dados.atividades.length]);

  useLayoutEffect(() => {
    const desenhar = () => {
      const cv = ref.current, sv = svg.current; if (!cv || !sv) return;
      const R = cv.getBoundingClientRect();
      const pos = (id: string) => { const el = cv.querySelector(`[data-no="${id}"]`) as HTMLElement | null; if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left - R.left + cv.scrollLeft, r: r.right - R.left + cv.scrollLeft, y: r.top + r.height / 2 - R.top + cv.scrollTop }; };
      const pares: [string, string, string][] = [];
      origens.forEach((_, id) => pares.push(['in-' + id, 'hub', '']));
      if (aguardando) pares.push(['caixa', 'hub', 'quente tracejado']);
      membros.forEach(p => pares.push(['hub', 'p-' + p.id, '']));
      saidas.forEach((e, id) => { const d = [...e.donos].filter(x => membros.some(m => m.id === x)); if (d.length) d.forEach(x => pares.push(['p-' + x, 'out-' + id, 'tracejado'])); else pares.push(['hub', 'out-' + id, 'tracejado']); });
      let h = '<defs><marker id="seta-eq" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" style="fill:var(--line);stroke:none"/></marker></defs>';
      for (const [a, b, c] of pares) { const A = pos(a), B = pos(b); if (!A || !B) continue; const dx = Math.max(26, (B.l - A.r) / 2); h += `<path class="${c}" d="M${A.r},${A.y} C${A.r + dx},${A.y} ${B.l - dx},${B.y} ${B.l - 2},${B.y}" marker-end="url(#seta-eq)"/>`; }
      sv.setAttribute('width', String(cv.scrollWidth)); sv.setAttribute('height', String(cv.scrollHeight)); sv.innerHTML = h;
    };
    desenhar(); const t = setTimeout(desenhar, 60);
    window.addEventListener('resize', desenhar);
    return () => { clearTimeout(t); window.removeEventListener('resize', desenhar); };
  }, [chave]); // eslint-disable-line

  return <div className="canvas" ref={ref}>
    <svg className="ligacoes" ref={svg} />
    <div className="equipe">
      <div className="colx">
        {[...origens.entries()].map(([id, n]) => { const o = dados.setores.find(x => x.id === id); return <div key={id} className="no ent" data-no={'in-' + id} style={{ ['--c' as string]: o?.cor }}><div className="nt"><PontoSetor s={o} />{o?.nome}</div><div className="ns">{n} recebida(s) em aberto</div></div>; })}
        {aguardando > 0 && <div className="no caixa" data-no="caixa" onClick={() => document.getElementById('aguardando')?.scrollIntoView({ behavior: 'smooth' })}><div className="nt"><LuHourglass size={15} />Aguardando aceite</div><div className="ns">{aguardando} solicitação(ões)</div></div>}
        {!origens.size && !aguardando && <div className="no" style={{ opacity: .65 }}><div className="ns">Sem entradas de outros setores</div></div>}
      </div>
      <div className="colx"><div className="no hub" data-no="hub" style={{ ['--c' as string]: s.cor }}><div className="nt">{s.nome}</div><div className="ns">{abertas.length} abertas · {membros.length} pessoas</div><div className="ns">{abertas.filter(a => a.status === 'a_distribuir').length} a distribuir</div></div></div>
      <div className={`colx pessoas ${membros.length <= 4 ? 'uma' : ''}`}>{membros.map(p => {
        const mine = abertas.filter(a => a.responsavel_id === p.id); const cur = mine.find(a => a.status === 'em_andamento'); const late = mine.filter(atrasada).length;
        const aus = ausenciaAtiva(dados.ausencias, p.id);
        return <div key={p.id} className={`no pessoa ${aus ? 'ausente' : ''}`} data-no={'p-' + p.id}><Avatar p={p} setores={dados.setores} tam="m" />
          <div style={{ minWidth: 0 }}><div className="nt">{p.nome.split(' ').slice(0, 2).join(' ')}{p.id === s.gestor_id && <span className="xs muted">gestor</span>}</div>
            <div className="atual" style={cur ? { cursor: 'pointer' } : undefined} onClick={() => cur && abrirAtividade(cur.id)}><span className="est" style={{ background: cur ? 'var(--blue)' : 'var(--line)' }} />{cur ? cur.titulo : aus ? <span style={{ color: 'var(--purple)' }}>{TIPO_AUSENCIA[aus.tipo]} até {fmtData(aus.fim)}</span> : <span className="muted">Sem atividade em andamento</span>}</div>
            <div className="ns">{mine.length} na fila{late ? <b style={{ color: 'var(--red)' }}> · {late} atrasada(s)</b> : ''}</div>
            <div className="carga" style={{ ['--c' as string]: late ? 'var(--red)' : s.cor }}><i style={{ width: `${(mine.length / maxCarga) * 100}%` }} /></div></div></div>;
      })}{!membros.length && <div className="no"><div className="ns">Nenhuma pessoa neste setor</div></div>}</div>
      {saidas.size > 0 && <div className="colx">{[...saidas.entries()].map(([id, e]) => { const d = dados.setores.find(x => x.id === id); return <div key={id} className="no sai" data-no={'out-' + id} style={{ ['--c' as string]: d?.cor }}><div className="nt"><PontoSetor s={d} />{d?.nome}</div><div className="ns">{e.n} seguirão para cá</div></div>; })}</div>}
    </div>
  </div>;
}
