export type Papel = 'admin' | 'gestor' | 'colaborador';
export type Status =
  | 'aguardando_aceite' | 'a_distribuir' | 'na_fila' | 'em_andamento'
  | 'pausada' | 'concluida' | 'recusada' | 'cancelada';
export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente';
export type TipoAusencia = 'ferias' | 'licenca' | 'folga' | 'outro';

export interface Empresa { id: number; nome: string; logo_url: string | null; atualizado_em?: string }

export interface Perfil {
  id: string; nome: string; email: string; cargo: string | null;
  setor_id: string | null; papel: Papel; ativo: boolean;
  notif_email: boolean; notif_teams: boolean; criado_em: string;
}

export interface Setor {
  id: string; nome: string; cor: string; descricao: string | null;
  gestor_id: string | null; pos_x: number; pos_y: number; criado_em: string;
}

export interface Vinculo {
  id: string; origem_id: string; destino_id: string; requer_aceite: boolean;
  descricao: string | null; criado_por: string | null; criado_em: string;
}

export type TipoNo = 'inicio' | 'etapa' | 'fim';
export interface FluxoNo {
  id: string; tipo: TipoNo; x: number; y: number; titulo: string;
  setor_id?: string | null; prazo_dias?: number | null; requer_aceite?: boolean;
}
export interface FluxoAresta { id: string; de: string; para: string; rotulo?: string }
export interface FluxoDefinicao { nos: FluxoNo[]; arestas: FluxoAresta[] }
export interface Fluxo {
  id: string; nome: string; descricao: string | null; ativo: boolean;
  definicao: FluxoDefinicao; criado_por: string | null; criado_em: string; atualizado_em: string;
}

export interface Atividade {
  id: string; numero: number; titulo: string; descricao: string | null;
  setor_id: string; responsavel_id: string | null; status: Status; prioridade: Prioridade;
  inicio: string | null; prazo: string | null; criado_por: string | null;
  solicitante_setor_id: string | null; origem_id: string | null; processo_id: string;
  fluxo_id: string | null; etapa_id: string | null; encaminhar_para: string | null;
  motivo: string | null; responsavel_original_id: string | null;
  iniciado_em: string | null; concluido_em: string | null; criado_em: string; atualizado_em: string;
}

export interface Historico { id: string; atividade_id: string; texto: string; autor_id: string | null; criado_em: string }
export interface Comentario { id: string; atividade_id: string; texto: string; autor_id: string | null; criado_em: string }
export interface Anexo {
  id: string; atividade_id: string; nome: string; caminho: string; tamanho: number;
  tipo: string | null; autor_id: string | null; criado_em: string;
}
export interface Notificacao {
  id: string; para_id: string; titulo: string; texto: string | null;
  atividade_id: string | null; lida: boolean; criado_em: string;
}
export interface Ausencia {
  id: string; pessoa_id: string; tipo: TipoAusencia; inicio: string; fim: string;
  substituto_id: string | null; observacao: string | null; delegado: boolean; devolvido: boolean;
  criado_por: string | null; criado_em: string;
}
export interface Integracoes { id: number; email_ativo: boolean; teams_ativo: boolean; app_url: string }
export interface TeamsWebhook { id: string; setor_id: string | null; url: string; ativo: boolean; criado_em: string }
export interface Envio {
  id: string; canal: 'email' | 'teams'; para_id: string | null; setor_id: string | null;
  assunto: string; corpo: string | null; link: string | null;
  status: 'pendente' | 'enviado' | 'erro' | 'ignorado'; erro: string | null; tentativas: number;
  criado_por: string | null; criado_em: string; enviado_em: string | null;
}

export interface Tabelas {
  empresa: Empresa; perfis: Perfil; setores: Setor; vinculos: Vinculo; fluxos: Fluxo;
  atividades: Atividade; historico: Historico; comentarios: Comentario; anexos: Anexo;
  notificacoes: Notificacao; ausencias: Ausencia; integracoes: Integracoes;
  teams_webhooks: TeamsWebhook; envios: Envio;
}
export type NomeTabela = keyof Tabelas;

/** Instantâneo dos dados carregados para a sessão atual. */
export interface Dados {
  empresa: Empresa;
  perfis: Perfil[]; setores: Setor[]; vinculos: Vinculo[]; fluxos: Fluxo[];
  atividades: Atividade[]; notificacoes: Notificacao[]; ausencias: Ausencia[];
  integracoes: Integracoes;
}
