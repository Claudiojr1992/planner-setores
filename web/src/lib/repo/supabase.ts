/*
 * Implementação do Repo sobre as APIs HTTP públicas do Supabase:
 *   Auth (GoTrue)  -> /auth/v1/*
 *   Dados (PostgREST) -> /rest/v1/*
 *   Arquivos (Storage) -> /storage/v1/*
 * Sem dependências externas. As regras de acesso ficam no banco (RLS).
 */
import type { NomeTabela, Tabelas } from '../types';
import { config } from '../../app/config';
import { ErroApp, type Filtro, type Repo, type Sessao } from './repo';

interface Token { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email: string } }
const CHAVE = 'planner.sessao';
const PAGINA = 1000;

const TRADUCOES: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).'],
  [/user already registered|already been registered/i, 'Já existe uma conta com este e-mail.'],
  [/password should be at least (\d+)/i, 'A senha deve ter pelo menos $1 caracteres.'],
  [/new password should be different/i, 'A nova senha deve ser diferente da atual.'],
  [/rate limit|too many requests|security purposes/i, 'Muitas tentativas. Aguarde alguns instantes e tente novamente.'],
  [/row-level security/i, 'Você não tem permissão para esta ação.'],
  [/jwt expired/i, 'Sua sessão expirou. Entre novamente.'],
  [/duplicate key value.*vinculo_unico/i, 'Já existe um vínculo entre estes setores.'],
  [/violates foreign key.*atividades_setor_id/i, 'Este setor possui atividades e não pode ser excluído.'],
  [/failed to fetch|networkerror/i, 'Não foi possível conectar ao servidor. Verifique se o Supabase está em execução.'],
];
const traduzir = (m: string) => {
  for (const [re, t] of TRADUCOES) { const g = m.match(re); if (g) return t.replace('$1', g[1] || ''); }
  return m;
};

export class SupabaseRepo implements Repo {
  readonly modo = 'supabase' as const;
  private token: Token | null = null;
  private recuperacao = false;
  private renovando: Promise<void> | null = null;

  constructor(private url: string, private chave: string) {
    this.url = url.replace(/\/+$/, '');
    try { const t = localStorage.getItem(CHAVE); if (t) this.token = JSON.parse(t); } catch { /* sem storage */ }
    this.lerRetornoDoEmail();
  }

  /* -------- infraestrutura HTTP -------- */
  private salvar(t: Token | null) {
    this.token = t;
    try { if (t) localStorage.setItem(CHAVE, JSON.stringify(t)); else localStorage.removeItem(CHAVE); } catch { /* ignore */ }
  }
  private aceitarToken(j: any): Token {
    const t: Token = {
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 3600),
      user: { id: j.user?.id, email: j.user?.email },
    };
    this.salvar(t); return t;
  }
  /** Links de e-mail (confirmação/recuperação) voltam com #access_token=...&type=recovery */
  private lerRetornoDoEmail() {
    if (typeof location === 'undefined') return;
    const h = location.hash.replace(/^#\/?/, '');
    if (!/(^|&)access_token=/.test(h) && !/(^|&)error_description=/.test(h)) return;
    const p = new URLSearchParams(h);
    if (p.get('error_description')) { sessionStorage.setItem('planner.erroLink', p.get('error_description') as string); history.replaceState(null, '', location.pathname + '#/login'); return; }
    const access = p.get('access_token') as string;
    let user = { id: '', email: '' };
    try { const pl = JSON.parse(atob(access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); user = { id: pl.sub, email: pl.email }; } catch { /* ignore */ }
    this.aceitarToken({ access_token: access, refresh_token: p.get('refresh_token'), expires_at: Number(p.get('expires_at')) || undefined, expires_in: p.get('expires_in'), user });
    this.recuperacao = p.get('type') === 'recovery';
    history.replaceState(null, '', location.pathname + (this.recuperacao ? '#/redefinir-senha' : '#/'));
  }
  private async garantirToken() {
    if (!this.token) return;
    if (this.token.expires_at - 60 > Date.now() / 1000) return;
    if (!this.renovando) {
      this.renovando = (async () => {
        try {
          const j = await this.http('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: this.token?.refresh_token }, false);
          this.aceitarToken(j);
        } catch { this.salvar(null); }
        finally { this.renovando = null; }
      })();
    }
    await this.renovando;
  }
  private async http(metodo: string, caminho: string, corpo?: unknown, autenticado = true, extra: Record<string, string> = {}, cru = false): Promise<any> {
    if (autenticado) await this.garantirToken();
    const headers: Record<string, string> = { apikey: this.chave, ...extra };
    // chaves novas (sb_publishable_...) não são JWT: vão só no cabeçalho apikey
    const bearer = autenticado && this.token ? this.token.access_token : this.chave.split('.').length === 3 ? this.chave : null;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    let body: BodyInit | undefined;
    if (corpo instanceof Blob) body = corpo;
    else if (corpo !== undefined) { body = JSON.stringify(corpo); headers['Content-Type'] = 'application/json'; }
    let r: Response;
    try { r = await fetch(this.url + caminho, { method: metodo, headers, body }); }
    catch (e: any) { throw new ErroApp(traduzir(String(e?.message || e)), 'rede'); }
    if (cru) { if (!r.ok) throw new ErroApp(`Erro ${r.status}`); return r; }
    const txt = await r.text();
    let j: any = null; try { j = txt ? JSON.parse(txt) : null; } catch { j = txt; }
    if (!r.ok) {
      const msg = (j && (j.message || j.msg || j.error_description || j.error)) || `Erro ${r.status}`;
      if (r.status === 401 && autenticado && /jwt/i.test(String(msg))) this.salvar(null);
      throw new ErroApp(traduzir(String(msg)), j?.code || String(r.status));
    }
    return j;
  }
  private filtroQS(f?: Filtro) {
    if (!f) return '';
    return Object.entries(f).map(([k, v]) => `&${encodeURIComponent(k)}=${v === null ? 'is.null' : 'eq.' + encodeURIComponent(String(v))}`).join('');
  }

  /* -------- autenticação -------- */
  auth = {
    sessao: async (): Promise<Sessao | null> => {
      if (!this.token) return null;
      try {
        const u = await this.http('GET', '/auth/v1/user');
        return { userId: u.id, email: u.email };
      } catch { this.salvar(null); return null; }
    },
    entrar: async (email: string, senha: string) => {
      const j = await this.http('POST', '/auth/v1/token?grant_type=password', { email, password: senha }, false);
      const t = this.aceitarToken(j); this.recuperacao = false;
      return { userId: t.user.id, email: t.user.email };
    },
    cadastrar: async (nome: string, email: string, senha: string) => {
      const redir = encodeURIComponent(location.origin + location.pathname);
      const j = await this.http('POST', `/auth/v1/signup?redirect_to=${redir}`, { email, password: senha, data: { nome } }, false);
      if (j?.access_token) { const t = this.aceitarToken(j); return { userId: t.user.id, email: t.user.email }; }
      return null; // confirmação de e-mail habilitada
    },
    recuperarSenha: async (email: string) => {
      const redir = encodeURIComponent(location.origin + location.pathname);
      await this.http('POST', `/auth/v1/recover?redirect_to=${redir}`, { email }, false);
    },
    redefinirSenha: async (senha: string) => {
      await this.http('PUT', '/auth/v1/user', { password: senha });
      this.recuperacao = false;
    },
    emRecuperacao: () => this.recuperacao,
    sair: async () => {
      try { if (this.token) await this.http('POST', '/auth/v1/logout', {}); } catch { /* ignore */ }
      this.salvar(null);
    },
  };

  /* -------- dados -------- */
  async listar<T extends NomeTabela>(t: T, filtro?: Filtro): Promise<Tabelas[T][]> {
    const ordem = t === 'empresa' || t === 'integracoes' ? 'id' : 'criado_em';
    const out: Tabelas[T][] = [];
    for (let de = 0; ; de += PAGINA) {
      const pag = await this.http('GET', `/rest/v1/${t}?select=*&order=${ordem}.asc,id.asc&limit=${PAGINA}&offset=${de}${this.filtroQS(filtro)}`);
      out.push(...pag);
      if (!Array.isArray(pag) || pag.length < PAGINA) break;
    }
    return out;
  }
  async inserir<T extends NomeTabela>(t: T, linhas: Partial<Tabelas[T]>[]): Promise<Tabelas[T][]> {
    if (!linhas.length) return [];
    if (t === 'envios') {
      // só o admin lê a fila (RLS), então não pedimos a linha de volta; em seguida acorda o notificador
      await this.http('POST', `/rest/v1/${t}`, linhas, true, { Prefer: 'return=minimal' });
      if (config.notificadorUrl) fetch(config.notificadorUrl, { method: 'POST', keepalive: true }).catch(() => {});
      return [];
    }
    return this.http('POST', `/rest/v1/${t}`, linhas, true, { Prefer: 'return=representation' });
  }
  async atualizar<T extends NomeTabela>(t: T, id: string | number, patch: Partial<Tabelas[T]>): Promise<Tabelas[T]> {
    const r = await this.http('PATCH', `/rest/v1/${t}?id=eq.${encodeURIComponent(String(id))}`, patch, true, { Prefer: 'return=representation' });
    if (!Array.isArray(r) || !r.length) throw new ErroApp('Você não tem permissão para alterar este registro.');
    return r[0];
  }
  async remover(t: NomeTabela, id: string | number) {
    const r = await this.http('DELETE', `/rest/v1/${t}?id=eq.${encodeURIComponent(String(id))}`, undefined, true, { Prefer: 'return=representation' });
    if (Array.isArray(r) && !r.length) throw new ErroApp('Você não tem permissão para excluir este registro.');
  }
  async empresaPublica() {
    try { const r = await this.http('GET', '/rest/v1/empresa?select=*&id=eq.1', undefined, false); return r?.[0] || null; }
    catch { return null; }
  }

  /* -------- arquivos -------- */
  private cam = (c: string) => c.split('/').map(encodeURIComponent).join('/');
  arquivos = {
    enviar: async (bucket: 'anexos' | 'marca', caminho: string, arq: Blob, tipo?: string) => {
      await this.http('POST', `/storage/v1/object/${bucket}/${this.cam(caminho)}`, arq, true,
        { 'Content-Type': tipo || arq.type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '3600' });
    },
    url: async (bucket: 'anexos' | 'marca', caminho: string) => {
      if (bucket === 'marca') return `${this.url}/storage/v1/object/public/marca/${this.cam(caminho)}`;
      const j = await this.http('POST', `/storage/v1/object/sign/${bucket}/${this.cam(caminho)}`, { expiresIn: 3600 });
      const s: string = j.signedURL || j.signedUrl;
      return s.startsWith('http') ? s : `${this.url}/storage/v1${s.startsWith('/') ? '' : '/'}${s}`;
    },
    remover: async (bucket: 'anexos' | 'marca', caminho: string) => {
      await this.http('DELETE', `/storage/v1/object/${bucket}`, { prefixes: [caminho] });
    },
  };
}
