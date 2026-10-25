import { useCallback, useEffect, useRef, useState } from 'react';
import { LuUpload, LuTrash2, LuMail, LuSend, LuRefreshCw, LuCircleCheck, LuCircleAlert, LuClock, LuExternalLink, LuSave, LuWorkflow, LuSun, LuMoon, LuMonitor, LuKeyRound, LuLogOut, LuBell } from 'react-icons/lu';
import { useDados, type Tema } from '../app/contexto';
import { navegar } from '../app/rota';
import type { Envio, TeamsWebhook } from '../lib/types';
import { PAPEL, fmtDataHora } from '../lib/regras';
import { Avatar, Aviso, Campo, Painel, PontoSetor, Toggle } from '../ui/base';

export function EmpresaMarca() {
  const { dados, svc, executar } = useDados();
  const [nome, setNome] = useState(dados.empresa.nome);
  const ref = useRef<HTMLInputElement>(null);
  return <>
    <div className="cabeca"><div className="t"><h1>Empresa e marca</h1><p>Nome e logotipo exibidos no menu, na tela de login e nos e-mails.</p></div></div>
    <div className="duas iguais">
      <Painel titulo="Identificação">
        <div className="col" style={{ gap: 14 }}>
          <Campo rotulo="Nome da empresa"><input className="inp" value={nome} onChange={e => setNome(e.target.value)} /></Campo>
          <div><button className="btn pri" disabled={nome === dados.empresa.nome} onClick={() => executar(() => svc.salvarEmpresa(nome), 'Nome atualizado')}><LuSave size={15} />Salvar</button></div>
        </div>
      </Painel>
      <Painel titulo="Logotipo" sub="PNG, JPG ou SVG até 1 MB — fundo transparente ou branco">
        <div className="col" style={{ gap: 14 }}>
          <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 12, minHeight: 120, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', padding: 16 }}>
            {dados.empresa.logo_url ? <img src={dados.empresa.logo_url} alt="Logo" style={{ maxHeight: 90, maxWidth: '100%', objectFit: 'contain' }} /> : <span className="logo-pad" style={{ width: 56, height: 56 }}><LuWorkflow size={26} /></span>}
          </div>
          <div className="row"><button className="btn pri" onClick={() => ref.current?.click()}><LuUpload size={15} />Enviar logotipo</button>
            {dados.empresa.logo_url && <button className="btn perigo" onClick={() => executar(() => svc.removerLogo(), 'Logotipo removido')}><LuTrash2 size={14} />Remover</button>}</div>
          <input ref={ref} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) executar(() => svc.enviarLogo(f), 'Logotipo atualizado'); e.target.value = ''; }} />
          <div className="row" style={{ background: '#0b1424', borderRadius: 10, padding: 12, gap: 10 }}>
            {dados.empresa.logo_url ? <img src={dados.empresa.logo_url} alt="" style={{ maxHeight: 32, maxWidth: 140, background: '#fff', borderRadius: 6, padding: '2px 4px' }} /> : <span className="logo-pad"><LuWorkflow size={18} /></span>}
            <span style={{ color: '#fff', fontWeight: 700 }}>{nome}</span><span className="xs" style={{ color: '#7f8ca3', marginLeft: 'auto' }}>pré-visualização do menu</span></div>
        </div>
      </Painel>
    </div>
  </>;
}

export function Integracoes() {
  const { dados, svc, executar, modo, toast } = useDados();
  const integ = dados.integracoes;
  const [hooks, setHooks] = useState<TeamsWebhook[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [appUrl, setAppUrl] = useState(integ.app_url);
  const carregar = useCallback(async () => {
    try {
      const [h, e] = await Promise.all([svc.listarWebhooks(), svc.listarEnvios()]);
      setHooks(h); setEnvios(e); setUrls(Object.fromEntries(h.map(x => [x.setor_id || 'geral', x.url])));
    } catch (e: any) { toast(e.message, 'erro'); }
  }, [svc, toast]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 8000); return () => clearInterval(t); }, [carregar]);
  const salvarHook = async (setorId: string | null) => { await executar(() => svc.salvarWebhook(setorId, urls[setorId || 'geral'] || '', hooks), 'Webhook salvo'); carregar(); };
  const testar = async (setorId: string | null) => { await executar(() => svc.testarTeams(setorId), 'Mensagem de teste enfileirada'); setTimeout(carregar, 1500); };
  const ultimo = (c: 'email' | 'teams') => envios.find(e => e.canal === c && e.status !== 'pendente');
  const status = (c: 'email' | 'teams') => { const u = ultimo(c); return !u ? { t: 'Sem envios ainda', cls: 't-gray' } : u.status === 'enviado' ? { t: `Funcionando · ${fmtDataHora(u.enviado_em)}`, cls: 't-green' } : { t: 'Falha no último envio', cls: 't-red' }; };
  const pendentes = envios.filter(e => e.status === 'pendente');
  const antigo = pendentes.find(e => Date.now() - new Date(e.criado_em).getTime() > 60000);
  const nomeDest = (e: Envio) => e.canal === 'email' ? dados.perfis.find(p => p.id === e.para_id)?.email || '—' : e.setor_id ? `Canal de ${dados.setores.find(s => s.id === e.setor_id)?.nome}` : 'Canal geral';
  const masc = (u: string) => u ? u.replace(/^(https:\/\/[^/]+\/).{6,}(.{6})$/, '$1••••••$2') : '';

  return <>
    <div className="cabeca"><div className="t"><h1>Integrações</h1><p>Notificações por e-mail e Microsoft Teams. O notificador (container no Docker ou função na Vercel) processa a fila de envios.</p></div>
      <div className="sp"><button className="btn" onClick={carregar}><LuRefreshCw size={15} />Atualizar</button></div></div>
    {modo === 'demo' && <Aviso tipo="atencao">Modo demonstração: os envios são <b>simulados</b>. Com o banco conectado (Docker ou Supabase na nuvem), o notificador envia de verdade.</Aviso>}
    {antigo && modo === 'supabase' && <Aviso tipo="atencao">Há envios pendentes há mais de 1 minuto. No Docker, verifique o container <b>notificador</b> (<code>docker compose logs notificador</code>). Na Vercel, confira as variáveis <code>SUPABASE_SERVICE_ROLE_KEY</code> e <code>SMTP_*</code> e os logs da função <code>/api/notificar</code>.</Aviso>}
    <div className="duas iguais">
      <Painel titulo={<span className="row"><LuMail size={18} />E-mail</span>} acoes={<span className={`pill ${status('email').cls}`}>{status('email').t}</span>}>
        <div className="col" style={{ gap: 14 }}>
          <Toggle marcado={integ.email_ativo} onChange={v => executar(() => svc.salvarIntegracoes({ email_ativo: v }), v ? 'E-mails ativados' : 'E-mails desativados')} rotulo={<b>Enviar notificações por e-mail</b>} />
          <p className="sm muted">O servidor SMTP (Office 365, Gmail, SendGrid…) é configurado no arquivo <code>.env</code> do Docker: <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USUARIO</code>, <code>SMTP_SENHA</code> e <code>SMTP_EMAIL_REMETENTE</code> (depois rode o INICIAR.bat). Na instalação local, os e-mails caem na caixa de testes em <a href="http://localhost:8025" target="_blank" rel="noreferrer">localhost:8025 <LuExternalLink size={11} /></a>.</p>
          <div><button className="btn" onClick={async () => { await executar(() => svc.testarEmail(), 'E-mail de teste enfileirado'); setTimeout(carregar, 1500); }}><LuSend size={14} />Enviar e-mail de teste para mim</button></div>
        </div>
      </Painel>
      <Painel titulo={<span className="row"><TeamsIcone />Microsoft Teams</span>} acoes={<span className={`pill ${status('teams').cls}`}>{status('teams').t}</span>}>
        <div className="col" style={{ gap: 14 }}>
          <Toggle marcado={integ.teams_ativo} onChange={v => executar(() => svc.salvarIntegracoes({ teams_ativo: v }), v ? 'Teams ativado' : 'Teams desativado')} rotulo={<b>Publicar notificações em canais do Teams</b>} />
          <ol className="sm" style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>No Teams, abra o canal → <b>⋯</b> → <b>Workflows</b>.</li>
            <li>Escolha <b>“Postar em um canal quando uma solicitação de webhook for recebida”</b>.</li>
            <li>Conclua o assistente e <b>copie a URL</b> gerada.</li>
            <li>Cole abaixo (canal geral e/ou por setor), salve e clique em <b>Testar</b>.</li>
          </ol>
          <Campo rotulo="Webhook do canal geral" ajuda="Usado quando o setor não tem um canal próprio.">
            <div className="row"><input className="inp" placeholder="https://…logic.azure.com/… ou https://….webhook.office.com/…" value={urls.geral || ''} onChange={e => setUrls({ ...urls, geral: e.target.value })} />
              <button className="btn" onClick={() => salvarHook(null)}><LuSave size={14} /></button><button className="btn" disabled={!hooks.some(h => !h.setor_id)} onClick={() => testar(null)}>Testar</button></div></Campo>
        </div>
      </Painel>
    </div>
    <Painel titulo="Canais do Teams por setor" sub="cada setor pode publicar no próprio canal" sem>
      <div className="tabela-wrap"><table className="tb"><thead><tr><th>Setor</th><th>URL do webhook</th><th>Situação</th><th /></tr></thead>
        <tbody>{dados.setores.map(s => { const h = hooks.find(x => x.setor_id === s.id);
          return <tr key={s.id}><td style={{ width: 200 }}><span className="row"><PontoSetor s={s} /><b>{s.nome}</b></span></td>
            <td><input className="inp" placeholder={hooks.some(x => !x.setor_id) ? 'Usando o canal geral' : 'Cole a URL do webhook'} value={urls[s.id] ?? ''} onChange={e => setUrls({ ...urls, [s.id]: e.target.value })} title={masc(h?.url || '')} /></td>
            <td style={{ width: 150 }}>{h ? <span className="pill t-green">canal próprio</span> : hooks.some(x => !x.setor_id) ? <span className="pill t-slate">canal geral</span> : <span className="pill t-gray">não configurado</span>}</td>
            <td className="d" style={{ width: 170 }}><div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn p" onClick={() => salvarHook(s.id)}>Salvar</button><button className="btn p" disabled={!h && !hooks.some(x => !x.setor_id)} onClick={() => testar(s.id)}>Testar</button></div></td></tr>; })}</tbody></table></div>
    </Painel>
    <Painel titulo="Endereço do sistema" sub="usado nos links dos e-mails e do Teams">
      <div className="row"><input className="inp" value={appUrl} onChange={e => setAppUrl(e.target.value)} /><button className="btn pri" disabled={appUrl === integ.app_url} onClick={() => executar(() => svc.salvarIntegracoes({ app_url: appUrl }), 'Endereço salvo')}><LuSave size={14} />Salvar</button></div>
    </Painel>
    <Painel titulo="Registro de envios" sub="últimos 60 — atualiza automaticamente" sem>
      {envios.length === 0 ? <div style={{ padding: 18 }} className="sm muted">Nenhum envio ainda.</div> :
        <div className="tabela-wrap"><table className="tb"><thead><tr><th>Quando</th><th>Canal</th><th>Destino</th><th>Assunto</th><th>Situação</th></tr></thead>
          <tbody>{envios.map(e => <tr key={e.id}><td className="num sm">{fmtDataHora(e.criado_em)}</td><td>{e.canal === 'email' ? <span className="row"><LuMail size={14} />E-mail</span> : <span className="row"><TeamsIcone />Teams</span>}</td>
            <td className="sm">{nomeDest(e)}</td><td className="sm" style={{ maxWidth: 320 }}><div className="ellipsis">{e.assunto}</div></td>
            <td>{e.status === 'enviado' ? <span className="pill t-green"><LuCircleCheck size={12} />Enviado</span> : e.status === 'erro' ? <span className="pill t-red" title={e.erro || ''}><LuCircleAlert size={12} />Erro</span> : e.status === 'ignorado' ? <span className="pill t-gray" title={e.erro || ''}>Ignorado</span> : <span className="pill t-amber"><LuClock size={12} />Na fila</span>}
              {e.erro && <div className="xs muted" style={{ maxWidth: 260 }}>{e.erro}</div>}</td></tr>)}</tbody></table></div>}
    </Painel>
  </>;
}
const TeamsIcone = () => <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="13" height="14" rx="2.5" fill="#5b5fc7" /><path d="M5.5 9h6M8.5 9v6.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /><circle cx="19" cy="7.5" r="2.3" fill="#7b83eb" /><rect x="16" y="10.5" width="6" height="7.5" rx="2.5" fill="#7b83eb" /></svg>;

export function Perfil() {
  const { dados, eu, svc, executar, tema, definirTema, repo, toast } = useDados();
  const [v, setV] = useState({ nome: eu.nome, cargo: eu.cargo || '' });
  const [s, setS] = useState({ a: '', b: '' });
  const setor = dados.setores.find(x => x.id === eu.setor_id);
  const temas: [Tema, string, typeof LuSun, string[]][] = [['claro', 'Claro', LuSun, ['#f3f5f9', '#ffffff', '#2152d9']], ['escuro', 'Escuro', LuMoon, ['#0b0f16', '#131923', '#6b8cff']], ['sistema', 'Automático (sistema)', LuMonitor, ['#f3f5f9', '#131923', '#2152d9']]];
  return <>
    <div className="cabeca"><div className="row" style={{ gap: 14 }}><Avatar p={eu} setores={dados.setores} tam="g" /><div className="t"><h1>{eu.nome}</h1><p>{eu.email} · {PAPEL[eu.papel]}{setor ? ` · ${setor.nome}` : ''}</p></div></div></div>
    <div className="duas iguais">
      <Painel titulo="Dados pessoais"><div className="col" style={{ gap: 14 }}>
        <Campo rotulo="Nome"><input className="inp" value={v.nome} onChange={e => setV({ ...v, nome: e.target.value })} /></Campo>
        <Campo rotulo="Cargo"><input className="inp" value={v.cargo} onChange={e => setV({ ...v, cargo: e.target.value })} /></Campo>
        <Campo rotulo="Setor" ajuda="Alterado pela diretoria em Pessoas e acessos."><input className="inp" disabled value={setor?.nome || 'Diretoria'} /></Campo>
        <div><button className="btn pri" onClick={() => executar(() => svc.salvarPerfil(eu.id, { nome: v.nome, cargo: v.cargo || null }), 'Dados atualizados')}><LuSave size={15} />Salvar</button></div>
      </div></Painel>
      <Painel titulo={<span className="row"><LuKeyRound size={17} />Alterar senha</span>}><form className="col" style={{ gap: 14 }} onSubmit={async e => {
        e.preventDefault();
        if (s.a.length < 8) return toast('A senha deve ter pelo menos 8 caracteres.', 'erro');
        if (s.a !== s.b) return toast('As senhas não conferem.', 'erro');
        try { await repo.auth.redefinirSenha(s.a); setS({ a: '', b: '' }); toast('Senha alterada com sucesso'); } catch (er: any) { toast(er.message, 'erro'); }
      }}>
        <Campo rotulo="Nova senha"><input className="inp" type="password" autoComplete="new-password" value={s.a} onChange={e => setS({ ...s, a: e.target.value })} /></Campo>
        <Campo rotulo="Confirmar nova senha"><input className="inp" type="password" autoComplete="new-password" value={s.b} onChange={e => setS({ ...s, b: e.target.value })} /></Campo>
        <div><button className="btn pri" disabled={!s.a}><LuKeyRound size={15} />Alterar senha</button></div>
      </form></Painel>
    </div>
    <Painel titulo="Aparência" sub="tema da interface neste navegador">
      <div className="temas">{temas.map(([t, r, I, c]) => <button key={t} className={`tema ${tema === t ? 'on' : ''}`} onClick={() => definirTema(t)}>
        <div className="prev"><div className="a" /><div className="b" style={{ background: c[0] }}><i style={{ background: c[1], width: '80%' }} /><i style={{ background: c[2], width: '40%' }} /><i style={{ background: c[1], width: '60%' }} /></div></div>
        <div className="rot"><I size={15} />{r}{tema === t && <LuCircleCheck size={15} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}</div></button>)}</div>
    </Painel>
    <div className="duas iguais">
      <Painel titulo={<span className="row"><LuBell size={17} />Notificações</span>}><div className="col" style={{ gap: 12 }}>
        <span className="sm muted">Você sempre recebe as notificações dentro do sistema (sino). Escolha também:</span>
        <Toggle marcado={eu.notif_email} onChange={x => executar(() => svc.salvarPerfil(eu.id, { notif_email: x }), 'Preferência salva')} rotulo="Receber por e-mail" />
        <Toggle marcado={eu.notif_teams} onChange={x => executar(() => svc.salvarPerfil(eu.id, { notif_teams: x }), 'Preferência salva')} rotulo="Ser mencionado no canal do Teams do meu setor" />
        {!dados.integracoes.email_ativo && !dados.integracoes.teams_ativo && <span className="xs muted">As integrações estão desativadas pela diretoria no momento.</span>}
      </div></Painel>
      <Painel titulo="Sessão"><div className="col" style={{ gap: 12 }}>
        <span className="sm muted">Encerre sua sessão neste navegador. Suas atividades continuam salvas.</span>
        <div><button className="btn perigo cheio" onClick={() => navegar('/sair')}><LuLogOut size={15} />Sair do sistema</button></div>
      </div></Painel>
    </div>
  </>;
}
