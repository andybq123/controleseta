## Objetivo

Gmail já foi conectado com sucesso ✓. Agora preciso adicionar uma **ressincronização profunda** que busca os e-mails recebidos durante o período offline, sem duplicar protocolos já existentes.

## Como funciona o anti-duplicação

O sistema já garante zero duplicação em duas camadas:
1. **`email_inbox_log.external_id`** = Gmail message ID. Antes de processar cada e-mail, a função `ingerirEmail` consulta se aquele `external_id` já existe para a conta — se sim, ignora.
2. **`protocolos.numero`** — quando a IA extrai um número de protocolo do corpo do e-mail, o sistema procura o protocolo existente e registra como **atualização/baixa** em vez de criar duplicado.

Ou seja, mesmo varrendo uma janela ampla, nada é duplicado.

## Mudanças

### 1. `src/lib/protocolo-ingest.server.ts`
Refatorar `sincronizarGmailContas()` para usar uma função interna parametrizável `sincronizarGmailContasComJanela(query, pageSize, maxPages)`:
- Sync normal (mantido): `newer_than:2d`, 20 mensagens, 1 página.
- Nova função `ressincronizarGmailContas(dias = 30)`: `newer_than:30d`, 100 por página, até 20 páginas (até 2.000 e-mails) com **paginação via `nextPageToken`** do Gmail.

### 2. `src/lib/gmail-sync.functions.ts`
Adicionar novo server function `ressincronizarGmail` (autenticado, parâmetro `dias` validado entre 1 e 90, default 30).

### 3. `src/routes/_authenticated/email-inbox.tsx`
Adicionar botão **"Ressincronizar 30 dias"** ao lado do botão "Sincronizar agora", com confirmação antes de executar. Mostra toast com total de novos/erros ao final.

## Resultado

Ao apertar o novo botão, o sistema vai varrer todos os e-mails dos últimos 30 dias da caixa Gmail conectada, processar apenas os que **ainda não foram vistos** (dedup por message ID) e criar/atualizar protocolos conforme já faz hoje.
