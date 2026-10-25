import type { NomeTabela, Tabelas } from '../types';

export interface Sessao { userId: string; email: string }
export type Filtro = Record<string, string | number | boolean | null>;

export class ErroApp extends Error {
  constructor(msg: string, public codigo?: string) { super(msg); }
}

/** Contrato único de acesso a dados. Implementado pelo Supabase (produção) e pelo modo demonstração. */
export interface Repo {
  readonly modo: 'supabase' | 'demo';
  auth: {
    sessao(): Promise<Sessao | null>;
    entrar(email: string, senha: string): Promise<Sessao>;
    /** Retorna a sessão quando o login é imediato, ou null quando precisa confirmar o e-mail. */
    cadastrar(nome: string, email: string, senha: string): Promise<Sessao | null>;
    recuperarSenha(email: string): Promise<void>;
    redefinirSenha(novaSenha: string): Promise<void>;
    /** true quando a sessão atual veio de um link de recuperação de senha. */
    emRecuperacao(): boolean;
    sair(): Promise<void>;
  };
  listar<T extends NomeTabela>(t: T, filtro?: Filtro): Promise<Tabelas[T][]>;
  inserir<T extends NomeTabela>(t: T, linhas: Partial<Tabelas[T]>[]): Promise<Tabelas[T][]>;
  atualizar<T extends NomeTabela>(t: T, id: string | number, patch: Partial<Tabelas[T]>): Promise<Tabelas[T]>;
  remover(t: NomeTabela, id: string | number): Promise<void>;
  arquivos: {
    enviar(bucket: 'anexos' | 'marca', caminho: string, arquivo: Blob, tipo?: string): Promise<void>;
    url(bucket: 'anexos' | 'marca', caminho: string): Promise<string>;
    remover(bucket: 'anexos' | 'marca', caminho: string): Promise<void>;
  };
  /** Empresa é pública (tela de login). */
  empresaPublica(): Promise<Tabelas['empresa'] | null>;
  /** Utilitário do modo demo (redefinir dados). */
  reiniciarDemo?(): Promise<void>;
}
