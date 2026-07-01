
## Objetivo

Integrar os protocolos antigos (hoje só em `src/data/ouvidorias.json`, exibidos separadamente em `/protocolos-antigos`) na tabela `protocolos`, para que apareçam em Protocolos, Dashboard, Saúde, Relatórios, Mapa etc. exatamente como os atuais — mas identificados como legados (sem link 1Doc).

Como é um teste, tudo é **reversível com um único DELETE** (marcador `origem = 'antigo:...'`).

## O que será importado

- Arquivo: `src/data/ouvidorias.json` (3.720 registros — 2.388 Brusque + 1.332 Saúde; anos 2025/2026).
- Serão **puladas** entradas cujo número/ano já existe em `protocolos` (evita duplicar com os atuais de junho/2026 que já vieram por e-mail).
- Também aplicaremos os overrides oficiais de `src/data/ouvidorias-atrasadas.json` para marcar situação.

## Mapeamento por registro

| Campo destino | Origem |
|---|---|
| `numero` | `"1.878/2026"` (mesmo formato dos atuais: sequência com ponto de milhar + `/AAAA` derivado de `data`) |
| `tipo` | `'ouvidoria'` |
| `assunto` | `setor` (ex.: "Bem-Estar Animal") |
| `descricao` | Texto limpo do `comentario` (remove cabeçalhos `======`, `ID#…`, autor/data) |
| `solicitante` | Autor extraído do cabeçalho do comentário, quando presente |
| `data_abertura` | `data` |
| `categoria` | Inferida pelo texto (mesma heurística já usada em `inferCategoria`) |
| `status` | `concluido` se houver registro em `protocolos_antigos_conclusoes` **ou** situação = "Em dia" antiga com data > 30 dias; senão `aberto` |
| `secretaria_id` | Match por nome (mesma lógica de `protocolos-antigos-merge.ts`); Saúde → secretaria Saúde |
| `origem` | `'antigo:Brusque'` ou `'antigo:Saúde'` ← **marcador de reversão** |
| `url` | `NULL` (sem link 1Doc) |
| `detalhes` (jsonb) | `{ legacy: true, setor_original, responsavel, situacao_original, numero_original }` |
| `triagem_pendente` | `false` |
| `sigilo` | `'nao'` |
| `hash_consulta` | `NULL` |

Filtros: pular `2026-06` (já cobertos pelos atuais) e qualquer `numero/ano` que já exista no banco.

## Passos

1. **Migration** — cria índice parcial `idx_protocolos_antigo ON protocolos(origem) WHERE origem LIKE 'antigo:%'` para busca/limpeza rápidas. Nada mais de schema.
2. **Server function `importarProtocolosAntigos`** (`src/lib/protocolos-antigos-import.functions.ts`, com `requireSupabaseAuth` + `has_role admin`):
   - Lê o JSON embutido, aplica mapeamento acima, faz `insert` em lotes de 500 pulando duplicatas por `numero`.
   - Retorna `{ inseridos, pulados_duplicados, pulados_junho, erros }`.
3. **Botão de importação** em `/protocolos-antigos` (topo, área admin): "Importar para protocolos" + botão "Reverter importação" (chama outra server fn que executa `DELETE FROM protocolos WHERE origem LIKE 'antigo:%'`). Confirmação com `AlertDialog`.
4. **UI de aviso "sem 1Doc"** em `src/components/protocolo-detail-dialog.tsx`:
   - Quando `protocolo.detalhes?.legacy === true` **ou** `origem` começa com `antigo:`:
     - Substituir o botão "Abrir no 1Doc" no rodapé por um `Alert` cinza com ícone: **"Protocolo legado — link do 1Doc não disponível."**
     - Adicionar `Badge` "Legado" ao lado do número no cabeçalho.
5. **Não** alterar `/protocolos-antigos` além do botão — a página continua funcionando lendo o JSON, então se revertermos nada quebra.
6. **Não** mexer em `protocolo-ingest.server.ts`, triggers de triagem, coletor, etc.

## Reversão (caso o teste não fique bom)

- Clicar "Reverter importação" na página, **ou** executar:  
  `DELETE FROM protocolos WHERE origem LIKE 'antigo:%';`
- Reverter os 2 arquivos novos (`protocolos-antigos-import.functions.ts` e o pequeno bloco no dialog/página).
- O índice parcial pode ficar (é inofensivo) ou ser removido com um drop simples.

## Riscos e mitigações

- **Colisão de números**: tratada pelo skip por `numero` já existente.
- **Volume (~3,7k linhas)**: insert em lotes; sem impacto notável em RLS/consultas (protocolos já lida com milhares).
- **Categoria/secretaria imprecisas**: usamos a mesma heurística já usada hoje em `/protocolos-antigos`, então o resultado será consistente com o que o usuário já vê lá.
- **Histórico/gatilhos**: o trigger `log_protocolo_changes` gravará `_criacao` para cada import. É esperado e reversível junto com o DELETE (cascade em `protocolo_historico`).

## Arquivos afetados

- **Novo**: `src/lib/protocolos-antigos-import.functions.ts`
- **Editar**: `src/routes/_authenticated/protocolos-antigos.index.tsx` (botões admin)
- **Editar**: `src/components/protocolo-detail-dialog.tsx` (badge + aviso "1Doc indisponível")
- **Migration**: índice parcial para reversão rápida
