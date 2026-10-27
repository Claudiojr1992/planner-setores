import { useState } from 'react';
import type { ReactNode } from 'react';
import { LuArrowRight, LuPlus, LuInbox, LuHourglass, LuChevronDown, LuChevronRight } from 'react-icons/lu';
import { useDados } from '../app/contexto';
import { navegar } from '../app/rota';
import type { Atividade } from '../lib/types';
import { aberta, addDias, atrasada, ehGestor, hoje, indicadores, ordenar, proximosNos, setoresGeridos, venceHoje, STATUS, FINAIS } from '../lib/regras';
import { Painel, Vazio, PontoSetor } from '../ui/base';
import { LinhaAtividade } from '../ui/atividade';
import { Calendario } from '../ui/painel';

const lerPref = (k: string, padrao: string) => { try { return localStorage.getItem(k) || padrao; } catch { return padrao; } };
const gravarPref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };
const ir = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function Inicio() {
  const { dados, eu, abrirNova, abrirAtividade } = useDados();
  const [aba, setAba] = useState<'fila' | 'solicitadas' | 'concluidas'>('fila');
  const [agenda, setAgenda] = useState<'dias' | 'mes'>(() => lerPref('planner.inicio.agenda', 'dias') as 'dias' | 'mes');
  const [mapa, setMapa] = useState(() => lerPref('planner.inicio.mapa', '1') === '1');

  const minhas = dados.atividades.filter(a => a.responsavel_id === eu.id);
  const abertas = ordenar(minhas.filter(aberta));
  const solicitadas = ordenar(dados.atividades.filter(a => a.criado_por === eu.id && a.setor_id !== eu.setor_id));
  const solicitadasAbertas = solicitadas.filter(a => !FINAIS.includes(a.status));
  const concluidas = minhas.filter(a => a.status === 'concluida').sort((a, b) => (b.concluido_em || '').localeCompare(a.concluido_em || '')).slice(0, 15);

  // fila em ordem de urgência: o que está atrasado, o que vence hoje, o que já está em mãos, o resto
  const atrasadas = abertas.filter(a => atrasada(a));
  const deHoje = abertas.filter(a => !atrasada(a) && venceHoje(a));
  const usados = new Set([...atrasadas, ...deHoje].map(a => a.id));
  const resto = abertas.filter(a => !usados.has(a.id));
  const grupos: [string, string, Atividade[], string][] = [
    ['g-atraso', 'Atrasadas', atrasadas, 'atraso'],
    ['g-hoje', 'Vencem hoje', deHoje, 'hoje'],
    ['g-andamento', 'Em andamento', resto.filter(a => a.status === 'em_andamento'), ''],
    ['g-proximas', 'Próximas', resto.filter(a => a.status === 'na_fila' || a.status === 'aguardando_aceite' || a.status === 'a_distribuir'), ''],
    ['g-pausadas', 'Pausadas', resto.filter(a => a.status === 'pausada'), ''],
  ];

  const gestor = ehGestor(eu, dados.setores);
  const geridos = setoresGeridos(eu, dados.setores);
  const precisa = ordenar(dados.atividades.filter(a => geridos.includes(a.setor_id) && (a.status === 'aguardando_aceite' || a.status === 'a_distribuir')));
  const nAceite = precisa.filter(a => a.status === 'aguardando_aceite').length;

  const h = new Date().getHours();
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const setor = (id?: string | null) => dados.setores.find(s => s.id === id);
  const i30 = indicadores(minhas);
  const andamento = grupos[2][2].length;

  const resumo = atrasadas.length ? `${atrasadas.length === 1 ? 'Uma atividade está atrasada' : `${atrasadas.length} atividades estão atrasadas`}: comece por ela${atrasadas.length > 1 ? 's' : ''}.`
    : deHoje.length ? `${deHoje.length === 1 ? 'Uma atividade vence' : `${deHoje.length} atividades vencem`} hoje.`
      : abertas.length ? 'Nada atrasado. Siga a sua fila.' : 'Sua fila está livre.';

  return <>
    <div className="saudacao">
      <div className="t"><h1>{saud}, {eu.nome.split(' ')[0]}</h1>
        <p>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · {resumo}</p></div>
      <div className="dia">
        <Contagem n={atrasadas.length} rot="atrasadas" cls="atraso" onClick={() => { setAba('fila'); setTimeout(() => ir('g-atraso')); }} />
        <Contagem n={deHoje.length} rot="vencem hoje" cls="hoje" onClick={() => { setAba('fila'); setTimeout(() => ir('g-hoje')); }} />
        <Contagem n={andamento} rot="em andamento" onClick={() => { setAba('fila'); setTimeout(() => ir('g-andamento')); }} />
        <Contagem n={solicitadasAbertas.length} rot="que pedi" onClick={() => setAba('solicitadas')} />
      </div>
    </div>

    {abertas.length > 0 && <Painel titulo="Meu fluxo" sub="de onde vem e para onde vai cada atividade sua"
      acoes={<button className="btn p fant" onClick={() => { setMapa(!mapa); gravarPref('planner.inicio.mapa', mapa ? '0' : '1'); }}>{mapa ? <><LuChevronDown size={14} />Recolher</> : <><LuChevronRight size={14} />Mostrar</>}</button>} sem>
      {mapa && <div style={{ padding: 14 }}>{meuFluxo()}</div>}
    </Painel>}

    {gestor && precisa.length > 0 && <section className="painel precisa">
      <div className="painel-h"><h2><LuHourglass size={16} />Precisa de você</h2>
        <span className="sub">{nAceite > 0 && `${nAceite} aguardando aceite`}{nAceite > 0 && precisa.length - nAceite > 0 && ' · '}{precisa.length - nAceite > 0 && `${precisa.length - nAceite} a distribuir`}</span>
        <div className="sp"><button className="btn p" onClick={() => navegar('/setor')}>Abrir painel do setor<LuArrowRight size={14} /></button></div></div>
      <div className="painel-b" style={{ paddingTop: 6, paddingBottom: 6 }}><div className="linhas">{precisa.slice(0, 6).map(a => <LinhaAtividade key={a.id} a={a} />)}</div>
        {precisa.length > 6 && <div className="sm muted" style={{ padding: '8px 0' }}>e mais {precisa.length - 6} no painel do setor.</div>}</div>
    </section>}

    <div className="mesa">
      <Painel titulo="Minhas atividades" acoes={<div className="segmento" role="tablist">
        <button role="tab" aria-selected={aba === 'fila'} className={aba === 'fila' ? 'on' : ''} onClick={() => setAba('fila')}>Minha fila<span className="c">{abertas.length}</span></button>
        <button role="tab" aria-selected={aba === 'solicitadas'} className={aba === 'solicitadas' ? 'on' : ''} onClick={() => setAba('solicitadas')}>Que solicitei<span className="c">{solicitadasAbertas.length}</span></button>
        <button role="tab" aria-selected={aba === 'concluidas'} className={aba === 'concluidas' ? 'on' : ''} onClick={() => setAba('concluidas')}>Concluídas</button></div>}>
        {aba === 'fila' && (abertas.length ? grupos.filter(g => g[2].length).map(([id, t, l, cls]) => <div key={id} id={id} style={{ scrollMarginTop: 80 }}>
          <div className={`grupo-fila ${cls}`}>{t}<span className="c">{l.length}</span></div>
          <div className="linhas">{l.map(a => <LinhaAtividade key={a.id} a={a} />)}</div></div>)
          : <Vazio icone={<LuInbox size={28} />}><b>Nada na sua fila</b><div>Quando o gestor distribuir uma atividade para você, ela aparece aqui.</div>
            <button className="btn pri" style={{ marginTop: 6 }} onClick={() => abrirNova()}><LuPlus size={15} />Nova solicitação</button></Vazio>)}
        {aba === 'solicitadas' && (solicitadas.length ? <div className="linhas">{solicitadas.map(a => <LinhaAtividade key={a.id} a={a} mostrarResp acoes={false} />)}</div>
          : <Vazio><b>Você ainda não pediu nada a outros setores</b><div>Use “Nova solicitação → Para outro setor” e acompanhe por aqui.</div></Vazio>)}
        {aba === 'concluidas' && (concluidas.length ? <div className="linhas">{concluidas.map(a => <LinhaAtividade key={a.id} a={a} acoes={false} />)}</div>
          : <Vazio>Nenhuma atividade concluída recentemente.</Vazio>)}
      </Painel>

      <div className="lado">
        <Painel titulo="Agenda" acoes={<div className="segmento">
          <button className={agenda === 'dias' ? 'on' : ''} onClick={() => { setAgenda('dias'); gravarPref('planner.inicio.agenda', 'dias'); }}>Próximos dias</button>
          <button className={agenda === 'mes' ? 'on' : ''} onClick={() => { setAgenda('mes'); gravarPref('planner.inicio.agenda', 'mes'); }}>Mês</button></div>}>
          {agenda === 'dias' ? <Agenda lista={abertas} /> : <Calendario lista={minhas} ausencias={dados.ausencias.filter(a => a.pessoa_id === eu.id)} titulo="" dados={dados} />}
        </Painel>
        <Painel titulo="Meus últimos 30 dias">
          <div className="numeros">
            <div><b>{i30.concluidas30}</b><span>concluídas</span></div>
            <div><b>{i30.concluidas30 ? `${i30.noPrazoPct}%` : '—'}</b><span>no prazo</span></div>
            <div><b>{i30.leadTimeDias == null ? '—' : `${String(i30.leadTimeDias).replace('.', ',')} d`}</b><span>tempo médio</span></div>
          </div>
        </Painel>
      </div>
    </div>
  </>;

  function meuFluxo() {
    return <div className="canvas"><div className="fluxo-linhas">{abertas.slice(0, 6).map(a => {
      const o = a.origem_id ? dados.atividades.find(x => x.id === a.origem_id) : null;
      const f = a.fluxo_id ? dados.fluxos.find(x => x.id === a.fluxo_id) : null;
      const prox = f && a.etapa_id ? proximosNos(f, a.etapa_id).map(n => ({ s: setor(n.setor_id), t: n.titulo })) : a.encaminhar_para ? [{ s: setor(a.encaminhar_para), t: 'Encaminhamento' }] : [];
      return <div key={a.id} className="fluxo-linha">
        {o && <><div className="fno fantasma" style={{ ['--c' as string]: setor(o.setor_id)?.cor }} onClick={() => abrirAtividade(o.id)}><div className="ft">Veio de {setor(o.setor_id)?.nome}</div><div className="fs">#{o.numero} · {STATUS[o.status].rotulo}</div></div><div className="seta" /></>}
        <div className="fno atual" style={{ ['--c' as string]: setor(a.setor_id)?.cor }} onClick={() => abrirAtividade(a.id)}>
          <div className="ft">#{a.numero} {a.titulo}</div><div className="fs"><PontoSetor s={setor(a.setor_id)} />{STATUS[a.status].rotulo}{atrasada(a) && <b style={{ color: 'var(--red)' }}>· atrasada</b>}</div></div>
        {prox.map((p, i) => <span key={i} className="row" style={{ gap: 0 }}><div className="seta tracejada" /><div className="fno fantasma" style={{ ['--c' as string]: p.s?.cor }}><div className="ft">{p.s?.nome}</div><div className="fs">{p.t} · depois</div></div></span>)}
      </div>;
    })}</div></div>;
  }
}

function Contagem({ n, rot, cls = '', onClick }: { n: number; rot: string; cls?: string; onClick: () => void }) {
  return <button className={`contagem ${n ? cls : 'zero'}`} onClick={onClick}><b>{n}</b>{rot}</button>;
}

/** Próximos 7 dias com o que vence em cada um (atrasadas no topo). */
function Agenda({ lista }: { lista: Atividade[] }) {
  const { dados, abrirAtividade } = useDados();
  const cor = (a: Atividade) => dados.setores.find(s => s.id === a.setor_id)?.cor;
  const atr = lista.filter(a => atrasada(a));
  const dias: ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDias(i);
    const its = lista.filter(a => a.prazo === d);
    const dt = new Date(d + 'T12:00:00');
    dias.push(<div key={d} className={`dia-ag ${d === hoje() ? 'hoje' : ''}`}>
      <div className="data-ag"><b>{dt.getDate()}</b><span>{i === 0 ? 'hoje' : i === 1 ? 'amanhã' : dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span></div>
      <div className="itens-ag">{its.length ? its.map(a => <div key={a.id} className="it-ag" style={{ ['--c' as string]: cor(a) }} title={`#${a.numero} ${a.titulo}`} onClick={() => abrirAtividade(a.id)}>{a.titulo}</div>) : <span className="livre">Sem prazos</span>}</div>
    </div>);
  }
  return <div className="agenda">
    {atr.length > 0 && <div className="dia-ag"><div className="data-ag"><b style={{ color: 'var(--red)' }}>{atr.length}</b><span>atrasadas</span></div>
      <div className="itens-ag">{atr.map(a => <div key={a.id} className="it-ag atraso" style={{ ['--c' as string]: 'var(--red)' }} onClick={() => abrirAtividade(a.id)}>{a.titulo}</div>)}</div></div>}
    {dias}
  </div>;
}
