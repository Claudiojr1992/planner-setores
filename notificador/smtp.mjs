// Cliente SMTP mínimo (sem dependências): SSL direto (465) ou STARTTLS (587), AUTH LOGIN/PLAIN.
import net from 'node:net';
import tls from 'node:tls';
import { randomUUID } from 'node:crypto';

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const cabecalho = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
const quebrar = s => s.replace(/.{1,76}/g, '$&\r\n');

class Conexao {
  constructor(sock) { this.trocar(sock); }
  trocar(sock) {
    if (this.sock) { this.sock.removeAllListeners('data'); this.sock.removeAllListeners('error'); }
    this.sock = sock; this.buf = ''; this.fila = [];
    sock.setEncoding('utf8');
    sock.on('data', d => { this.buf += d; this.processar(); });
    sock.on('error', e => { this.erro = e; this.fila.splice(0).forEach(f => f.rej(e)); });
  }
  processar() {
    while (this.fila.length) {
      const linhas = this.buf.split('\r\n');
      const fim = linhas.findIndex(l => /^\d{3} /.test(l));
      if (fim < 0) return;
      const resp = linhas.slice(0, fim + 1);
      this.buf = linhas.slice(fim + 1).join('\r\n');
      this.fila.shift().res({ codigo: Number(resp[fim].slice(0, 3)), texto: resp.join('\n') });
    }
  }
  ler() { return new Promise((res, rej) => { if (this.erro) return rej(this.erro); this.fila.push({ res, rej }); this.processar(); }); }
  async cmd(linha, esperado) {
    this.sock.write(linha + '\r\n');
    const r = await this.ler();
    if (esperado && !esperado.includes(r.codigo)) throw new Error(`SMTP: "${linha.startsWith('AUTH') || /^[A-Za-z0-9+/=]+$/.test(linha) ? '***' : linha}" → ${r.texto}`);
    return r;
  }
}

function conectar(host, porta, seguro, timeout) {
  return new Promise((ok, erro) => {
    const s = seguro ? tls.connect({ host, port: porta, servername: host }) : net.connect({ host, port: porta });
    s.setTimeout(timeout, () => { s.destroy(new Error(`Tempo esgotado conectando a ${host}:${porta}`)); });
    s.once(seguro ? 'secureConnect' : 'connect', () => ok(s));
    s.once('error', erro);
  });
}

/**
 * Envia uma mensagem. cfg: { host, porta, seguro, usuario, senha, remetente, ignorarTLS }
 * msg: { para, assunto, texto, html }
 */
export async function enviarEmail(cfg, msg) {
  const porta = Number(cfg.porta || 587);
  const seguro = cfg.seguro ?? porta === 465;
  let sock = await conectar(cfg.host, porta, seguro, 20000);
  const c = new Conexao(sock);
  try {
    let r = await c.ler(); if (r.codigo !== 220) throw new Error(`SMTP saudação inesperada: ${r.texto}`);
    const nome = 'planner.local';
    r = await c.cmd(`EHLO ${nome}`, [250]);
    if (!seguro && /STARTTLS/i.test(r.texto) && !cfg.ignorarTLS) {
      await c.cmd('STARTTLS', [220]);
      sock = await new Promise((ok, erro) => { const t = tls.connect({ socket: sock, servername: cfg.host }, () => ok(t)); t.once('error', erro); });
      c.trocar(sock);
      r = await c.cmd(`EHLO ${nome}`, [250]);
    }
    if (cfg.usuario) {
      if (/AUTH[^\n]*\bPLAIN\b/i.test(r.texto) && !/AUTH[^\n]*\bLOGIN\b/i.test(r.texto)) await c.cmd(`AUTH PLAIN ${b64(`\0${cfg.usuario}\0${cfg.senha || ''}`)}`, [235]);
      else { await c.cmd('AUTH LOGIN', [334]); await c.cmd(b64(cfg.usuario), [334]); await c.cmd(b64(cfg.senha || ''), [235]); }
    }
    const de = (cfg.remetente.match(/<([^>]+)>/) || [, cfg.remetente])[1].trim();
    await c.cmd(`MAIL FROM:<${de}>`, [250]);
    await c.cmd(`RCPT TO:<${msg.para}>`, [250, 251]);
    await c.cmd('DATA', [354]);
    const limite = `=_planner_${randomUUID()}`;
    const nomeRem = cfg.remetente.includes('<') ? `${cabecalho(cfg.remetente.split('<')[0].trim().replace(/^"|"$/g, ''))} <${de}>` : de;
    const corpo = [
      `From: ${nomeRem}`, `To: <${msg.para}>`, `Subject: ${cabecalho(msg.assunto)}`, `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${randomUUID()}@${de.split('@')[1] || 'planner'}>`, 'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${limite}"`, '',
      `--${limite}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', quebrar(b64(msg.texto)),
      `--${limite}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', quebrar(b64(msg.html)),
      `--${limite}--`, '',
    ].join('\r\n');
    sock.write(corpo + '\r\n.\r\n');
    r = await c.ler(); if (r.codigo !== 250) throw new Error(`SMTP DATA: ${r.texto}`);
    await c.cmd('QUIT').catch(() => undefined);
  } finally { sock.end(); }
}
