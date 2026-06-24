# Coletor de Protocolos 1doc

Extensão de navegador (Chrome / Edge / Brave) que lê a lista de protocolos
arquivados do 1doc na aba ativa, busca os detalhes de cada um e envia para
este painel.

## Como instalar

1. Baixe a pasta `extension/` deste projeto.
2. Abra `chrome://extensions` (ou `edge://extensions`).
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta `extension/`.
5. Fixe o ícone na barra para acesso rápido.

## Configurar

1. Clique no ícone da extensão e abra **Configurações de backend**.
2. **URL do backend:** `https://controleseta.lovable.app` (já vem preenchida).
3. **Token:** cole o valor do segredo `INGEST_TOKEN` do painel.
4. Clique em **Salvar**.

## Usar

1. Faça login no 1doc e abra a listagem de Ouvidorias arquivadas / já cumpridas.
2. Clique no ícone da extensão.
3. Ajuste as opções (manter "Apenas status já cumprido" marcado, se for o caso).
4. Clique em **Coletar da aba atual**.

A extensão dedup‑lica contra o painel, abre cada protocolo para coletar os
detalhes e envia tudo de uma vez. O histórico das execuções fica na tabela
`coletas`.