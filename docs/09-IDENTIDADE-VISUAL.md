# 9. Identidade visual e experiência

## Conceito: "Elo"

O Planner existe para levar o trabalho de um setor ao próximo sem que nada se perca no caminho. A identidade parte dessa ideia de passagem:

- **Símbolo**: dois blocos (setores) ligados por uma curva (a passagem do trabalho). Fica no menu, na tela de entrada, no ícone da aba e no carregamento.
- **Trilho de passagem**: é o elemento de assinatura do sistema. Mostra, nas cores de cada setor, `setor de origem —— setor atual - - - próximo setor`. Aparece:
  - nos cartões;
  - nas linhas da fila;
  - no detalhe da atividade;
  - no resumo da Nova solicitação.

  A linha cheia indica o caminho já percorrido; a tracejada, o que ainda vai acontecer.
- **Tela de entrada**: a sequência *Comercial pede → Fiscal aceita → A analista executa → Financeiro recebe* aparece passo a passo, uma única vez. Ela não é exibida para quem ativou "reduzir movimento" no sistema.

## Paleta padrão

| Papel | Claro | Escuro | Uso |
|---|---|---|---|
| Marca (verde-petróleo) | `#0B7A75` | derivada, mais clara | botões principais, seleção, foco, menu |
| Tinta | `#14222E` | `#E5ECEB` | texto principal |
| Papel | `#F3F5F4` | `#0D1417` | fundo |
| Superfície | `#FFFFFF` | `#141D21` | painéis e cartões |
| Âmbar | `#A35F00` | `#F0B44C` | aguardando alguém (aceite) e vencendo hoje |
| Vermelho | `#B83229` | `#FF8A80` | atraso, recusa e exclusão |

As cores de **situação** são fixas para todas as empresas, para que o significado não mude: aguardando aceite em âmbar, a distribuir em ciano, na fila em cinza, em andamento em azul, pausada em roxo e concluída em verde. As cores dos **setores** são definidas no cadastro de setores.

## Tipografia

- **Onest** em toda a interface, com números tabulares em prazos, contadores e indicadores.
- Sem fonte instalada (por exemplo, Docker sem internet), o sistema usa a fonte do Windows (Segoe UI).
- Os títulos usam peso 650 e espaçamento levemente negativo. Os rótulos ficam em caixa normal, sem letras maiúsculas espaçadas.

## Marca da empresa (personalizável)

Em **Administração → Empresa e marca**, a diretoria define:

1. **Nome** da empresa.
2. **Cor da marca**: escolha uma das sugestões ou qualquer cor (`#RRGGBB`).
   - O menu lateral, os botões, as seleções e os destaques passam a usar essa cor. O e-mail de notificação também.
   - A versão para o tema escuro é calculada automaticamente.
   - O texto sobre a cor (branco ou escuro) é escolhido pelo contraste. Se a cor tiver pouco contraste, o sistema avisa.
   - A cor é **pré-visualizada no sistema inteiro** enquanto você escolhe. Só vale para todos depois de **Salvar marca**.
3. **Logotipo**: quando enviado, substitui o símbolo do Planner no menu e na tela de entrada.

Tecnicamente, a cor fica em `empresa.cor_primaria`. A interface define as variáveis CSS `--marca` e `--marca-texto`, e o restante do tema deriva delas com `color-mix`.

## Temas

São três: **claro**, **escuro** e **automático**, que segue o sistema operacional. Para trocar, use o botão de lua/sol na barra superior ou **Meu perfil → Aparência**. A escolha fica salva no navegador, e o tema é aplicado antes de a página aparecer, sem "piscar".

## Princípios de interação

1. **Uma ação principal por atividade.** O botão visível é o próximo passo: *Aceitar*, *Distribuir*, *Iniciar*, *Concluir* ou *Retomar*. O restante fica no menu **⋯**: recusar, pausar, enviar para outro setor e abrir detalhes.
2. **A fila em ordem de urgência.** O Início agrupa as atividades nesta ordem:
   - *Atrasadas*;
   - *Vencem hoje*;
   - *Em andamento*;
   - *Próximas*;
   - *Pausadas*.
3. **O gestor vê primeiro o que depende dele.** A caixa *Precisa de você*, no Início e no topo do Painel do setor, reúne o que aguarda aceite e o que está a distribuir.
4. **O próximo passo em uma frase.** O detalhe abre dizendo o que precisa acontecer agora ("Decida se o seu setor aceita", "Ao concluir, segue para Financeiro"), com a ação certa ao lado.
5. **Formulário curto.** A Nova solicitação pede só o essencial:
   - para onde vai;
   - o que fazer;
   - prazo, com botões rápidos;
   - prioridade.

   Início, responsável, encaminhamento e anexos ficam em *Mais opções*. O resumo mostra o caminho antes de enviar.
6. **Atalhos de teclado.**

   | Tecla | Ação |
   |---|---|
   | `N` | Nova solicitação |
   | `/` | Buscar atividade |
   | `Ctrl` + `Enter` | Enviar o formulário aberto |
   | `Esc` | Fechar janelas, menus e o detalhe |
7. **Acessibilidade.**
   - foco visível;
   - contraste verificado na cor da marca;
   - respeito a "reduzir movimento";
   - layout que funciona no celular, com menu em gaveta.
