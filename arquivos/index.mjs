// Serviço de arquivos do Planner (anexos e logotipo) — compatível com o subconjunto da API
// do Supabase Storage usado pela interface. Sem dependências: Node 20+.
//   POST   /object/:bucket/:caminho          envia (token do usuário)
//   POST   /object/sign/:bucket/:caminho     gera link assinado (1 h)
//   GET    /object/sign/:bucket/:caminho?token=...  baixa pelo link assinado
//   GET    /object/public/marca/:caminho     logotipo (público)
//   DELETE /object/:bucket  {prefixes:[...]} remove
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';

const PASTA = process.env.PASTA_ARQUIVOS || '/data';
const SEGREDO = process.env.JWT_SECRET || '';
const REST = (process.env.REST_URL || 'http://rest:3000').replace(/\/+$/, '');
const LIMITE = Number(process.env.LIMITE_BYTES || 50 * 1024 * 1024);
const BUCKETS = { anexos: { publico: false }, marca: { publico: true } };

const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const assinar = dados => b64u(createHmac('sha256', SEGREDO).update(dados).digest());

export function verificarJwt(token) {
  const [h, p, s] = String(token || '').split('.');
  if (!h || !p || !s) return null;
  const esperado = Buffer.from(assinar(`${h}.${p}`)), recebido = Buffer.from(s);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  try {
    const c = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (c.exp && c.exp < Date.now() / 1000) return null;
    return c;
  } catch { return null; }
}
function caminhoSeguro(bucket, rel) {
  if (!BUCKETS[bucket]) return null;
  const limpo = String(rel || '').replace(/\\/g, '/');
  if (!limpo || limpo.split('/').some(seg => seg === '..' || seg === '')) return null;
  return path.join(PASTA, bucket, limpo);
}
async function rpc(nome, token) {
  const r = await fetch(`${REST}/rpc/${nome}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
  return r.ok && (await r.json()) === true;
}
const json = (res, codigo, corpo) => { res.writeHead(codigo, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(corpo)); };
const lerCorpo = req => new Promise((ok, erro) => {
  const partes = []; let total = 0;
  req.on('data', d => { total += d.length; if (total > LIMITE) { erro(Object.assign(new Error('Arquivo maior que o limite permitido.'), { codigo: 413 })); req.destroy(); } else partes.push(d); });
  req.on('end', () => ok(Buffer.concat(partes))); req.on('error', erro);
});
async function servir(res, arq) {
  try {
    const st = await stat(arq);
    let tipo = 'application/octet-stream';
    try { tipo = JSON.parse(await readFile(arq + '.meta.json', 'utf8')).tipo || tipo; } catch { /* sem meta */ }
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': st.size, 'Cache-Control': 'private, max-age=300' });
    createReadStream(arq).pipe(res);
  } catch { json(res, 404, { message: 'Arquivo não encontrado.' }); }
}

export async function tratar(req, res) {
  const u = new URL(req.url, 'http://x');
  let partes;
  try { partes = u.pathname.replace(/^\/+/, '').split('/').map(decodeURIComponent); }
  catch { return json(res, 400, { message: 'Caminho inválido.' }); }
  if (u.pathname === '/status') return json(res, 200, { ok: true });
  if (partes[0] !== 'object') return json(res, 404, { message: 'Rota não encontrada.' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    // público: logotipo
    if (req.method === 'GET' && partes[1] === 'public') {
      const [, , bucket, ...resto] = partes;
      if (!BUCKETS[bucket]?.publico) return json(res, 404, { message: 'Bucket não é público.' });
      const arq = caminhoSeguro(bucket, resto.join('/')); if (!arq) return json(res, 400, { message: 'Caminho inválido.' });
      return servir(res, arq);
    }
    // download por link assinado
    if (req.method === 'GET' && partes[1] === 'sign') {
      const [, , bucket, ...resto] = partes; const rel = resto.join('/');
      const [exp, sig] = String(u.searchParams.get('token') || '').split('.');
      if (!exp || !sig || Number(exp) < Date.now() / 1000 || sig !== assinar(`${bucket}/${rel}:${exp}`)) return json(res, 403, { message: 'Link expirado ou inválido.' });
      const arq = caminhoSeguro(bucket, rel); if (!arq) return json(res, 400, { message: 'Caminho inválido.' });
      return servir(res, arq);
    }
    // demais operações exigem usuário autenticado e ativo
    const c = verificarJwt(token);
    if (!c || (c.role !== 'authenticated' && c.role !== 'service_role')) return json(res, 401, { message: 'Sessão inválida. Entre novamente.' });
    const ativo = c.role === 'service_role' || await rpc('eh_ativo', token);
    if (!ativo) return json(res, 403, { message: 'Você não tem permissão para esta ação.' });

    if (req.method === 'POST' && partes[1] === 'sign') {
      const [, , bucket, ...resto] = partes; const rel = resto.join('/');
      if (!caminhoSeguro(bucket, rel)) return json(res, 400, { message: 'Caminho inválido.' });
      const corpo = JSON.parse((await lerCorpo(req)).toString() || '{}');
      const exp = Math.floor(Date.now() / 1000) + Math.min(Number(corpo.expiresIn) || 3600, 7 * 86400);
      return json(res, 200, { signedURL: `/object/sign/${bucket}/${resto.map(encodeURIComponent).join('/')}?token=${exp}.${assinar(`${bucket}/${rel}:${exp}`)}` });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const [, bucket, ...resto] = partes; const arq = caminhoSeguro(bucket, resto.join('/'));
      if (!arq) return json(res, 400, { message: 'Bucket ou caminho inválido.' });
      if (bucket === 'marca' && c.role !== 'service_role' && !(await rpc('eh_admin', token))) return json(res, 403, { message: 'Somente a diretoria altera o logotipo.' });
      const dados = await lerCorpo(req);
      await mkdir(path.dirname(arq), { recursive: true });
      await writeFile(arq, dados);
      await writeFile(arq + '.meta.json', JSON.stringify({ tipo: req.headers['content-type'] || 'application/octet-stream', tamanho: dados.length, por: c.sub, em: new Date().toISOString() }));
      return json(res, 200, { Key: `${bucket}/${resto.join('/')}` });
    }
    if (req.method === 'DELETE') {
      const bucket = partes[1];
      if (bucket === 'marca' && c.role !== 'service_role' && !(await rpc('eh_admin', token))) return json(res, 403, { message: 'Somente a diretoria altera o logotipo.' });
      const corpo = JSON.parse((await lerCorpo(req)).toString() || '{}');
      for (const p of corpo.prefixes || []) { const arq = caminhoSeguro(bucket, p); if (arq) { await rm(arq, { force: true }); await rm(arq + '.meta.json', { force: true }); } }
      return json(res, 200, []);
    }
    return json(res, 405, { message: 'Método não suportado.' });
  } catch (e) { return json(res, e.codigo || 500, { message: e.message || 'Erro no serviço de arquivos.' }); }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  if (!SEGREDO) { console.error('Defina JWT_SECRET'); process.exit(1); }
  const porta = Number(process.env.PORTA || 5000);
  http.createServer(tratar).listen(porta, () => console.log(`[arquivos] ouvindo na porta ${porta} · pasta ${PASTA}`));
}
