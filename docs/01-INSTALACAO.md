# 1. Instalação e operação

O Planner roda **inteiro em Docker**. O único pré-requisito é o **Docker Desktop**. Não precisa instalar Node.js, Supabase CLI ou PostgreSQL.

## Pré-requisitos

| Item | Observação |
|---|---|
| **Docker Desktop** (Windows 10/11 com WSL 2) | <https://www.docker.com/products/docker-desktop/>. Depois de instalar, abra-o e aguarde a mensagem "Engine running". |
| 4 GB livres em disco e 8 GB de RAM | Para as imagens do banco e dos serviços |
| Portas **8080** e **8025** livres | Sistema e caixa de e-mails (a porta do sistema pode ser alterada em `PORTA_WEB` no `.env`) |

## Serviços (docker-compose.yml)

| Serviço | Função | Imagem |
|---|---|---|
| `db` | Banco **PostgreSQL** puro (papéis e esquemas criados por `docker/db/01-papeis.sh`) | `postgres:17-alpine` |
| `auth` | Login, cadastro e recuperação de senha | `supabase/gotrue:v2.197.0` |
| `rest` | API de dados | `postgrest/postgrest:v14.18` |
| `arquivos` | Anexos e logotipo (compatível com a API do Supabase Storage) | `node:20-alpine` |
| `migrador` | Cria e atualiza as tabelas a cada subida, e depois encerra | `postgres:17-alpine` + `supabase/migrations` |
| `web` | Interface e gateway (`/auth/v1`, `/rest/v1`, `/storage/v1`) | `nginx:1.27-alpine` |
| `notificador` | Envia e-mails e mensagens do Teams | `node:20-alpine` |
| `mailpit` | Caixa de e-mails de teste em <http://localhost:8025> | `axllent/mailpit` |

Os dados ficam nos volumes do Docker `planner-banco` (banco) e `planner-anexos` (arquivos). Eles sobrevivem a reinícios e atualizações.

---

## Instalação (uma vez)

1. Dê dois cliques em **`INSTALAR.bat`**. O script:
   1. verifica se o Docker está rodando;
   2. cria o arquivo **`.env`** com **senhas e chaves novas e aleatórias**;
   3. roda `docker compose up -d --build`. A primeira vez baixa as imagens, cerca de 1,5 GB, e leva de 5 a 10 minutos;
   4. espera o sistema responder e abre o navegador.
2. Na tela de login, clique em **Criar conta**. **A primeira conta criada vira Administrador.**
3. Cadastre os **Setores** e os gestores.
4. Peça para cada pessoa **Criar conta**. Depois, aprove-a em **Pessoas e acessos**, definindo o setor e o papel.
5. Em **Gestão da empresa**, desenhe os vínculos entre setores. Em **Fluxos de processo**, desenhe os processos.

## Dia a dia

| Ação | Como |
|---|---|
| Ligar | `INICIAR.bat` |
| Desligar (mantém os dados) | `PARAR.bat` |
| Só conhecer as telas, sem banco | `DEMONSTRACAO.bat` (rode `PARAR.bat` antes, se o sistema completo estiver ligado) |
| Ver o estado dos serviços | `docker compose ps` |
| Ver os logs | `docker compose logs -f web auth rest notificador` |
| Backup do banco | `docker compose exec -T db pg_dump -U postgres -d postgres > backup.sql` |
| Apagar **tudo** e começar do zero | `docker compose down -v` (remove os volumes, ou seja, **todos os dados**) |

## E-mails

- Por padrão, todos os e-mails caem na caixa de testes **<http://localhost:8025>**. Isso inclui "esqueci a senha" e as notificações.
- Para enviar e-mails de verdade, edite no `.env` as variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_SEGURO`, `SMTP_USUARIO`, `SMTP_SENHA` e `SMTP_EMAIL_REMETENTE`. Depois rode `INICIAR.bat`. Exemplos em [06-INTEGRACOES.md](06-INTEGRACOES.md).

## Acessar de outros computadores da rede

1. Descubra o IP da máquina (`ipconfig`), por exemplo `192.168.0.50`.
2. No `.env`, defina `ENDERECO_PUBLICO=http://192.168.0.50:8080`. Esse endereço é usado nos links de e-mail e de redefinição de senha.
3. Rode `INICIAR.bat`.
4. Libere a porta 8080 no firewall do Windows.
5. Em **Integrações → Endereço do sistema**, use o mesmo endereço.

A interface detecta sozinha o endereço pelo qual foi aberta. Não é preciso configurar mais nada.

## Supabase na nuvem (opcional)

Se preferir o banco hospedado em <https://supabase.com>:

1. Crie um projeto. No **SQL Editor**, execute o conteúdo de `supabase/migrations/20261025000000_planner_inicial.sql`.
2. Em **Authentication → URL Configuration**, informe o endereço do sistema em *Site URL* e em *Redirect URLs*.
3. No `.env`, preencha:
   - `SUPABASE_URL_NUVEM=https://xxxx.supabase.co`;
   - `ANON_KEY` e `SERVICE_ROLE_KEY`, com as chaves do projeto;
   - o SMTP.
4. Suba os containers com `docker compose -f docker-compose.nuvem.yml up -d --build`. Isso sobe só a interface e o notificador.

## Segurança

- O `.env` contém a senha do banco e a chave `SERVICE_ROLE_KEY`, que dá acesso total. Não compartilhe esse arquivo.
- O `INSTALAR.bat` gera chaves únicas para cada instalação. Se você criar o `.env` copiando o `.env.example` à mão, troque `POSTGRES_PASSWORD` e `JWT_SECRET`. Depois, gere a `ANON_KEY` e a `SERVICE_ROLE_KEY` com `docker run --rm -v "%cd%:/app" -w /app node:20-alpine node scripts/gerar-env.mjs .env` (o arquivo `.env` não pode existir antes).
- Para acesso pela internet, coloque um proxy HTTPS (Caddy, Traefik, IIS ou Nginx) na frente da porta 8080.

## Solução de problemas

| Sintoma | Solução |
|---|---|
| "O Docker Desktop não está em execução" | Abra o Docker Desktop e aguarde "Engine running". |
| O `INSTALAR.bat` para em `docker compose` | Rode `docker compose logs migrador`. O migrador espera o serviço de login (`auth`) criar o esquema dele. Na primeira vez, rode `INICIAR.bat` de novo. |
| "Não foi possível conectar ao servidor" na tela | Rode `docker compose ps`: `db`, `auth`, `rest`, `arquivos` e `web` precisam estar *running* e o `migrador` precisa estar *exited (0)*. |
| A porta 8080 está ocupada | Troque `PORTA_WEB` no `.env` e o mesmo número em `ENDERECO_PUBLICO`. |
| O link de "esqueci a senha" não abre | Confira se `ENDERECO_PUBLICO` no `.env` é o endereço que você usa no navegador. |
| As notificações ficam "Na fila" | Rode `docker compose logs notificador`. |
| Mudei o `.env` e nada aconteceu | Rode `INICIAR.bat`. O Docker recria os serviços afetados. |
