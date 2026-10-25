# 3. Manual do usuário

## Acesso

- **Criar conta**: informe o nome, o e-mail corporativo e uma senha com 8 ou mais caracteres. A conta fica *aguardando aprovação* até a diretoria definir seu setor e seu papel. Você recebe uma notificação quando for liberado.
- **Esqueci minha senha**: informe o e-mail e abra o link recebido. O link vale por 1 hora. Em seguida, crie a nova senha.
- **Sair**: menu da sua foto (canto superior direito) → *Sair do sistema*, ou o item **Sair** no rodapé do menu lateral. A tela de saída pede confirmação.
- **Tema**: o botão de lua/sol na barra superior alterna entre claro e escuro. Em *Meu perfil → Aparência*, você escolhe Claro, Escuro ou Automático (segue o Windows).

## Para todos — Início

1. **Meu fluxo de trabalho**: cada atividade sua aparece com o setor de onde veio e os setores para onde vai depois.
2. **Indicadores**: clique em um deles para abrir a lista já filtrada.
3. **Minhas atividades**: alterne entre *Minha fila*, *Que solicitei* (para acompanhar pedidos a outros setores) e *Concluídas*.
4. **Calendário**: mostra os prazos e as suas ausências.

Use os botões do cartão: **Iniciar** → **Pausar/Retomar** → **Concluir**. Ao clicar no cartão, abre o detalhe, com resumo, trilha do processo, comentários, anexos e histórico.

### Fazer uma solicitação

1. Clique em **+ Nova solicitação**.
2. Escolha um dos caminhos:
   - **Atividade do meu setor**: entra na fila do seu setor (para você ou para o gestor distribuir);
   - **Solicitar a outro setor**: a lista mostra só os setores vinculados ao seu e indica se exigem aceite;
   - **Iniciar um processo**: escolha um fluxo e dê um nome a esta execução (ex.: "Onboarding – Cliente X").
3. Preencha título, descrição, prioridade, prazo e anexos.
4. Confira a caixa **"O que vai acontecer"** e envie.

### Concluir e encaminhar

Ao concluir, escreva uma observação para o próximo setor. O que acontece depois depende do tipo de atividade:
- **com fluxo**: a tela mostra as próximas etapas e se elas exigem aceite;
- **sem fluxo**: você pode escolher encaminhar para um setor vinculado ou encerrar aqui.

## Atividades em quadro (estilo Trello)

Em **Atividades**, a visão **Quadro** mostra uma coluna por situação: Aguardando aceite, A distribuir, Na fila, Em andamento, Pausada e Concluída (últimos 14 dias). A visão **Lista** mostra a tabela com exportação para CSV.

- **Arraste o cartão entre as colunas** para mudar a situação:
  - **Em andamento**: inicia a atividade;
  - **Pausada**: pede o motivo;
  - **Concluída**: abre a confirmação e o encaminhamento;
  - **A distribuir**: o gestor devolve a atividade para distribuição;
  - de **Aguardando aceite** para **Na fila** ou **A distribuir**: o gestor aceita a solicitação;
  - de **Concluída** para outra coluna: o gestor reabre a atividade.

  Durante o arraste, as colunas permitidas ficam destacadas. Passe o mouse sobre uma coluna apagada para ver o motivo.
- **Enviar para outro setor**: arraste o cartão até um setor da faixa acima do quadro. Só ficam ativos os setores com vínculo a partir do setor da atividade. Outra opção é usar o botão **Enviar** no cartão. Em seguida, escolha *Próxima etapa ao concluir* ou *Enviar agora*. O gestor do setor de destino é notificado.

## Usuários de teste

Com o sistema no ar, dê dois cliques em **`CRIAR-USUARIO-TESTE.bat`**. A senha de todos é `Planner@2026`.

| Papel | E-mail |
|---|---|
| Administrador | `admin@planner.local` |
| Gestor do setor Fiscal | `gestor@planner.local` |
| Colaborador do setor Fiscal | `colaborador@planner.local` |

O script também cria:
- os setores **Fiscal** e **Financeiro**;
- o vínculo Fiscal → Financeiro, com aceite;
- 4 atividades de exemplo.

Antes de usar com a equipe, troque as senhas.

## Para gestores

### Painel do setor
- **Mapa da equipe**: mostra o que entra de outros setores, quem está fazendo o quê (com carga e atrasos) e para onde as atividades seguem.
- **Aguardando aceite**:
  - **Aceitar** permite já escolher o responsável e ajustar o prazo;
  - **Recusar** exige um motivo, e o solicitante é avisado.
- **A distribuir**: use **Distribuir** ou arraste o cartão para a coluna de uma pessoa.
- **Filas por pessoa**: arraste entre colunas para redistribuir. Colunas hachuradas indicam pessoa ausente.

### Férias e delegação
1. Clique em **Programar ausência** e preencha pessoa, tipo e período.
2. Escolha o substituto principal. Isso pré-seleciona todas as atividades.
3. Ajuste atividade por atividade: manter, delegar a outra pessoa ou devolver para distribuição.
4. Clique em **Salvar e delegar**.

No retorno, clique em **Devolver** na linha da ausência. Também é possível delegar mais tarde, pelo botão **Delegar**.

### Gestão da empresa
- **Criar vínculo**: puxe a bolinha azul à direita de um setor até outro setor e escolha se o vínculo exige aceite.
- **Remover vínculo**: clique na ligação → *Remover vínculo*, ou pressione Delete.
- **Vincular uma atividade a outro setor**: arraste o cartão da lista à esquerda até o setor e escolha entre:
  - *Próxima etapa ao concluir*;
  - *Enviar agora*.
- Arraste o título de um setor para reorganizar o mapa.

### Fluxos de processo
1. **Novo fluxo**: arraste os elementos da paleta, ou clique neles. A paleta tem *Etapa por setor*, que já cria a etapa com o setor definido.
2. Ligue os elementos puxando a bolinha azul da direita até o próximo. Para desfazer uma ligação, selecione-a e pressione Delete.
3. Clique em uma etapa para definir nome, setor, prazo em dias e *exigir aceite*.
4. O painel **Verificação** mostra o que falta. **Organizar** arruma o desenho automaticamente.
5. **Salvar fluxo**. Depois, **Iniciar processo**, ou use *Nova solicitação → Iniciar um processo*.

## Para a diretoria (administrador)
- **Setores**: nome, cor, descrição e gestor. Definir o gestor transforma a pessoa em gestora.
- **Pessoas e acessos**:
  - aprove novos cadastros (defina setor e papel);
  - edite cargos;
  - bloqueie acessos.
- **Empresa e marca**: nome e **logotipo**, que aparece no menu, no login e nos e-mails.
- **Integrações**: ative e-mail e Teams, cole os webhooks dos canais, use **Testar** e acompanhe o **Registro de envios**.
