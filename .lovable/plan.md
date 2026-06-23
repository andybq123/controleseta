## Objetivo

1. Catálogo de **assuntos** vira tabela do banco, com página administrativa para listar, buscar, criar, editar, excluir e vincular cada assunto a uma secretaria.
2. Quando um e-mail chega, a secretaria é definida automaticamente pelo vínculo `assunto → secretaria` salvo no banco (em vez do mapa hard-coded no código).
3. Repaginar a página de **Secretarias**, removendo o conceito de **Responsáveis** e a coluna **Centro de Custo**.
4. Remover totalmente os responsáveis: tabela, página, dropdowns e exibições.

---

## 1. Modelo de dados (migração única)

**Nova tabela `public.assuntos`:**

| coluna | tipo | observação |
|---|---|---|
| id | uuid PK | |
| nome | text unique not null | rótulo do assunto |
| grupo | text | agrupador opcional (ex. "Saúde", "Trânsito e Vias") |
| secretaria_id | uuid FK → secretarias(id) ON DELETE SET NULL | vínculo padrão |
| ativo | boolean default true | esconder sem perder histórico |
| created_at / updated_at | timestamps | |

- GRANTs para `authenticated` e `service_role`. Sem `anon`.
- RLS: autenticados leem e gerenciam.
- Trigger `update_updated_at_column` no UPDATE.
- **Seed**: insere todos os 78 itens do catálogo atual (`src/lib/assuntos-ouvidoria.ts`), já vinculando à secretaria correspondente conforme o mapa existente em `src/lib/protocolo-ingest.server.ts` (match por `lower(unaccent(secretarias.nome))`).
- Normaliza **na própria migração** as duplicidades do catálogo: mantém **"Programas Sociais"** (descarta "Programas Socias") e **"Praça e/ou quadra para lazer e esportes"** (descarta "Praça e ou quadra…").

**Remoção de Responsáveis:**

- `ALTER TABLE protocolos DROP COLUMN responsavel_id;`
- `DROP TABLE public.responsaveis;`

**Remoção de Centro de Custo:**

- `ALTER TABLE secretarias DROP COLUMN centro_custo;`

---

## 2. Nova página: `/assuntos`

Rota `src/routes/_authenticated/assuntos.tsx`.

- Tabela com colunas: **Assunto**, **Grupo**, **Secretaria vinculada**, **Ativo**, **Ações**.
- Busca por texto (filtra `nome` e `grupo`) + filtro por secretaria + filtro ativo/inativo.
- Botão **Novo assunto** → diálogo com campos: nome, grupo (combobox livre com sugestões dos grupos atuais), secretaria (select), ativo.
- Edição inline da secretaria via `<Select>` na linha (salva ao mudar).
- Editar/excluir via diálogo. Excluir só permitido se nenhum protocolo usa esse assunto (verificação na chamada).
- Item de menu **Assuntos** na sidebar do `_authenticated/route.tsx`.

---

## 3. Integração com ingestão de e-mail

`src/lib/protocolo-ingest.server.ts`:

- Substituir o objeto `ASSUNTO_PARA_SECRETARIA` por uma busca em `assuntos` (`select nome, secretaria_id`) carregada uma vez por execução.
- Lookup case/acento-insensitivo do `extr.assunto_categoria` na tabela; se houver match e `secretaria_id` não nulo, usa.
- Mantém os fallbacks atuais (regra por palavras-chave) se nenhum vínculo for encontrado.

Atualizar `src/lib/protocolo-extract.shared.ts` para listar os rótulos válidos a partir dos `nome` em `assuntos` ativos (gerado em build-time não é viável; manter lista estática sincronizada com o catálogo seed). Não bloqueante: o prompt já tolera "" quando não há match.

---

## 4. Repaginação das páginas

**`/secretarias`** (`src/routes/_authenticated/secretarias.tsx`):

- Remover totalmente a aba/seção de Responsáveis e a coluna Centro de Custo.
- Layout em cards por secretaria mostrando: nome, sigla, ícone, endereço, **nº de assuntos vinculados** (link para `/assuntos?secretaria=<id>`) e **nº de protocolos abertos**.
- Manter editar/excluir e o mapa atual.

**Página `/responsaveis` / aba responsáveis:** removida.

**Outros arquivos afetados (responsavel_id / centro_custo):**

- `protocolos.tsx`, `dashboard.tsx`, `atrasados.tsx`, `saude.tsx`, `relatorios.index.tsx`, `relatorios.secretaria.$id.tsx`, `protocolo-detail-dialog.tsx`, `notification-bell.tsx` → remover colunas, filtros, joins e exportações que mencionam responsável/centro de custo.

---

## 5. Detalhes técnicos

- Tipos do Supabase são regerados após a migração; só então editar os arquivos `.tsx`.
- Server functions novas em `src/lib/assuntos.functions.ts` com `requireSupabaseAuth`:
  - `listAssuntos`, `createAssunto`, `updateAssunto`, `deleteAssunto` (verifica uso em `protocolos.assunto`).
- Leituras na página usam padrão TanStack Query (`ensureQueryData` no loader + `useSuspenseQuery` no componente).
- Sem alterações em `responsaveis` policies — a tabela é dropada.

---

## Ordem de execução

1. Migração: nova tabela `assuntos` + seed + drop `responsaveis` + drop `secretarias.centro_custo` + drop `protocolos.responsavel_id`.
2. Server fns `assuntos.functions.ts` + ajuste em `protocolo-ingest.server.ts`.
3. Página `/assuntos` + item de menu.
4. Refatorar `/secretarias` e remover todas as referências a responsável e centro de custo.
5. Remover `src/lib/assuntos-ouvidoria.ts` (ou deixá-lo apenas como fonte de seed comentado).
