/*
 * Modo demonstração: mesmo contrato do Supabase, com dados no navegador (localStorage).
 * Usado quando o sistema roda sem Supabase configurado — ideal para conhecer as telas.
 */
import type { NomeTabela, Tabelas } from '../types';
import { agoraISO, uuid } from '../regras';
import { ErroApp, type Filtro, type Repo, type Sessao } from './repo';
import { gerarDadosDemo, SENHA_DEMO } from './seed';

type Banco = { [K in NomeTabela]: Tabelas[K][] } & { __senhas: Record<string, string>; __seq: number };
const CHAVE = 'planner.demo.v2';
const CHAVE_SESSAO = 'planner.demo.sessao';
const LIMITE_ARQUIVO = 2 * 1024 * 1024;

const memoria: Record<string, string> = {};
const ls = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return memoria[k] ?? null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { memoria[k] = v; } },
  del(k: string) { try { localStorage.removeItem(k); } catch { delete memoria[k]; } },
};
const espera = (ms = 60) => new Promise(r => setTimeout(r, ms));

export class DemoRepo implements Repo {
  readonly modo = 'demo' as const;
  private db!: Banco;
  private recuperacao = false;

  constructor() { this.carregar(); }

  private carregar() {
    const raw = ls.get(CHAVE);
    if (raw) { try { this.db = JSON.parse(raw); return; } catch { /* recria */ } }
    this.db = gerarDadosDemo() as Banco;
    this.gravar();
  }
  private gravar() {
    try { ls.set(CHAVE, JSON.stringify(this.db)); }
    catch { throw new ErroApp('O armazenamento do navegador está cheio. Remova anexos grandes do modo demonstração.'); }
  }
  private sessaoAtual(): Sessao | null { try { return JSON.parse(ls.get(CHAVE_SESSAO) || 'null'); } catch { return null; } }
  private exigirSessao() { const s = this.sessaoAtual(); if (!s) throw new ErroApp('Sua sessão expirou. Entre novamente.'); return s; }

  async reiniciarDemo() { ls.del(CHAVE); this.carregar(); }

  /** Simula o clique no link enviado por e-mail (somente modo demo). */
  simularLinkRecuperacao(email: string) {
    const p = this.db.perfis.find(x => x.email.toLowerCase() === email.toLowerCase());
    if (!p) return false;
    ls.set(CHAVE_SESSAO, JSON.stringify({ userId: p.id, email: p.email }));
    this.recuperacao = true; return true;
  }

  auth = {
    sessao: async () => { await espera(20); this.carregar(); return this.sessaoAtual(); },
    entrar: async (email: string, senha: string) => {
      await espera(250); this.carregar();
      const e = email.trim().toLowerCase();
      const p = this.db.perfis.find(x => x.email.toLowerCase() === e);
      if (!p || this.db.__senhas[e] !== senha) throw new ErroApp('E-mail ou senha incorretos.');
      const s = { userId: p.id, email: p.email }; ls.set(CHAVE_SESSAO, JSON.stringify(s)); this.recuperacao = false; return s;
    },
    cadastrar: async (nome: string, email: string, senha: string) => {
      await espera(250); this.carregar();
      const e = email.trim().toLowerCase();
      if (this.db.perfis.some(x => x.email.toLowerCase() === e)) throw new ErroApp('Já existe uma conta com este e-mail.');
      if (senha.length < 6) throw new ErroApp('A senha deve ter pelo menos 6 caracteres.');
      const primeiro = this.db.perfis.length === 0;
      const p = { id: uuid(), nome: nome.trim(), email: e, cargo: null, setor_id: null, papel: primeiro ? 'admin' : 'colaborador', ativo: primeiro, notif_email: true, notif_teams: true, criado_em: agoraISO() } as Tabelas['perfis'];
      this.db.perfis.push(p); this.db.__senhas[e] = senha; this.gravar();
      const s = { userId: p.id, email: p.email }; ls.set(CHAVE_SESSAO, JSON.stringify(s)); return s;
    },
    recuperarSenha: async (_email: string) => { await espera(300); },
    redefinirSenha: async (senha: string) => {
      const s = this.exigirSessao();
      if (senha.length < 6) throw new ErroApp('A senha deve ter pelo menos 6 caracteres.');
      this.db.__senhas[s.email.toLowerCase()] = senha; this.gravar(); this.recuperacao = false;
    },
    emRecuperacao: () => this.recuperacao,
    sair: async () => { ls.del(CHAVE_SESSAO); this.recuperacao = false; },
  };

  async listar<T extends NomeTabela>(t: T, filtro?: Filtro): Promise<Tabelas[T][]> {
    await espera(15); this.carregar();
    const s = this.sessaoAtual();
    let l = (this.db[t] || []) as Tabelas[T][];
    if (t === 'notificacoes') l = l.filter((n: any) => n.para_id === s?.userId);
    if (filtro) l = l.filter((r: any) => Object.entries(filtro).every(([k, v]) => (r[k] ?? null) === v));
    return JSON.parse(JSON.stringify(l));
  }
  async inserir<T extends NomeTabela>(t: T, linhas: Partial<Tabelas[T]>[]): Promise<Tabelas[T][]> {
    await espera(); this.carregar();
    const s = this.exigirSessao();
    const out = linhas.map(l => {
      const r: any = { id: uuid(), criado_em: agoraISO(), ...l };
      if (t === 'atividades') { r.numero = ++this.db.__seq; r.atualizado_em = r.criado_em; r.processo_id ||= uuid(); }
      if (t === 'fluxos') r.atualizado_em = r.criado_em;
      if (t === 'envios') { r.status = 'pendente'; r.tentativas = 0; r.criado_por ||= s.userId; }
      return r;
    });
    (this.db[t] as any[]).push(...out); this.gravar();
    if (t === 'envios') setTimeout(() => this.simularNotificador(out.map(x => x.id)), 1200);
    return JSON.parse(JSON.stringify(out));
  }
  async atualizar<T extends NomeTabela>(t: T, id: string | number, patch: Partial<Tabelas[T]>): Promise<Tabelas[T]> {
    await espera(); this.carregar(); this.exigirSessao();
    const l = this.db[t] as any[];
    const i = l.findIndex(r => r.id === id);
    if (i < 0) throw new ErroApp('Registro não encontrado.');
    l[i] = { ...l[i], ...patch };
    if (t === 'atividades' || t === 'fluxos') l[i].atualizado_em = agoraISO();
    this.gravar();
    return JSON.parse(JSON.stringify(l[i]));
  }
  async remover(t: NomeTabela, id: string | number) {
    await espera(); this.carregar(); this.exigirSessao();
    if (t === 'setores' && this.db.atividades.some(a => a.setor_id === id)) throw new ErroApp('Este setor possui atividades e não pode ser excluído.');
    (this.db as any)[t] = (this.db[t] as any[]).filter(r => r.id !== id);
    // cascatas principais
    if (t === 'atividades') for (const k of ['historico', 'comentarios', 'anexos', 'notificacoes'] as const) (this.db as any)[k] = (this.db[k] as any[]).filter(r => r.atividade_id !== id);
    if (t === 'setores') this.db.vinculos = this.db.vinculos.filter(v => v.origem_id !== id && v.destino_id !== id);
    this.gravar();
  }
  async empresaPublica() { this.carregar(); return this.db.empresa[0] || null; }

  arquivos = {
    enviar: async (bucket: string, caminho: string, arq: Blob) => {
      if (arq.size > LIMITE_ARQUIVO) throw new ErroApp('No modo demonstração o limite é de 2 MB por arquivo. Com o Supabase o limite padrão é 50 MB.');
      const url = await new Promise<string>((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => erro(r.error); r.readAsDataURL(arq); });
      ls.set(`planner.demo.arq:${bucket}/${caminho}`, url);
    },
    url: async (bucket: string, caminho: string) => ls.get(`planner.demo.arq:${bucket}/${caminho}`) || caminho,
    remover: async (bucket: string, caminho: string) => { ls.del(`planner.demo.arq:${bucket}/${caminho}`); },
  };

  /** No demo não há servidor de e-mail/Teams: marcamos os envios como processados. */
  private simularNotificador(ids: string[]) {
    this.carregar();
    for (const e of this.db.envios) if (ids.includes(e.id) && e.status === 'pendente') {
      e.status = 'enviado'; e.tentativas = 1; e.enviado_em = agoraISO(); e.erro = 'Modo demonstração: envio simulado (nenhuma mensagem real foi enviada).';
    }
    this.gravar();
  }
}

export { SENHA_DEMO };
