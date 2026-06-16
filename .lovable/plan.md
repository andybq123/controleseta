## Objetivo
Dentro de `/protocolos-antigos`, fazer o filtro **"Atrasadas"** refletir exatamente a lista das abas **"Ouvidorias atrasadas"** das duas planilhas (Brusque + Saúde), em vez do filtro atual baseado no texto da coluna situação.

## Passos

1. **Extrair as atrasadas das planilhas** (script único, executado uma vez)
   - Ler `Gestão_Ouvidoria_Brusque.xlsx` aba "Ouvidorias atrasadas" → 869 linhas
   - Ler `Gestão_Ouvidoria_Saúde.xlsx` aba "Ouvidorias atrasadas" → 857 linhas
   - Para cada linha válida (coluna B = data), extrair: `source` (Brusque/Saúde), `numero`, `data`, `setor`, `origem` (IPM/1Doc)
   - Gravar em `src/data/ouvidorias-atrasadas.json`

2. **Aplicar na página `protocolos-antigos.index.tsx`**
   - Importar o novo JSON e montar um `Set<string>` com chaves `${source}|${numero}`
   - No filtro rápido "Atrasadas", trocar a regra atual (`r.situacao !== "Em dia"`) por `atrasadasSet.has(${r.source}|${r.numero})`
   - Adicionar um badge vermelho "Atrasada" na tabela nas linhas que estão no set (independente do filtro), para destaque visual
   - Atualizar o KPI/contagem de "Atrasadas" no topo para usar o set também

## Arquivos
- novo: `src/data/ouvidorias-atrasadas.json`
- edita: `src/routes/_authenticated/protocolos-antigos.index.tsx`

Nada de backend, nada de nova rota — só atualizar a aba "Atrasadas" existente conforme você pediu.