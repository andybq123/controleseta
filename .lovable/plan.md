## Objetivo
Fazer os KPIs da dashboard atualizarem instantaneamente após qualquer alteração relevante em um protocolo (conclusão, edição, triagem) e, ao mesmo tempo, propagar essas mudanças em tempo real para os outros usuários conectados.

## Passos

1. **Habilitar Realtime na tabela `protocolos`**
   - Migração adicionando `public.protocolos` à publication `supabase_realtime`.
   - Garantir `REPLICA IDENTITY FULL` para receber os campos antigos nos eventos de UPDATE.

2. **Hook `useProtocolosRealtime`**
   - Novo arquivo `src/hooks/use-protocolos-realtime.ts`.
   - Assina o canal `postgres_changes` (`event: '*'`, `schema: 'public'`, `table: 'protocolos'`) dentro de um `useEffect` com cleanup (`supabase.removeChannel`), conforme padrão de Realtime.
   - Ao receber um evento, faz `queryClient.invalidateQueries` de forma debounced (300 ms) nas chaves relevantes: `protocolos`, `protocolos-*`, `relatorio*`, `triagem-stats`, `atrasados`, `dashboard*`, `protocolo` (detalhe).

3. **Montar o hook uma única vez**
   - Chamar `useProtocolosRealtime()` em `src/routes/_authenticated/route.tsx` (dentro do layout autenticado) — evita múltiplas assinaturas por página.

4. **Reforçar a atualização imediata local**
   - Revisar `protocolo-detail-dialog.tsx` para garantir invalidação abrangente após `handleSave`, `confirmarConclusao`, `handleReabrir`, `handleIniciar`, `handleProrrogar` e `handleConcluirTriagem` (algumas ações hoje só invalidam `["protocolos"]`).
   - Consolidar num helper `invalidateProtocoloCaches(qc)` para não repetir o predicate.

5. **Feedback discreto de sincronização (opcional, leve)**
   - Um pequeno indicador "Atualizado agora" no cabeçalho da dashboard quando o Realtime dispara uma revalidação (badge que some após 2 s). Sem toasts intrusivos.

## Detalhes técnicos
- Sem novas tabelas nem colunas. Apenas: 1 migração de publication + 1 hook novo + 1 chamada de hook + refactor pequeno no dialog.
- Debounce evita tempestade de re-fetch quando várias linhas mudam em sequência (ex.: triagem em lote).
- RLS já existente cobre o filtro do Realtime — usuários só recebem eventos das linhas que podem ler.
- Custo Realtime: baixo (3 usuários, tabela de baixa escrita).

## Fora do escopo
- Polling periódico (descartado — o Realtime já cobre).
- Mudanças visuais na dashboard além do micro-indicador de sync.
