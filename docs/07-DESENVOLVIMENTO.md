# 7. Desenvolvimento e testes

## Estrutura do código (`web/src`)

```
main.tsx, App.tsx          inicialização e rotas (#/caminho)
app/
  config.ts                lê window.__PLANNER_CONFIG__ (gerado pelo Docker)
  contexto.tsx             estado global: sessão, dados, tema, toasts, diálogos
  rota.ts                  roteador por hash
lib/
  types.ts                 tipos das tabelas
  regras.ts                regras puras (status, prazos, permissões, validação de fluxos, indicadores)
  servico.ts               OPERAÇÕES DE NEGÓCIO (criar, aceitar, distribuir, concluir, delegar, vincular…)
  dados.ts                 carga do instantâneo de dados
  repo/
    repo.ts                contrato de acesso a dados
    supabase.ts            implementação Supabase (Auth, PostgREST, Storage via HTTP)
    demo.ts, seed.ts       modo demonstração (localStorage) e dados de exemplo
ui/
  base.tsx                 componentes básicos (modal, campos, avisos, menus)
  atividade.tsx            cartão, detalhe (gaveta), modais de ação, nova solicitação
  grafo.tsx                editor de grafos: arrastar, ligar, pan/zoom (fluxos e mapa da empresa)
  painel.tsx               indicadores e calendário
paginas/                   telas (acesso, início, setor, atividades, empresa, fluxos, ausências, cadastros, configurações)
styles.css                 design system (tokens claro/escuro, componentes)
```

## Comandos

```bash
cd web
npm install          # primeira vez
npm run dev          # http://localhost:5173 com recompilação automática (modo demonstração)
npm run build        # gera web/dist (usado pelo Dockerfile)
npm test             # testes das regras de negócio (36 cenários)
npm run typecheck    # verificação de tipos

cd ../notificador
npm test             # testes do notificador (SMTP, Teams e REST simulados)

cd ../arquivos
npm test             # testes do serviço de arquivos (upload, link assinado, permissões)
```

Para usar o `npm run dev` com o banco do Docker, crie `web/public/config.js`:

```js
window.__PLANNER_CONFIG__ = { supabaseUrl: 'http://localhost:8080', supabaseAnonKey: '<ANON_KEY do .env>' };
```

Após alterar a interface, rode `npm run build` e `docker compose up -d --build web`. Após criar uma migração nova em `supabase/migrations/`, rode `docker compose up -d --build migrador`.

## Testes incluídos

| Conjunto | Cobre |
|---|---|
| `web/test/servico.test.ts` | Login; solicitação com e sem vínculo; aceite e recusa; distribuição; fluxo linear completo; fluxo paralelo com convergência (sem duplicar etapa); encaminhamento avulso; criar e remover vínculo; férias com delegação e devolução; conflito de período; permissões de colaborador; indicadores; aprovação de cadastro |
| `notificador/test/notificador.test.mjs` | E-mail com assunto UTF-8 e HTML; cartão do Teams; ausência de webhook; falha com novas tentativas |
| Banco (RLS) | Validado em PostgreSQL 16 com perfis simulados (veja a seção de segurança em [04-ARQUITETURA.md](04-ARQUITETURA.md)) |

## Convenções

- Toda regra nova entra em `servico.ts` ou `regras.ts`, nunca direto na tela, e ganha um caso em `servico.test.ts`.
- Toda tabela nova recebe uma política RLS na migração. Crie um novo arquivo em `supabase/migrations/` com data no nome; não altere migrações já aplicadas.
- Os textos da interface são em português do Brasil.
