import { useMemo, useState } from 'react';
import { LuCircleCheck, LuTriangleAlert, LuCircleAlert, LuInfo, LuSave, LuRotateCcw, LuPencil, LuTarget } from 'react-icons/lu';
import { useDados } from '../app/contexto';
import type { Atividade, Prioridade, SlaDias } from '../lib/types';
import {
  PRIORIDADE, SITUACAO_SLA, aberta, addDias, diasUteisEntre, ehAdmin, fmtData, gere, hoje, metaDoSetor, primeiroNome,
  resumoSla, setoresGeridos, situacaoMeta, slaAtividade, ymd, type SituacaoSla,
} from '../lib/regras';
import { Avatar, Aviso, Painel, PontoSetor, Pri, Vazio } from '../ui/base';

type Periodo = 'mes' | '30' | '90';
const PERIODOS: [Periodo, string][] = [['mes', 'Este mês'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias']];
const intervalo = (p: Periodo): [string, string] => p === 'mes' ? [hoje().slice(0, 8) + '01', hoje()] : [addDias(-(Number(p) - 1)), hoje()];
const pct = (n: number | null) => (n == null ? '—' : `${n}%`);
const dias = (n: number | null) => (n == null ? '—' : `${n.toFixed(1).replace('.', ',')} d`);
const horas = (n: number | null) => (n == null ? '—' : n < 1 ? `${Math.round(n * 60)} min` : `${n.toFixed(1).replace('.', ',')} h`);

const SIT_META = {
  na_meta: { rotulo: 'Na meta', tom: 'green', Ic: LuCircleCheck },
  atencao: { rotulo: 'Atenção', tom: 'amber', Ic: LuTriangleAlert },
  abaixo: { rotulo: 'Abaixo da meta', tom: 'red', Ic: LuCircleAlert },
  sem_dados: { rotulo: 'Sem entregas', tom: 'gray', Ic: LuInfo },
} as const;
function PillMeta({ pct: p, meta }: { pct: number | null; meta: number }) {
  const s = SIT_META[situacaoMeta(p, meta)];
  return <span className={`pill t-${s.tom}`}><s.Ic size={12} />{s.rotulo}</span>;
}
export function PillSla({ s }: { s: SituacaoSla }) {
  const i = SITUACAO_SLA[s];
  const Ic = s === 'estourado' || s === 'violado' ? LuCircleAlert : s === 'em_risco' ? LuTriangleAlert : LuCircleCheck;
  return <span className={`pill t-${i.tom}`}><Ic size={12} />{i.rotulo}</span>;
}
/** Barra do resultado com a marca da meta. */
function BarraMeta({ valor, meta }: { valor: number | null; meta: number }) {
  const sit = situacaoMeta(valor, meta);
  return <div className="barra-meta" title={`Resultado ${pct(valor)} · meta ${meta}%`}>
    <div className="trilho-b"><i className={`s-${sit}`} style={{ width: `${valor ?? 0}%` }} /><b style={{ left: `${meta}%` }} /></div>
    <span className="num">{pct(valor)}</span>
  </div>;
}

export function IndicadoresMetas() {
  const { dados, eu } = useDados();
  const geridos = setoresGeridos(eu, dados.setores);
  const [aba, setAba] = useState<'acomp' | 'metas'>('acomp');
  const [setor, setSetor] = useState<string>(() => (geridos.length === 1 ? geridos[0] : ''));
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const escopo = setor ? [setor] : geridos;
  const [de, ate] = intervalo(periodo);
  const ats = useMemo(() => dados.atividades.filter(a => escopo.includes(a.setor_id)), [dados.atividades, escopo.join()]); // eslint-disable-line
  const r = resumoSla(ats, dados.metas, de, ate);
  const metaRef = metaDoSetor(dados.metas, setor || null);
  // meta de entregas só soma (e compara) os setores que têm meta mensal definida
  const comMeta = periodo === 'mes' ? escopo.filter(id => metaDoSetor(dados.metas, id).meta_concluidas_mes != null) : [];
  const metaEntregas = comMeta.length ? comMeta.reduce((s, id) => s + (metaDoSetor(dados.metas, id).meta_concluidas_mes || 0), 0) : null;
  const entregasComMeta = comMeta.length ? dados.atividades.filter(a => comMeta.includes(a.setor_id) && a.status === 'concluida' && (a.concluido_em || '').slice(0, 10) >= de).length : 0;
  const nomeSetor = setor ? dados.setores.find(s => s.id === setor)?.nome : null;

  return <>
    <div className="cabeca">
      <div className="t"><h1>Indicadores e metas</h1><p>{nomeSetor ? `${nomeSetor} · ` : geridos.length > 1 ? `${geridos.length} setores · ` : ''}SLA de atendimento, metas por equipe e o que precisa de atenção agora.</p></div>
      <div className="sp">
        {aba === 'acomp' && geridos.length > 1 && <select className="inp" style={{ width: 'auto' }} value={setor} onChange={e => setSetor(e.target.value)} aria-label="Setor">
          <option value="">Todos os {ehAdmin(eu) ? 'setores' : 'meus setores'}</option>{geridos.map(id => <option key={id} value={id}>{dados.setores.find(s => s.id === id)?.nome}</option>)}</select>}
        {aba === 'acomp' && <div className="segmento">{PERIODOS.map(([k, t]) => <button key={k} className={periodo === k ? 'on' : ''} onClick={() => setPeriodo(k)}>{t}</button>)}</div>}
      </div>
    </div>
    <div className="abas" style={{ padding: 0 }}>
      <button className={aba === 'acomp' ? 'on' : ''} onClick={() => setAba('acomp')}>Acompanhamento</button>
      <button className={aba === 'metas' ? 'on' : ''} onClick={() => setAba('metas')}><LuTarget size={15} />Metas e SLA</button>
    </div>

    {aba === 'metas' ? <ConfigMetas geridos={geridos} /> : <>
      <div className="placar">
        <div className="cel destaque">
          <span className="l">Entregues no SLA</span>
          <span className="v">{pct(r.pctSla)}</span>
          <BarraMeta valor={r.pctSla} meta={metaRef.meta_sla_pct} />
          <span className="row sm muted" style={{ gap: 8 }}>meta {metaRef.meta_sla_pct}%{setor ? '' : ' (padrão da empresa)'}<PillMeta pct={r.pctSla} meta={metaRef.meta_sla_pct} /></span>
        </div>
        <div className="cel"><span className="l">Entregas</span><span className="v">{r.concluidas}</span><span className="sm muted">{metaEntregas != null ? (comMeta.length === escopo.length ? `meta de ${metaEntregas} no mês` : `${entregasComMeta} de ${metaEntregas} nos ${comMeta.length === 1 ? 'setor' : `${comMeta.length} setores`} com meta`) : `${r.cumpridas} dentro do SLA`}</span>
          {metaEntregas != null && <div className="trilho-b fino" title={`${entregasComMeta} de ${metaEntregas}`}><i className={`s-${entregasComMeta >= metaEntregas ? 'na_meta' : 'atencao'}`} style={{ width: `${Math.min(100, metaEntregas ? (entregasComMeta / metaEntregas) * 100 : 100)}%` }} /></div>}</div>
        <div className="cel"><span className="l">Em risco agora</span><span className={`v ${r.emRisco ? 't-ambar' : 'zero'}`}>{r.emRisco}</span><span className="sm muted">{LIMIAR_TXT}</span></div>
        <div className="cel"><span className="l">Estouradas agora</span><span className={`v ${r.estouradas ? 't-verm' : 'zero'}`}>{r.estouradas}</span><span className="sm muted">de {r.abertas} abertas</span></div>
        <div className="cel"><span className="l">Aceite no SLA</span><span className="v">{pct(r.pctAceite)}</span><span className="sm muted">média de {horas(r.aceiteMedioH)} · limite {metaRef.sla_aceite_horas} h</span></div>
        <div className="cel"><span className="l">Tempo médio de entrega</span><span className="v">{dias(r.conclusaoMediaDias)}</span><span className="sm muted">da abertura à conclusão</span></div>
      </div>

      <Painel titulo="Evolução semanal" sub="percentual de entregas dentro do SLA nas últimas 8 semanas">
        <GraficoSemanas ats={ats} meta={metaRef.meta_sla_pct} />
      </Painel>

      {!setor && geridos.length > 1 && <Painel titulo="Por equipe" sub="clique em um setor para ver os detalhes" sem>
        <div className="tabela-wrap"><table className="tb"><thead><tr><th>Setor</th><th>Meta</th><th style={{ minWidth: 190 }}>Entregues no SLA</th><th className="d">Entregas</th><th className="d">Em risco</th><th className="d">Estouradas</th><th className="d">Aceite no SLA</th><th className="d">Tempo médio</th><th>Situação</th></tr></thead>
          <tbody>{geridos.map(id => {
            const s = dados.setores.find(x => x.id === id)!; const m = metaDoSetor(dados.metas, id);
            const rs = resumoSla(dados.atividades.filter(a => a.setor_id === id), dados.metas, de, ate);
            return <tr key={id} className="clic" onClick={() => setSetor(id)}>
              <td><span className="row"><PontoSetor s={s} /><b>{s.nome}</b></span></td>
              <td className="num">{m.meta_sla_pct}%{m.origem !== 'setor' && <span className="xs muted"> · padrão</span>}</td>
              <td><BarraMeta valor={rs.pctSla} meta={m.meta_sla_pct} /></td>
              <td className="d num">{rs.concluidas}</td><Num v={rs.emRisco} cls="t-ambar" /><Num v={rs.estouradas} cls="t-verm" />
              <td className="d num">{pct(rs.pctAceite)}</td><td className="d num">{dias(rs.conclusaoMediaDias)}</td>
              <td><PillMeta pct={rs.pctSla} meta={m.meta_sla_pct} /></td></tr>;
          })}</tbody></table></div>
      </Painel>}

      <PorPessoa escopo={escopo} de={de} ate={ate} />
      <SlaPorAtividade ats={ats} de={de} ate={ate} />
    </>}
  </>;
}
const LIMIAR_TXT = 'usaram 75% ou mais do prazo';
const Num = ({ v, cls }: { v: number; cls: string }) => <td className={`d num ${v ? cls : 'muted'}`} style={v ? { fontWeight: 650 } : undefined}>{v}</td>;

/** Barras semanais (uma série: % no SLA) com a linha da meta. */
function GraficoSemanas({ ats, meta }: { ats: Atividade[]; meta: number }) {
  const { dados } = useDados();
  const [foco, setFoco] = useState<number | null>(null);
  const semanas = useMemo(() => {
    const seg = new Date(); seg.setHours(12, 0, 0, 0); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
    return Array.from({ length: 8 }, (_, i) => {
      const ini = new Date(seg); ini.setDate(seg.getDate() - (7 - i) * 7);
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
      const r = resumoSla(ats, dados.metas, ymd(ini), ymd(fim));
      return { ini, fim, r };
    });
  }, [ats, dados.metas]);
  if (!semanas.some(s => s.r.concluidas)) return <Vazio>Ainda não há entregas nas últimas 8 semanas.</Vazio>;
  const W = 720, H = 220, E = 40, D = 12, T = 14, B = 34, larg = (W - E - D) / 8, barra = Math.min(46, larg * 0.56);
  const y = (v: number) => T + (H - T - B) * (1 - v / 100);
  const f = foco != null ? semanas[foco] : null;
  return <div className="grafico-sla">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Percentual de entregas no SLA por semana. Meta de ${meta}%.`} onMouseLeave={() => setFoco(null)}>
      {[0, 50, 100].map(v => <g key={v}><line x1={E} x2={W - D} y1={y(v)} y2={y(v)} className="grade-g" /><text x={E - 8} y={y(v) + 4} textAnchor="end" className="eixo">{v}%</text></g>)}
      {semanas.map((s, i) => {
        const x = E + i * larg + (larg - barra) / 2, v = s.r.pctSla;
        return <g key={i} onMouseEnter={() => setFoco(i)} onFocus={() => setFoco(i)} tabIndex={0} aria-label={`Semana de ${fmtData(ymd(s.ini))}: ${v == null ? 'sem entregas' : `${v}% no SLA, ${s.r.concluidas} entregas`}`}>
          <rect x={E + i * larg} y={T} width={larg} height={H - T - B} fill="transparent" />
          {v != null ? <path className={`barra-g ${foco === i ? 'foco' : ''}`} d={barraArredondada(x, y(v), barra, y(0) - y(v))} /> : <text x={x + barra / 2} y={y(0) - 6} textAnchor="middle" className="eixo">—</text>}
          {i === 7 && v != null && <text x={x + barra / 2} y={y(v) - 7} textAnchor="middle" className="valor-g">{v}%</text>}
          <text x={x + barra / 2} y={H - 12} textAnchor="middle" className="eixo">{`${String(s.ini.getDate()).padStart(2, '0')}/${String(s.ini.getMonth() + 1).padStart(2, '0')}`}</text>
        </g>;
      })}
      <line x1={E} x2={W - D} y1={y(meta)} y2={y(meta)} className="meta-g" />
      <text x={W - D} y={y(meta) - 6} textAnchor="end" className="rot-meta">meta {meta}%</text>
    </svg>
    <div className="dica-g" aria-live="polite">{f ? <>Semana de <b>{fmtData(ymd(f.ini))}</b> a {fmtData(ymd(f.fim))}: {f.r.concluidas ? <><b>{f.r.pctSla}%</b> no SLA · {f.r.concluidas} entregas, {f.r.cumpridas} dentro do prazo</> : 'sem entregas'}</>
      : <span className="muted">Passe o mouse sobre uma semana para ver os números.</span>}</div>
  </div>;
}
/** Barra com topo arredondado (4px) e base reta no eixo. */
function barraArredondada(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2);
  if (h <= 0) return '';
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function PorPessoa({ escopo, de, ate }: { escopo: string[]; de: string; ate: string }) {
  const { dados } = useDados();
  const linhas = dados.perfis.filter(p => p.ativo && p.setor_id && escopo.includes(p.setor_id)).map(p => {
    const ats = dados.atividades.filter(a => a.responsavel_id === p.id && a.setor_id === p.setor_id);
    return { p, r: resumoSla(ats, dados.metas, de, ate), abertas: ats.filter(aberta).length, meta: metaDoSetor(dados.metas, p.setor_id).meta_sla_pct };
  }).sort((a, b) => b.r.estouradas - a.r.estouradas || b.r.emRisco - a.r.emRisco || a.p.nome.localeCompare(b.p.nome));
  if (!linhas.length) return null;
  return <Painel titulo="Por pessoa" sub="quem precisa de apoio aparece primeiro" sem>
    <div className="tabela-wrap"><table className="tb"><thead><tr><th>Pessoa</th>{escopo.length > 1 && <th>Setor</th>}<th className="d">Abertas</th><th className="d">Em risco</th><th className="d">Estouradas</th><th className="d">Entregas</th><th style={{ minWidth: 170 }}>Entregues no SLA</th><th className="d">Tempo médio</th></tr></thead>
      <tbody>{linhas.map(({ p, r, abertas, meta }) => <tr key={p.id}>
        <td><span className="row"><Avatar p={p} setores={dados.setores} tam="p" /><b>{p.nome}</b></span></td>
        {escopo.length > 1 && <td><span className="row"><PontoSetor s={dados.setores.find(s => s.id === p.setor_id)} />{dados.setores.find(s => s.id === p.setor_id)?.nome}</span></td>}
        <td className="d num">{abertas}</td><Num v={r.emRisco} cls="t-ambar" /><Num v={r.estouradas} cls="t-verm" />
        <td className="d num">{r.concluidas}</td><td><BarraMeta valor={r.pctSla} meta={meta} /></td><td className="d num">{dias(r.conclusaoMediaDias)}</td></tr>)}</tbody></table></div>
  </Painel>;
}

type FiltroAt = 'em_risco' | 'estourado' | 'abertas' | 'concluidas';
function SlaPorAtividade({ ats, de, ate }: { ats: Atividade[]; de: string; ate: string }) {
  const { dados, abrirAtividade } = useDados();
  const agora = new Date();
  const todas = ats.map(a => ({ a, s: slaAtividade(a, dados.metas, agora) })).filter(x => x.s.situacao !== 'sem_sla');
  const ab = todas.filter(x => aberta(x.a));
  const conc = todas.filter(x => x.a.status === 'concluida' && (x.a.concluido_em || '').slice(0, 10) >= de && (x.a.concluido_em || '').slice(0, 10) <= ate);
  const grupos: Record<FiltroAt, typeof todas> = {
    em_risco: ab.filter(x => x.s.situacao === 'em_risco'), estourado: ab.filter(x => x.s.situacao === 'estourado'), abertas: ab, concluidas: conc,
  };
  const [f, setF] = useState<FiltroAt>(() => (grupos.estourado.length ? 'estourado' : grupos.em_risco.length ? 'em_risco' : 'abertas'));
  const [limite, setLimite] = useState(30);
  const lista = grupos[f].slice().sort((x, y) => f === 'concluidas' ? (y.a.concluido_em || '').localeCompare(x.a.concluido_em || '') : y.s.consumo - x.s.consumo);
  const rot: [FiltroAt, string][] = [['estourado', 'Estouradas'], ['em_risco', 'Em risco'], ['abertas', 'Todas abertas'], ['concluidas', 'Entregues no período']];
  return <Painel titulo="SLA por atividade" acoes={<div className="segmento">{rot.map(([k, t]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => { setF(k); setLimite(30); }}>{t}<span className="c">{grupos[k].length}</span></button>)}</div>} sem>
    {!lista.length ? <div style={{ padding: 18 }}><Vazio>{f === 'estourado' ? 'Nenhuma atividade com o SLA estourado.' : f === 'em_risco' ? 'Nenhuma atividade em risco agora.' : 'Nada para mostrar neste filtro.'}</Vazio></div> : <>
      <div className="tabela-wrap"><table className="tb"><thead><tr><th>Atividade</th><th>Setor</th><th>Responsável</th><th>Prioridade</th><th>Limite do SLA</th><th style={{ minWidth: 150 }}>Prazo consumido</th><th>Situação</th></tr></thead>
        <tbody>{lista.slice(0, limite).map(({ a, s }) => {
          const st = dados.setores.find(x => x.id === a.setor_id); const r = dados.perfis.find(x => x.id === a.responsavel_id);
          const du = diasUteisEntre(agora, s.limite);
          return <tr key={a.id} className="clic" onClick={() => abrirAtividade(a.id)}>
            <td style={{ maxWidth: 340 }}><div className="ellipsis"><span className="muted num">#{a.numero}</span> <b>{a.titulo}</b></div></td>
            <td><span className="row"><PontoSetor s={st} />{st?.nome}</span></td>
            <td>{r ? <span className="row"><Avatar p={r} setores={dados.setores} tam="p" />{primeiroNome(r.nome)}</span> : <span className="muted">sem responsável</span>}</td>
            <td><Pri p={a.prioridade} /><span className="sm muted">{a.prioridade === 'baixa' || a.prioridade === 'media' ? PRIORIDADE[a.prioridade].rotulo : ''} · {s.dias} d úteis</span></td>
            <td className="num">{fmtData(ymd(s.limite))}<div className="xs muted">{a.status === 'concluida' ? `entregue em ${fmtData(a.concluido_em)}` : du > 0 ? `faltam ${du} dia${du > 1 ? 's' : ''} úteis` : du === 0 ? 'vence hoje' : `há ${-du} dia${du < -1 ? 's' : ''} úteis`}</div></td>
            <td><Consumo v={s.consumo} sit={s.situacao} /></td>
            <td><PillSla s={s.situacao} /></td></tr>;
        })}</tbody></table></div>
      {lista.length > limite && <div style={{ padding: 12, textAlign: 'center' }}><button className="btn p" onClick={() => setLimite(l => l + 30)}>Mostrar mais {Math.min(30, lista.length - limite)} de {lista.length - limite}</button></div>}
    </>}
  </Painel>;
}
function Consumo({ v, sit }: { v: number; sit: SituacaoSla }) {
  const p = Math.round(v * 100);
  return <div className="barra-meta"><div className="trilho-b"><i className={`s-${sit === 'estourado' || sit === 'violado' ? 'abaixo' : sit === 'em_risco' ? 'atencao' : 'na_meta'}`} style={{ width: `${Math.min(100, p)}%` }} /><b style={{ left: '75%' }} className="limiar" /></div><span className="num">{p}%</span></div>;
}

/* ===================== configuração de metas e SLA ===================== */
function ConfigMetas({ geridos }: { geridos: string[] }) {
  const { dados, eu } = useDados();
  const admin = ehAdmin(eu);
  return <>
    <Aviso><b>Como o SLA é contado: </b>da abertura do pedido até a conclusão, em <b>dias úteis</b> (sábado e domingo não contam), conforme a prioridade. A atividade fica <b>em risco</b> ao usar 75% do prazo e <b>estourada</b> quando o passa. O <b>SLA de aceite</b> conta as horas entre a chegada ao setor e o aceite do gestor. Setores sem meta própria usam o padrão da empresa.</Aviso>
    <Painel titulo="Metas e SLA por setor" sub={admin ? 'a diretoria define o padrão; cada gestor pode ajustar o do seu setor' : 'ajuste o SLA e as metas dos setores que você gerencia'} sem>
      <div className="tabela-wrap"><table className="tb metas-tb"><thead><tr><th>Setor</th>{(Object.keys(PRIORIDADE) as Prioridade[]).slice().reverse().map(k => <th key={k} className="d">{PRIORIDADE[k].rotulo}<div className="xs muted" style={{ fontWeight: 500 }}>dias úteis</div></th>)}
        <th className="d">Aceite<div className="xs muted" style={{ fontWeight: 500 }}>horas</div></th><th className="d">Meta no SLA<div className="xs muted" style={{ fontWeight: 500 }}>% das entregas</div></th><th className="d">Entregas<div className="xs muted" style={{ fontWeight: 500 }}>por mês</div></th><th /></tr></thead>
        <tbody>
          <LinhaMeta setorId={null} podeEditar={admin} />
          {geridos.map(id => <LinhaMeta key={id} setorId={id} podeEditar={gere(eu, id, dados.setores)} />)}
        </tbody></table></div>
    </Painel>
  </>;
}
function LinhaMeta({ setorId, podeEditar }: { setorId: string | null; podeEditar: boolean }) {
  const { dados, svc, executar, confirmar } = useDados();
  const m = metaDoSetor(dados.metas, setorId);
  const propria = setorId ? m.origem === 'setor' : true;
  const inicial = () => ({ sla: { ...m.sla_dias } as SlaDias, aceite: m.sla_aceite_horas, meta: m.meta_sla_pct, entregas: m.meta_concluidas_mes == null ? '' : String(m.meta_concluidas_mes) });
  const [ed, setEd] = useState<ReturnType<typeof inicial> | null>(null);
  const s = setorId ? dados.setores.find(x => x.id === setorId) : null;
  const ordem = (Object.keys(PRIORIDADE) as Prioridade[]).slice().reverse();
  const nome = s ? <span className="row"><PontoSetor s={s} /><b>{s.nome}</b>{!propria && <span className="xs muted">usa o padrão</span>}</span> : <span className="row"><b>Padrão da empresa</b><span className="xs muted">{m.origem === 'padrao' ? 'valores do sistema' : ''}</span></span>;
  if (!ed) return <tr className={!propria ? 'herdada' : ''}>
    <td>{nome}</td>
    {ordem.map(k => <td key={k} className="d num">{m.sla_dias[k]}</td>)}
    <td className="d num">{m.sla_aceite_horas}</td><td className="d num">{m.meta_sla_pct}%</td><td className="d num">{m.meta_concluidas_mes ?? '—'}</td>
    <td className="d">{podeEditar && <span className="row" style={{ justifyContent: 'flex-end' }}>
      <button className="btn p" onClick={() => setEd(inicial())}><LuPencil size={13} />{propria ? 'Editar' : 'Personalizar'}</button>
      {setorId && propria && m.origem === 'setor' && <button className="btn p fant" title="Voltar a usar o padrão da empresa" onClick={async () => { if (await confirmar({ titulo: 'Voltar ao padrão da empresa', texto: `${s?.nome} passará a usar o SLA e as metas padrão.`, ok: 'Voltar ao padrão' })) executar(() => svc.removerMeta(m), 'Setor voltou ao padrão da empresa'); }}><LuRotateCcw size={13} /></button>}
    </span>}</td></tr>;
  const num = (v: string | number) => Math.round(Number(v));
  const salvar = async () => {
    const r = await executar(() => svc.salvarMeta(setorId, { sla_dias: Object.fromEntries(ordem.map(k => [k, num(ed.sla[k])])) as SlaDias, sla_aceite_horas: num(ed.aceite), meta_sla_pct: num(ed.meta), meta_concluidas_mes: ed.entregas === '' ? null : num(ed.entregas) }), 'Metas salvas');
    if (r !== undefined) setEd(null);
  };
  const campo = (v: string | number, on: (x: string) => void, max: number, rot: string) => <input className="inp num-inp" type="number" min={0} max={max} value={v} aria-label={rot} onChange={e => on(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEd(null); }} />;
  return <tr className="editando">
    <td>{nome}</td>
    {ordem.map(k => <td key={k} className="d">{campo(ed.sla[k], x => setEd({ ...ed, sla: { ...ed.sla, [k]: x as unknown as number } }), 90, `SLA ${PRIORIDADE[k].rotulo} em dias úteis`)}</td>)}
    <td className="d">{campo(ed.aceite, x => setEd({ ...ed, aceite: x as unknown as number }), 240, 'SLA de aceite em horas')}</td>
    <td className="d">{campo(ed.meta, x => setEd({ ...ed, meta: x as unknown as number }), 100, 'Meta de entregas no SLA em %')}</td>
    <td className="d">{campo(ed.entregas, x => setEd({ ...ed, entregas: x }), 9999, 'Meta de entregas por mês')}</td>
    <td className="d"><span className="row" style={{ justifyContent: 'flex-end' }}><button className="btn p" onClick={() => setEd(null)}>Cancelar</button><button className="btn p pri" onClick={salvar}><LuSave size={13} />Salvar</button></span></td>
  </tr>;
}
