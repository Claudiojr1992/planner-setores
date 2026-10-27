# 3. Manual do usuário

## Acesso

- **Criar conta**: informe o nome, o e-mail corporativo e uma senha com 8 ou mais caracteres. A conta fica *aguardando aprovação* até a diretoria definir seu setor e seu papel. Você recebe uma notificação quando for liberado.
- **Esqueci minha senha**: informe o e-mail e abra o link recebido. O link vale por 1 hora. Em seguida, crie a nova senha.
- **Sair**: menu da sua foto (canto superior direito) → *Sair do sistema*, ou o item **Sair** no rodapé do menu lateral. A tela de saída pede confirmação.
- **Tema**: o botão de lua/sol na barra superior alterna entre claro e escuro. Em *Meu perfil → Aparência*, você escolhe Claro, Escuro ou Automático (segue o Windows).

## Para todos — Início

O Início é a sua mesa de trabalho.

1. **Resumo do dia** (no topo, à direita): mostra quantas atividades suas estão atrasadas, quantas vencem hoje, quantas estão em andamento e quantos pedidos você fez. Clique em um número para ir direto ao grupo.
2. **Meu fluxo**: mostra cada atividade sua com o setor de onde veio e o setor para onde segue. Use *Recolher* se não precisar dele.
3. **Precisa de você** (somente gestores): reúne os pedidos aguardando aceite e as atividades a distribuir, com o botão certo em cada linha.
4. **Minhas atividades**:
   - *Minha fila* fica em ordem de urgência: Atrasadas, Vencem hoje, Em andamento, Próximas e Pausadas;
   - *Que solicitei* serve para acompanhar o que você pediu a outros setores;
   - *Concluídas* lista as atividades que você terminou.
5. **Agenda**: mostra os próximos 7 dias, com o que vence em cada um. Em *Mês*, aparece o calendário completo, com as suas ausências.
6. **Meus últimos 30 dias**: concluídas, percentual no prazo e tempo médio de entrega.

Cada linha tem **uma ação principal**, que é o próximo passo: *Iniciar*, *Concluir*, *Retomar*, *Aceitar* ou *Distribuir*. As outras ações (pausar, recusar, enviar para outro setor) ficam no botão **⋯**. Ao clicar na linha, abre o detalhe, que começa com o **próximo passo** em uma frase. Depois vêm o resumo, o trilho entre setores, comentários, anexos e histórico.

O **trilho de passagem** aparece em cada atividade: `setor de origem —— setor atual - - - próximo setor`, nas cores dos setores. A linha cheia indica o caminho já percorrido; a tracejada, o que vem depois.

### Atalhos de teclado

| Tecla | Ação |
|---|---|
| `N` | Nova solicitação |
| `/` | Buscar atividade |
| `Ctrl` + `Enter` | Enviar o formulário aberto |
| `Esc` | Fechar janelas, menus e o detalhe |

### Fazer uma solicitação

1. Clique em **Nova solicitação** ou aperte `N`.
2. Em **Para onde vai?**, escolha:
   - **Para o meu setor**: entra na fila do seu setor;
   - **Para outro setor**: escolha o setor nos botões. Só aparecem os setores vinculados ao seu, com a indicação "com aceite" ou "direto";
   - **Iniciar um processo**: escolha o fluxo e dê um nome a esta execução (ex.: "Onboarding – Cliente X").
3. Escreva **o que precisa ser feito** e os detalhes.
4. Escolha o **prazo** (*Hoje*, *Amanhã*, *Em 3 dias*, *Em 1 semana* ou uma data) e a **prioridade**.
5. Se precisar, abra **Mais opções** para informar início, responsável, para onde enviar ao concluir e anexos.
6. Confira o caminho no resumo e envie, com o botão ou com `Ctrl` + `Enter`.

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
A página segue a ordem do trabalho do gestor:
1. **indicadores**;
2. **Aguardando aceite** e **A distribuir** (o que depende de você);
3. **Mapa da equipe**, que pode ser recolhido;
4. **Filas por pessoa**;
5. calendário e ausências.

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
- **Empresa e marca**: nome, **cor da marca** e **logotipo**. Eles aparecem no menu, nos botões, no login e nos e-mails. A cor é pré-visualizada no sistema inteiro antes de você clicar em *Salvar marca*. Veja [09-IDENTIDADE-VISUAL.md](09-IDENTIDADE-VISUAL.md).
- **Integrações**: ative e-mail e Teams, cole os webhooks dos canais, use **Testar** e acompanhe o **Registro de envios**.
