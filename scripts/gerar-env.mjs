// Gera o arquivo .env com senhas e chaves novas (executado dentro de um container Node pelo INSTALAR.bat).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';

const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
export function jwt(role, segredo) {
  const agora = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ role, iss: 'supabase', iat: agora, exp: agora + 10 * 365 * 24 * 3600 }));
  return `${h}.${p}.${b64u(createHmac('sha256', segredo).update(`${h}.${p}`).digest())}`;
}
if (process.argv[1]?.endsWith('gerar-env.mjs')) {
  const destino = process.argv[2] || '.env';
  if (existsSync(destino)) { console.log(`${destino} já existe — mantido.`); process.exit(0); }
  const segredo = randomBytes(36).toString('hex');
  const valores = {
    POSTGRES_PASSWORD: randomBytes(18).toString('hex'),
    JWT_SECRET: segredo, ANON_KEY: jwt('anon', segredo), SERVICE_ROLE_KEY: jwt('service_role', segredo),
  };
  const linhas = readFileSync('.env.example', 'utf8').split(/\r?\n/).map(l => {
    const k = l.split('=')[0]; return k in valores ? `${k}=${valores[k]}` : l;
  });
  writeFileSync(destino, linhas.join('\n'));
  console.log(`${destino} criado com senhas e chaves novas.`);
}
