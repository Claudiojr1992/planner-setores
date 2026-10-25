# 6. Integrações: e-mail e Microsoft Teams

As notificações sempre aparecem no sino. E-mail e Teams são canais adicionais, ligados pela diretoria em **Administração → Integrações**. Cada pessoa também pode desligá-los em **Meu perfil → Notificações**.

## Como funciona

1. Uma ação gera uma notificação. Se o canal estiver ativo, a ação também grava um item na fila `envios`.
2. O container **notificador** verifica a fila a cada 5 segundos e entrega a mensagem. Em caso de falha, tenta de novo até 3 vezes.
3. O resultado aparece em **Integrações → Registro de envios**: *Enviado*, *Erro* (com a mensagem) ou *Ignorado* (canal não configurado).

## E-mail (SMTP)

O SMTP é configurado no arquivo `.env`. Os segredos não ficam no banco.

| Provedor | Configuração |
|---|---|
| Teste local (padrão) | `SMTP_HOST=mailpit` `SMTP_PORT=1025` — veja as mensagens em <http://localhost:8025> |
| Microsoft 365 / Outlook | `SMTP_HOST=smtp.office365.com` `SMTP_PORT=587` `SMTP_SEGURO=false`, mais o usuário e a senha da caixa (o "SMTP AUTH" precisa estar habilitado para a caixa no Exchange) |
| Gmail / Google Workspace | `SMTP_HOST=smtp.gmail.com` `SMTP_PORT=465` `SMTP_SEGURO=true`, com uma **senha de app** |
| SendGrid, Mailgun, Amazon SES | Use o host, a porta e as credenciais SMTP do provedor |

Também defina `SMTP_NOME_REMETENTE` e `SMTP_EMAIL_REMETENTE`. Depois de alterar o `.env`, rode o `INICIAR.bat`.

**Teste:** em *Integrações → E-mail*, clique em **Enviar e-mail de teste para mim**.

> Os e-mails de **login** ("esqueci a senha") usam o mesmo SMTP do `.env` (serviço `auth`). Na instalação padrão, chegam em <http://localhost:8025>. Com o Supabase na nuvem, configure o SMTP em *Authentication → Emails → SMTP Settings* do projeto.

## Microsoft Teams — tela de conexão

1. No Teams, abra o **canal** que vai receber os avisos (ex.: *Fiscal*, ou um canal geral *Planner*).
2. Clique em **⋯ → Workflows**.
3. Escolha o modelo **"Postar em um canal quando uma solicitação de webhook for recebida"** (*Post to a channel when a webhook request is received*).
4. Conclua o assistente e **copie a URL** gerada.
5. No Planner, vá em **Integrações**:
   - para o canal geral, cole a URL em **Webhook do canal geral** e salve. Ele recebe os avisos de setores que não têm canal próprio;
   - para um canal por setor, cole a URL na linha do setor, em **Canais do Teams por setor**.
6. Clique em **Testar**. Uma mensagem de teste deve aparecer no canal em poucos segundos.
7. Ative a chave **Publicar notificações em canais do Teams**.

As mensagens chegam como *Adaptive Card*, com o título, o texto, o nome da pessoa e o botão **Abrir no Planner**. O botão leva direto à atividade, usando o **Endereço do sistema** configurado na mesma tela.

Os *Incoming Webhooks* antigos (`…webhook.office.com…`) também funcionam, mas a Microsoft recomenda migrar para Workflows.

## Solução de problemas

| Registro de envios | Significado | Ação |
|---|---|---|
| Na fila há mais de 1 minuto | Notificador parado | `INICIAR.bat` e `docker compose logs notificador` |
| Ignorado: SMTP não configurado | `SMTP_HOST` vazio | Preencha o `.env` |
| Ignorado: nenhum webhook | Setor sem canal e sem canal geral | Configure um webhook |
| Erro: `535` / autenticação | Usuário ou senha do SMTP incorretos, ou SMTP AUTH desabilitado | Corrija as credenciais |
| Erro: `Teams respondeu 400/404` | URL do webhook inválida ou fluxo desativado no Teams | Gere uma nova URL no Workflows |
