// Teste do notificador com Supabase REST, SMTP e Teams simulados.
import http from 'node:http';
import net from 'node:net';
const db = {
  envios: [
    { id: 'e1', canal: 'email', para_id: 'u1', setor_id: null, assunto: 'Nova solicitação aguardando seu aceite', corpo: 'Comercial enviou “Onboarding – Ação”.', link: 'http://localhost:8080/#/atividade/x', status: 'pendente', tentativas: 0, criado_em: '1' },
    { id: 'e2', canal: 'teams', para_id: 'u1', setor_id: 's1', assunto: 'Teste Teams', corpo: 'Olá canal', link: null, status: 'pendente', tentativas: 0, criado_em: '2' },
    { id: 'e3', canal: 'teams', para_id: null, setor_id: 's9', assunto: 'Sem hook', corpo: '', status: 'pendente', tentativas: 0, criado_em: '3' },
    { id: 'e4', canal: 'teams', para_id: null, setor_id: 's2', assunto: 'Hook quebrado', corpo: '', status: 'pendente', tentativas: 2, criado_em: '4' },
  ],
  perfis: [{ id: 'u1', nome: 'Ana Souza', email: 'ana@empresa.com.br' }],
  empresa: [{ id: 1, nome: 'Grupo Exemplo', logo_url: null }],
};
const emails = []; const teams = [];
const rest = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const t = u.pathname.split('/').pop(); let b = '';
  req.on('data', d => b += d); req.on('end', () => {
    if (req.headers.apikey !== 'chave-servico') { res.writeHead(401); return res.end('{}'); }
    if (req.method === 'GET') {
      let l = t === 'teams_webhooks' ? [{ setor_id: 's1', url: `http://127.0.0.1:${tp}/ok`, ativo: true }, { setor_id: 's2', url: `http://127.0.0.1:${tp}/falha`, ativo: true }] : db[t];
      if (t === 'envios') l = l.filter(e => e.status === 'pendente' && e.tentativas < 3);
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(l));
    }
    // PATCH com filtros (id, status, tentativas), como o PostgREST
    const alvo = db.envios.filter(e => [...u.searchParams].every(([k, v]) => !v.startsWith('eq.') || String(e[k]) === v.slice(3)));
    alvo.forEach(e => Object.assign(e, JSON.parse(b)));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(alvo));
  });
}).listen(0); const rp = rest.address().port;
const tsrv = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => { if (req.url === '/ok') { teams.push(JSON.parse(b)); res.writeHead(202); res.end(); } else { res.writeHead(400); res.end('Bad payload'); } }); }).listen(0); const tp = tsrv.address().port;
const smtp = net.createServer(s => {
  let modo = 'cmd', dados = '', auth = 0; s.write('220 fake ESMTP\r\n');
  s.on('data', d => { for (const linha of d.toString().split('\r\n')) {
    if (modo === 'data') { if (linha === '.') { emails.push(dados); modo = 'cmd'; s.write('250 OK queued\r\n'); } else dados += linha + '\n'; continue; }
    if (!linha) continue;
    if (auth === 1) { auth = 2; s.write('334 UGFzc3dvcmQ6\r\n'); continue; }
    if (auth === 2) { auth = Buffer.from(linha, 'base64').toString() === 'segredo' ? 3 : 4; s.write(auth === 3 ? '235 ok\r\n' : '535 bad\r\n'); continue; }
    if (/^EHLO/.test(linha)) s.write('250-fake\r\n250-AUTH LOGIN PLAIN\r\n250 SIZE 1000000\r\n');
    else if (linha === 'AUTH LOGIN') { auth = 1; s.write('334 VXNlcm5hbWU6\r\n'); }
    else if (/^(MAIL|RCPT)/.test(linha)) s.write('250 ok\r\n');
    else if (linha === 'DATA') { modo = 'data'; s.write('354 go\r\n'); }
    else if (linha === 'QUIT') { s.write('221 bye\r\n'); s.end(); }
    else s.write('500 ?\r\n');
  } });
}).listen(0); const sp = smtp.address().port;
Object.assign(process.env, { SUPABASE_URL: `http://127.0.0.1:${rp}`, SUPABASE_SERVICE_ROLE_KEY: 'chave-servico', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(sp), SMTP_USUARIO: 'planner', SMTP_SENHA: 'segredo', SMTP_REMETENTE: 'Planner Ação <planner@empresa.com.br>' });
const { ciclo } = await import('../index.mjs');
const n = await ciclo();
let ok = 0, f = 0; const t = (nome, c) => { c ? ok++ : f++; console.log(c ? '  ✓' : '  ✗', nome); };
const st = id => db.envios.find(e => e.id === id);
t('processou 4 envios', n === 4);
t('e-mail enviado', st('e1').status === 'enviado' && emails.length === 1);
t('e-mail com assunto UTF-8 codificado', /Subject: =\?UTF-8\?B\?/.test(emails[0] || ''));
t('e-mail com HTML e link', Buffer.from((emails[0] || '').split('Content-Type: text/html; charset=UTF-8\nContent-Transfer-Encoding: base64\n\n')[1]?.split('--')[0].replace(/\n/g, '') || '', 'base64').toString().includes('Abrir no Planner'));
t('Teams recebeu cartão adaptativo', st('e2').status === 'enviado' && teams[0]?.attachments?.[0]?.content?.type === 'AdaptiveCard');
t('sem webhook → ignorado', st('e3').status === 'ignorado');
t('falha na 3ª tentativa → erro registrado', st('e4').status === 'erro' && /400/.test(st('e4').erro) && st('e4').tentativas === 3);
// dois notificadores ao mesmo tempo (funções paralelas na Vercel): cada envio sai uma vez só
db.envios.push({ id: 'e5', canal: 'email', para_id: 'u1', setor_id: null, assunto: 'Concorrência', corpo: 'x', link: null, status: 'pendente', tentativas: 0, criado_em: '5' });
const antes = emails.length;
const mod2 = await import('../index.mjs?segunda');
await Promise.all([ciclo(), mod2.ciclo()]);
t('envio concorrente não duplica', emails.length - antes === 1 && st('e5').status === 'enviado' && st('e5').tentativas === 1);
console.log(`${ok} passaram, ${f} falharam`); rest.close(); tsrv.close(); smtp.close(); process.exit(f ? 1 : 0);
