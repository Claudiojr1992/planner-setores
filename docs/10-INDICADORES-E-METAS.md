# 10. Indicadores e metas (SLA)

A tela fica em **Gestão → Indicadores e metas**. Ela está disponível para gestores, que veem os seus setores, e para a diretoria, que vê todos. O número ao lado do menu mostra quantas atividades abertas estão com o SLA estourado.

## Como o SLA é contado

| Regra | Como funciona |
|---|---|
| **SLA de conclusão** | conta da **abertura do pedido** até a **conclusão**, em **dias úteis** (sábado e domingo não contam), conforme a **prioridade** |
| **Vencimento** | às 23h59 do último dia útil. Um pedido aberto no fim de semana começa a contar na segunda-feira |
| **Em risco** | a atividade usou **75% ou mais** do tempo útil do SLA |
| **Estourado** | a atividade está aberta depois do limite |
| **Cumprido / fora do SLA** | resultado das atividades concluídas, ou seja, se foram entregues antes ou depois do limite |
| **Não conta** | atividades recusadas ou canceladas |
| **SLA de aceite** | horas corridas entre a chegada ao setor e o aceite do gestor. Vale só para o que passa por aceite |

O SLA é diferente do **prazo** da atividade. O prazo é a data combinada em cada pedido. O SLA é a regra de atendimento do setor e vale para todos os pedidos daquela prioridade.

Valores padrão do sistema:

| Item | Padrão |
|---|---|
| SLA urgente | 1 dia útil |
| SLA alta | 2 dias úteis |
| SLA média | 5 dias úteis |
| SLA baixa | 10 dias úteis |
| SLA de aceite | 8 horas |
| Meta de entregas no SLA | 90% |

## Metas e SLA (aba de configuração)

- **Padrão da empresa**: só a diretoria altera. Vale para todos os setores sem meta própria.
- **Por setor**: o gestor do setor (ou a diretoria) clica em **Personalizar** e informa:
  - os dias úteis por prioridade;
  - as horas de aceite;
  - a meta de % das entregas no SLA;
  - a meta de entregas por mês (opcional).

  Para descartar a personalização, use o botão **↺** (voltar ao padrão).
- As mudanças valem na hora, inclusive para as atividades já abertas: o limite é recalculado com a regra atual.

## Acompanhamento (aba principal)

Filtros: **setor** (todos ou um) e **período**: este mês, últimos 30 dias ou últimos 90 dias.

1. **Placar**:
   - entregues no SLA, comparado com a meta: *Na meta*, *Atenção* (até 10 pontos abaixo) ou *Abaixo da meta*;
   - total de entregas, comparado com a meta mensal;
   - quantas estão em risco agora e quantas estão estouradas agora;
   - percentual de aceites no SLA e o tempo médio de aceite;
   - tempo médio de entrega.
2. **Evolução semanal**: mostra o % de entregas no SLA nas últimas 8 semanas, com a linha da meta. Passe o mouse ou use Tab sobre uma semana para ver os números.
3. **Por equipe**: resultado de cada setor contra a meta dele. Clique em um setor para detalhar.
4. **Por pessoa**: quem tem atividades estouradas ou em risco aparece primeiro, para o gestor oferecer apoio ou redistribuir.
5. **SLA por atividade**: as abas *Estouradas*, *Em risco*, *Todas abertas* e *Entregues no período*. Cada linha mostra o limite, quanto do prazo já foi usado (com a marca de 75%) e a situação. Clique para abrir a atividade.

O SLA também aparece no dia a dia:
- a linha da fila e o cartão mostram **SLA em risco** ou **SLA estourado** quando for o caso;
- o detalhe da atividade mostra o limite e quanto falta.

## Banco de dados

O arquivo `supabase/migrations/20261027010000_metas_sla.sql` faz quatro coisas:
- cria a tabela `metas` (`setor_id` nulo = padrão da empresa);
- adiciona `atividades.aceito_em`, que é preenchido ao aceitar;
- define as regras de acesso: todos os usuários ativos leem, o gestor altera as metas do seu setor e a diretoria altera todas;
- insere o padrão da empresa.

No Docker, o migrador aplica o arquivo sozinho. No Supabase na nuvem, cole o arquivo no SQL Editor. Enquanto a migração não for aplicada, o sistema usa o SLA padrão e continua funcionando, mas não é possível salvar metas.
