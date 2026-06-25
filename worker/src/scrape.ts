import type { Page } from "playwright";

export type ListaItem = {
  numero: string;
  url: string | null;
  status: string | null;
  data_protocolo: string | null;
  relato: string;
};

/** Lê a listagem do 1Doc e retorna apenas linhas com marcador "Arquivado✅". */
export async function lerListaArquivados(page: Page): Promise<ListaItem[]> {
  return await page.evaluate(() => {
    const out = new Map<string, ListaItem>();
    const semAcentos = (s: string) =>
      (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const detectStatus = (t: string) => {
      if (/arquivado\s*\u2705/i.test(t)) return "arquivado_marcador";
      const n = semAcentos(t);
      if (n.includes("ja cumprido")) return "ja_cumprido";
      if (/arquivad|finaliz|baixad/i.test(t)) return "arquivado";
      return null;
    };
    const reNum = /(\d[\d.]*\s*\/\s*\d{4}|\d{6,})/;
    const reData = /\d{2}\/\d{2}\/\d{4}/;

    type ListaItem = {
      numero: string; url: string | null; status: string | null;
      data_protocolo: string | null; relato: string;
    };
    const push = (p: ListaItem) => {
      if (p.numero && !out.has(p.numero)) out.set(p.numero, p);
    };

    document.querySelectorAll("tr").forEach((tr) => {
      const text = ((tr as HTMLElement).innerText || "").replace(/\s+/g, " ").trim();
      const m = text.match(reNum);
      if (!m) return;
      const link = tr.querySelector<HTMLAnchorElement>("a[href]");
      push({
        numero: m[1].replace(/\s+/g, ""),
        url: link ? link.href : null,
        status: detectStatus(text),
        data_protocolo: (text.match(reData) || [null])[0],
        relato: text.slice(0, 500),
      });
    });
    document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      const text = (a.innerText || "").replace(/\s+/g, " ").trim();
      const ctx = ((a.closest("article,li,div,section") as HTMLElement | null)?.innerText || text)
        .replace(/\s+/g, " ").trim();
      const m = (text + " " + ctx).match(reNum);
      if (!m) return;
      push({
        numero: m[1].replace(/\s+/g, ""),
        url: a.href,
        status: detectStatus(ctx),
        data_protocolo: (ctx.match(reData) || [null])[0],
        relato: ctx.slice(0, 500),
      });
    });

    return Array.from(out.values()).filter((p) => p.status === "arquivado_marcador");
  });
}

/** Lê detalhes de um protocolo (último despacho, finalidade, status, data). */
export async function lerDetalhe(page: Page): Promise<Record<string, string>> {
  return await page.evaluate(() => {
    const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
    const detalhes: Record<string, string> = {};
    const labelMap: Record<string, string> = {
      Assunto: "assunto", Setor: "setor", Solicitante: "solicitante",
      Status: "status", "Situação": "status",
      Data: "data", "Data de cadastro": "data_cadastro",
      "Data de abertura": "data_abertura",
      "Data de finalização": "data_finalizacao",
      "Data de arquivamento": "data_arquivamento",
      "Descrição": "descricao", Mensagem: "mensagem", Relato: "relato",
      Finalidade: "finalidade",
    };
    document.querySelectorAll("dl").forEach((dl) => {
      dl.querySelectorAll("dt").forEach((dt) => {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === "DD") {
          const k = norm((dt as HTMLElement).innerText).replace(/:$/, "");
          const v = norm((dd as HTMLElement).innerText);
          if (k && v) detalhes[labelMap[k] || k] = v;
        }
      });
    });
    document.querySelectorAll("table tr").forEach((tr) => {
      const cells = tr.querySelectorAll<HTMLElement>("th,td");
      if (cells.length === 2) {
        const k = norm(cells[0].innerText).replace(/:$/, "");
        const v = norm(cells[1].innerText);
        if (k && v && k.length < 60) detalhes[labelMap[k] || k] = v;
      }
    });

    const bodyText = (document.body as HTMLElement).innerText || "";
    if (!detalhes.finalidade) {
      const mFin = bodyText.match(/Finalidade\s*\*?\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ /\-]{2,40})/);
      if (mFin) detalhes.finalidade = mFin[1].split(/\s{2,}|\n/)[0].trim();
    }

    // Último despacho — mesma heurística da extensão.
    const MAX = 20000;
    const normMulti = (s: string) =>
      (s || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
    const headers: HTMLElement[] = [];
    document.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,strong,b,.titulo,.label,.cabecalho,legend,summary",
    ).forEach((el) => {
      const t = norm(el.innerText || "");
      if (t && /^Despacho(\s|:|$|\s*n[ºo°])/i.test(t) && t.length < 400) headers.push(el);
    });
    if (headers.length) {
      const ultimo = headers[headers.length - 1];
      let bloco: HTMLElement | null = ultimo.closest(
        ".despacho,.timeline-item,.timeline__item,.item-timeline,article,section,li,.card,.box,.panel,.well,.row",
      ) || ultimo.parentElement || ultimo;
      let t = 0;
      while (bloco && (bloco.innerText || "").length < 200 && t < 4) {
        bloco = bloco.parentElement;
        t++;
      }
      const texto = normMulti((bloco as HTMLElement | null)?.innerText || "").slice(0, MAX);
      if (texto) detalhes.despacho = texto;
    }
    if (!detalhes.despacho) {
      const re = /Despacho\b[\s\S]*?(?=\n\s*(?:Despacho\b|Anexos?\b|Hist[óo]rico\b|Tramita[çc][ãa]o\b|Encaminhament|Resposta\b|$))/gi;
      let m: RegExpExecArray | null;
      let last: string | null = null;
      while ((m = re.exec(bodyText)) !== null) last = m[0];
      if (last) detalhes.despacho = normMulti(last).slice(0, MAX);
    }
    return detalhes;
  });
}