# Coletor 1Doc — Python local

Script local em Python que loga no 1Doc, lê os protocolos marcados com
**Arquivado✅**, extrai o último despacho de cada um e envia o lote para o
endpoint `/api/public/ingest-protocolos` do app no Lovable. O backend
atualiza os protocolos correspondentes (status `concluido`, URL do 1Doc,
Resolução = último despacho) e registra a execução na aba **Coletor →
Histórico** com badge `worker`.

## 1) Pré-requisitos

- **Python 3.11+** — https://www.python.org/downloads/
  (no Windows marque "Add Python to PATH" durante a instalação).
- O `INGEST_TOKEN` do projeto (mesmo valor que está nos Secrets do Lovable).
- Login e senha do 1Doc.

## 2) Instalação (uma vez só)

Abra um terminal **dentro da pasta `coletor-py/`** e rode:

### Windows (PowerShell ou CMD)

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium
copy .env.example .env
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env
```

Depois edite o arquivo **`.env`** preenchendo `ONEDOC_USER`, `ONEDOC_PASS` e
`INGEST_TOKEN`. Deixe `HEADLESS=false` na primeira execução pra ver a janela
do Chromium e confirmar que o login está OK.

## 3) Rodar

### Modo simples (recomendado)

- **Windows**: dê dois cliques em `run.bat`.
- **macOS / Linux**: `./run.sh` (na primeira vez: `chmod +x run.sh`).

O script ativa a venv, garante dependências instaladas e roda `coletor.py`.

### Modo manual

```bash
source .venv/bin/activate     # Windows: .venv\Scripts\activate
python coletor.py
```

## 4) O que esperar

Saída típica:

```
[coletor] iniciando — backend=https://controleseta.lovable.app  headless=false
[coletor] login no 1Doc…
[coletor] abrindo lista: https://brusque.1doc.com.br/?pg=doc/lst
[coletor] arquivados encontrados: 17
[coletor] 1/17  2.078/2026
[coletor] 2/17  2.084/2026
...
[coletor] enviando 17 protocolos ao backend…
[coletor] resposta: {'sucesso': True, 'total': 17, 'atualizados': 12, 'jaConcluidos': 5, ...}
[coletor] concluído em 38.4s
```

Depois é só abrir o app e conferir em **Coletor → Auditoria** / **Histórico**.

## 5) Variáveis (`.env`)

| Variável          | Padrão                                  | O que faz                                                  |
|-------------------|------------------------------------------|------------------------------------------------------------|
| `ONEDOC_BASE`     | `https://brusque.1doc.com.br`            | URL base do 1Doc.                                          |
| `ONEDOC_USER`     | —                                        | Seu login.                                                 |
| `ONEDOC_PASS`     | —                                        | Sua senha.                                                 |
| `ONEDOC_LIST_URL` | `${ONEDOC_BASE}/?pg=doc/lst`             | Página da listagem onde aparece Arquivado✅.               |
| `BACKEND_URL`     | `https://controleseta.lovable.app`       | URL pública do app Lovable.                                |
| `INGEST_TOKEN`    | —                                        | Mesmo token configurado nos Secrets do projeto.            |
| `MAX_PROTOCOLOS`  | `200`                                    | Quantos arquivados processar por execução.                 |
| `DELAY_MS`        | `500`                                    | Pausa entre abrir cada detalhe (mínimo 100).               |
| `HEADLESS`        | `false`                                  | `true` esconde a janela. Use `false` na primeira vez.      |

## 6) Agendar automaticamente

Veja `SCHEDULE.md` para rodar 3x ao dia (Windows / macOS / Linux).

## 7) Problemas comuns

- **`python: command not found`** → use `python3` (macOS/Linux) ou reinstale
  o Python marcando "Add to PATH" (Windows).
- **Janela do navegador não aparece** → verifique `HEADLESS=false` no `.env`.
- **`Backend 401`** → `INGEST_TOKEN` no `.env` está diferente do Secret no
  Lovable. Copie o valor exato da aba Coletor → Extensão (ou Secrets).
- **`arquivados encontrados: 0`** → o filtro Arquivado✅ não está aplicado
  na URL. Abra o 1Doc manualmente, aplique o filtro, copie a URL e cole em
  `ONEDOC_LIST_URL` no `.env`.
- **Login falha** → confirme usuário/senha; rode com `HEADLESS=false` pra
  ver o que está acontecendo.