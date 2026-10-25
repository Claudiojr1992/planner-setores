# 8. Publicar na nuvem: GitHub + Vercel + Supabase

Este é o caminho para usar o sistema pela internet, sem nada instalado na sua máquina.

```
 navegador ──► Vercel (interface + função /api/notificar) ──► e-mail (SMTP) e Teams
     │                                      │
     └──────────► Supabase (banco PostgreSQL, login, arquivos) ◄──┘
```

| Peça | Onde roda | Plano gratuito atende? |
|---|---|---|
| Interface (React) | Vercel, como site estático | Sim |
| Notificador de e-mail e Teams | Vercel, como função `api/notificar.js` | Sim |
| Banco, login, anexos e logotipo | Supabase | Sim (o projeto pausa após 7 dias sem uso) |
| Código | GitHub | Sim |

A instalação em Docker (docs/01) continua funcionando igual. São duas formas de rodar o **mesmo código**.

---

## Passo 1 — Banco no Supabase (≈ 5 min)

1. Entre em <https://supabase.com> → **New project**.
   - Região: **South America (São Paulo)**.
   - Anote a senha do banco.
2. Aplique a estrutura do banco:
   1. No menu, abra **SQL Editor** → **New query**.
   2. Cole **todo** o conteúdo de [`supabase/migrations/20261025000000_planner_inicial.sql`](../supabase/migrations/20261025000000_planner_inicial.sql) e clique em **Run**.
   3. A execução cria as tabelas, as regras de acesso (RLS) e os espaços de arquivos `anexos` e `marca`.
3. *(Opcional)* Usuários de teste:
   1. Em uma nova query, cole [`supabase/usuarios-teste-nuvem.sql`](../supabase/usuarios-teste-nuvem.sql) e clique em **Run**.
   2. Isso cria `admin@`, `gestor@` e `colaborador@planner.local`, todos com a senha `Planner@2026`.
   3. **Bloqueie ou apague esses usuários** antes de colocar a equipe no sistema.
4. Copie as chaves em **Project Settings → API Keys** (ou *Data API*):
   - **Project URL**, no formato `https://xxxx.supabase.co`;
   - **Publishable key** (ou *anon public*). É pública e vai para a interface;
   - **Secret key** (ou *service_role*). É **secreta** e fica só na Vercel, para o notificador.

> Sem usuários de teste, a **primeira conta criada** pela tela de login vira Administrador automaticamente.

## Passo 2 — Código no GitHub

O repositório é **`Claudiojr1992/planner-setores`**. Para atualizar a partir do seu computador:

```bash
git add -A
git commit -m "descrição da mudança"
git push
```

Cada `git push` na branch `main` publica uma nova versão na Vercel automaticamente.

## Passo 3 — Site na Vercel (≈ 3 min)

1. Entre em <https://vercel.com> com a conta do GitHub → **Add New… → Project**.
2. Importe o repositório `planner-setores`. As configurações de build já vêm do `vercel.json`, então **não altere nada** em *Build & Output Settings*.
3. Abra **Environment Variables** e cadastre as variáveis abaixo.

| Variável | Valor | Obrigatória |
|---|---|---|
| `PLANNER_SUPABASE_URL` | Project URL do Supabase | Sim |
| `PLANNER_SUPABASE_ANON_KEY` | Publishable / anon key | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret / service_role key. Marque como **Sensitive** | Para e-mail e Teams |
| `SMTP_HOST` | ex.: `smtp.office365.com` ou `smtp.gmail.com` | Para e-mail |
| `SMTP_PORT` | `587` (Office 365) ou `465` (Gmail) | Para e-mail |
| `SMTP_SEGURO` | `false` para 587, `true` para 465 | Para e-mail |
| `SMTP_USUARIO` / `SMTP_SENHA` | caixa que envia (no Gmail, use uma *senha de app*) | Para e-mail |
| `SMTP_EMAIL_REMETENTE` | ex.: `planner@suaempresa.com.br` | Para e-mail |
| `SMTP_NOME_REMETENTE` | ex.: `Planner de Setores` | Não |
| `NOME_SISTEMA` | nome que aparece no topo | Não |

4. Clique em **Deploy**. O endereço fica parecido com `https://planner-setores.vercel.app`.

> Se a Vercel publicar **sem** `PLANNER_SUPABASE_URL` e `PLANNER_SUPABASE_ANON_KEY`, o site abre em **modo demonstração**, com dados no navegador. Para corrigir, cadastre as variáveis e use **Deployments → ⋯ → Redeploy**. As variáveis são lidas no build.

## Passo 4 — Ligar o login ao endereço da Vercel

No Supabase, abra **Authentication**.

1. **URL Configuration**:
   - em **Site URL**, informe o endereço da Vercel (`https://planner-setores.vercel.app`);
   - em **Redirect URLs**, adicione `https://planner-setores.vercel.app/**`, além do endereço de pré-visualização se for usar.

   Sem isso, os links de *confirmar cadastro* e *esqueci a senha* levam para `localhost`.
2. **Emails → SMTP Settings**: ative o **Custom SMTP** com a mesma caixa do passo 3. O e-mail padrão do Supabase só entrega para os membros da sua organização no Supabase e tem limite de poucas mensagens por hora. Sem SMTP próprio, cadastro e recuperação de senha falham para a equipe.
3. *(Opcional)* **Sign In / Providers → Email**:
   - se desligar *Confirm email*, as pessoas não precisam confirmar o e-mail. Continuam precisando da aprovação do administrador dentro do Planner.

## Passo 5 — Notificações (e-mail e Teams)

- Quando alguém cria uma notificação, a interface **acorda o notificador** (`/api/notificar`) na hora. Ele envia os e-mails e os cartões do Teams.
- Como reserva, a Vercel chama o notificador **uma vez por dia**. O plano gratuito não permite chamadas mais frequentes.
- **Recomendado**: peça ao Supabase que chame o notificador a cada minuto. Isso reenvia falhas e pendências:
  1. em **Database → Extensions**, ative `pg_cron` e `pg_net`;
  2. no SQL Editor, rode [`supabase/agendar-notificador.sql`](../supabase/agendar-notificador.sql), trocando o endereço pelo seu.
- Para testar, entre como administrador e abra **Configurações → Integrações**. Clique em **Testar** no e-mail e no Teams e acompanhe o *Registro de envios*.
- Confira também o campo **Endereço do sistema**. Ele é usado nos links dos e-mails e deve ser o endereço da Vercel.

Dois notificadores podem rodar ao mesmo tempo (por exemplo, a interface e o agendamento) sem duplicar mensagens: cada envio é "reservado" antes de sair.

## Atualizações do banco

Quando uma versão nova trouxer um arquivo em `supabase/migrations/`, cole esse arquivo no **SQL Editor** e execute. Na instalação Docker, o container `migrador` faz isso sozinho.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Faixa "modo demonstração" no site | Variáveis `PLANNER_SUPABASE_*` ausentes no build | Cadastre as variáveis e faça *Redeploy* |
| "Invalid API key" no login | Chave copiada errada ou de outro projeto | Copie de novo a publishable/anon key |
| Link do e-mail abre `localhost` | Site URL do Supabase não ajustada | Siga o passo 4.1 |
| Não chega e-mail de cadastro ou de senha | SMTP próprio não configurado no Supabase | Siga o passo 4.2 |
| Notificações ficam "pendente" | Falta `SUPABASE_SERVICE_ROLE_KEY` ou SMTP na Vercel | Vercel → Project → **Logs**, filtre por `/api/notificar` |
| "relation … does not exist" | Migração não aplicada | Siga o passo 1.2 |
| Site lento no primeiro acesso do dia | Projeto gratuito do Supabase "acordando" | Normal no plano gratuito. Após 7 dias sem uso, reative o projeto no painel |
