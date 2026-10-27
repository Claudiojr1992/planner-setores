import type { Dados } from './types';
import type { Repo } from './repo/repo';

/** Carrega o instantâneo de dados usado pelas telas. */
export async function carregarDados(repo: Repo, euId: string): Promise<Dados> {
  const [empresa, perfis, setores, vinculos, fluxos, atividades, notificacoes, ausencias, integracoes, metas] = await Promise.all([
    repo.listar('empresa'), repo.listar('perfis'), repo.listar('setores'), repo.listar('vinculos'), repo.listar('fluxos'),
    repo.listar('atividades'), repo.listar('notificacoes', { para_id: euId }), repo.listar('ausencias'), repo.listar('integracoes'),
    // metas é opcional: bancos antigos sem a tabela continuam funcionando com o SLA padrão
    repo.listar('metas').catch(() => []),
  ]);
  return {
    empresa: empresa[0] || { id: 1, nome: 'Minha Empresa', logo_url: null },
    perfis: perfis.sort((a, b) => a.nome.localeCompare(b.nome)),
    setores: setores.sort((a, b) => a.nome.localeCompare(b.nome)),
    vinculos, fluxos, atividades,
    notificacoes: notificacoes.sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
    ausencias,
    integracoes: integracoes[0] || { id: 1, email_ativo: false, teams_ativo: false, app_url: '' },
    metas,
  };
}
