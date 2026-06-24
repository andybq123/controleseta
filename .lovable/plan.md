## Objetivo
Salvar lat/lng nos 25 locais da Saúde enviados e exibir como pontos clicáveis no mapa que abrem a lista de protocolos vinculados ao local.

## 1. Banco — adicionar coordenadas ao `locais`
Migração:
- `ALTER TABLE public.locais ADD COLUMN latitude double precision, ADD COLUMN longitude double precision;`
- `UPDATE` em cada um dos 25 locais usando o `id` já identificado, com o mapeamento:

| Local cadastrado | Lat / Lng |
|---|---|
| Águas Claras | -27.14451, -48.90327 |
| Azambuja/ 1º de Maio | -27.10651, -48.91755 |
| Bateas | -27.04552, -48.89299 |
| Cedrinho | -27.15098, -48.92665 |
| Dom Joaquim | -27.14659, -48.96102 |
| Emma II | -27.05230, -48.88049 |
| Guarani | -27.10455, -48.94298 |
| Limeira | -27.07897, -48.86158 |
| Limeira Alta | -27.10882, -48.85265 |
| Nova Brasília | -27.08311, -48.89206 |
| Paquetá | -27.14067, -48.92083 |
| Planalto | -27.04944, -48.86873 |
| Poço Fundo | -27.12570, -48.87522 |
| Ponta Russa | -27.14757, -48.88048 |
| Rio Branco | -27.12274, -48.94991 |
| Santa Luzia | -27.15999, -48.89339 |
| Santa Rita | -27.07980, -48.89869 |
| Santa Terezinha | -27.07553, -48.88863 |
| São João | -27.16941, -48.96027 |
| São Luiz | -27.08087, -48.91640 |
| São Pedro | -27.07288, -48.93773 |
| Souza Cruz – Maluche | -27.10654, -48.92275 |
| Steffen | -27.07411, -48.90533 |
| Volta Grande | -27.02247, -48.88487 |
| Zantão | -27.16431, -48.90771 |

Mantém RLS atual; só adiciona colunas opcionais.

## 2. Mapa (`/mapa`) — pontos de locais com lista de protocolos
No `mapa.tsx`:
- Buscar `locais` com `latitude/longitude not null` (id, nome, lat, lng, secretaria_id, secretarias(nome, icone)).
- Aplicar filtro de Secretaria já existente.

No `ManifestacoesMap` (`src/components/manifestacoes-map.tsx`):
- Adicionar nova prop `locais: LocalPoint[]` com marker próprio (ícone 🏥 menor, cor branca com borda do tema saúde) para diferenciar dos pins de protocolo e do "shield" da secretaria.
- Popup do local mostra: nome, secretaria, contagem de protocolos e **lista clicável** (número + assunto, status). Cada item chama `onOpenProtocolo(id)` reaproveitando o `ProtocoloDetailDialog`.
- Lista derivada em tempo real cruzando `points` (já carregados no mapa) por `local` (já vem no MapPoint) — sem novo fetch. Limita visualmente a ~20 itens com scroll interno e um total no topo.

## 3. Saúde (`/saude`)
Reaproveitar o mesmo componente para que os locais da Saúde apareçam automaticamente lá também (já consome `ManifestacoesMap`). Sem mudança extra de UI.

## Detalhes técnicos
- Tipos regenerados pela migração; após isso, ajusto query em `mapa.tsx` e `saude.tsx` (se aplicável) e adiciono o tipo `LocalPoint` em `manifestacoes-map.tsx`.
- Sem mudanças em RLS/policies (colunas só leitura via policy já existente em `locais`).
- Nenhum geocoding novo — coordenadas vêm fixas do usuário.

## Fora do escopo
- UI de admin para editar lat/lng de locais (posso adicionar depois se quiser).
- Coordenadas de locais de outras secretarias.
