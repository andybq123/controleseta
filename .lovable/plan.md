## Implementação — Worker Playwright no Railway

Confirmado: 1Doc só usa usuário + senha, sem 2FA. Como Lovable não cria repositórios no seu GitHub, eu vou montar todos os arquivos do worker dentro do projeto, numa pasta `worker/`. Depois você só copia essa pasta pra um repositório novo no GitHub e conecta no Railway (passo a passo no fim do plano).

---

### O que vou criar / alterar

**1. Pasta `worker/` (novo subprojeto, isolado do app Lovable)**
- `worker/Dockerfile` — base `mcr.microsoft.com/playwright:v1.49.0-jammy`, instala deps e roda `node dist/index.js`.
- `worker/package.json` — `playwright`, `zod`, `tsx`, `typescript`.
- `worker/tsconfig.json`.
- `worker/src/index.ts` — orquestra: login → lista arquivados → para cada um, abre detalhe → POST no backend.
- `worker/src/onedoc.ts` — login no 1Doc com `page.fill` + `page.click`, salva `storageState` em memória.
- `worker/src/scrape.ts` — porta a heurística atual do `extension/background.js` (último despacho, finalidade, status, link, número).
- `worker/src/ingest.ts` — POST `${BACKEND_URL}/api/public/ingest-protocolos` com `Authorization: Bearer ${INGEST_TOKEN}` e `{ protocolos: [...], origem: "worker" }`.
- `worker/railway.json` — define cron `0 7,13,19 * * *` e comando de execução.
- `worker/.env.example` — documenta as variáveis.
- `worker/README.md` — como subir no Railway.

**2. Pequena migração no app Lovable** (executo via tool de migration):
- `ALTER TABLE coletas ADD COLUMN origem text NOT NULL DEFAULT 'extensao'`.

**3. Ajuste em `src/routes/api/public/ingest-protocolos.ts`**
- Aceitar campo opcional `origem: "extensao" | "worker"` no body.
- Gravar esse valor na linha de `coletas` ao final.

**4. Ajuste em `src/routes/_authenticated/coletor.tsx`**
- Aba **Histórico**: nova coluna "Origem" (badge azul `worker` / cinza `extensão`).
- Aba **Auditoria**: mostrar a origem da última execução.

---

### Variáveis que você vai configurar no Railway

| Variável | Valor |
| --- | --- |
| `ONEDOC_BASE` | `https://brusque.1doc.com.br` |
| `ONEDOC_USER` | seu login |
| `ONEDOC_PASS` | sua senha |
| `BACKEND_URL` | `https://controleseta.lovable.app` |
| `INGEST_TOKEN` | mesmo que está nos secrets do projeto |
| `MAX_PROTOCOLOS` | `200` (opcional) |
| `DELAY_MS` | `500` (opcional) |
| `HEADLESS` | `true` |

---

### Passo a passo pra você depois que eu terminar

1. Criar repositório vazio no GitHub (ex.: `coletor-1doc-worker`).
2. Copiar o conteúdo da pasta `worker/` deste projeto pra dentro do repositório novo e dar `git push`.
3. No Railway → **New Project → Deploy from GitHub** e selecionar o repositório.
4. Em **Variables**, colar as variáveis da tabela acima.
5. Em **Settings → Cron Schedule**, colar `0 7,13,19 * * *` (3x ao dia).
6. Rodar manualmente uma vez pelo botão **Deploy** pra validar — o log vai mostrar quantos arquivados encontrou e quantos o backend atualizou; também aparece na aba **Coletor → Auditoria** com origem `worker`.

---

### Riscos previstos

- Se o seletor de login do 1Doc mudar, o worker quebra no login — eu deixo log claro nesse passo pra você identificar rápido.
- Se uma execução voltar 0 arquivados (e antes vinha vindo), provavelmente a sessão expirou ou o layout mudou; ajustamos o seletor.
- Railway Hobby (5 USD grátis/mês) cobre essa carga sobrando.

Confirma que pode seguir nessa estrutura? Assim que aprovar, eu implemento tudo de uma vez.
