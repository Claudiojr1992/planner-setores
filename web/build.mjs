// Compila a interface para web/dist (usado pelo Dockerfile e para desenvolvimento).
//   node build.mjs           -> build de produção
//   node build.mjs --servir  -> servidor de desenvolvimento em http://localhost:5173
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';

const servir = process.argv.includes('--servir');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/assets', { recursive: true });
cpSync('index.html', 'dist/index.html');
if (existsSync('public')) cpSync('public', 'dist', { recursive: true });
// config.js: na Vercel (ou em qualquer build com as variáveis abaixo) aponta para o Supabase na nuvem.
// Aceita os nomes do projeto e os criados pela integração Supabase ↔ Vercel.
const env = process.env;
const urlSb = env.PLANNER_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
const chaveSb = env.PLANNER_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
if (urlSb && chaveSb) {
  const cfg = {
    supabaseUrl: urlSb.replace(/\/+$/, ''), supabaseAnonKey: chaveSb,
    nomeSistema: env.NOME_SISTEMA || 'Planner de Setores',
    notificadorUrl: env.VERCEL ? '/api/notificar' : (env.PLANNER_NOTIFICADOR_URL || undefined),
  };
  writeFileSync('dist/config.js', `window.__PLANNER_CONFIG__ = ${JSON.stringify(cfg)};\n`);
  console.log(`config.js → Supabase ${cfg.supabaseUrl}${cfg.notificadorUrl ? ' · notificador ' + cfg.notificadorUrl : ''}`);
} else if (!existsSync('dist/config.js')) {
  writeFileSync('dist/config.js', '// Sem Supabase configurado: o sistema abre em modo demonstração.\nwindow.__PLANNER_CONFIG__ = {};\n');
  if (env.VERCEL) console.warn('AVISO: PLANNER_SUPABASE_URL / PLANNER_SUPABASE_ANON_KEY não definidas — publicando em modo demonstração.');
}

const opcoes = {
  entryPoints: { app: 'src/main.tsx' },
  bundle: true, format: 'esm', target: ['es2020'], outdir: 'dist/assets',
  jsx: 'automatic', minify: !servir, sourcemap: servir, legalComments: 'none',
  define: { 'process.env.NODE_ENV': servir ? '"development"' : '"production"' },
  logLevel: 'info',
};
if (servir) {
  const ctx = await esbuild.context(opcoes);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 5173 });
  console.log(`Planner em http://localhost:${port}`);
} else {
  await esbuild.build(opcoes);
}
