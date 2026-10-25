/*
 * Serviço de domínio: todas as operações de negócio passam por aqui.
 * Mantém regras de fluxo, aceite, distribuição, delegação e notificação em um só lugar.
 */
import type {
  Anexo, Atividade, Ausencia, Comentario, Dados, Envio, Fluxo, FluxoNo, Historico, Notificacao,
  Perfil, Prioridade, Setor, TeamsWebhook, TipoAusencia, Vinculo,
} from './types';
import {
  FINAIS, addDias, agoraISO, ausenciaNoPeriodo, ehAdmin, fmtData, gere, hoje, podeExecutar,
  primeirasEtapas, proximosNos, uuid, validarFluxo, vinculoEntre, TIPO_AUSENCIA,
} from './regras';
import { ErroApp, type Repo } from './repo/repo';

export interface NovaAtividade {
  modo: 'setor' | 'solicitar' | 'fluxo';
  titulo: string; descricao?: string; prioridade: Prioridade;
  inicio?: string | null; prazo?: string | null;
  setor_id?: string | null; responsavel_id?: string | null;
  fluxo_id?: string | null; encaminhar_para?: string | null;
  arquivos?: File[];
}
export interface Delegacao { atividade_id: string; para: string | null }
export interface Detalhe { historico: Historico[]; comentarios: Comentario[]; anexos: Anexo[] }

class Lote {
  notifs: Partial<Notificacao>[] = [];
  envios: Partial<Envio>[] = [];
  hist: Partial<Historico>[] = [];
}

export class Servico {
  constructor(private repo: Repo, private ctx: () => { dados: Dados; eu: Perfil }) {}

  private get d() { return this.ctx().dados; }
  private get eu() { return this.ctx().eu; }
  private setor = (id: string | null | undefined) => this.d.setores.find(s => s.id === id);
  private pessoa = (id: string | null | undefined) => this.d.perfis.find(p => p.id === id);
  private nomeSetor = (id: string | null | undefined) => this.setor(id)?.nome || 'setor removido';
  private nomePessoa = (id: string | null | undefined) => this.pessoa(id)?.nome || '—';
  private atv = (id: string) => this.d.atividades.find(a => a.id === id);

  /* ======================= infraestrutura ======================= */
  private link(atividadeId?: string | null) {
    let base = (this.d.integracoes?.app_url || '').replace(/#.*$/, '').replace(/\/+$/, '') || '';
    // publicado na nuvem com o endereço padrão (localhost) ainda salvo: usa o endereço real da página
    if (typeof location !== 'undefined' && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
      base = location.origin;
    return atividadeId ? `${base}/#/atividade/${atividadeId}` : `${base}/#/`;
  }
  private notificar(l: Lote, paraId: string | null | undefined, titulo: string, texto: string, atividadeId?: string | null) {
    if (!paraId || paraId === this.eu.id) return;
    if (l.notifs.some(n => n.para_id === paraId && n.atividade_id === (atividadeId ?? null) && n.titulo === titulo)) return;
    const p = this.pessoa(paraId); if (!p || !p.ativo) return;
    l.notifs.push({ para_id: paraId, titulo, texto, atividade_id: atividadeId ?? null, lida: false });
    const integ = this.d.integracoes;
    if (integ?.email_ativo && p.notif_email)
      l.envios.push({ canal: 'email', para_id: p.id, setor_id: p.setor_id, assunto: titulo, corpo: texto, link: this.link(atividadeId), criado_por: this.eu.id });
    if (integ?.teams_ativo && p.notif_teams)
      l.envios.push({ canal: 'teams', para_id: p.id, setor_id: p.setor_id, assunto: titulo, corpo: `Para ${p.nome}: ${texto}`, link: this.link(atividadeId), criado_por: this.eu.id });
  }
  private registrar(l: Lote, atividadeId: string, texto: string) {
    l.hist.push({ atividade_id: atividadeId, texto, autor_id: this.eu.id, criado_em: agoraISO() });
  }
  private async gravar(l: Lote) {
    // histórico é essencial; notificações e envios não devem impedir a operação principal
    if (l.hist.length) await this.repo.inserir('historico', l.hist);
    if (l.notifs.length) await this.repo.inserir('notificacoes', l.notifs).catch(e => console.warn('notificações', e));
    if (l.envios.length) await this.repo.inserir('envios', l.envios).catch(e => console.warn('envios', e));
  }
  private exigir(cond: boolean, msg: string) { if (!cond) throw new ErroApp(msg); }
  private gestorDe = (setorId: string | null | undefined) => this.setor(setorId)?.gestor_id || null;

  /** Define se a entrega em `destino` precisa de aceite e com qual vínculo. */
  private regraEntrada(origem: string | null, destino: string, requerAceiteEtapa?: boolean | null, viaFluxo = false) {
    if (origem === destino) return { aceite: false };
    if (this.gestorDe(destino) === this.eu.id) return { aceite: false };
    if (viaFluxo) return { aceite: requerAceiteEtapa !== false };
    const v = vinculoEntre(this.d.vinculos, origem, destino);
    if (v) return { aceite: v.requer_aceite };
    this.exigir(ehAdmin(this.eu), `Não existe vínculo de ${this.nomeSetor(origem)} para ${this.nomeSetor(destino)}. Peça ao gestor ou à diretoria para criar o vínculo em Gestão da Empresa.`);
    return { aceite: true };
  }
  private avisosEntrada(l: Lote, a: Partial<Atividade> & { id: string; titulo: string; setor_id: string }, origemTexto: string) {
    const g = this.gestorDe(a.setor_id);
    if (a.status === 'aguardando_aceite')
      this.notificar(l, g, 'Nova solicitação aguardando seu aceite', `${origemTexto} enviou “${a.titulo}” para ${this.nomeSetor(a.setor_id)}.`, a.id);
    else if (a.status === 'a_distribuir')
      this.notificar(l, g, 'Nova atividade para distribuir', `“${a.titulo}” chegou em ${this.nomeSetor(a.setor_id)} (${origemTexto}).`, a.id);
    if (a.responsavel_id) this.notificar(l, a.responsavel_id, 'Atividade atribuída a você', `“${a.titulo}” está na sua fila${a.prazo ? `, prazo ${fmtData(a.prazo)}` : ''}.`, a.id);
  }
  private async enviarArquivos(atividadeIds: string[], arquivos: File[] | undefined, l: Lote) {
    if (!arquivos?.length || !atividadeIds.length) return;
    const linhas: Partial<Anexo>[] = [];
    for (const f of arquivos) {
      const caminho = `${atividadeIds[0]}/${uuid()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
      await this.repo.arquivos.enviar('anexos', caminho, f, f.type);
      for (const id of atividadeIds) linhas.push({ atividade_id: id, nome: f.name, caminho, tamanho: f.size, tipo: f.type || null, autor_id: this.eu.id });
    }
    await this.repo.inserir('anexos', linhas);
    atividadeIds.forEach(id => this.registrar(l, id, `${arquivos.length} anexo(s) adicionado(s)`));
  }

  /* ======================= atividades ======================= */
  async criar(e: NovaAtividade): Promise<Atividade[]> {
    const titulo = e.titulo.trim();
    this.exigir(titulo.length >= 3, 'Informe um título com pelo menos 3 caracteres.');
    const l = new Lote();
    const meuSetor = this.eu.setor_id;
    const base = {
      titulo, descricao: e.descricao?.trim() || null, prioridade: e.prioridade, inicio: e.inicio || hoje(),
      criado_por: this.eu.id, solicitante_setor_id: meuSetor, processo_id: uuid(),
    };
    let linhas: Partial<Atividade>[] = [];

    if (e.modo === 'fluxo') {
      const f = this.d.fluxos.find(x => x.id === e.fluxo_id);
      this.exigir(!!f && f.ativo, 'Selecione um fluxo de processo ativo.');
      const erros = validarFluxo(f as Fluxo, this.d.setores).filter(x => x.nivel === 'erro');
      this.exigir(!erros.length, `O fluxo “${f!.nome}” tem pendências: ${erros[0]?.texto}`);
      for (const etapa of primeirasEtapas(f as Fluxo)) {
        const setorId = etapa.setor_id as string;
        const r = this.regraEntrada(meuSetor, setorId, etapa.requer_aceite, true);
        const podeAtribuir = !r.aceite && (setorId === meuSetor || gere(this.eu, setorId, this.d.setores));
        const resp = podeAtribuir && e.responsavel_id && this.pessoa(e.responsavel_id)?.setor_id === setorId ? e.responsavel_id : null;
        linhas.push({
          ...base, setor_id: setorId, fluxo_id: f!.id, etapa_id: etapa.id,
          prazo: etapa.prazo_dias ? addDias(etapa.prazo_dias, base.inicio) : e.prazo || null,
          responsavel_id: resp, status: r.aceite ? 'aguardando_aceite' : resp ? 'na_fila' : 'a_distribuir',
        });
      }
      this.exigir(linhas.length > 0, 'O fluxo não possui etapa inicial.');
    } else {
      const destino = e.setor_id || meuSetor;
      this.exigir(!!destino && !!this.setor(destino), 'Selecione o setor que vai executar a atividade.');
      if (e.modo === 'setor') this.exigir(destino === meuSetor || gere(this.eu, destino, this.d.setores), 'Você só pode criar atividades diretamente no seu setor.');
      const r = this.regraEntrada(meuSetor, destino as string);
      let resp = r.aceite ? null : e.responsavel_id || null;
      if (resp) {
        this.exigir(this.pessoa(resp)?.setor_id === destino, 'O responsável precisa pertencer ao setor executor.');
        this.exigir(resp === this.eu.id || gere(this.eu, destino, this.d.setores), 'Somente o gestor pode atribuir a atividade a outra pessoa.');
      }
      if (r.aceite && ehAdmin(this.eu) && e.responsavel_id) resp = e.responsavel_id; // diretoria pode atribuir direto
      linhas.push({
        ...base, setor_id: destino as string, prazo: e.prazo || null, responsavel_id: resp,
        encaminhar_para: e.encaminhar_para || null,
        status: r.aceite && !resp ? 'aguardando_aceite' : resp ? 'na_fila' : 'a_distribuir',
      });
    }
    const criadas = await this.repo.inserir('atividades', linhas);
    const origem = meuSetor ? `${this.eu.nome} (${this.nomeSetor(meuSetor)})` : this.eu.nome;
    for (const a of criadas) {
      this.registrar(l, a.id, a.status === 'aguardando_aceite'
        ? `Solicitação criada por ${this.eu.nome} e enviada para aceite de ${this.nomeSetor(a.setor_id)}`
        : `Atividade criada por ${this.eu.nome}`);
      if (a.responsavel_id) this.registrar(l, a.id, `Atribuída a ${this.nomePessoa(a.responsavel_id)}`);
      this.avisosEntrada(l, a, origem);
    }
    await this.enviarArquivos(criadas.map(a => a.id), e.arquivos, l);
    await this.gravar(l);
    return criadas;
  }

  async aceitar(a: Atividade, op: { responsavel_id?: string | null; prazo?: string | null }) {
    this.exigir(a.status === 'aguardando_aceite', 'Esta atividade não está aguardando aceite.');
    this.exigir(gere(this.eu, a.setor_id, this.d.setores), 'Somente o gestor do setor pode aceitar.');
    const l = new Lote();
    const resp = op.responsavel_id || null;
    await this.repo.atualizar('atividades', a.id, { status: resp ? 'na_fila' : 'a_distribuir', responsavel_id: resp, prazo: op.prazo || a.prazo });
    this.registrar(l, a.id, `Aceita por ${this.eu.nome}${resp ? ` e atribuída a ${this.nomePessoa(resp)}` : ''}`);
    const texto = `${this.nomeSetor(a.setor_id)} aceitou “${a.titulo}”.`;
    this.notificar(l, a.criado_por, 'Solicitação aceita', texto, a.id);
    this.notificar(l, this.gestorDe(a.solicitante_setor_id), 'Solicitação aceita', texto, a.id);
    if (resp) this.notificar(l, resp, 'Atividade atribuída a você', `“${a.titulo}” está na sua fila.`, a.id);
    await this.gravar(l);
  }

  async recusar(a: Atividade, motivo: string) {
    this.exigir(a.status === 'aguardando_aceite', 'Esta atividade não está aguardando aceite.');
    this.exigir(gere(this.eu, a.setor_id, this.d.setores), 'Somente o gestor do setor pode recusar.');
    this.exigir(motivo.trim().length >= 5, 'Explique o motivo da recusa (mínimo 5 caracteres).');
    const l = new Lote();
    await this.repo.atualizar('atividades', a.id, { status: 'recusada', motivo: motivo.trim() });
    this.registrar(l, a.id, `Recusada por ${this.eu.nome}: ${motivo.trim()}`);
    const texto = `${this.nomeSetor(a.setor_id)} recusou “${a.titulo}”. Motivo: ${motivo.trim()}`;
    this.notificar(l, a.criado_por, 'Solicitação recusada', texto, a.id);
    this.notificar(l, this.gestorDe(a.solicitante_setor_id), 'Solicitação recusada', texto, a.id);
    const o = a.origem_id ? this.atv(a.origem_id) : null;
    if (o) this.notificar(l, o.responsavel_id, 'Solicitação recusada', texto, a.id);
    await this.gravar(l);
  }

  async distribuir(a: Atividade, pessoaId: string | null) {
    this.exigir(gere(this.eu, a.setor_id, this.d.setores), 'Somente o gestor do setor pode distribuir atividades.');
    this.exigir(!FINAIS.includes(a.status) && a.status !== 'aguardando_aceite', 'Aceite a atividade antes de distribuí-la.');
    if (pessoaId) this.exigir(this.pessoa(pessoaId)?.setor_id === a.setor_id, 'A pessoa precisa pertencer ao setor da atividade.');
    if ((a.responsavel_id || null) === pessoaId) return;
    const l = new Lote();
    let status = a.status;
    if (pessoaId && a.status === 'a_distribuir') status = 'na_fila';
    if (!pessoaId) status = 'a_distribuir';
    await this.repo.atualizar('atividades', a.id, { responsavel_id: pessoaId, status, responsavel_original_id: null });
    this.registrar(l, a.id, pessoaId ? `Distribuída para ${this.nomePessoa(pessoaId)} por ${this.eu.nome}` : `Devolvida para distribuição por ${this.eu.nome}`);
    if (pessoaId) this.notificar(l, pessoaId, 'Atividade atribuída a você', `${this.eu.nome} colocou “${a.titulo}” na sua fila${a.prazo ? ` (prazo ${fmtData(a.prazo)})` : ''}.`, a.id);
    if (a.responsavel_id && a.responsavel_id !== pessoaId) this.notificar(l, a.responsavel_id, 'Atividade redistribuída', `“${a.titulo}” foi passada para ${pessoaId ? this.nomePessoa(pessoaId) : 'distribuição'}.`, a.id);
    await this.gravar(l);
  }

  async iniciar(a: Atividade) {
    this.exigir(['na_fila', 'pausada', 'a_distribuir'].includes(a.status), 'Esta atividade não pode ser iniciada.');
    this.exigir(a.responsavel_id === this.eu.id || gere(this.eu, a.setor_id, this.d.setores) || (!a.responsavel_id && this.eu.setor_id === a.setor_id),
      'Somente o responsável ou o gestor pode iniciar.');
    const l = new Lote();
    const resp = a.responsavel_id || this.eu.id;
    await this.repo.atualizar('atividades', a.id, { status: 'em_andamento', responsavel_id: resp, iniciado_em: a.iniciado_em || agoraISO(), motivo: null });
    this.registrar(l, a.id, a.status === 'pausada' ? `Retomada por ${this.eu.nome}` : `Iniciada por ${this.eu.nome}`);
    await this.gravar(l);
  }

  async pausar(a: Atividade, motivo: string) {
    this.exigir(a.status === 'em_andamento', 'Somente atividades em andamento podem ser pausadas.');
    this.exigir(podeExecutar(this.eu, a, this.d.setores), 'Somente o responsável ou o gestor pode pausar.');
    const l = new Lote();
    await this.repo.atualizar('atividades', a.id, { status: 'pausada', motivo: motivo.trim() || null });
    this.registrar(l, a.id, `Pausada por ${this.eu.nome}${motivo.trim() ? `: ${motivo.trim()}` : ''}`);
    await this.gravar(l);
  }

  /** Próximas etapas que serão disparadas ao concluir (usado na tela de confirmação). */
  preverProximos(a: Atividade): { setor: Setor | undefined; etapa: FluxoNo | null; aceite: boolean; aguardando?: string[] }[] {
    if (a.fluxo_id && a.etapa_id) {
      const f = this.d.fluxos.find(x => x.id === a.fluxo_id); if (!f) return [];
      return proximosNos(f, a.etapa_id).map(n => {
        const pend = this.predecessoresPendentes(f, n, a);
        return { setor: this.setor(n.setor_id), etapa: n, aceite: this.regraEntradaSegura(a.setor_id, n.setor_id as string, n.requer_aceite, true), aguardando: pend };
      });
    }
    const dest = a.encaminhar_para;
    return dest ? [{ setor: this.setor(dest), etapa: null, aceite: this.regraEntradaSegura(a.setor_id, dest) }] : [];
  }
  private regraEntradaSegura(o: string, d: string, r?: boolean | null, viaFluxo = false) {
    try { return this.regraEntrada(o, d, r, viaFluxo).aceite; } catch { return true; }
  }
  /** Etapas anteriores (convergência) que ainda não terminaram neste processo. */
  private predecessoresPendentes(f: Fluxo, etapa: FluxoNo, concluindo: Atividade): string[] {
    const doProc = this.d.atividades.filter(x => x.processo_id === concluindo.processo_id);
    return f.definicao.arestas.filter(x => x.para === etapa.id)
      .map(x => f.definicao.nos.find(n => n.id === x.de))
      .filter((n): n is FluxoNo => !!n && n.tipo === 'etapa' && n.id !== concluindo.etapa_id)
      .filter(n => !doProc.some(x => x.etapa_id === n.id && FINAIS.includes(x.status)))
      .map(n => n.titulo);
  }

  async concluir(a: Atividade, op: { observacao?: string; encaminhar_para?: string | null } = {}) {
    this.exigir(!FINAIS.includes(a.status) && a.status !== 'aguardando_aceite', 'Esta atividade não pode ser concluída.');
    this.exigir(podeExecutar(this.eu, a, this.d.setores), 'Somente o responsável ou o gestor pode concluir.');
    const l = new Lote();
    const obs = op.observacao?.trim();
    await this.repo.atualizar('atividades', a.id, { status: 'concluida', concluido_em: agoraISO(), responsavel_id: a.responsavel_id || this.eu.id });
    this.registrar(l, a.id, `Concluída por ${this.eu.nome}${obs ? `: ${obs}` : ''}`);

    const novas: Partial<Atividade>[] = [];
    const comum = {
      titulo: a.titulo, descricao: [a.descricao, obs ? `Observação de ${this.nomeSetor(a.setor_id)}: ${obs}` : ''].filter(Boolean).join('\n\n') || null,
      prioridade: a.prioridade, inicio: hoje(), criado_por: this.eu.id, solicitante_setor_id: a.setor_id, origem_id: a.id, processo_id: a.processo_id,
    };
    if (a.fluxo_id && a.etapa_id) {
      const f = this.d.fluxos.find(x => x.id === a.fluxo_id);
      if (f) {
        const doProc = this.d.atividades.filter(x => x.processo_id === a.processo_id);
        for (const n of proximosNos(f, a.etapa_id)) {
          if (!n.setor_id || !this.setor(n.setor_id)) { this.registrar(l, a.id, `Etapa “${n.titulo}” sem setor válido — não foi criada`); continue; }
          if (doProc.some(x => x.etapa_id === n.id && x.status !== 'recusada' && x.status !== 'cancelada')) continue;
          const pend = this.predecessoresPendentes(f, n, a);
          if (pend.length) { this.registrar(l, a.id, `“${n.titulo}” será liberada quando concluir: ${pend.join(', ')}`); continue; }
          const r = this.regraEntrada(a.setor_id, n.setor_id, n.requer_aceite, true);
          novas.push({ ...comum, setor_id: n.setor_id, fluxo_id: f.id, etapa_id: n.id, prazo: n.prazo_dias ? addDias(n.prazo_dias) : addDias(3), status: r.aceite ? 'aguardando_aceite' : 'a_distribuir' });
        }
      }
    } else {
      const dest = op.encaminhar_para !== undefined ? op.encaminhar_para : a.encaminhar_para;
      if (dest) {
        this.exigir(dest !== a.setor_id, 'Escolha um setor diferente para encaminhar.');
        const r = this.regraEntrada(a.setor_id, dest);
        novas.push({ ...comum, setor_id: dest, prazo: addDias(3), status: r.aceite ? 'aguardando_aceite' : 'a_distribuir' });
      }
    }
    const criadas = novas.length ? await this.repo.inserir('atividades', novas) : [];
    for (const n of criadas) {
      this.registrar(l, n.id, `Recebida de ${this.nomeSetor(a.setor_id)} (${n.status === 'aguardando_aceite' ? 'aguardando aceite' : 'para distribuição'})`);
      this.registrar(l, a.id, `Encaminhada para ${this.nomeSetor(n.setor_id)}`);
      this.avisosEntrada(l, n, this.nomeSetor(a.setor_id));
    }
    const texto = `${this.eu.nome} concluiu “${a.titulo}”${criadas.length ? ` e encaminhou para ${criadas.map(c => this.nomeSetor(c.setor_id)).join(', ')}` : ''}.`;
    this.notificar(l, a.criado_por, 'Atividade concluída', texto, a.id);
    this.notificar(l, this.gestorDe(a.setor_id), 'Atividade concluída', texto, a.id);
    await this.gravar(l);
    return criadas;
  }

  async cancelar(a: Atividade, motivo: string) {
    this.exigir(gere(this.eu, a.setor_id, this.d.setores) || a.criado_por === this.eu.id, 'Somente o gestor do setor ou quem criou pode cancelar.');
    this.exigir(!FINAIS.includes(a.status), 'Esta atividade já foi encerrada.');
    const l = new Lote();
    await this.repo.atualizar('atividades', a.id, { status: 'cancelada', motivo: motivo.trim() || null });
    this.registrar(l, a.id, `Cancelada por ${this.eu.nome}${motivo.trim() ? `: ${motivo.trim()}` : ''}`);
    this.notificar(l, a.responsavel_id, 'Atividade cancelada', `“${a.titulo}” foi cancelada.`, a.id);
    this.notificar(l, a.criado_por, 'Atividade cancelada', `“${a.titulo}” foi cancelada.`, a.id);
    await this.gravar(l);
  }

  async reabrir(a: Atividade) {
    this.exigir(gere(this.eu, a.setor_id, this.d.setores), 'Somente o gestor do setor pode reabrir.');
    this.exigir(FINAIS.includes(a.status), 'A atividade já está aberta.');
    const l = new Lote();
    await this.repo.atualizar('atividades', a.id, { status: a.responsavel_id ? 'na_fila' : 'a_distribuir', concluido_em: null, motivo: null });
    this.registrar(l, a.id, `Reaberta por ${this.eu.nome}`);
    this.notificar(l, a.responsavel_id, 'Atividade reaberta', `“${a.titulo}” voltou para a sua fila.`, a.id);
    await this.gravar(l);
  }

  async editar(a: Atividade, p: Partial<Pick<Atividade, 'titulo' | 'descricao' | 'prioridade' | 'inicio' | 'prazo' | 'encaminhar_para'>>) {
    this.exigir(gere(this.eu, a.setor_id, this.d.setores) || a.criado_por === this.eu.id || a.responsavel_id === this.eu.id, 'Você não pode editar esta atividade.');
    if (p.titulo !== undefined) this.exigir(p.titulo.trim().length >= 3, 'Informe um título com pelo menos 3 caracteres.');
    if (p.encaminhar_para) this.regraEntrada(a.setor_id, p.encaminhar_para);
    const l = new Lote();
    await this.repo.atualizar('atividades', a.id, p);
    const mud: string[] = [];
    if (p.prazo !== undefined && p.prazo !== a.prazo) mud.push(`prazo ${fmtData(a.prazo)} → ${fmtData(p.prazo)}`);
    if (p.prioridade && p.prioridade !== a.prioridade) mud.push(`prioridade ${p.prioridade}`);
    if (p.encaminhar_para !== undefined && p.encaminhar_para !== a.encaminhar_para) mud.push(p.encaminhar_para ? `próximo setor: ${this.nomeSetor(p.encaminhar_para)}` : 'sem encaminhamento');
    this.registrar(l, a.id, `Atualizada por ${this.eu.nome}${mud.length ? ` (${mud.join('; ')})` : ''}`);
    if (p.prazo !== undefined && p.prazo !== a.prazo) this.notificar(l, a.responsavel_id, 'Prazo alterado', `O prazo de “${a.titulo}” agora é ${fmtData(p.prazo)}.`, a.id);
    await this.gravar(l);
  }

  /** Encaminha agora uma cópia vinculada para outro setor (arrastar no mapa da empresa). */
  async solicitarParaSetor(a: Atividade, destino: string, op: { prazo?: string | null; observacao?: string }) {
    this.exigir(destino !== a.setor_id, 'A atividade já pertence a este setor.');
    this.exigir(gere(this.eu, a.setor_id, this.d.setores) || a.responsavel_id === this.eu.id, 'Somente o gestor ou o responsável pode encaminhar.');
    const r = this.regraEntrada(a.setor_id, destino);
    const l = new Lote();
    const [n] = await this.repo.inserir('atividades', [{
      titulo: a.titulo, descricao: [a.descricao, op.observacao?.trim() ? `Observação de ${this.nomeSetor(a.setor_id)}: ${op.observacao.trim()}` : ''].filter(Boolean).join('\n\n') || null,
      prioridade: a.prioridade, inicio: hoje(), prazo: op.prazo || addDias(3), criado_por: this.eu.id, solicitante_setor_id: a.setor_id,
      origem_id: a.id, processo_id: a.processo_id, setor_id: destino, status: r.aceite ? 'aguardando_aceite' : 'a_distribuir',
    }]);
    this.registrar(l, n.id, `Solicitada por ${this.nomeSetor(a.setor_id)} a partir de #${a.numero}`);
    this.registrar(l, a.id, `Solicitação vinculada enviada para ${this.nomeSetor(destino)}`);
    this.avisosEntrada(l, n, this.nomeSetor(a.setor_id));
    await this.gravar(l);
    return n;
  }

  async excluir(a: Atividade) {
    this.exigir(gere(this.eu, a.setor_id, this.d.setores), 'Somente o gestor do setor pode excluir.');
    const anexos = await this.repo.listar('anexos', { atividade_id: a.id });
    for (const x of anexos) await this.repo.arquivos.remover('anexos', x.caminho).catch(() => undefined);
    await this.repo.remover('atividades', a.id);
  }

  async detalhe(id: string): Promise<Detalhe> {
    const [historico, comentarios, anexos] = await Promise.all([
      this.repo.listar('historico', { atividade_id: id }),
      this.repo.listar('comentarios', { atividade_id: id }),
      this.repo.listar('anexos', { atividade_id: id }),
    ]);
    return { historico, comentarios, anexos };
  }

  async comentar(a: Atividade, texto: string) {
    this.exigir(texto.trim().length > 0, 'Escreva o comentário.');
    const l = new Lote();
    await this.repo.inserir('comentarios', [{ atividade_id: a.id, texto: texto.trim(), autor_id: this.eu.id }]);
    const t = `${this.eu.nome} comentou em “${a.titulo}”: ${texto.trim().slice(0, 140)}`;
    [a.responsavel_id, a.criado_por, this.gestorDe(a.setor_id)].forEach(p => this.notificar(l, p, 'Novo comentário', t, a.id));
    await this.gravar(l);
  }
  async anexar(a: Atividade, arquivos: File[]) {
    const l = new Lote();
    await this.enviarArquivos([a.id], arquivos, l);
    await this.gravar(l);
  }
  async removerAnexo(x: Anexo) {
    const l = new Lote();
    const outros = await this.repo.listar('anexos', { caminho: x.caminho });
    if (outros.length <= 1) await this.repo.arquivos.remover('anexos', x.caminho).catch(() => undefined);
    await this.repo.remover('anexos', x.id);
    this.registrar(l, x.atividade_id, `Anexo “${x.nome}” removido por ${this.eu.nome}`);
    await this.gravar(l);
  }
  urlAnexo(x: Anexo) { return this.repo.arquivos.url('anexos', x.caminho); }

  /* ======================= ausências e delegação ======================= */
  async registrarAusencia(e: { pessoa_id: string; tipo: TipoAusencia; inicio: string; fim: string; substituto_id: string | null; observacao?: string; delegacoes: Delegacao[] }) {
    const p = this.pessoa(e.pessoa_id);
    this.exigir(!!p, 'Selecione a pessoa.');
    this.exigir(gere(this.eu, p!.setor_id, this.d.setores), 'Somente o gestor do setor pode registrar ausências.');
    this.exigir(!!e.inicio && !!e.fim && e.fim >= e.inicio, 'Informe um período válido (fim depois do início).');
    this.exigir(e.substituto_id !== e.pessoa_id, 'O substituto deve ser outra pessoa.');
    const conflito = ausenciaNoPeriodo(this.d.ausencias, e.pessoa_id, e.inicio, e.fim);
    this.exigir(!conflito, `${p!.nome} já tem ausência registrada de ${fmtData(conflito?.inicio)} a ${fmtData(conflito?.fim)}.`);
    const [aus] = await this.repo.inserir('ausencias', [{
      pessoa_id: e.pessoa_id, tipo: e.tipo, inicio: e.inicio, fim: e.fim, substituto_id: e.substituto_id,
      observacao: e.observacao?.trim() || null, delegado: e.delegacoes.length > 0, devolvido: false, criado_por: this.eu.id,
    }]);
    const l = new Lote();
    await this.aplicarDelegacoes(aus, e.delegacoes, l);
    const periodo = `${fmtData(e.inicio)} a ${fmtData(e.fim)}`;
    this.notificar(l, e.pessoa_id, `${TIPO_AUSENCIA[e.tipo]} registrada`, `${this.eu.nome} registrou ${TIPO_AUSENCIA[e.tipo].toLowerCase()} de ${periodo}${e.delegacoes.length ? `; ${e.delegacoes.length} atividade(s) foram delegadas` : ''}.`);
    if (e.substituto_id) this.notificar(l, e.substituto_id, 'Você foi indicado como substituto', `Você substituirá ${p!.nome} de ${periodo}.`);
    await this.gravar(l);
    return aus;
  }
  async delegar(aus: Ausencia, delegacoes: Delegacao[]) {
    const p = this.pessoa(aus.pessoa_id);
    this.exigir(gere(this.eu, p?.setor_id, this.d.setores), 'Somente o gestor do setor pode delegar.');
    this.exigir(delegacoes.length > 0, 'Selecione ao menos uma atividade.');
    const l = new Lote();
    await this.aplicarDelegacoes(aus, delegacoes, l);
    await this.repo.atualizar('ausencias', aus.id, { delegado: true, devolvido: false });
    this.notificar(l, aus.pessoa_id, 'Atividades delegadas', `${delegacoes.length} atividade(s) suas foram delegadas durante a ausência.`);
    await this.gravar(l);
  }
  private async aplicarDelegacoes(aus: Ausencia, dels: Delegacao[], l: Lote) {
    const pessoa = this.nomePessoa(aus.pessoa_id);
    for (const d of dels) {
      const a = this.atv(d.atividade_id); if (!a || FINAIS.includes(a.status)) continue;
      if (d.para) this.exigir(this.pessoa(d.para)?.setor_id === a.setor_id, `${this.nomePessoa(d.para)} não pertence ao setor de “${a.titulo}”.`);
      const status = !d.para ? 'a_distribuir' : a.status === 'em_andamento' ? 'na_fila' : a.status;
      await this.repo.atualizar('atividades', a.id, { responsavel_id: d.para, status, responsavel_original_id: a.responsavel_original_id || aus.pessoa_id });
      this.registrar(l, a.id, `Delegada ${d.para ? `para ${this.nomePessoa(d.para)}` : 'para distribuição'} — ${TIPO_AUSENCIA[aus.tipo].toLowerCase()} de ${pessoa} (${fmtData(aus.inicio)} a ${fmtData(aus.fim)})`);
      if (d.para) this.notificar(l, d.para, 'Atividade delegada a você', `“${a.titulo}” foi delegada a você durante a ausência de ${pessoa} (até ${fmtData(aus.fim)}).`, a.id);
    }
  }
  /** Atividades abertas que ainda estão com a pessoa (candidatas à delegação). */
  pendentesDe(pessoaId: string) {
    return this.d.atividades.filter(a => a.responsavel_id === pessoaId && ['na_fila', 'em_andamento', 'pausada'].includes(a.status));
  }
  delegadasDe(aus: Ausencia) {
    return this.d.atividades.filter(a => a.responsavel_original_id === aus.pessoa_id && !FINAIS.includes(a.status));
  }
  async devolver(aus: Ausencia) {
    const p = this.pessoa(aus.pessoa_id);
    this.exigir(gere(this.eu, p?.setor_id, this.d.setores), 'Somente o gestor do setor pode devolver atividades.');
    const l = new Lote();
    const lista = this.delegadasDe(aus);
    for (const a of lista) {
      await this.repo.atualizar('atividades', a.id, { responsavel_id: aus.pessoa_id, responsavel_original_id: null, status: a.status === 'a_distribuir' ? 'na_fila' : a.status });
      this.registrar(l, a.id, `Devolvida para ${p!.nome} após retorno da ausência`);
      if (a.responsavel_id && a.responsavel_id !== aus.pessoa_id) this.notificar(l, a.responsavel_id, 'Delegação encerrada', `“${a.titulo}” voltou para ${p!.nome}.`, a.id);
    }
    await this.repo.atualizar('ausencias', aus.id, { devolvido: true });
    this.notificar(l, aus.pessoa_id, 'Bem-vindo(a) de volta', `${lista.length} atividade(s) voltaram para a sua fila.`);
    await this.gravar(l);
    return lista.length;
  }
  async excluirAusencia(aus: Ausencia) {
    const p = this.pessoa(aus.pessoa_id);
    this.exigir(gere(this.eu, p?.setor_id, this.d.setores), 'Somente o gestor do setor pode excluir ausências.');
    await this.repo.remover('ausencias', aus.id);
  }

  /* ======================= vínculos entre setores ======================= */
  async criarVinculo(origem: string, destino: string, requer_aceite: boolean, descricao = '') {
    this.exigir(origem !== destino, 'Escolha setores diferentes.');
    this.exigir(gere(this.eu, origem, this.d.setores) || gere(this.eu, destino, this.d.setores), 'Somente gestores dos setores envolvidos ou a diretoria podem criar vínculos.');
    this.exigir(!vinculoEntre(this.d.vinculos, origem, destino), 'Já existe um vínculo entre estes setores.');
    const [v] = await this.repo.inserir('vinculos', [{ origem_id: origem, destino_id: destino, requer_aceite, descricao: descricao.trim() || null, criado_por: this.eu.id }]);
    const l = new Lote();
    const t = `${this.eu.nome} criou o vínculo ${this.nomeSetor(origem)} → ${this.nomeSetor(destino)} (${requer_aceite ? 'com aceite' : 'entrada direta'}).`;
    this.notificar(l, this.gestorDe(origem), 'Novo vínculo entre setores', t);
    this.notificar(l, this.gestorDe(destino), 'Novo vínculo entre setores', t);
    await this.gravar(l);
    return v;
  }
  async atualizarVinculo(v: Vinculo, p: Partial<Pick<Vinculo, 'requer_aceite' | 'descricao'>>) {
    this.exigir(gere(this.eu, v.origem_id, this.d.setores) || gere(this.eu, v.destino_id, this.d.setores), 'Sem permissão para alterar este vínculo.');
    await this.repo.atualizar('vinculos', v.id, p);
    const l = new Lote();
    if (p.requer_aceite !== undefined && p.requer_aceite !== v.requer_aceite) {
      const t = `O vínculo ${this.nomeSetor(v.origem_id)} → ${this.nomeSetor(v.destino_id)} agora ${p.requer_aceite ? 'exige aceite' : 'tem entrada direta'}.`;
      this.notificar(l, this.gestorDe(v.origem_id), 'Vínculo alterado', t); this.notificar(l, this.gestorDe(v.destino_id), 'Vínculo alterado', t);
    }
    await this.gravar(l);
  }
  async removerVinculo(v: Vinculo) {
    this.exigir(gere(this.eu, v.origem_id, this.d.setores) || gere(this.eu, v.destino_id, this.d.setores), 'Sem permissão para remover este vínculo.');
    await this.repo.remover('vinculos', v.id);
    const l = new Lote();
    const t = `${this.eu.nome} removeu o vínculo ${this.nomeSetor(v.origem_id)} → ${this.nomeSetor(v.destino_id)}. Novas solicitações por este caminho não serão mais permitidas.`;
    this.notificar(l, this.gestorDe(v.origem_id), 'Vínculo removido', t); this.notificar(l, this.gestorDe(v.destino_id), 'Vínculo removido', t);
    await this.gravar(l);
  }

  /* ======================= fluxos ======================= */
  async salvarFluxo(f: Partial<Fluxo> & { nome: string; definicao: Fluxo['definicao'] }) {
    this.exigir(f.nome.trim().length >= 3, 'Dê um nome ao fluxo (mínimo 3 caracteres).');
    if (f.id && this.d.fluxos.some(x => x.id === f.id))
      return this.repo.atualizar('fluxos', f.id, { nome: f.nome.trim(), descricao: f.descricao ?? null, ativo: f.ativo ?? true, definicao: f.definicao });
    const [n] = await this.repo.inserir('fluxos', [{ ...(f.id ? { id: f.id } : {}), nome: f.nome.trim(), descricao: f.descricao ?? null, ativo: f.ativo ?? true, definicao: f.definicao, criado_por: this.eu.id }]);
    return n;
  }
  async excluirFluxo(f: Fluxo) {
    const emUso = this.d.atividades.some(a => a.fluxo_id === f.id && !FINAIS.includes(a.status));
    this.exigir(!emUso, 'Há atividades em andamento neste fluxo. Desative-o em vez de excluir.');
    await this.repo.remover('fluxos', f.id);
  }

  /* ======================= cadastros ======================= */
  async salvarSetor(s: Partial<Setor> & { nome: string }) {
    this.exigir(s.nome.trim().length >= 2, 'Informe o nome do setor.');
    const dados = { nome: s.nome.trim(), cor: s.cor || '#2563eb', descricao: s.descricao?.trim() || null, gestor_id: s.gestor_id || null };
    let setor: Setor;
    if (s.id) setor = await this.repo.atualizar('setores', s.id, dados);
    else {
      this.exigir(ehAdmin(this.eu), 'Somente a diretoria cria setores.');
      const n = this.d.setores.length;
      [setor] = await this.repo.inserir('setores', [{ ...dados, pos_x: 80 + (n % 4) * 300, pos_y: 60 + Math.floor(n / 4) * 200 }]);
    }
    if (dados.gestor_id && ehAdmin(this.eu)) {
      const g = this.pessoa(dados.gestor_id);
      if (g && (g.papel === 'colaborador' || !g.setor_id))
        await this.repo.atualizar('perfis', g.id, { papel: g.papel === 'admin' ? 'admin' : 'gestor', setor_id: g.setor_id || setor.id });
      const l = new Lote();
      this.notificar(l, dados.gestor_id, 'Você é gestor de um setor', `Você agora é responsável pelo setor ${setor.nome}.`);
      await this.gravar(l);
    }
    return setor;
  }
  async moverSetor(id: string, x: number, y: number) {
    if (!gere(this.eu, id, this.d.setores)) return;
    await this.repo.atualizar('setores', id, { pos_x: Math.round(x), pos_y: Math.round(y) });
  }
  async excluirSetor(s: Setor) {
    this.exigir(ehAdmin(this.eu), 'Somente a diretoria exclui setores.');
    this.exigir(!this.d.atividades.some(a => a.setor_id === s.id), 'Este setor possui atividades e não pode ser excluído.');
    await this.repo.remover('setores', s.id);
  }
  async salvarPerfil(id: string, p: Partial<Pick<Perfil, 'nome' | 'cargo' | 'setor_id' | 'papel' | 'ativo' | 'notif_email' | 'notif_teams'>>) {
    this.exigir(id === this.eu.id || ehAdmin(this.eu), 'Sem permissão.');
    const atual = this.pessoa(id);
    if (p.nome !== undefined) this.exigir(p.nome.trim().length >= 2, 'Informe o nome.');
    if (ehAdmin(this.eu) && id === this.eu.id && p.papel && p.papel !== 'admin')
      this.exigir(this.d.perfis.filter(x => x.papel === 'admin' && x.ativo).length > 1, 'Mantenha ao menos um administrador ativo.');
    if (p.papel === 'gestor') this.exigir(!!(p.setor_id ?? atual?.setor_id), 'Gestor precisa de um setor.');
    const r = await this.repo.atualizar('perfis', id, p);
    if (ehAdmin(this.eu)) {
      if (p.papel === 'gestor' && r.setor_id) {
        const s = this.setor(r.setor_id);
        if (s && s.gestor_id !== id) await this.repo.atualizar('setores', s.id, { gestor_id: id });
      }
      if (p.papel && p.papel !== 'gestor' && atual?.papel === 'gestor')
        for (const s of this.d.setores.filter(x => x.gestor_id === id)) await this.repo.atualizar('setores', s.id, { gestor_id: null });
      if (p.ativo === true && atual && !atual.ativo) {
        const l = new Lote(); // perfil ainda consta inativo nos dados carregados: notificação direta
        l.notifs.push({ para_id: id, titulo: 'Acesso liberado', texto: `Bem-vindo(a)! ${this.eu.nome} liberou seu acesso${r.setor_id ? ` ao setor ${this.nomeSetor(r.setor_id)}` : ''}.`, atividade_id: null, lida: false });
        if (this.d.integracoes.email_ativo) l.envios.push({ canal: 'email', para_id: id, assunto: 'Seu acesso ao Planner foi liberado', corpo: `Olá, ${r.nome}! Seu acesso foi liberado. Entre com seu e-mail e senha.`, link: this.link(), criado_por: this.eu.id });
        await this.gravar(l);
      }
    }
    return r;
  }
  async excluirPerfil(p: Perfil) {
    this.exigir(ehAdmin(this.eu) && p.id !== this.eu.id, 'Sem permissão.');
    await this.repo.remover('perfis', p.id);
  }
  async salvarEmpresa(nome: string) {
    this.exigir(ehAdmin(this.eu), 'Somente a diretoria altera os dados da empresa.');
    this.exigir(nome.trim().length >= 2, 'Informe o nome da empresa.');
    await this.repo.atualizar('empresa', 1, { nome: nome.trim() });
  }
  async enviarLogo(arq: File) {
    this.exigir(ehAdmin(this.eu), 'Somente a diretoria altera o logo.');
    this.exigir(/^image\//.test(arq.type), 'Envie uma imagem (PNG, JPG ou SVG).');
    this.exigir(arq.size <= 1024 * 1024, 'O logo deve ter no máximo 1 MB.');
    const ext = (arq.name.split('.').pop() || 'png').toLowerCase();
    const caminho = `logo-${Date.now()}.${ext}`;
    await this.repo.arquivos.enviar('marca', caminho, arq, arq.type);
    const url = await this.repo.arquivos.url('marca', caminho);
    await this.repo.atualizar('empresa', 1, { logo_url: url });
  }
  async removerLogo() { this.exigir(ehAdmin(this.eu), 'Sem permissão.'); await this.repo.atualizar('empresa', 1, { logo_url: null }); }

  /* ======================= integrações ======================= */
  async salvarIntegracoes(p: Partial<Dados['integracoes']>) {
    this.exigir(ehAdmin(this.eu), 'Somente a diretoria altera integrações.');
    if (p.app_url !== undefined) this.exigir(/^https?:\/\//.test(p.app_url), 'O endereço do sistema deve começar com http:// ou https://');
    await this.repo.atualizar('integracoes', 1, p);
  }
  listarWebhooks() { return this.repo.listar('teams_webhooks'); }
  async salvarWebhook(setorId: string | null, url: string, existentes: TeamsWebhook[]) {
    this.exigir(ehAdmin(this.eu), 'Sem permissão.');
    const atual = existentes.find(w => (w.setor_id || null) === setorId);
    if (!url.trim()) { if (atual) await this.repo.remover('teams_webhooks', atual.id); return; }
    this.exigir(/^https:\/\//.test(url.trim()), 'A URL do webhook deve começar com https://');
    if (atual) await this.repo.atualizar('teams_webhooks', atual.id, { url: url.trim(), ativo: true });
    else await this.repo.inserir('teams_webhooks', [{ setor_id: setorId, url: url.trim(), ativo: true }]);
  }
  async testarTeams(setorId: string | null) {
    this.exigir(ehAdmin(this.eu), 'Sem permissão.');
    await this.repo.inserir('envios', [{ canal: 'teams', para_id: null, setor_id: setorId, assunto: 'Teste de conexão do Planner', corpo: `Mensagem de teste enviada por ${this.eu.nome}. Se você está lendo isto, a integração com o Teams está funcionando${setorId ? ` para o setor ${this.nomeSetor(setorId)}` : ''}.`, link: this.link(), criado_por: this.eu.id }]);
  }
  async testarEmail() {
    this.exigir(ehAdmin(this.eu), 'Sem permissão.');
    await this.repo.inserir('envios', [{ canal: 'email', para_id: this.eu.id, setor_id: null, assunto: 'Teste de e-mail do Planner', corpo: `Olá, ${this.eu.nome}! Este é um e-mail de teste. A integração de e-mail está funcionando.`, link: this.link(), criado_por: this.eu.id }]);
  }
  async listarEnvios() {
    const l = await this.repo.listar('envios');
    return l.sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, 60);
  }

  /* ======================= notificações ======================= */
  async marcarLida(n: Notificacao) { if (!n.lida) await this.repo.atualizar('notificacoes', n.id, { lida: true }); }
  async marcarTodasLidas() {
    for (const n of this.d.notificacoes.filter(x => !x.lida && x.para_id === this.eu.id)) await this.repo.atualizar('notificacoes', n.id, { lida: true });
  }
}
