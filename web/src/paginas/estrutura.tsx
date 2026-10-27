import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  LuHouse, LuListChecks, LuLayoutDashboard, LuTreePalm, LuNetwork, LuWorkflow, LuBuilding2, LuUsers, LuImage, LuPlug,
  LuBell, LuGauge, LuSun, LuMoon, LuLogOut, LuSearch, LuPlus, LuMenu, LuPanelLeftClose, LuPanelLeft, LuUser, LuMonitor, LuCheck, LuCheckCheck,
} from 'react-icons/lu';
import { useDados, type Tema } from '../app/contexto';
import { navegar } from '../app/rota';
import { NOME_SISTEMA } from '../app/config';
import { PAPEL, aberta, ehAdmin, ehGestor, setoresGeridos, slaAtividade, tempoRelativo } from '../lib/regras';
import { Avatar, Kbd, Marca, Suspenso } from '../ui/base';

interface Item { para: string; rotulo: string; Ic: typeof LuHouse; cont?: number; alerta?: boolean }

export function Estrutura({ caminho, titulo, children }: { caminho: string; titulo: string; children: ReactNode }) {
  const { dados, eu, abrirNova, modo } = useDados();
  const [colapsado, setColapsado] = useState(() => { try { return localStorage.getItem('planner.menu') === '1'; } catch { return false; } });
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const buscaRef = useRef<HTMLInputElement>(null);
  // atalhos: N = nova solicitação, / = buscar
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || document.querySelector('.veu, .gaveta')) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); abrirNova(); }
      else if (e.key === '/') { e.preventDefault(); if (buscaRef.current && buscaRef.current.offsetParent) buscaRef.current.focus(); else navegar('/atividades'); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [abrirNova]);
  const admin = ehAdmin(eu), gestor = ehGestor(eu, dados.setores);
  const geridos = setoresGeridos(eu, dados.setores);
  const pendSetor = dados.atividades.filter(a => geridos.includes(a.setor_id) && (a.status === 'aguardando_aceite' || a.status === 'a_distribuir')).length;
  const minhas = dados.atividades.filter(a => a.responsavel_id === eu.id && ['na_fila', 'em_andamento', 'pausada'].includes(a.status)).length;
  const pendentes = dados.perfis.filter(p => !p.ativo).length;
  const slaEstourado = dados.atividades.filter(a => geridos.includes(a.setor_id) && aberta(a) && slaAtividade(a, dados.metas).situacao === 'estourado').length;
  const grupos: { titulo: string; itens: Item[] }[] = [
    { titulo: 'Meu trabalho', itens: [{ para: '/', rotulo: 'Início', Ic: LuHouse, cont: minhas }, { para: '/atividades', rotulo: 'Atividades', Ic: LuListChecks }] },
  ];
  if (gestor) grupos.push({ titulo: 'Gestão', itens: [
    { para: '/setor', rotulo: 'Painel do setor', Ic: LuLayoutDashboard, cont: pendSetor, alerta: pendSetor > 0 },
    { para: '/indicadores', rotulo: 'Indicadores e metas', Ic: LuGauge, cont: slaEstourado, alerta: slaEstourado > 0 },
    { para: '/ausencias', rotulo: 'Férias e delegação', Ic: LuTreePalm },
    { para: '/empresa', rotulo: 'Gestão da empresa', Ic: LuNetwork },
    { para: '/fluxos', rotulo: 'Fluxos de processo', Ic: LuWorkflow },
  ] });
  if (admin) grupos.push({ titulo: 'Administração', itens: [
    { para: '/cadastros/setores', rotulo: 'Setores', Ic: LuBuilding2 },
    { para: '/cadastros/pessoas', rotulo: 'Pessoas e acessos', Ic: LuUsers, cont: pendentes, alerta: pendentes > 0 },
    { para: '/configuracoes/empresa', rotulo: 'Empresa e marca', Ic: LuImage },
    { para: '/configuracoes/integracoes', rotulo: 'Integrações', Ic: LuPlug },
  ] });
  const ativo = (p: string) => p === '/' ? caminho === '/' : caminho.startsWith(p);
  const grupoAtual = grupos.find(g => g.itens.some(it => ativo(it.para)))?.titulo;
  const alternar = () => {
    if (window.innerWidth <= 900) { setAberto(!aberto); return; }
    setColapsado(c => { try { localStorage.setItem('planner.menu', c ? '0' : '1'); } catch { /* */ } return !c; });
  };
  const ir = (p: string) => { setAberto(false); navegar(p); };
  const setorEu = dados.setores.find(s => s.id === eu.setor_id);

  return <div className={`app ${colapsado ? 'colapsado' : ''} ${aberto ? 'menu-aberto' : ''}`}>
    <aside className="side">
      <div className="side-marca">
        <Marca logo={dados.empresa.logo_url} nome={dados.empresa.nome} />
        <div className="txt" style={{ minWidth: 0 }}><div className="nome ellipsis">{dados.empresa.nome}</div><div className="sub ellipsis">{NOME_SISTEMA}</div></div>
      </div>
      <nav>{grupos.map(g => <div key={g.titulo}>
        <div className="grupo">{g.titulo}</div>
        {g.itens.map(it => <a key={it.para} href={'#' + it.para} className={`item ${ativo(it.para) ? 'on' : ''}`} onClick={e => { e.preventDefault(); ir(it.para); }} title={it.rotulo}>
          <it.Ic size={18} /><span className="rot">{it.rotulo}</span>{!!it.cont && <span className={`cont ${it.alerta ? 'alerta' : ''}`}>{it.cont}</span>}</a>)}
      </div>)}</nav>
      <div className="side-pe">
        <div className="side-user" onClick={() => ir('/perfil')} title="Meu perfil"><Avatar p={eu} setores={dados.setores} tam="m" />
          <div className="txt" style={{ minWidth: 0 }}><div className="n ellipsis">{eu.nome}</div><div className="r ellipsis">{PAPEL[eu.papel]}{setorEu ? ` · ${setorEu.nome}` : ''}</div></div></div>
        <button className="item" onClick={() => navegar('/sair')} title="Sair"><LuLogOut size={18} /><span className="rot">Sair</span></button>
      </div>
    </aside>
    {aberto && <div className="gaveta-veu" style={{ zIndex: 35 }} onClick={() => setAberto(false)} />}
    <div className="main">
      <header className="top">
        <button className="btn fant icone" onClick={alternar} aria-label="Menu">{aberto || colapsado ? <LuPanelLeft size={18} className="desk-only" /> : <LuPanelLeftClose size={18} className="desk-only" />}<LuMenu size={18} className="mobile-only" /></button>
        <div className="crumb">{grupoAtual && <><span className="desk-only">{grupoAtual}</span><span className="sep-c desk-only">/</span></>}<b className="ellipsis">{titulo}</b>{modo === 'demo' && <span className="pill t-amber desk-only">Demonstração</span>}</div>
        <form className="busca" role="search" onSubmit={e => { e.preventDefault(); navegar(`/atividades?q=${encodeURIComponent(busca)}`); }}><LuSearch size={15} /><input ref={buscaRef} aria-label="Buscar atividades" placeholder="Buscar por título ou número" value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => e.key === 'Escape' && (e.currentTarget.blur())} /><Kbd>/</Kbd></form>
        <div className="acoes">
          <button className="btn pri" onClick={() => abrirNova()} title="Nova solicitação (atalho N)"><LuPlus size={16} /><span className="rot-m">Nova solicitação</span><Kbd>N</Kbd></button>
          <BotaoTema />
          <Notificacoes />
          <MenuUsuario onSair={() => navegar('/sair')} />
        </div>
      </header>
      <main className="conteudo">{children}</main>
    </div>
  </div>;
}

function BotaoTema() {
  const { temaEfetivo, definirTema } = useDados();
  return <button className="btn icone desk-only" title={temaEfetivo === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => definirTema(temaEfetivo === 'escuro' ? 'claro' : 'escuro')}>
    {temaEfetivo === 'escuro' ? <LuSun size={17} /> : <LuMoon size={17} />}</button>;
}

function Notificacoes() {
  const { dados, svc, executar, abrirAtividade, recarregar } = useDados();
  const ns = dados.notificacoes;
  const novas = ns.filter(n => !n.lida).length;
  return <Suspenso classe="notifs" gatilho={(abrir, aberto) => <button className={`btn icone ${aberto ? 'on' : ''}`} onClick={() => { abrir(); if (!aberto) recarregar(); }} aria-label="Notificações"><LuBell size={17} />{novas > 0 && <span className="badge-n">{novas > 99 ? '99+' : novas}</span>}</button>}>
    {fechar => <>
      <div className="cab"><b>Notificações</b>{novas > 0 && <span className="pill t-accent">{novas} novas</span>}<span className="sp" />{novas > 0 && <button className="btn p fant" onClick={() => executar(() => svc.marcarTodasLidas())}><LuCheckCheck size={14} />Marcar todas como lidas</button>}</div>
      <div className="lista">{ns.length === 0 ? <div className="vazio" style={{ margin: 14 }}>Nenhuma notificação.</div> :
        ns.slice(0, 50).map(n => <div key={n.id} className={`notif ${n.lida ? '' : 'nova'}`} onClick={async () => { fechar(); if (n.atividade_id) abrirAtividade(n.atividade_id); await executar(() => svc.marcarLida(n)); }}>
          <span className="bolinha" /><div className="grow"><div className="tt">{n.titulo}</div>{n.texto && <div className="tx">{n.texto}</div>}<div className="xs muted">{tempoRelativo(n.criado_em)}</div></div></div>)}</div>
    </>}
  </Suspenso>;
}

function MenuUsuario({ onSair }: { onSair: () => void }) {
  const { eu, dados, tema, definirTema } = useDados();
  const temas: [Tema, string, typeof LuSun][] = [['claro', 'Claro', LuSun], ['escuro', 'Escuro', LuMoon], ['sistema', 'Automático', LuMonitor]];
  return <Suspenso gatilho={abrir => <button className="btn fant" style={{ padding: 3, borderRadius: 20 }} onClick={abrir} aria-label="Conta"><Avatar p={eu} setores={dados.setores} tam="m" /></button>}>
    {fechar => <>
      <div style={{ padding: '8px 10px' }}><b>{eu.nome}</b><div className="xs muted">{eu.email}</div></div><hr />
      <button className="mi" onClick={() => { fechar(); navegar('/perfil'); }}><LuUser size={15} />Meu perfil e preferências</button>
      <div className="xs muted" style={{ padding: '8px 10px 2px' }}>Aparência</div>
      {temas.map(([t, r, I]) => <button key={t} className="mi" onClick={() => definirTema(t)}><I size={15} /><span className="grow">{r}</span>{tema === t && <LuCheck size={15} />}</button>)}
      <hr /><button className="mi perigo" onClick={() => { fechar(); onSair(); }}><LuLogOut size={15} />Sair do sistema</button>
    </>}
  </Suspenso>;
}

/** Tela de saída: confirmação clara antes de encerrar a sessão. */
export function TelaSair() {
  const { sair, eu, dados } = useDados();
  const [saindo, setSaindo] = useState(false);
  return <div className="auth-form" style={{ minHeight: '100vh' }}><div className="painel" style={{ width: 'min(440px, 100%)' }}><div className="painel-b col" style={{ gap: 18, padding: 28, alignItems: 'center', textAlign: 'center' }}>
    <Avatar p={eu} setores={dados.setores} tam="g" />
    <div><h1>Sair do sistema?</h1><p className="muted" style={{ marginTop: 6 }}>Sua sessão como <b>{eu.nome}</b> será encerrada neste navegador. Atividades e notificações continuam salvas.</p></div>
    <div className="row" style={{ width: '100%' }}>
      <button className="btn g grow" onClick={() => history.length > 1 ? history.back() : navegar('/')}>Continuar conectado</button>
      <button className="btn g perigo cheio grow" disabled={saindo} onClick={async () => { setSaindo(true); await sair(); sessionStorage.setItem('planner.saiu', '1'); navegar('/login', true); }}><LuLogOut size={16} />{saindo ? 'Saindo…' : 'Sair'}</button>
    </div></div></div></div>;
}

export function SemAcesso() {
  return <div className="vazio" style={{ marginTop: 40 }}><LuUsers size={30} /><b>Acesso restrito</b><div>Esta área é exclusiva para gestores ou para a diretoria.</div><a className="btn" href="#/">Voltar ao início</a></div>;
}
