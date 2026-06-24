const $ = (id) => document.getElementById(id);
const log = (msg, cls) => {
  const el = $("log");
  el.textContent = msg;
  el.className = "";
  if (cls) el.classList.add(cls);
};

const FASE_LABEL = {
  iniciando: "Iniciando…",
  verificando_duplicados: "Verificando duplicados…",
  detalhando: "Coletando detalhes",
  enviando: "Enviando ao backend…",
  concluido: "Concluído",
  erro: "Erro",
  vazio: "Nenhum protocolo encontrado",
};

function renderProgress(p) {
  const box = $("progress");
  if (!p || !p.fase) { box.style.display = "none"; return; }
  box.style.display = "block";
  const total = p.total || 0;
  const done = p.processados || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : (p.rodando ? 5 : 100);
  $("prog-bar").style.width = pct + "%";
  $("prog-bar").style.background = p.fase === "erro" ? "#dc2626" : p.fase === "concluido" ? "#16a34a" : "#2563eb";
  $("prog-fase").textContent = (FASE_LABEL[p.fase] || p.fase) + (p.rodando ? "…" : "");
  $("prog-counts").textContent = `${done} / ${total}`;
  $("prog-ok").textContent = `✓ ${p.sucessos || 0}`;
  $("prog-err").textContent = `✕ ${p.erros || 0}`;
  const partes = [];
  if (p.atual?.numero) partes.push(`Em andamento: ${p.atual.numero} (#${p.atual.indice})`);
  if (typeof p.jaSalvos === "number") partes.push(`${p.jaSalvos} já existiam (ignorados)`);
  if (p.fase === "concluido") partes.push(`Novos: ${p.novos ?? 0} • Enviados: ${p.total ?? 0}`);
  $("prog-atual").textContent = partes.join(" • ");
  const erros = p.ultimosErros || [];
  const wrap = $("prog-erros-wrap");
  if (erros.length === 0) wrap.style.display = "none";
  else {
    wrap.style.display = "block";
    $("prog-erros").innerHTML = erros
      .map((e) => `<li>${e.numero}: ${(e.erro || "").replace(/</g, "&lt;")}</li>`).join("");
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.progress) renderProgress(changes.progress.newValue);
});

async function pollProgress() {
  const { progress } = await chrome.storage.local.get(["progress"]);
  renderProgress(progress);
  if (progress?.rodando) setTimeout(pollProgress, 600);
}

async function loadCfg() {
  try {
    const r = await fetch(chrome.runtime.getURL("defaults.json"));
    if (r.ok) {
      const def = await r.json();
      const cur = await chrome.storage.local.get(["backend", "token"]);
      const patch = {};
      if (!cur.backend && def.backend) patch.backend = def.backend;
      if (!cur.token && def.token) patch.token = def.token;
      if (Object.keys(patch).length) await chrome.storage.local.set(patch);
    }
  } catch {}
  const cfg = await chrome.storage.local.get([
    "backend", "token", "autoCloseTab", "coletarDetalhes",
    "delayDetalheMs", "maxDetalhes", "apenasJaCumprido",
  ]);
  $("backend").value = cfg.backend || "";
  $("token").value = cfg.token || "";
  $("autoCloseTab").checked = cfg.autoCloseTab !== false;
  $("coletarDetalhes").checked = cfg.coletarDetalhes !== false;
  $("delayDetalheMs").value = cfg.delayDetalheMs || 1500;
  $("maxDetalhes").value = cfg.maxDetalhes || 200;
  $("apenasJaCumprido").checked = cfg.apenasJaCumprido !== false;
  pollProgress();
}

$("salvar").addEventListener("click", async () => {
  await chrome.storage.local.set({
    backend: $("backend").value.trim().replace(/\/$/, ""),
    token: $("token").value.trim(),
  });
  log("Configurações salvas.", "ok");
});

$("salvar-opts").addEventListener("click", async () => {
  await chrome.storage.local.set({
    autoCloseTab: $("autoCloseTab").checked,
    coletarDetalhes: $("coletarDetalhes").checked,
    delayDetalheMs: Math.max(500, Number($("delayDetalheMs").value) || 1500),
    maxDetalhes: Math.max(1, Number($("maxDetalhes").value) || 200),
    apenasJaCumprido: $("apenasJaCumprido").checked,
  });
  log("Opções salvas.", "ok");
});

// Roda na aba ativa para extrair a lista
function scrapeLista() {
  const out = new Map();
  const semAcentos = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const detectStatus = (t) => {
    const n = semAcentos(t);
    if (n.includes("ja cumprido")) return "ja_cumprido";
    if (/arquivad|finaliz|baixad/i.test(t)) return "arquivado";
    return null;
  };
  const push = (p) => { if (p.numero && !out.has(p.numero)) out.set(p.numero, p); };
  const reNum = /(\d{3,}\s*\/\s*\d{2,4}|\d{6,})/;
  const reData = /\d{2}\/\d{2}\/\d{4}/;
  document.querySelectorAll("tr").forEach((tr) => {
    const text = (tr.innerText || "").replace(/\s+/g, " ").trim();
    const m = text.match(reNum);
    if (!m) return;
    const link = tr.querySelector("a[href]");
    push({
      numero: m[1].replace(/\s+/g, ""), setor: null,
      relato: text.slice(0, 500), status: detectStatus(text),
      data_protocolo: (text.match(reData) || [null])[0], url: link ? link.href : null,
    });
  });
  document.querySelectorAll("a[href]").forEach((a) => {
    const text = (a.innerText || "").replace(/\s+/g, " ").trim();
    const ctx = (a.closest("article,li,div,section")?.innerText || text).replace(/\s+/g, " ").trim();
    const m = (text + " " + ctx).match(reNum);
    if (!m) return;
    push({
      numero: m[1].replace(/\s+/g, ""), setor: null,
      relato: ctx.slice(0, 500), status: detectStatus(ctx),
      data_protocolo: (ctx.match(reData) || [null])[0], url: a.href,
    });
  });
  return Array.from(out.values());
}

$("coletar").addEventListener("click", async () => {
  const { backend = "", token = "" } = await chrome.storage.local.get(["backend", "token"]);
  if (!backend || !token) {
    log("Configure URL do backend e token primeiro (expanda 'Configurações de backend').", "err");
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/1doc\.com\.br/.test(tab.url)) {
    log("Abra uma aba do 1doc primeiro.", "err");
    return;
  }
  $("coletar").disabled = true;
  log("Lendo lista da página…");
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: scrapeLista,
    });
    const lista = result || [];
    if (lista.length === 0) {
      log("Nenhum protocolo encontrado nesta página.", "err");
      return;
    }
    log(`Encontrados ${lista.length}. Verificando duplicados e coletando…`);
    pollProgress();
    const res = await chrome.runtime.sendMessage({ type: "processar-lista", protocolos: lista });
    if (res?.ok) {
      log(`OK: ${res.novos} novos / ${res.ignorados || 0} já existiam${res.msg ? `\n${res.msg}` : ""}`, "ok");
    } else {
      log(`Falha: ${res?.msg || "erro"}`, "err");
    }
  } catch (e) {
    log(`Erro: ${e.message}`, "err");
  } finally {
    $("coletar").disabled = false;
  }
});

loadCfg();