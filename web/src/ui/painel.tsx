import { useState } from 'react';
import type { ReactNode } from 'react';
import { LuChevronLeft, LuChevronRight, LuInbox, LuLayers, LuPlay, LuClock, LuTriangleAlert, LuCircleCheck, LuTarget, LuTimer, LuHourglass } from 'react-icons/lu';
import type { Atividade, Ausencia, Dados } from '../lib/types';
import { atrasada, fmtData, hoje, indicadores, ordenar, ymd, TIPO_AUSENCIA } from '../lib/regras';
import { useDados } from '../app/contexto';
import { Modal } from './base';
import { Cartao } from './atividade';

export function Indicadores({ lista, onFiltro, extra = true }: { lista: Atividade[]; onFiltro?: (f: string) => void; extra?: boolean }) {
  const i = indicadores(lista);
  const K = ({ v, l, k, Ic, bar, f }: { v: string | number; l: string; k: string; Ic: typeof LuInbox; bar?: number; f?: string }) =>
    <div className={`kpi ${onFiltro && f ? 'clicavel' : ''} ${v === 0 ? 'zero' : ''} ${k === 'red' && Number(v) > 0 ? 'alerta' : ''}`} style={{ ['--k' as string]: `var(--${k})` }} onClick={() => f && onFiltro?.(f)} role={onFiltro && f ? 'button' : undefined} title={onFiltro && f ? `Ver ${l.toLowerCase()}` : undefined}>
      <span className="ic"><Ic size={16} /></span><span className="v">{v}</span><span className="l">{l}</span>{bar != null && <div className="bar"><i style={{ width: `${bar}%` }} /></div>}
    </div>;
  return <div className="kpis">
    <K v={i.abertas} l="Abertas" k="accent" Ic={LuLayers} f="abertas" />
    <K v={i.aguardando} l="Aguardando aceite" k="amber" Ic={LuHourglass} f="aguardando_aceite" />
    <K v={i.distribuir} l="A distribuir" k="cyan" Ic={LuInbox} f="a_distribuir" />
    <K v={i.fila} l="Na fila" k="slate" Ic={LuClock} f="na_fila" />
    <K v={i.andamento} l="Em andamento" k="blue" Ic={LuPlay} bar={i.ocupacaoPct} f="em_andamento" />
    <K v={i.atrasadas} l="Atrasadas" k="red" Ic={LuTriangleAlert} f="atrasadas" />
    <K v={i.concluidas30} l="Concluídas 30d" k="green" Ic={LuCircleCheck} f="concluida" />
    {extra && <K v={`${i.noPrazoPct}%`} l="No prazo" k="green" Ic={LuTarget} bar={i.noPrazoPct} />}
    {extra && <K v={i.leadTimeDias == null ? '—' : `${String(i.leadTimeDias).replace('.', ',')} d`} l="Tempo médio" k="purple" Ic={LuTimer} />}
  </div>;
}

export function Calendario({ lista, ausencias = [], titulo = 'Calendário', dados }: { lista: Atividade[]; ausencias?: Ausencia[]; titulo?: string; dados: Dados }) {
  const { abrirAtividade } = useDados();
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [dia, setDia] = useState<string | null>(null);
  const [y, m] = mes.split('-').map(Number);
  const primeiro = new Date(y, m - 1, 1);
  const inicio = new Date(y, m - 1, 1 - primeiro.getDay());
  const porDia = new Map<string, Atividade[]>();
  lista.filter(a => a.prazo).forEach(a => porDia.set(a.prazo as string, [...(porDia.get(a.prazo as string) || []), a]));
  const navegarMes = (n: number) => { const d = new Date(y, m - 1 + n, 1); setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const celulas: ReactNode[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const fora = d.getMonth() !== m - 1;
    if (i % 7 === 0 && i >= 28 && fora) break;
    const k = ymd(d), its = ordenar(porDia.get(k) || []);
    const aus = ausencias.filter(a => a.inicio <= k && a.fim >= k);
    celulas.push(<div key={k} className={`cal-d ${fora ? 'fora' : ''} ${k === hoje() ? 'hoje' : ''} ${d.getDay() % 6 === 0 ? 'fds' : ''}`}>
      <span className="n">{d.getDate()}</span>
      {aus.slice(0, 2).map(a => <span key={a.id} className="cal-aus" title={`${TIPO_AUSENCIA[a.tipo]}: ${dados.perfis.find(p => p.id === a.pessoa_id)?.nome} (${fmtData(a.inicio)}–${fmtData(a.fim)})`}>{TIPO_AUSENCIA[a.tipo]} · {dados.perfis.find(p => p.id === a.pessoa_id)?.nome.split(' ')[0]}</span>)}
      {its.slice(0, 3).map(a => <div key={a.id} className={`cal-i ${a.status === 'concluida' ? 'feita' : ''} ${atrasada(a) ? 'atraso' : ''}`} style={{ ['--c' as string]: dados.setores.find(s => s.id === a.setor_id)?.cor }} title={`#${a.numero} ${a.titulo}`} onClick={() => abrirAtividade(a.id)}>{a.titulo}</div>)}
      {its.length > 3 && <span className="cal-mais" onClick={() => setDia(k)}>+{its.length - 3} mais</span>}
    </div>);
  }
  return <>
    <div className="cal-h">{titulo && <><h2>{titulo}</h2><span className="muted sm">por prazo</span></>}<span className="sp" />
      <button className="btn icone p" onClick={() => navegarMes(-1)} aria-label="Mês anterior"><LuChevronLeft size={16} /></button>
      <span className="mes">{primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
      <button className="btn icone p" onClick={() => navegarMes(1)} aria-label="Próximo mês"><LuChevronRight size={16} /></button>
      <button className="btn p" onClick={() => setMes(hoje().slice(0, 7))}>Hoje</button></div>
    <div className="cal">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="cal-s">{d}</div>)}{celulas}</div>
    {dia && <Modal titulo={`Prazo em ${fmtData(dia)}`} onFechar={() => setDia(null)}><div className="lista-cartoes">{ordenar(porDia.get(dia) || []).map(a => <Cartao key={a.id} a={a} mostrarSetor />)}</div></Modal>}
  </>;
}
