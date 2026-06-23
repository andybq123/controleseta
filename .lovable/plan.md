## Objetivo

Fazer com que o `protocolo-ingest` use o número real da Ouvidoria que vem no assunto do e-mail (ex.: `Ouvidoria 2.078/2026: Poluição Ambiental` → `2.078/2026`) em vez de gerar um número novo aleatório (`5.602/2026`, `6.971/2026`).

## O que muda

### 1. `src/lib/protocolo-ingest.server.ts`

- Adicionar uma função `extrairNumeroDoAssunto(assunto, corpo)` que tenta achar o número no padrão `NNN(.NNN)?/AAAA` em:
  1. `Ouvidoria <num>:`
  2. `Ouvidoria Nº/N° <num>` ou `Protocolo <num>`
  3. `e-SIC <num>` / `LAI <num>`
  4. Fallback: primeira ocorrência de `\d{1,3}(\.\d{3})*\/20\d{2}` no assunto, depois no corpo.
- Usar esse número como **fonte autoritativa**: passa a ter prioridade sobre o `extr.numero` vindo da IA (a IA continua usada para os demais campos).
- Aplicar `normalizarNumero` para já fazer a checagem de duplicidade considerando variações com/sem ponto de milhar — se já existir protocolo com aquele número, segue o fluxo de "atualização/baixa" já implementado (não cria duplicado).
- Só cai no `gerarNumeroProtocolo(extr.tipo)` quando nenhum número for encontrado nem no assunto, nem no corpo, nem pela IA. Isso evita gerar números sintéticos quando o e-mail claramente traz o número da Ouvidoria.

### 2. Correção dos 2 protocolos já criados de forma incorreta

Migração única para renumerar:
- `5.602/2026` → `2.078/2026` (Poluição Ambiental, Fundema)
- `6.971/2026` → `2.084/2026` (Poda de árvores de rua, Secretaria de Obras)

Antes de atualizar, a migração checa se já não existe outro protocolo com o número de destino para não estourar a unique constraint. O trigger `log_protocolo_changes` vai registrar a mudança no histórico automaticamente.

## O que NÃO muda

- Lógica de roteamento por secretaria (catálogo `assuntos` + fallback hard-coded) permanece igual.
- Extração de demais campos pela IA permanece igual.
- Fluxo de detecção de "baixa/atualização" para protocolos já existentes permanece igual — só passa a casar mais cedo porque o número correto será extraído do assunto.

## Detalhes técnicos

- Regex principal: `/Ouvidoria\s+(?:n[ºo°]\s*)?(\d{1,3}(?:\.\d{3})*\/20\d{2})/i`
- Regex genérica de fallback: `/(\d{1,3}(?:\.\d{3})*\/20\d{2})/`
- A função roda **antes** do bloco de detecção de existente (linhas 203-247), substituindo o `extr.numero` quando encontra match — assim o lookup `IN (variantes)` já encontra o protocolo certo na próxima vez que o mesmo e-mail chegar.
