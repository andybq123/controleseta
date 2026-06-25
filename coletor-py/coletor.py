"""Coletor 1Doc local em Python.

Loga no 1Doc, lê os protocolos marcados com "Arquivado✅", abre cada
detalhe para extrair o último despacho e posta o lote em
/api/public/ingest-protocolos do app Lovable.

Uso:
    cp .env.example .env   # preencher credenciais
    python -m venv .venv
    source .venv/bin/activate   # ou .venv\\Scripts\\activate no Windows
    pip install -r requirements.txt
    python -m playwright install chromium
    python coletor.py
"""
from __future__ import annotations

import os
import sys
import time
from typing import Any

import httpx
from dotenv import load_dotenv
from playwright.sync_api import Page, sync_playwright

load_dotenv()


def _must(name: str) -> str:
    v = os.environ.get(name, "").strip()
    if not v:
        print(f"[coletor] ERRO: variável de ambiente {name} não definida (veja .env)")
        sys.exit(2)
    return v


BASE = _must("ONEDOC_BASE").rstrip("/")
USER = _must("ONEDOC_USER")
PASS = _must("ONEDOC_PASS")
LIST_URL = os.environ.get("ONEDOC_LIST_URL", "").strip() or f"{BASE}/?pg=doc/lst"
BACKEND_URL = _must("BACKEND_URL").rstrip("/")
INGEST_TOKEN = _must("INGEST_TOKEN")
MAX_PROTOCOLOS = int(os.environ.get("MAX_PROTOCOLOS", "200"))
DELAY_MS = max(100, int(os.environ.get("DELAY_MS", "500")))
HEADLESS = (os.environ.get("HEADLESS", "true").lower() != "false")


# -------------------- Login --------------------

def first_visible(page: Page, selectors: list[str]) -> str | None:
    for sel in selectors:
        loc = page.locator(sel).first
        try:
            if loc.count() > 0 and loc.is_visible():
                return sel
        except Exception:
            continue
    return None


def login(page: Page) -> None:
    page.goto(BASE, wait_until="domcontentloaded")
    user_sel = first_visible(page, [
        'input[name="usuario"]', 'input[name="login"]',
        'input[name="email"]', 'input[type="text"]',
    ])
    pass_sel = first_visible(page, [
        'input[name="senha"]', 'input[name="password"]', 'input[type="password"]',
    ])
    if not user_sel or not pass_sel:
        # talvez já esteja logado via cookie
        return
    page.fill(user_sel, USER)
    page.fill(pass_sel, PASS)
    submit = first_visible(page, [
        'button[type="submit"]', 'input[type="submit"]',
        'button:has-text("Entrar")', 'button:has-text("Acessar")',
    ])
    if submit:
        page.click(submit)
    else:
        page.keyboard.press("Enter")
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(1500)


# -------------------- Scrape (porta do worker TS) --------------------

LISTA_JS = r"""
() => {
  const out = new Map();
  const semAcentos = (s) => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const detectStatus = (t) => {
    if (/arquivado\s*\u2705/i.test(t)) return "arquivado_marcador";
    const n = semAcentos(t);
    if (n.includes("ja cumprido")) return "ja_cumprido";
    if (/arquivad|finaliz|baixad/i.test(t)) return "arquivado";
    return null;
  };
  const reNum = /(\d[\d.]*\s*\/\s*\d{4}|\d{6,})/;
  const reData = /\d{2}\/\d{2}\/\d{4}/;
  const push = (p) => { if (p.numero && !out.has(p.numero)) out.set(p.numero, p); };

  document.querySelectorAll("tr").forEach((tr) => {
    const text = (tr.innerText || "").replace(/\s+/g," ").trim();
    const m = text.match(reNum); if (!m) return;
    const link = tr.querySelector("a[href]");
    push({
      numero: m[1].replace(/\s+/g,""),
      url: link ? link.href : null,
      status: detectStatus(text),
      data_protocolo: (text.match(reData) || [null])[0],
      relato: text.slice(0,500),
    });
  });
  document.querySelectorAll("a[href]").forEach((a) => {
    const text = (a.innerText || "").replace(/\s+/g," ").trim();
    const ctx = ((a.closest("article,li,div,section")?.innerText) || text).replace(/\s+/g," ").trim();
    const m = (text + " " + ctx).match(reNum); if (!m) return;
    push({
      numero: m[1].replace(/\s+/g,""),
      url: a.href,
      status: detectStatus(ctx),
      data_protocolo: (ctx.match(reData) || [null])[0],
      relato: ctx.slice(0,500),
    });
  });
  return Array.from(out.values()).filter((p) => p.status === "arquivado_marcador");
}
"""

DETALHE_JS = r"""
() => {
  const norm = (s) => (s||"").replace(/\s+/g," ").trim();
  const labelMap = {
    "Assunto":"assunto","Setor":"setor","Solicitante":"solicitante",
    "Status":"status","Situação":"status","Data":"data",
    "Data de cadastro":"data_cadastro","Data de abertura":"data_abertura",
    "Data de finalização":"data_finalizacao","Data de arquivamento":"data_arquivamento",
    "Descrição":"descricao","Mensagem":"mensagem","Relato":"relato","Finalidade":"finalidade",
  };
  const detalhes = {};
  document.querySelectorAll("dl").forEach((dl) => {
    dl.querySelectorAll("dt").forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === "DD") {
        const k = norm(dt.innerText).replace(/:$/,"");
        const v = norm(dd.innerText);
        if (k && v) detalhes[labelMap[k]||k] = v;
      }
    });
  });
  document.querySelectorAll("table tr").forEach((tr) => {
    const cells = tr.querySelectorAll("th,td");
    if (cells.length === 2) {
      const k = norm(cells[0].innerText).replace(/:$/,"");
      const v = norm(cells[1].innerText);
      if (k && v && k.length < 60) detalhes[labelMap[k]||k] = v;
    }
  });

  const bodyText = document.body.innerText || "";
  if (!detalhes.finalidade) {
    const mFin = bodyText.match(/Finalidade\s*\*?\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ /\-]{2,40})/);
    if (mFin) detalhes.finalidade = mFin[1].split(/\s{2,}|\n/)[0].trim();
  }

  const MAX = 20000;
  const normMulti = (s) => (s||"")
    .replace(/\r/g,"").replace(/[ \t]+\n/g,"\n")
    .replace(/\n{3,}/g,"\n\n").replace(/[ \t]{2,}/g," ").trim();

  const headers = [];
  document.querySelectorAll("h1,h2,h3,h4,h5,h6,strong,b,.titulo,.label,.cabecalho,legend,summary")
    .forEach((el) => {
      const t = norm(el.innerText || "");
      if (t && /^Despacho(\s|:|$|\s*n[ºo°])/i.test(t) && t.length < 400) headers.push(el);
    });
  if (headers.length) {
    const ultimo = headers[headers.length - 1];
    let bloco = ultimo.closest(".despacho,.timeline-item,.timeline__item,.item-timeline,article,section,li,.card,.box,.panel,.well,.row") || ultimo.parentElement || ultimo;
    let t = 0;
    while (bloco && (bloco.innerText || "").length < 200 && t < 4) { bloco = bloco.parentElement; t++; }
    const texto = normMulti(bloco?.innerText || "").slice(0, MAX);
    if (texto) detalhes.despacho = texto;
  }
  if (!detalhes.despacho) {
    const re = /Despacho\b[\s\S]*?(?=\n\s*(?:Despacho\b|Anexos?\b|Hist[óo]rico\b|Tramita[çc][ãa]o\b|Encaminhament|Resposta\b|$))/gi;
    let m, last = null;
    while ((m = re.exec(bodyText)) !== null) last = m[0];
    if (last) detalhes.despacho = normMulti(last).slice(0, MAX);
  }
  return detalhes;
}
"""


def ler_lista_arquivados(page: Page) -> list[dict[str, Any]]:
    return page.evaluate(LISTA_JS)


def ler_detalhe(page: Page) -> dict[str, Any]:
    return page.evaluate(DETALHE_JS)


# -------------------- Ingest --------------------

def enviar(payload: list[dict[str, Any]]) -> dict[str, Any]:
    url = f"{BACKEND_URL}/api/public/ingest-protocolos"
    with httpx.Client(timeout=60) as client:
        r = client.post(
            url,
            json={"protocolos": payload, "origem": "worker"},
            headers={
                "Authorization": f"Bearer {INGEST_TOKEN}",
                "Content-Type": "application/json",
            },
        )
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text}
        if r.status_code >= 400:
            raise RuntimeError(f"Backend {r.status_code}: {data}")
        return data


# -------------------- Orquestração --------------------

def run() -> int:
    t0 = time.time()
    print(f"[coletor] iniciando — backend={BACKEND_URL}  headless={HEADLESS}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        context = browser.new_context(viewport={"width": 1366, "height": 900}, locale="pt-BR")
        page = context.new_page()
        try:
            print("[coletor] login no 1Doc…")
            login(page)

            print(f"[coletor] abrindo lista: {LIST_URL}")
            page.goto(LIST_URL, wait_until="domcontentloaded")
            page.wait_for_timeout(2000)

            lista = ler_lista_arquivados(page)
            print(f"[coletor] arquivados encontrados: {len(lista)}")
            if not lista:
                print("[coletor] nada a enviar.")
                return 0

            limite = min(len(lista), MAX_PROTOCOLOS)
            payload: list[dict[str, Any]] = []

            for i in range(limite):
                p_item = lista[i]
                detalhes: dict[str, Any] | None = None
                url = p_item.get("url")
                if url:
                    det_page = context.new_page()
                    try:
                        det_page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        det_page.wait_for_timeout(1500)
                        detalhes = ler_detalhe(det_page)
                    except Exception as e:
                        print(f"[coletor] falha detalhe {p_item.get('numero')}: {e}")
                        detalhes = {"erro_coleta_detalhe": str(e)}
                    finally:
                        try:
                            det_page.close()
                        except Exception:
                            pass
                payload.append({**p_item, "setor": None, "detalhes": detalhes})
                print(f"[coletor] {i + 1}/{limite}  {p_item.get('numero')}")
                if i < limite - 1:
                    time.sleep(DELAY_MS / 1000)

            print(f"[coletor] enviando {len(payload)} protocolos ao backend…")
            res = enviar(payload)
            print(f"[coletor] resposta: {res}")
        finally:
            context.close()
            browser.close()

    dur = time.time() - t0
    print(f"[coletor] concluído em {dur:.1f}s")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(run())
    except KeyboardInterrupt:
        print("\n[coletor] interrompido pelo usuário")
        sys.exit(130)
    except Exception as e:
        print(f"[coletor] erro fatal: {e}")
        sys.exit(1)