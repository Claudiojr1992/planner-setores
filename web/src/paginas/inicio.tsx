import { useState } from 'react';
import { LuArrowRight, LuPlus, LuInbox, LuTriangleAlert } from 'react-icons/lu';
import { useDados } from '../app/contexto';
import { navegar } from '../app/rota';
import { aberta, atrasada, ehGestor, ordenar, proximosNos, setoresGeridos, STATUS, FINAIS } from '../lib/regras';
import { Painel, Vazio, PontoSetor } from '../ui/base';
import { Cartao } from '../ui/atividade';
import { Calendario, Indicadores } from '../ui/painel';

export function Inicio() {
  const { dados, eu, abrirAtividade, abrirNova } = useDados();
  const [aba, setAba] = useState<'abertas' | 'solicitadas' | 'concluidas'>('abertas');
  const minhas = dados.atividades.filter(a => a.responsavel_id === eu.id);
  const abertas = ordenar(minhas.filter(aberta));
  const solicitadas = ordenar(dados.atividades.filter(a => a.criado_por === eu.id && a.setor_id !== eu.setor_id));
  const concluidas = minhas.filter(a => a.status === 'concluida').sort((a, b) => (b.concluido_em || '').localeCompare(a.concluido_em || '')).slice(0, 15);
  const geridos = setoresGeridos(eu, dados.setores);
  const aguard = dados.atividades.filter(a => geridos.includes(a.setor_id) && a.status === 'aguardando_aceite').length;
  const distr = dados.atividades.filter(a => geridos.includes(a.setor_id) && a.status === 'a_distribuir').length;
  const h = new Date().getHours();
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const setor = (id?: string | null) => dados.setores.find(s => s.id === id);
  const lista = aba === 'abertas' ? abertas : aba === 'solicitadas' ? solicitadas : concluidas;
  const minhasAus = dados.ausencias.filter(a => a.pessoa_id === eu.id);

  return <>
    <div className="cabeca">
      <div className="t"><h1>{saud}, {eu.nome.split(' ')[0]}</h1><p>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · {setor(eu.setor_id)?.nome || 'Diretoria'}</p></div>
      <div className="sp"><button className="btn" onClick={() => navegar('/atividades')}>Ver todas as atividades</button><button className="btn pri" onClick={() => abrirNova()}><LuPlus size={16} />Nova solicitação</button></div>
    </div>
    {ehGestor(eu, dados.setores) && (aguard + distr) > 0 && <div className="aviso atencao" style={{ alignItems: 'center' }}><LuInbox size={18} /><div className="grow">Seu setor tem <b>{aguard} aguardando aceite</b> e <b>{distr} a distribuir</b>.</div><button className="btn p" onClick={() => navegar('/setor')}>Abrir painel do setor <LuArrowRight size={14} /></button></div>}

    <Painel titulo="Meu fluxo de trabalho" sub="de onde vem e para onde vai cada atividade sua">
      <div className="canvas">{abertas.length ? <div className="fluxo-linhas">{abertas.slice(0, 8).map(a => {
        const o = a.origem_id ? dados.atividades.find(x => x.id === a.origem_id) : null;
        const f = a.fluxo_id ? dados.fluxos.find(x => x.id === a.fluxo_id) : null;
        const prox = f && a.etapa_id ? proximosNos(f, a.etapa_id).map(n => ({ s: setor(n.setor_id), t: n.titulo })) : a.encaminhar_para ? [{ s: setor(a.encaminhar_para), t: 'Encaminhamento' }] : [];
        return <div key={a.id} className="fluxo-linha">
          {o && <><div className="fno fantasma" style={{ ['--c' as string]: setor(o.setor_id)?.cor }} onClick={() => abrirAtividade(o.id)}><div className="ft">Recebida de</div><div className="fs"><PontoSetor s={setor(o.setor_id)} />{setor(o.setor_id)?.nome} · #{o.numero}</div></div><div className="seta" /></>}
          <div className="fno atual" style={{ ['--c' as string]: setor(a.setor_id)?.cor }} onClick={() => abrirAtividade(a.id)}>
            <div className="ft">#{a.numero} {a.titulo}</div><div className="fs"><PontoSetor s={setor(a.setor_id)} />{STATUS[a.status].rotulo}{atrasada(a) && <b style={{ color: 'var(--red)' }}>· atrasada</b>}</div></div>
          {prox.map((p, i) => <span key={i} className="row" style={{ gap: 0 }}><div className="seta tracejada" /><div className="fno fantasma" style={{ ['--c' as string]: p.s?.cor }}><div className="ft">{p.t}</div><div className="fs"><PontoSetor s={p.s} />{p.s?.nome} · próxima etapa</div></div></span>)}
        </div>;
      })}</div> : <div style={{ padding: 16 }}><Vazio>Nenhuma atividade aberta com você. Quando receber uma, o caminho dela entre os setores aparece aqui.</Vazio></div>}</div>
    </Painel>

    <Indicadores lista={minhas} onFiltro={f => navegar(`/atividades?resp=eu&f=${f}`)} />

    <div className="duas">
      <Painel titulo="Minhas atividades" acoes={<div className="segmento">
        <button className={aba === 'abertas' ? 'on' : ''} onClick={() => setAba('abertas')}>Minha fila ({abertas.length})</button>
        <button className={aba === 'solicitadas' ? 'on' : ''} onClick={() => setAba('solicitadas')}>Que solicitei ({solicitadas.filter(a => !FINAIS.includes(a.status)).length})</button>
        <button className={aba === 'concluidas' ? 'on' : ''} onClick={() => setAba('concluidas')}>Concluídas</button></div>}>
        {abertas.some(atrasada) && aba === 'abertas' && <div className="aviso erro" style={{ marginBottom: 12 }}><LuTriangleAlert size={16} /><div>Você tem <b>{abertas.filter(atrasada).length} atividade(s) atrasada(s)</b>.</div></div>}
        <div className="lista-cartoes">{lista.length ? lista.map(a => <Cartao key={a.id} a={a} mostrarSetor={aba === 'solicitadas'} acoes={aba !== 'concluidas'} />) : <Vazio>{aba === 'abertas' ? 'Sua fila está vazia.' : aba === 'solicitadas' ? 'Você ainda não solicitou nada a outros setores.' : 'Nenhuma atividade concluída recentemente.'}</Vazio>}</div>
      </Painel>
      <Painel><Calendario lista={minhas} ausencias={minhasAus} titulo="Meu calendário" dados={dados} /></Painel>
    </div>
  </>;
}
