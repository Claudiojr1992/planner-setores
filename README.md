# Planner de Setores

Sistema de planejamento e gestão de atividades **por setor**, com passagem controlada de demandas **entre setores**: solicitação → aceite do gestor → distribuição → execução → próximo setor. Os fluxos são desenhados na tela, como em um fluxograma.

| | |
|---|---|
| **Interface** | React + TypeScript, menu lateral com barra superior, tema claro, escuro ou automático |
| **Banco e login** | PostgreSQL com regras de acesso no banco (RLS), login GoTrue e API PostgREST (os mesmos componentes do Supabase); também roda no Supabase na nuvem |
| **Notificações** | No sistema (sino), por e-mail (SMTP) e por Microsoft Teams (webhook por canal) |
| **Execução** | **Na nuvem**: Vercel (interface e notificador) + Supabase (banco, login, arquivos). **Ou local**: tudo em Docker, com scripts de um clique para Windows |

## Começar em 3 minutos

| Quero… | Faça |
|---|---|
| **Só conhecer as telas**, sem banco | Dois cliques em **`DEMONSTRACAO.bat`** e abra <http://localhost:8080>. Contas de exemplo com a senha `demo123`. |
| **Usar de verdade** | Instale só o [Docker Desktop](https://www.docker.com/products/docker-desktop/) e dê dois cliques em **`INSTALAR.bat`**. A primeira conta criada vira Administrador. E-mails de teste: <http://localhost:8025>. |
| **Publicar na internet** (Vercel + Supabase) | Siga [docs/08-PUBLICAR-NA-NUVEM.md](docs/08-PUBLICAR-NA-NUVEM.md): cole a migração no Supabase, importe este repositório na Vercel e cadastre as variáveis. |
| **Usar em equipe na rede** | Ajuste `ENDERECO_PUBLICO` no `.env` (veja [docs/01-INSTALACAO.md](docs/01-INSTALACAO.md#acessar-de-outros-computadores-da-rede)). |

No dia a dia, use **`INICIAR.bat`** para ligar e **`PARAR.bat`** para desligar. Os dados são mantidos.

## O que o sistema faz

- **Início (cada pessoa):**
  - canvas "Meu fluxo", mostrando de onde vem e para onde vai cada atividade;
  - indicadores e fila pessoal;
  - lista do que a pessoa solicitou a outros setores;
  - calendário.
- **Painel do setor (gestor):**
  - indicadores no topo;
  - **mapa da equipe** em canvas: entradas, pessoas e saídas;
  - caixas *Aguardando aceite* e *A distribuir*;
  - **filas por pessoa**, com arrastar e soltar para distribuir;
  - calendário com as férias da equipe.
- **Nova solicitação** em três caminhos claros:
  - *atividade do meu setor*;
  - *solicitar a outro setor* (só para setores vinculados, com ou sem aceite);
  - *iniciar um processo* a partir de um fluxo desenhado.
- **Gestão da empresa:**
  - **mapa de setores** onde você **cria um vínculo puxando uma ligação** de um setor a outro e **remove** selecionando a ligação. Isso muda as regras de quem pode solicitar a quem;
  - arraste uma atividade até um setor para vinculá-la e notificar o gestor;
  - desempenho por setor e processos em andamento.
- **Fluxos de processo:** editor de fluxograma com Início, Etapas (setor, prazo, exigir aceite) e Fim.
  - Etapas podem rodar em paralelo e convergir.
  - Alterar o fluxo vale para as próximas conclusões, inclusive dos processos que já estão rodando.
- **Férias e delegação:** programe a ausência e escolha, atividade por atividade, para quem delegar as pendentes, as a iniciar e as em andamento. No retorno, devolva tudo com um clique.
- **Detalhe da atividade:**
  - trilha do processo entre setores;
  - comentários;
  - **anexos**;
  - histórico completo;
  - aceitar, recusar com motivo, distribuir, iniciar, pausar, concluir e encaminhar.
- **Acesso:**
  - login, **criar conta** (aprovada pelo administrador) e **esqueci a senha**, com link por e-mail;
  - redefinição de senha;
  - tela de **sair**;
  - preferências de tema e de notificação.
- **Administração:**
  - setores e gestores;
  - pessoas, papéis e aprovação de cadastros;
  - **logotipo da empresa** no topo;
  - **tela de conexão do Teams e do e-mail**, com botão de teste e registro de envios.

## Estrutura

```
INSTALAR.bat  INICIAR.bat  PARAR.bat  DEMONSTRACAO.bat   ← atalhos (Windows)
vercel.json · package.json · api/notificar.js              ← publicação na Vercel
docker-compose.yml (completo) · docker-compose.demo.yml · docker-compose.nuvem.yml · .env.example
supabase/migrations/ banco, segurança e armazenamento (Docker: aplicado pelo migrador; nuvem: colar no SQL Editor)
supabase/*.sql       usuários de teste e agendamento do notificador para o Supabase na nuvem
docker/              imagens do banco e do migrador
web/                 interface (src/, dist/ já compilado, Dockerfile, nginx)
notificador/         serviço de e-mail e Teams (Node, sem dependências)
arquivos/            serviço de anexos e logotipo (Node, sem dependências)
scripts/             instalar/iniciar/parar (.ps1), gerar-env.mjs e instalar.sh (Linux/macOS)
docs/                documentação completa
```

## Documentação

1. [Instalação e operação](docs/01-INSTALACAO.md)
2. [Regras de negócio e processos](docs/02-REGRAS-DE-NEGOCIO.md)
3. [Manual do usuário](docs/03-MANUAL-DO-USUARIO.md)
4. [Arquitetura e segurança](docs/04-ARQUITETURA.md)
5. [Modelo de dados](docs/05-MODELO-DE-DADOS.md)
6. [Integrações: e-mail e Teams](docs/06-INTEGRACOES.md)
7. [Desenvolvimento e testes](docs/07-DESENVOLVIMENTO.md)
8. [Publicar na nuvem: GitHub + Vercel + Supabase](docs/08-PUBLICAR-NA-NUVEM.md)
