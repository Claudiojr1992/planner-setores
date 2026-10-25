import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LuEye, LuEyeOff, LuLogIn, LuMail, LuArrowLeft, LuKeyRound, LuUserPlus, LuHourglass, LuRefreshCw, LuLogOut, LuCircleCheck, LuWorkflow } from 'react-icons/lu';
import { useApp } from '../app/contexto';
import { navegar } from '../app/rota';
import { NOME_SISTEMA } from '../app/config';
import { Aviso, Campo } from '../ui/base';
import type { DemoRepo } from '../lib/repo/demo';

function Marca() {
  const { empresa } = useApp();
  return <div className="marca">{empresa?.logo_url ? <img src={empresa.logo_url} alt={empresa.nome} /> : <span className="logo-pad"><LuWorkflow size={18} /></span>}<span>{empresa?.nome || NOME_SISTEMA}</span></div>;
}
function Layout({ children }: { children: ReactNode }) {
  return <div className="auth">
    <div className="auth-arte">
      <Marca />
      <div className="demo-fluxo">{['Solicitação', 'Aceite do gestor', 'Distribuição', 'Execução', 'Próximo setor'].map((t, i) => <span key={t} className="row" style={{ gap: 0 }}>{i > 0 && <span className="s" />}<span className="n">{t}</span></span>)}</div>
      <h2>Processos entre setores, do pedido à entrega.</h2>
      <p>Planeje as atividades de cada setor e acompanhe as filas da equipe. As passagens entre áreas são feitas com aceite, prazos e notificações por e-mail e Teams.</p>
    </div>
    <div className="auth-form"><div className="auth-card">{children}</div></div>
  </div>;
}
function CampoSenha({ valor, onChange, rotulo = 'Senha', auto = 'current-password' }: { valor: string; onChange: (v: string) => void; rotulo?: string; auto?: string }) {
  const [ver, setVer] = useState(false);
  return <Campo rotulo={rotulo}><div style={{ position: 'relative' }}>
    <input className="inp" type={ver ? 'text' : 'password'} value={valor} onChange={e => onChange(e.target.value)} autoComplete={auto} style={{ paddingRight: 40 }} required />
    <button type="button" className="btn fant icone p" style={{ position: 'absolute', right: 5, top: 5 }} onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}>{ver ? <LuEyeOff size={16} /> : <LuEye size={16} />}</button>
  </div></Campo>;
}
function forcaSenha(s: string) {
  let p = 0; if (s.length >= 8) p++; if (/[A-Z]/.test(s) && /[a-z]/.test(s)) p++; if (/\d/.test(s)) p++; if (/[^\w]/.test(s)) p++; if (s.length >= 12) p++;
  return { p, rot: ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Excelente'][p], cor: ['var(--red)', 'var(--red)', 'var(--amber)', 'var(--amber)', 'var(--green)', 'var(--green)'][p] };
}
function Forca({ s }: { s: string }) {
  if (!s) return null; const f = forcaSenha(s);
  return <div className="col" style={{ gap: 4 }}><div className="forca"><i style={{ width: `${(f.p / 5) * 100}%`, background: f.cor }} /></div><span className="xs" style={{ color: f.cor }}>Força: {f.rot}</span></div>;
}

export function Login() {
  const { repo, aoEntrar, modo } = useApp();
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(''); const [carregando, setCarregando] = useState(false);
  const [info, setInfo] = useState('');
  useEffect(() => {
    if (sessionStorage.getItem('planner.saiu')) { setInfo('Você saiu com segurança. Até logo!'); sessionStorage.removeItem('planner.saiu'); }
    const e = sessionStorage.getItem('planner.erroLink'); if (e) { setErro(`O link de e-mail é inválido ou expirou (${e}). Solicite um novo.`); sessionStorage.removeItem('planner.erroLink'); }
  }, []);
  const entrar = async (em = email, se = senha) => {
    setErro(''); setCarregando(true);
    try { await repo.auth.entrar(em.trim(), se); await aoEntrar(); navegar('/', true); }
    catch (e: any) { setErro(e.message); } finally { setCarregando(false); }
  };
  const contas = [['Roberta Lima', 'Diretoria (admin)', 'roberta'], ['Ana Souza', 'Gestora · Fiscal', 'ana'], ['Bruno Lima', 'Analista · Fiscal', 'bruno'], ['Gabriela Alves', 'Gestora · Financeiro', 'gabriela']];
  return <Layout>
    <div><h1>Entrar</h1><p className="muted">Acesse com seu e-mail corporativo.</p></div>
    {info && <Aviso tipo="ok">{info}</Aviso>}
    {erro && <Aviso tipo="erro">{erro}</Aviso>}
    <form className="col" style={{ gap: 14 }} onSubmit={e => { e.preventDefault(); entrar(); }}>
      <Campo rotulo="E-mail"><input className="inp" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></Campo>
      <CampoSenha valor={senha} onChange={setSenha} />
      <button className="btn pri g bloco" disabled={carregando}><LuLogIn size={17} />{carregando ? 'Entrando…' : 'Entrar'}</button>
    </form>
    <div className="links"><a href="#/esqueci-senha">Esqueci minha senha</a><span>Novo por aqui? <a href="#/cadastro">Criar conta</a></span></div>
    {modo === 'demo' && <div className="auth-demo"><b>Modo demonstração</b> — os dados ficam neste navegador. Senha de todas as contas: <code>demo123</code>
      <div className="contas">{contas.map(([n, r, e]) => <button key={e} onClick={() => entrar(`${e}@empresa.com.br`, 'demo123')}><b>{n}</b>{r}</button>)}</div></div>}
  </Layout>;
}

export function Cadastro() {
  const { repo, aoEntrar } = useApp();
  const [v, setV] = useState({ nome: '', email: '', senha: '', conf: '' });
  const [erro, setErro] = useState(''); const [ok, setOk] = useState(''); const [carregando, setCarregando] = useState(false);
  const enviar = async () => {
    setErro('');
    if (v.nome.trim().length < 3) return setErro('Informe seu nome completo.');
    if (v.senha.length < 8) return setErro('A senha deve ter pelo menos 8 caracteres.');
    if (v.senha !== v.conf) return setErro('As senhas não conferem.');
    setCarregando(true);
    try {
      const s = await repo.auth.cadastrar(v.nome.trim(), v.email.trim(), v.senha);
      if (s) { await aoEntrar(); navegar('/', true); }
      else setOk(`Enviamos um link de confirmação para ${v.email}. Abra o e-mail e clique no link para ativar sua conta.`);
    } catch (e: any) { setErro(e.message); } finally { setCarregando(false); }
  };
  return <Layout>
    <div><a href="#/login" className="row sm"><LuArrowLeft size={14} />Voltar ao login</a><h1 style={{ marginTop: 10 }}>Criar conta</h1><p className="muted">Após o cadastro, a diretoria libera seu acesso e define seu setor.</p></div>
    {erro && <Aviso tipo="erro">{erro}</Aviso>}
    {ok ? <Aviso tipo="ok">{ok}</Aviso> : <form className="col" style={{ gap: 14 }} onSubmit={e => { e.preventDefault(); enviar(); }}>
      <Campo rotulo="Nome completo"><input className="inp" value={v.nome} onChange={e => setV({ ...v, nome: e.target.value })} autoComplete="name" required autoFocus /></Campo>
      <Campo rotulo="E-mail corporativo"><input className="inp" type="email" value={v.email} onChange={e => setV({ ...v, email: e.target.value })} autoComplete="email" required /></Campo>
      <CampoSenha valor={v.senha} onChange={s => setV({ ...v, senha: s })} auto="new-password" />
      <Forca s={v.senha} />
      <CampoSenha rotulo="Confirmar senha" valor={v.conf} onChange={s => setV({ ...v, conf: s })} auto="new-password" />
      <button className="btn pri g bloco" disabled={carregando}><LuUserPlus size={17} />{carregando ? 'Criando…' : 'Criar conta'}</button>
    </form>}
  </Layout>;
}

export function EsqueciSenha() {
  const { repo, modo, aoEntrar } = useApp();
  const [email, setEmail] = useState(''); const [enviado, setEnviado] = useState(false); const [erro, setErro] = useState(''); const [carregando, setCarregando] = useState(false);
  const enviar = async () => {
    setErro(''); setCarregando(true);
    try { await repo.auth.recuperarSenha(email.trim()); setEnviado(true); } catch (e: any) { setErro(e.message); } finally { setCarregando(false); }
  };
  const simular = async () => {
    const r = repo as DemoRepo;
    if (!r.simularLinkRecuperacao(email.trim())) return setErro('Nenhuma conta com este e-mail no modo demonstração.');
    await aoEntrar(); navegar('/redefinir-senha', true);
  };
  return <Layout>
    <div><a href="#/login" className="row sm"><LuArrowLeft size={14} />Voltar ao login</a><h1 style={{ marginTop: 10 }}>Recuperar acesso</h1><p className="muted">Informe seu e-mail. Enviaremos um link para você criar uma nova senha.</p></div>
    {erro && <Aviso tipo="erro">{erro}</Aviso>}
    {enviado ? <>
      <Aviso tipo="ok"><b>Verifique sua caixa de entrada.</b> Se existir uma conta para {email}, você receberá o link em instantes. O link expira em 1 hora.</Aviso>
      {modo === 'demo' && <button className="btn pri bloco" onClick={simular}><LuKeyRound size={16} />Abrir o link de redefinição (simulação)</button>}
      {modo === 'supabase' && <p className="sm muted">Instalação local: os e-mails chegam na caixa de testes em <a href="http://localhost:8025" target="_blank" rel="noreferrer">localhost:8025</a>.</p>}
      <button className="btn bloco" onClick={() => setEnviado(false)}>Enviar novamente</button>
    </> : <form className="col" style={{ gap: 14 }} onSubmit={e => { e.preventDefault(); enviar(); }}>
      <Campo rotulo="E-mail"><input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></Campo>
      <button className="btn pri g bloco" disabled={carregando}><LuMail size={17} />{carregando ? 'Enviando…' : 'Enviar link de recuperação'}</button>
    </form>}
  </Layout>;
}

export function RedefinirSenha() {
  const { repo, aoEntrar, sessao } = useApp();
  const [s, setS] = useState(''); const [c, setC] = useState(''); const [erro, setErro] = useState(''); const [ok, setOk] = useState(false); const [carregando, setCarregando] = useState(false);
  const enviar = async () => {
    setErro('');
    if (s.length < 8) return setErro('A senha deve ter pelo menos 8 caracteres.');
    if (s !== c) return setErro('As senhas não conferem.');
    setCarregando(true);
    try { await repo.auth.redefinirSenha(s); setOk(true); await aoEntrar(); } catch (e: any) { setErro(e.message); } finally { setCarregando(false); }
  };
  if (!sessao) return <Layout><h1>Link expirado</h1><Aviso tipo="atencao">Abra novamente o link recebido por e-mail ou solicite um novo.</Aviso><a className="btn pri" href="#/esqueci-senha">Solicitar novo link</a></Layout>;
  return <Layout>
    <div><h1>Criar nova senha</h1><p className="muted">Conta: {sessao.email}</p></div>
    {erro && <Aviso tipo="erro">{erro}</Aviso>}
    {ok ? <><Aviso tipo="ok"><LuCircleCheck size={15} /> Senha alterada com sucesso.</Aviso><button className="btn pri g bloco" onClick={() => navegar('/', true)}>Ir para o sistema</button></>
      : <form className="col" style={{ gap: 14 }} onSubmit={e => { e.preventDefault(); enviar(); }}>
        <CampoSenha rotulo="Nova senha" valor={s} onChange={setS} auto="new-password" /><Forca s={s} />
        <CampoSenha rotulo="Confirmar nova senha" valor={c} onChange={setC} auto="new-password" />
        <button className="btn pri g bloco" disabled={carregando}><LuKeyRound size={17} />Salvar nova senha</button>
      </form>}
  </Layout>;
}

export function AguardandoAprovacao() {
  const { eu, sair, recarregar } = useApp();
  return <Layout>
    <span className="logo-pad" style={{ width: 48, height: 48, background: 'var(--amber-soft)', color: 'var(--amber)' }}><LuHourglass size={22} /></span>
    <div><h1>Cadastro recebido</h1><p className="muted" style={{ marginTop: 6 }}>Olá, {eu?.nome?.split(' ')[0]}! Seu acesso está <b>aguardando aprovação</b> da diretoria, que vai definir seu setor e seu papel. Você receberá uma notificação assim que for liberado.</p></div>
    <div className="row"><button className="btn pri" onClick={() => recarregar()}><LuRefreshCw size={15} />Verificar novamente</button>
      <button className="btn" onClick={async () => { await sair(); sessionStorage.setItem('planner.saiu', '1'); navegar('/login', true); }}><LuLogOut size={15} />Sair</button></div>
  </Layout>;
}
