# Coletor 1Doc — Worker (Playwright)

Worker headless que faz o que a extensão de navegador faz, mas roda sozinho
num servidor (Railway). Usa o **mesmo endpoint** do app principal
(`/api/public/ingest-protocolos`) e aparece com origem `worker` na aba
**Coletor → Histórico/Auditoria**.

## Fluxo

1. Abre o 1Doc e faz login com `ONEDOC_USER` / `ONEDOC_PASS`.
2. Vai até `ONEDOC_LIST_URL` e lê toda a página, filtrando linhas com o
   marcador **Arquivado✅**.
3. Para cada protocolo, abre o detalhe e extrai o último despacho,
   finalidade, status e link.
4. Envia o lote pro backend Lovable (`POST /api/public/ingest-protocolos`).

## Deploy no Railway

1. Crie um repositório novo no GitHub e copie o conteúdo desta pasta
   `worker/` pra raiz dele.
2. No Railway, **New Project → Deploy from GitHub** e selecione o repo.
3. Em **Variables**, configure:

   | Variável | Exemplo |
   | --- | --- |
   | `ONEDOC_BASE` | `https://brusque.1doc.com.br` |
   | `ONEDOC_USER` | seu login |
   | `ONEDOC_PASS` | sua senha |
   | `ONEDOC_LIST_URL` | URL da listagem de ouvidorias (opcional) |
   | `BACKEND_URL` | `https://controleseta.lovable.app` |
   | `INGEST_TOKEN` | mesmo token usado pela extensão |
   | `MAX_PROTOCOLOS` | `200` (opcional) |
   | `DELAY_MS` | `500` (opcional, mínimo 100) |
   | `HEADLESS` | `true` |

4. Em **Settings → Cron Schedule**, cole: `0 7,13,19 * * *`
   (3x ao dia: 7h, 13h e 19h).
5. Faça um **Deploy** manual pra validar — o log do Railway mostra
   `[worker] arquivados encontrados: N` e depois `[worker] resposta: …`.

## Rodando local

```bash
cp .env.example .env
# preencha credenciais
npm install
npx playwright install chromium
npm run dev
```

## Ajustes comuns

- **Login não funciona**: ajuste os seletores em `src/onedoc.ts`. Por
  padrão tenta `input[name="usuario"]`, `name="senha"` e variações.
- **Listagem vazia**: verifique se `ONEDOC_LIST_URL` aponta pra página
  que mostra o marcador `Arquivado✅`. Pode ser preciso passar filtros
  na URL (ex.: `?pg=doc/lst&status=arquivado`).
- **Captcha/2FA**: este worker assume login simples usuário+senha.