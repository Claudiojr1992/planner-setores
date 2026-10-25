import { useEffect } from 'react';
import { LuWorkflow } from 'react-icons/lu';
import { Provedor, useApp } from './app/contexto';
import { navegar, useRota } from './app/rota';
import { ehAdmin, ehGestor } from './lib/regras';
import { DialogoGlobal, Toasts } from './ui/base';
import { DetalheAtividade, ModaisAtividade, ModalNovaAtividade } from './ui/atividade';
import { AguardandoAprovacao, Cadastro, EsqueciSenha, Login, RedefinirSenha } from './paginas/acesso';
import { Estrutura, SemAcesso, TelaSair } from './paginas/estrutura';
import { Inicio } from './paginas/inicio';
import { PainelSetor } from './paginas/setor';
import { Atividades } from './paginas/atividades';
import { GestaoEmpresa } from './paginas/empresa';
import { EditorFluxo, ListaFluxos } from './paginas/fluxos';
import { Ausencias } from './paginas/ausencias';
import { Pessoas, Setores } from './paginas/cadastros';
import { EmpresaMarca, Integracoes, Perfil } from './paginas/configuracoes';

const PUBLICAS = ['/login', '/cadastro', '/esqueci-senha'];

function Roteador() {
  const { iniciando, sessao, eu, dados, repo, abrirAtividade } = useApp();
  const rota = useRota();
  const c = rota.caminho;

  // links diretos para uma atividade (#/atividade/<id>) — usados nos e-mails e no Teams
  useEffect(() => { if (rota.partes[0] === 'atividade' && rota.partes[1] && dados) { abrirAtividade(rota.partes[1]); navegar('/', true); } }, [c, !!dados]); // eslint-disable-line
  useEffect(() => { if (!iniciando && sessao && PUBLICAS.includes(c)) navegar('/', true); }, [iniciando, sessao, c]);

  if (iniciando) return <div className="carregando"><span className="logo-pad" style={{ width: 46, height: 46 }}><LuWorkflow size={22} /></span><div className="giro" /><span>Carregando…</span></div>;
  if (c === '/redefinir-senha' || repo.auth.emRecuperacao()) return <RedefinirSenha />;
  if (!sessao) {
    if (c === '/cadastro') return <Cadastro />;
    if (c === '/esqueci-senha') return <EsqueciSenha />;
    return <Login />;
  }
  if (!eu || !eu.ativo) return <AguardandoAprovacao />;
  if (!dados) return <div className="carregando"><div className="giro" /><span>Carregando dados…</span></div>;
  if (c === '/sair') return <TelaSair />;

  const gestor = ehGestor(eu, dados.setores), admin = ehAdmin(eu);
  let titulo = 'Início', pagina = <Inicio />;
  const p = rota.partes;
  if (c === '/atividades') { titulo = 'Atividades'; pagina = <Atividades rota={rota} />; }
  else if (c === '/setor') { titulo = 'Painel do setor'; pagina = gestor ? <PainelSetor /> : <SemAcesso />; }
  else if (c === '/ausencias') { titulo = 'Férias e delegação'; pagina = gestor ? <Ausencias /> : <SemAcesso />; }
  else if (c === '/empresa') { titulo = 'Gestão da empresa'; pagina = gestor ? <GestaoEmpresa /> : <SemAcesso />; }
  else if (c === '/fluxos') { titulo = 'Fluxos de processo'; pagina = gestor ? <ListaFluxos /> : <SemAcesso />; }
  else if (p[0] === 'fluxos' && p[1]) { titulo = 'Editor de fluxo'; pagina = gestor ? <EditorFluxo key={p[1]} id={p[1]} /> : <SemAcesso />; }
  else if (c === '/cadastros/setores') { titulo = 'Setores'; pagina = admin ? <Setores /> : <SemAcesso />; }
  else if (c === '/cadastros/pessoas') { titulo = 'Pessoas e acessos'; pagina = admin ? <Pessoas /> : <SemAcesso />; }
  else if (c === '/configuracoes/empresa') { titulo = 'Empresa e marca'; pagina = admin ? <EmpresaMarca /> : <SemAcesso />; }
  else if (c === '/configuracoes/integracoes') { titulo = 'Integrações'; pagina = admin ? <Integracoes /> : <SemAcesso />; }
  else if (c === '/perfil') { titulo = 'Meu perfil'; pagina = <Perfil />; }

  return <>
    <Estrutura caminho={c} titulo={titulo}>{pagina}</Estrutura>
    <DetalheAtividade />
    <ModaisAtividade />
    <ModalNovaAtividade />
  </>;
}

export function App() {
  return <Provedor><Roteador /><DialogoGlobal /><Toasts /></Provedor>;
}
