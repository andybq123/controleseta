## Coletor 1Doc local em Python

Trocamos a pasta `worker/` (Node/TypeScript) por um script Python que roda na sua máquina, usa Playwright em Python pra abrir o 1Doc, e posta os arquivados no endpoint `/api/public/ingest-protocolos` que já existe no Lovable.

---

### Como vai funcionar

```text
Sua máquina
    │
    │ python coletor.py
    ▼
Playwright Python + Chromium local
    │
    ▼
brusque.1doc.com.br ──▶ filtra Arquivado✅, paginação, último despacho
    │
    ▼
POST https://controleseta.lovable.app/api/public/ingest-protocolos
    │ Authorization: Bearer ${INGEST_TOKEN}
    │ body: { protocolos: [...], origem: "worker" }
    ▼
Lovable atualiza protocolos + grava em "coletas"
```

Mesmo backend, mesma tabela `coletas`, mesma aba **Coletor → Histórico** com badge `worker`. Você só troca a tecnologia da execução local.

---

### O que vou criar

Nova pasta **`coletor-py/`** no projeto, com:

1. **`coletor.py`** — script único, fácil de ler:
   - Lê `.env` com `python-dotenv`.
   - Abre Chromium via `playwright.sync_api`.
   - Loga no 1Doc (`page.fill` / `page.click`).
   - Navega na lista filtrando Arquivado✅, paginando até `MAX_PROTOCOLOS`.
   - Para cada item: abre o detalhe, extrai número (`X.XXX/AAAA`, ignora `1/30`), URL, último despacho.
   - Envia o lote ao endpoint do Lovable e imprime resumo: `coletados=X atualizados=Y ignorados=Z`.

2. **`requirements.txt`**:
   ```
   playwright==1.49.0
   httpx==0.27.2
   python-dotenv==1.0.1
   ```

3. **`.env.example`**:
   ```env
   ONEDOC_BASE=https://brusque.1doc.com.br
   ONEDOC_USER=seu_login
   ONEDOC_PASS=sua_senha
   BACKEND_URL=https://controleseta.lovable.app
   INGEST_TOKEN=<mesmo dos secrets do Lovable>
   MAX_PROTOCOLOS=200
   DELAY_MS=500
   HEADLESS=false
   ```

4. **`README.md`** — passo a passo Windows/Mac/Linux (instalar Python, criar venv, `pip install`, `playwright install chromium`, copiar `.env`, `python coletor.py`).

5. **`run.bat`** (Windows) e **`run.sh`** (Mac/Linux) — clica e roda, ativa a venv e chama o script.

6. **`SCHEDULE.md`** (opcional) — como agendar 3x ao dia no Agendador de Tarefas do Windows ou no `cron` Linux/Mac.

A pasta antiga `worker/` (Node) eu **removo** pra não confundir, já que você escolheu Python. Se quiser manter pra referência, me avisa.

---

### O que você instala uma vez só

1. **Python 3.11+** (https://www.python.org/downloads/ — marcar "Add to PATH" no Windows).
2. Abrir terminal dentro de `coletor-py/`:
   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # Mac/Linux
   source .venv/bin/activate

   pip install -r requirements.txt
   playwright install chromium
   cp .env.example .env
   ```
3. Editar `.env` com seu login do 1Doc e o `INGEST_TOKEN`.
4. Rodar: `python coletor.py` (ou clicar em `run.bat`).

Da segunda vez em diante: só clicar no script.

---

### Vantagens da abordagem Python local

- **Custo zero** — nada na nuvem.
- Você vê a janela do Chromium na primeira execução (`HEADLESS=false`) e confirma login + filtro.
- Python é mais fácil de você abrir e ajustar uma linha se precisar.
- Mesmos dados → dashboard, triagem, Saúde, mapa: tudo continua igual.

### Limitações

- Só roda quando seu computador está ligado e conectado.
- O `INGEST_TOKEN` fica no `.env` local — só você acessa.
- 2FA / captcha no 1Doc continua sendo um problema potencial, mas você confirmou que é só usuário/senha.

---

### O que preciso de você antes de implementar

1. Seu **sistema operacional** (Windows, Mac ou Linux) — pra eu priorizar o `run.bat` ou `run.sh`.
2. Confirmar se já tem **Python 3.11+** instalado (`python --version`) ou se vai instalar agora.
3. Se quer já incluir as instruções de **agendamento automático** (3x ao dia) ou prefere rodar manual quando precisar.
4. Se posso **apagar a pasta `worker/`** (Node) ou prefere manter as duas.

Assim que responder, eu crio a `coletor-py/` completa e te entrego pronto pra rodar.
