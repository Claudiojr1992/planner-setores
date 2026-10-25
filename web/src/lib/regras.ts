/* Regras de negócio puras (sem acesso a dados) — testáveis isoladamente. */
import type {
  Atividade, Ausencia, Dados, Fluxo, FluxoNo, Perfil, Prioridade, Setor, Status, TipoAusencia, Vinculo,
} from './types';

/* ---------------- datas ---------------- */
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hoje = () => ymd(new Date());
export const addDias = (n: number, base?: string) => {
  const d = base ? new Date(base + 'T12:00:00') : new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const agoraISO = () => new Date().toISOString();
export const diaDe = (iso: string | null | undefined) => (iso ? ymd(new Date(iso)) : null);
export const fmtData = (s: string | null | undefined) => {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
export const fmtDataCurta = (s: string | null | undefined) => {
  if (!s) return '—';
  const [, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}`;
};
export const fmtDataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
export const tempoRelativo = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'ontem' : `há ${d} dias`;
};
export const uuid = () =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto)
    ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

/* ---------------- rótulos ---------------- */
export const STATUS: Record<Status, { rotulo: string; tom: string; ordem: number }> = {
  aguardando_aceite: { rotulo: 'Aguardando aceite', tom: 'amber', ordem: 1 },
  a_distribuir: { rotulo: 'A distribuir', tom: 'cyan', ordem: 2 },
  na_fila: { rotulo: 'Na fila', tom: 'slate', ordem: 3 },
  em_andamento: { rotulo: 'Em andamento', tom: 'blue', ordem: 4 },
  pausada: { rotulo: 'Pausada', tom: 'purple', ordem: 5 },
  concluida: { rotulo: 'Concluída', tom: 'green', ordem: 6 },
  recusada: { rotulo: 'Recusada', tom: 'red', ordem: 7 },
  cancelada: { rotulo: 'Cancelada', tom: 'gray', ordem: 8 },
};
export const PRIORIDADE: Record<Prioridade, { rotulo: string; peso: number }> = {
  baixa: { rotulo: 'Baixa', peso: 1 }, media: { rotulo: 'Média', peso: 2 },
  alta: { rotulo: 'Alta', peso: 3 }, urgente: { rotulo: 'Urgente', peso: 4 },
};
export const PAPEL = { admin: 'Administrador', gestor: 'Gestor', colaborador: 'Colaborador' } as const;
export const TIPO_AUSENCIA: Record<TipoAusencia, string> = { ferias: 'Férias', licenca: 'Licença', folga: 'Folga', outro: 'Outro' };

/* ---------------- atividades ---------------- */
export const FINAIS: Status[] = ['concluida', 'recusada', 'cancelada'];
export const aberta = (a: Atividade) => !FINAIS.includes(a.status);
export const atrasadaEm = (a: Atividade, ref: string) => aberta(a) && !!a.prazo && a.prazo < ref;
/** Uso seguro como callback de filter/some (não recebe índice como data). */
export const atrasada = (a: Atividade) => atrasadaEm(a, hoje());
export const venceHoje = (a: Atividade) => aberta(a) && a.prazo === hoje();
export const ordenar = (l: Atividade[]) =>
  l.slice().sort((a, b) =>
    (Number(b.status === 'em_andamento') - Number(a.status === 'em_andamento')) ||
    (Number(atrasada(b)) - Number(atrasada(a))) ||
    (PRIORIDADE[b.prioridade].peso - PRIORIDADE[a.prioridade].peso) ||
    (a.prazo || '9999').localeCompare(b.prazo || '9999') ||
    a.numero - b.numero);

export interface Indicadores {
  abertas: number; aguardando: number; distribuir: number; fila: number; andamento: number;
  atrasadas: number; concluidas30: number; noPrazoPct: number; ocupacaoPct: number; leadTimeDias: number | null;
}
export function indicadores(l: Atividade[], ref = hoje()): Indicadores {
  const ab = l.filter(aberta);
  const lim = addDias(-30, ref);
  const conc = l.filter(a => a.status === 'concluida' && a.concluido_em && (diaDe(a.concluido_em) as string) >= lim);
  const noPrazo = conc.filter(a => !a.prazo || (diaDe(a.concluido_em) as string) <= a.prazo).length;
  const exec = ab.filter(a => ['na_fila', 'em_andamento', 'pausada'].includes(a.status));
  const lt = conc.filter(a => a.criado_em).map(a => (new Date(a.concluido_em as string).getTime() - new Date(a.criado_em).getTime()) / 86400000);
  return {
    abertas: ab.length,
    aguardando: ab.filter(a => a.status === 'aguardando_aceite').length,
    distribuir: ab.filter(a => a.status === 'a_distribuir').length,
    fila: ab.filter(a => a.status === 'na_fila' || a.status === 'pausada').length,
    andamento: ab.filter(a => a.status === 'em_andamento').length,
    atrasadas: ab.filter(a => atrasadaEm(a, ref)).length,
    concluidas30: conc.length,
    noPrazoPct: conc.length ? Math.round((noPrazo / conc.length) * 100) : 100,
    ocupacaoPct: exec.length ? Math.round((exec.filter(a => a.status === 'em_andamento').length / exec.length) * 100) : 0,
    leadTimeDias: lt.length ? Math.round((lt.reduce((s, x) => s + x, 0) / lt.length) * 10) / 10 : null,
  };
}

/* ---------------- permissões ---------------- */
export const ehAdmin = (p: Perfil | null | undefined) => !!p && p.papel === 'admin' && p.ativo;
export const setoresGeridos = (p: Perfil | null | undefined, setores: Setor[]) =>
  !p ? [] : ehAdmin(p) ? setores.map(s => s.id) : setores.filter(s => s.gestor_id === p.id).map(s => s.id);
export const gere = (p: Perfil | null | undefined, setorId: string | null | undefined, setores: Setor[]) =>
  !!p && !!setorId && (ehAdmin(p) || setores.some(s => s.id === setorId && s.gestor_id === p.id));
export const ehGestor = (p: Perfil | null | undefined, setores: Setor[]) => setoresGeridos(p, setores).length > 0;
export const podeExecutar = (p: Perfil | null | undefined, a: Atividade, setores: Setor[]) =>
  !!p && (a.responsavel_id === p.id || gere(p, a.setor_id, setores));

/* ---------------- vínculos ---------------- */
export const vinculoEntre = (v: Vinculo[], origem: string | null | undefined, destino: string) =>
  origem ? v.find(x => x.origem_id === origem && x.destino_id === destino) || null : null;

export interface Destino { setor: Setor; modo: 'proprio' | 'direto' | 'aceite'; vinculo: Vinculo | null }
/** Setores para onde a pessoa pode enviar uma atividade a partir de `origem` (padrão: setor dela). */
export function destinosPermitidos(p: Perfil, d: Pick<Dados, 'setores' | 'vinculos'>, origem = p.setor_id): Destino[] {
  return d.setores.map<Destino | null>(s => {
    if (s.id === origem) return { setor: s, modo: 'proprio', vinculo: null };
    const v = vinculoEntre(d.vinculos, origem, s.id);
    if (v) return { setor: s, modo: v.requer_aceite ? 'aceite' : 'direto', vinculo: v };
    if (gere(p, s.id, d.setores)) return { setor: s, modo: 'direto', vinculo: null };
    return null;
  }).filter((x): x is Destino => !!x).sort((a, b) => a.setor.nome.localeCompare(b.setor.nome));
}

/* ---------------- fluxos ---------------- */
export const noInicio = (f: Fluxo) => f.definicao.nos.find(n => n.tipo === 'inicio') || null;
export const proximosNos = (f: Fluxo, deId: string): FluxoNo[] =>
  f.definicao.arestas.filter(a => a.de === deId)
    .map(a => f.definicao.nos.find(n => n.id === a.para))
    .filter((n): n is FluxoNo => !!n && n.tipo === 'etapa');
export const primeirasEtapas = (f: Fluxo) => { const i = noInicio(f); return i ? proximosNos(f, i.id) : []; };
export const terminaApos = (f: Fluxo, deId: string) =>
  f.definicao.arestas.some(a => a.de === deId && f.definicao.nos.find(n => n.id === a.para)?.tipo === 'fim');
export const etapasDoFluxo = (f: Fluxo) => f.definicao.nos.filter(n => n.tipo === 'etapa');

/** Ordem "visual" das etapas a partir do início (busca em largura). */
export function etapasEmOrdem(f: Fluxo): FluxoNo[] {
  const ini = noInicio(f); if (!ini) return etapasDoFluxo(f);
  const visto = new Set<string>(), out: FluxoNo[] = [], fila = [ini.id];
  while (fila.length) {
    const id = fila.shift() as string;
    for (const n of proximosNos(f, id)) if (!visto.has(n.id)) { visto.add(n.id); out.push(n); fila.push(n.id); }
  }
  return out.concat(etapasDoFluxo(f).filter(n => !visto.has(n.id)));
}

export interface Problema { nivel: 'erro' | 'aviso'; texto: string; noId?: string }
export function validarFluxo(f: Fluxo, setores: Setor[]): Problema[] {
  const p: Problema[] = [];
  const { nos, arestas } = f.definicao;
  const inis = nos.filter(n => n.tipo === 'inicio'), fins = nos.filter(n => n.tipo === 'fim'), etapas = nos.filter(n => n.tipo === 'etapa');
  if (inis.length !== 1) p.push({ nivel: 'erro', texto: inis.length ? 'O fluxo deve ter apenas um nó de Início.' : 'Adicione um nó de Início.' });
  if (!fins.length) p.push({ nivel: 'erro', texto: 'Adicione pelo menos um nó de Fim.' });
  if (!etapas.length) p.push({ nivel: 'erro', texto: 'Adicione pelo menos uma etapa.' });
  for (const e of etapas) {
    if (!e.setor_id || !setores.some(s => s.id === e.setor_id)) p.push({ nivel: 'erro', texto: `A etapa “${e.titulo || 'sem nome'}” precisa de um setor responsável.`, noId: e.id });
    if (!arestas.some(a => a.para === e.id)) p.push({ nivel: 'erro', texto: `Nenhuma conexão chega na etapa “${e.titulo}”.`, noId: e.id });
    if (!arestas.some(a => a.de === e.id)) p.push({ nivel: 'erro', texto: `A etapa “${e.titulo}” não tem saída (ligue a uma etapa ou ao Fim).`, noId: e.id });
  }
  for (const a of arestas) {
    const de = nos.find(n => n.id === a.de), para = nos.find(n => n.id === a.para);
    if (!de || !para) p.push({ nivel: 'erro', texto: 'Existe uma conexão apontando para um nó que não existe.' });
    else if (para.tipo === 'inicio') p.push({ nivel: 'erro', texto: 'O Início não pode receber conexões.' });
    else if (de.tipo === 'fim') p.push({ nivel: 'erro', texto: 'O Fim não pode ter saídas.' });
  }
  if (inis[0] && !arestas.some(a => a.de === inis[0].id)) p.push({ nivel: 'erro', texto: 'Ligue o Início à primeira etapa.' });
  // alcançabilidade
  if (inis[0]) {
    const visto = new Set([inis[0].id]); const fila = [inis[0].id];
    while (fila.length) { const id = fila.shift() as string; for (const a of arestas) if (a.de === id && !visto.has(a.para)) { visto.add(a.para); fila.push(a.para); } }
    for (const e of etapas) if (!visto.has(e.id)) p.push({ nivel: 'aviso', texto: `A etapa “${e.titulo}” nunca é alcançada a partir do Início.`, noId: e.id });
    if (fins.length && !fins.some(x => visto.has(x.id))) p.push({ nivel: 'erro', texto: 'Nenhum caminho leva do Início até o Fim.' });
  }
  if (temCiclo(f)) p.push({ nivel: 'aviso', texto: 'O fluxo tem um ciclo (retrabalho). Ele é permitido, mas confira se é intencional.' });
  return p;
}
function temCiclo(f: Fluxo) {
  const adj = new Map<string, string[]>();
  f.definicao.arestas.forEach(a => adj.set(a.de, [...(adj.get(a.de) || []), a.para]));
  const cor = new Map<string, number>();
  const dfs = (u: string): boolean => {
    cor.set(u, 1);
    for (const v of adj.get(u) || []) { if (cor.get(v) === 1) return true; if (!cor.get(v) && dfs(v)) return true; }
    cor.set(u, 2); return false;
  };
  return f.definicao.nos.some(n => !cor.get(n.id) && dfs(n.id));
}

/* ---------------- ausências ---------------- */
export const ausenciaAtiva = (aus: Ausencia[], pessoaId: string | null | undefined, ref = hoje()) =>
  pessoaId ? aus.find(a => a.pessoa_id === pessoaId && a.inicio <= ref && a.fim >= ref) || null : null;
export const ausenciaNoPeriodo = (aus: Ausencia[], pessoaId: string, ini: string, fim: string, ignorarId?: string) =>
  aus.find(a => a.id !== ignorarId && a.pessoa_id === pessoaId && a.inicio <= fim && a.fim >= ini) || null;
export const situacaoAusencia = (a: Ausencia, ref = hoje()) =>
  a.fim < ref ? 'encerrada' : a.inicio > ref ? 'programada' : 'em_curso';

/* ---------------- processos ---------------- */
export const atividadesDoProcesso = (todas: Atividade[], processoId: string) =>
  todas.filter(a => a.processo_id === processoId)
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.numero - b.numero);

export const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
export const primeiroNome = (nome: string | undefined) => (nome || '').split(' ')[0];
