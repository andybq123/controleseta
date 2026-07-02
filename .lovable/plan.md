
## Diagnóstico

Hoje o card e o drill de **Atrasados** no dashboard filtram por `data_abertura` dentro do mês selecionado e usam `situacaoProtocolo()`, que compara o prazo final com **a data de hoje**. Resultado: em Junho/2026 e Julho/2026 aparecem 0, porque quase todos os atrasados foram *abertos* em meses anteriores. Já a aba `/atrasados` mostra tudo que está vencido hoje, sem recorte de mês — daí o descompasso.

A aba `/atrasados` também não tem filtro de mês nenhum.

## Proposta

Adotar a lógica **acumulada até o fim do mês** que você sugeriu:

> "Atrasados de Junho" = todo protocolo cujo **prazo final** já passou até 30/Jun **e** que ainda não estava concluído em 30/Jun.

Assim o número só cresce (ou fica estável) mês a mês, refletindo a fila real de atraso naquele momento. Para o mês corrente, o corte é "hoje".

Fórmula por mês `M` (fim do mês = `endM`, ou `hoje` se `M` for o mês atual):
- `prazoFinal(p) < endM`
- E (`p.status != 'concluido'` OU `p.data_conclusao > endM`)

## Mudanças

1. **`src/lib/prazo.ts`**
   - Nova helper `situacaoNaData(p, refDate)` idêntica a `situacaoProtocolo`, mas recebendo uma data de referência.
   - `estavaAtrasadoNaData(p, refDate)` aplicando a regra acima.

2. **`src/routes/_authenticated/dashboard.tsx`**
   - Card **Atrasados** e drill: usar `estavaAtrasadoNaData` sobre **todo** o dataset (`allEnriched`), não só `filtrados` (que hoje corta por `data_abertura`).
   - Legenda do card: "atrasados acumulados até <mês>" (ou "até hoje" quando `mes === 'all'` ou for o mês atual).
   - Percentual: sobre o total acumulado aberto até o fim do mês.
   - Novo mini-gráfico opcional (**pequeno**, dentro do card ou logo abaixo do KPI de atrasados) com a evolução dos últimos 6 meses da fila acumulada de atrasados — puramente frontend, mesmo dataset.

3. **`src/routes/_authenticated/atrasados.tsx`**
   - Adicionar o mesmo `Select` de mês (reaproveitando `monthOptionsFromDates` + `currentMonthValue`) para escolher a data de corte.
   - Trocar o filtro `_s.situacao === 'vencido'` por `estavaAtrasadoNaData(p, endMes)`.
   - Buckets ("+30 dias", "+20 dias", …) e o "Xd atrasado" passam a ser calculados relativos ao `endMes` selecionado (não a hoje), para o número ser coerente com o corte.
   - Padrão do filtro: mês atual (comportamento atual preservado quando o usuário não muda nada, exceto que já não some quem foi aberto antes).

4. Nenhuma mudança de schema, nenhuma edge function, nenhum ajuste em ingest/triagem.

## Não fazer

- Não mexer em `NotificationBell` nem em `/tarefas` (usam "vencido hoje", que é o comportamento certo lá).
- Não alterar como legado/antigos são carregados — já estão em `allEnriched`.
- Não tocar o gráfico de evolução de manifestações (é sobre aberturas, não atrasos).
