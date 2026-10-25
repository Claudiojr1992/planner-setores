// Notificador do Planner: lê a fila "envios" no Supabase e entrega por e-mail (SMTP) e Microsoft Teams.
// Sem dependências externas — Node 20+.
import { enviarEmail } from './smtp.mjs';

const env = process.env;
const URL_SB = (env.SUPABASE_URL || env.PLANNER_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || 'http://host.docker.internal:54321').replace(/\/+$/, '');
const CHAVE = env.SUPABASE_SERVICE_ROLE_KEY || '';
const INTERVALO = Math.max(2, Number(env.INTERVALO_SEGUNDOS || 5)) * 1000;
const MAX_TENTATIVAS = Number(env.MAX_TENTATIVAS || 3);
const SMTP = {
  host: env.SMTP_HOST || '', porta: Number(env.SMTP_PORT || 587),
  seguro: env.SMTP_SEGURO ? env.SMTP_SEGURO === 'true' : undefined,
  usuario: env.SMTP_USUARIO || '', senha: env.SMTP_SENHA || '',
  remetente: env.SMTP_REMETENTE
    || (env.SMTP_EMAIL_REMETENTE ? `${env.SMTP_NOME_REMETENTE || 'Planner de Setores'} <${env.SMTP_EMAIL_REMETENTE}>` : 'Planner de Setores <planner@localhost>'),
  ignorarTLS: env.SMTP_IGNORAR_TLS === 'true',
};
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function rest(metodo, caminho, corpo) {
  const h = { apikey: CHAVE, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (CHAVE.split('.').length === 3) h.Authorization = `Bearer ${CHAVE}`;
  const r = await fetch(`${URL_SB}/rest/v1/${caminho}`, { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function htmlEmail(empresa, e, nome) {
  return `<!doctype html><html><body style="margin:0;background:#f3f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0e1726">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e1e6ee;border-radius:14px;overflow:hidden">
<tr><td style="background:#0b1424;padding:16px 24px;color:#fff;font-weight:700;font-size:15px">${empresa.logo_url ? `<img src="${esc(empresa.logo_url)}" alt="" height="28" style="vertical-align:middle;background:#fff;border-radius:6px;padding:2px 4px;margin-right:10px">` : ''}${esc(empresa.nome)} · Planner de Setores</td></tr>
<tr><td style="padding:24px">
${nome ? `<p style="margin:0 0 8px;color:#6b7789;font-size:13px">Olá, ${esc(nome.split(' ')[0])}</p>` : ''}
<h1 style="margin:0 0 12px;font-size:19px">${esc(e.assunto)}</h1>
<p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#3b4658">${esc(e.corpo).replace(/\n/g, '<br>')}</p>
${e.link ? `<a href="${esc(e.link)}" style="display:inline-block;background:#2152d9;color:#fff;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:600;font-size:14px">Abrir no Planner</a>` : ''}
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e1e6ee;color:#6b7789;font-size:11.5px">Você recebe este e-mail porque as notificações por e-mail estão ativas no seu perfil.</td></tr>
</table></td></tr></table></body></html>`;
}

function cartaoTeams(empresa, e) {
  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null,
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4',
        body: [
          { type: 'TextBlock', text: `${empresa.nome} · Planner de Setores`, size: 'Small', isSubtle: true },
          { type: 'TextBlock', text: e.assunto, weight: 'Bolder', size: 'Medium', wrap: true },
          { type: 'TextBlock', text: e.corpo || '', wrap: true },
        ],
        actions: e.link ? [{ type: 'Action.OpenUrl', title: 'Abrir no Planner', url: e.link }] : [],
      },
    }],
  };
}

async function processar(e, ctx) {
  if (e.canal === 'email') {
    if (!SMTP.host) return { status: 'ignorado', erro: 'SMTP não configurado no .env do notificador.' };
    const p = e.para_id ? ctx.perfis.get(e.para_id) : null;
    if (!p?.email) return { status: 'ignorado', erro: 'Destinatário sem e-mail.' };
    await enviarEmail(SMTP, { para: p.email, assunto: e.assunto, texto: `${e.assunto}\n\n${e.corpo || ''}${e.link ? `\n\nAbrir: ${e.link}` : ''}`, html: htmlEmail(ctx.empresa, e, p.nome) });
    return { status: 'enviado' };
  }
  const hook = (e.setor_id && ctx.hooks.find(h => h.setor_id === e.setor_id && h.ativo)) || ctx.hooks.find(h => !h.setor_id && h.ativo);
  if (!hook) return { status: 'ignorado', erro: 'Nenhum webhook do Teams configurado para este setor nem canal geral.' };
  const r = await fetch(hook.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cartaoTeams(ctx.empresa, e)) });
  if (!r.ok) throw new Error(`Teams respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { status: 'enviado' };
}

let rodando = false;
export async function ciclo() {
  if (rodando) return; rodando = true;
  try {
    const fila = await rest('GET', `envios?select=*&status=eq.pendente&tentativas=lt.${MAX_TENTATIVAS}&order=criado_em.asc&limit=25`);
    if (!fila.length) return 0;
    const ids = [...new Set(fila.map(e => e.para_id).filter(Boolean))];
    const [perfis, hooks, emp] = await Promise.all([
      ids.length ? rest('GET', `perfis?select=id,nome,email&id=in.(${ids.join(',')})`) : [],
      rest('GET', 'teams_webhooks?select=*'), rest('GET', 'empresa?select=*&id=eq.1'),
    ]);
    const ctx = { perfis: new Map(perfis.map(p => [p.id, p])), hooks, empresa: emp[0] || { nome: 'Empresa' } };
    let feitos = 0;
    for (const e of fila) {
      // "reserva" o envio: só segue quem conseguir somar a tentativa. Evita e-mail duplicado
      // quando dois notificadores rodam juntos (ex.: várias funções da Vercel ao mesmo tempo).
      const reserva = await rest('PATCH', `envios?id=eq.${e.id}&status=eq.pendente&tentativas=eq.${e.tentativas}`, { tentativas: e.tentativas + 1 });
      if (!reserva?.length) continue;
      feitos++;
      let res;
      try { res = await processar(e, ctx); }
      catch (err) {
        const t = e.tentativas + 1;
        res = { status: t >= MAX_TENTATIVAS ? 'erro' : 'pendente', erro: String(err.message || err).slice(0, 500) };
      }
      await rest('PATCH', `envios?id=eq.${e.id}`, { status: res.status, erro: res.erro || null, enviado_em: res.status === 'enviado' ? new Date().toISOString() : null });
      log(`[${e.canal}] ${res.status}${res.erro ? ' — ' + res.erro : ''} · ${e.assunto}`);
    }
    return feitos;
  } catch (err) { log('falha no ciclo:', err.message || err); return -1; }
  finally { rodando = false; }
}

export const configurado = () => !!CHAVE;
export const smtpAtivo = () => !!SMTP.host;

if (!env.VERCEL && process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  if (!CHAVE) { log('Defina SUPABASE_SERVICE_ROLE_KEY no .env'); process.exit(1); }
  log(`Notificador iniciado · Supabase ${URL_SB} · SMTP ${SMTP.host ? `${SMTP.host}:${SMTP.porta}` : '(desativado)'} · a cada ${INTERVALO / 1000}s`);
  ciclo(); setInterval(ciclo, INTERVALO);
}
