import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Dados, Empresa, Perfil } from '../lib/types';
import type { Repo, Sessao } from '../lib/repo/repo';
import { DemoRepo } from '../lib/repo/demo';
import { SupabaseRepo } from '../lib/repo/supabase';
import { carregarDados } from '../lib/dados';
import { Servico, type NovaAtividade } from '../lib/servico';
import { config, usaSupabase } from './config';

export type Tema = 'claro' | 'escuro' | 'sistema';
export interface Toast { id: number; texto: string; tipo: 'ok' | 'erro' | 'info' }
export interface PedidoConfirmacao { titulo: string; texto?: ReactNode; ok?: string; perigo?: boolean; campo?: { rotulo: string; obrigatorio?: boolean; placeholder?: string; min?: number } }
interface Dialogo extends PedidoConfirmacao { resolver: (v: string | false) => void }

interface Ctx {
  repo: Repo; svc: Servico; modo: Repo['modo'];
  sessao: Sessao | null; eu: Perfil | null; dados: Dados | null; empresa: Empresa | null;
  iniciando: boolean;
  recarregar(): Promise<void>;
  executar<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined>;
  toast(texto: string, tipo?: Toast['tipo']): void;
  toasts: Toast[];
  confirmar(p: PedidoConfirmacao): Promise<string | false>;
  dialogo: Dialogo | null; fecharDialogo(v: string | false): void;
  tema: Tema; definirTema(t: Tema): void; temaEfetivo: 'claro' | 'escuro';
  aoEntrar(): Promise<void>; sair(): Promise<void>;
  atividadeAberta: string | null; abrirAtividade(id: string | null): void;
  nova: Partial<NovaAtividade> | null; abrirNova(p?: Partial<NovaAtividade>): void; fecharNova(): void;
}
const C = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(C); if (!c) throw new Error('fora do provedor'); return c; };
/** Atalho para telas autenticadas (dados sempre carregados). */
export const useDados = () => { const c = useApp(); return { ...c, dados: c.dados as Dados, eu: c.eu as Perfil }; };

const TEMA_KEY = 'planner.tema';
function lerTema(): Tema { try { return (localStorage.getItem(TEMA_KEY) as Tema) || 'sistema'; } catch { return 'sistema'; } }

export function Provedor({ children }: { children: ReactNode }) {
  const repo = useMemo<Repo>(() => (usaSupabase ? new SupabaseRepo(config.supabaseUrl as string, config.supabaseAnonKey as string) : new DemoRepo()), []);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [eu, setEu] = useState<Perfil | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [iniciando, setIniciando] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [tema, setTema] = useState<Tema>(lerTema);
  const [sistemaEscuro, setSistemaEscuro] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  const [atividadeAberta, setAtividadeAberta] = useState<string | null>(null);
  const [nova, setNova] = useState<Partial<NovaAtividade> | null>(null);
  const ref = useRef<{ dados: Dados | null; eu: Perfil | null }>({ dados: null, eu: null });
  ref.current = { dados, eu };
  const svc = useMemo(() => new Servico(repo, () => ({ dados: ref.current.dados as Dados, eu: ref.current.eu as Perfil })), [repo]);

  const toast = useCallback((texto: string, tipo: Toast['tipo'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-3), { id, texto, tipo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tipo === 'erro' ? 6000 : 3500);
  }, []);

  const carregar = useCallback(async (s: Sessao | null) => {
    if (!s) { setEu(null); setDados(null); return; }
    const perfis = await repo.listar('perfis', { id: s.userId });
    const p = perfis[0] || null;
    setEu(p);
    if (p?.ativo) { const d = await carregarDados(repo, p.id); ref.current = { dados: d, eu: p }; setDados(d); setEmpresa(d.empresa); }
    else setDados(null);
  }, [repo]);

  const recarregar = useCallback(async () => {
    try { const s = await repo.auth.sessao(); setSessao(s); await carregar(s); }
    catch (e: any) { toast(e?.message || String(e), 'erro'); }
  }, [repo, carregar, toast]);

  useEffect(() => {
    (async () => {
      try {
        setEmpresa(await repo.empresaPublica());
        const s = await repo.auth.sessao(); setSessao(s); await carregar(s);
      } catch (e: any) { toast(e?.message || String(e), 'erro'); }
      finally { setIniciando(false); }
    })();
  }, [repo, carregar, toast]);

  // atualização periódica (outras pessoas trabalhando ao mesmo tempo)
  useEffect(() => {
    if (!sessao) return;
    const tick = () => { if (document.visibilityState === 'visible' && !dialogo) recarregar(); };
    const t = setInterval(tick, 20000);
    const foco = () => recarregar();
    window.addEventListener('focus', foco);
    const st = (e: StorageEvent) => { if (e.key?.startsWith('planner.demo')) recarregar(); };
    window.addEventListener('storage', st);
    return () => { clearInterval(t); window.removeEventListener('focus', foco); window.removeEventListener('storage', st); };
  }, [sessao, recarregar, dialogo]);

  const executar = useCallback(async <T,>(fn: () => Promise<T>, ok?: string) => {
    try { const r = await fn(); await recarregar(); if (ok) toast(ok); return r; }
    catch (e: any) { toast(e?.message || String(e), 'erro'); await recarregar(); return undefined; }
  }, [recarregar, toast]);

  // tema
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const m = matchMedia('(prefers-color-scheme: dark)');
    const f = () => setSistemaEscuro(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f);
  }, []);
  const temaEfetivo = tema === 'sistema' ? (sistemaEscuro ? 'escuro' : 'claro') : tema;
  useEffect(() => { document.documentElement.dataset.theme = temaEfetivo === 'escuro' ? 'dark' : 'light'; }, [temaEfetivo]);
  const definirTema = useCallback((t: Tema) => { setTema(t); try { localStorage.setItem(TEMA_KEY, t); } catch { /* */ } }, []);

  const confirmar = useCallback((p: PedidoConfirmacao) => new Promise<string | false>(resolver => setDialogo({ ...p, resolver })), []);
  const fecharDialogo = useCallback((v: string | false) => { setDialogo(d => { d?.resolver(v); return null; }); }, []);

  const aoEntrar = useCallback(async () => { const s = await repo.auth.sessao(); setSessao(s); await carregar(s); }, [repo, carregar]);
  const sair = useCallback(async () => {
    await repo.auth.sair(); setSessao(null); setEu(null); setDados(null); setAtividadeAberta(null); setNova(null);
    setEmpresa(await repo.empresaPublica());
  }, [repo]);

  const valor: Ctx = {
    repo, svc, modo: repo.modo, sessao, eu, dados, empresa: dados?.empresa || empresa, iniciando,
    recarregar, executar, toast, toasts, confirmar, dialogo, fecharDialogo,
    tema, definirTema, temaEfetivo, aoEntrar, sair,
    atividadeAberta, abrirAtividade: setAtividadeAberta,
    nova, abrirNova: (p = {}) => setNova(p), fecharNova: () => setNova(null),
  };
  return <C.Provider value={valor}>{children}</C.Provider>;
}
