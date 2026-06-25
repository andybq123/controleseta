import { chromium } from "playwright";
import { env } from "./env.js";
import { login } from "./onedoc.js";
import { lerListaArquivados, lerDetalhe } from "./scrape.js";
import { enviarParaBackend, type ProtocoloPayload } from "./ingest.js";

async function run() {
  const t0 = Date.now();
  console.log("[worker] iniciando", new Date().toISOString());

  const browser = await chromium.launch({ headless: env.headless });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: "pt-BR",
  });
  const page = await context.newPage();

  try {
    console.log("[worker] login no 1Doc…");
    await login(page);

    console.log("[worker] abrindo listagem:", env.listUrl);
    await page.goto(env.listUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const lista = await lerListaArquivados(page);
    console.log(`[worker] arquivados encontrados: ${lista.length}`);

    if (lista.length === 0) {
      console.log("[worker] nada a enviar. encerrando.");
      return;
    }

    const limite = Math.min(lista.length, env.maxProtocolos);
    const payload: ProtocoloPayload[] = [];

    for (let i = 0; i < limite; i++) {
      const p = lista[i];
      const url = p.url;
      let detalhes: Record<string, string> | null = null;
      if (url) {
        const detPage = await context.newPage();
        try {
          await detPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await detPage.waitForTimeout(1500);
          detalhes = await lerDetalhe(detPage);
        } catch (e: any) {
          console.warn(`[worker] falha detalhe ${p.numero}: ${e?.message}`);
          detalhes = { erro_coleta_detalhe: String(e?.message || e) };
        } finally {
          await detPage.close().catch(() => {});
        }
      }
      payload.push({ ...p, setor: null, detalhes });
      console.log(`[worker] ${i + 1}/${limite} ${p.numero}`);
      if (i < limite - 1) await sleep(env.delayMs);
    }

    console.log("[worker] enviando ao backend…");
    const res = (await enviarParaBackend(payload)) as any;
    console.log("[worker] resposta:", JSON.stringify(res));
    console.log(`[worker] concluído em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

run().catch((e) => {
  console.error("[worker] erro fatal:", e);
  process.exit(1);
});