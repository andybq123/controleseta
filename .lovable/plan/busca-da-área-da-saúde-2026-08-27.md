# Busca da área da Saúde

Hoje a busca da página Saúde só olha número, assunto e solicitante — e só dentro do mês/ano selecionado. Digitar uma palavra do relato não encontra nada.

## O que muda

1. A busca passa a considerar também:
   - descrição/relato da ouvidoria
   - resolução
   - endereço
   - nome da unidade (UBS/local) e nome da secretaria
   - categoria e tipo (ex.: reclamação, solicitação)
2. Busca sem acento e sem diferenciar maiúsculas: "reclamacao" encontra "Reclamação".
3. Múltiplas palavras: todos os termos digitados precisam aparecer (em qualquer campo), em qualquer ordem.
4. Quando houver texto na busca, o filtro de mês/ano é ignorado (a busca varre todos os protocolos da Saúde), com um aviso discreto na tela indicando "buscando em todo o período". Filtro de unidade e intervalo de datas continuam valendo.
5. Placeholder atualizado para "Buscar nº, assunto, relato, unidade…".

## Detalhes técnicos

- Alteração restrita a `src/routes/_authenticated/saude.tsx`.
- Normalização com `String.normalize("NFD")` removendo diacríticos, aplicada ao texto agregado do protocolo e aos termos.
- O predicado de filtro atual é reorganizado: bloco de data só é avaliado quando `busca` está vazia.
- Nenhuma mudança de banco, RLS ou consultas — a lista já é carregada por `fetchAllPaginated`.
