const BASE = "https://brusque.1doc.com.br";

async function loadDefaults() {
  try {
    const r = await fetch(chrome.runtime.getURL("defaults.json"));
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function aplicarDefaults() {
  const def = await loadDefaults();
  if (!def) return;
  const cur = await chrome.storage.local.get(["backend", "token"]);
  const patch = {};
  if (!cur.backend && def.backend) patch.backend = def.backend;
  if (!cur.token && def.token) patch.token = def.token;
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
}

// Roda na página de detalhe do protocolo (pg=doc/ver&hash=...)
function scrapeDetalhe() {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const labelMap = {
    "Assunto": "assunto", "Setor": "setor", "Solicitante": "solicitante",
    "Status": "status", "Situação": "status", "Data": "data",
    "Data de cadastro": "data_cadastro", "Data de abertura": "data_abertura",
    "Data de finalização": "data_finalizacao", "Data de arquivamento": "data_arquivamento",
    "Origem": "origem", "Tipo": "tipo", "Documento": "documento",
    "Prazo": "prazo", "Protocolo": "protocolo", "Responsável": "responsavel",
    "E-mail": "email", "Telefone": "telefone", "Endereço": "endereco",
    "Descrição": "descricao", "Mensagem": "mensagem", "Relato": "relato",
  };
  const detalhes = {};
  document.querySelectorAll("dl").forEach((dl) => {
    dl.querySelectorAll("dt").forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === "DD") {
        const k = norm(dt.innerText).replace(/:$/, "");
        const v = norm(dd.innerText);
        if (k && v) detalhes[k] = v;
      }
    });
  });
  document.querySelectorAll("table tr").forEach((tr) => {
    const cells = tr.querySelectorAll("th,td");
    if (cells.length === 2) {
      const k = norm(cells[0].innerText).replace(/:$/, "");
      const v = norm(cells[1].innerText);
      if (k && v && k.length < 60) detalhes[k] = v;
    }
  });
  document.querySelectorAll("label,strong,b,.label,.titulo,.field-label").forEach((el) => {
    const k = norm(el.innerText).replace(/:$/, "");
    if (!k || k.length > 60) return;
    let v = "";
    let sib = el.nextSibling;
    while (sib && !v) { v = norm(sib.textContent || ""); sib = sib.nextSibling; }
    if (!v) {
      const parent = el.parentElement;
      if (parent) {
        const clone = parent.cloneNode(true);
        clone.querySelectorAll("label,strong,b,.label,.titulo,.field-label").forEach((n) => n.remove());
        v = norm(clone.textContent || "");
      }
    }
    if (k && v && !detalhes[k]) detalhes[k] = v;
  });
  const main = document.querySelector("#conteudo, .conteudo, main, .container, #main, .doc-conteudo, .ver-doc") || document.body;
  const textoCompleto = norm(main.innerText).slice(0, 15000);
  const padronizado = {};
  Object.entries(detalhes).forEach(([k, v]) => { padronizado[labelMap[k] || k] = v; });
  const semAcentos = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const alvo = "deu baixa manualmente no prazo";
  const haystack = semAcentos(norm(main.innerText));
  const idx = haystack.indexOf(alvo);
  let trecho = null;
  if (idx >= 0) {
    const t = norm(main.innerText);
    trecho = t.slice(Math.max(0, idx - 80), Math.min(t.length, idx + alvo.length + 80));
  }
  padronizado.baixa_manual_no_prazo = idx >= 0 ? "sim" : "nao";
  if (trecho) padronizado.baixa_manual_trecho = trecho;
  return {
    detalhes: padronizado,
    setor: padronizado.setor || null,
    status: padronizado.status || null,
    relato: padronizado.descricao || padronizado.mensagem || padronizado.relato || textoCompleto,
    data_protocolo: padronizado.data || padronizado.data_abertura || padronizado.data_cadastro || null,
  };
}

function waitForTabLoad(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("timeout aguardando carregamento"));
    }, timeoutMs);
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => {
      if (t && t.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }).catch(() => {});
  });
}

function normalizeUrl(u) {
  if (!u) return null;
  if (u.startsWith("http")) return u;
  if (u.startsWith("/")) return BASE + u;
  return BASE + "/" + u;
}

async function setProgress(patch) {
  const { progress = {} } = await chrome.storage.local.get(["progress"]);
  const next = { ...progress, ...patch, atualizadoEm: Date.now() };
  await chrome.storage.local.set({ progress: next });
  return next;
}

async function resetProgress() {
  await chrome.storage.local.set({
    progress: {
      rodando: true, fase: "iniciando", total: 0, processados: 0,
      sucessos: 0, erros: 0, atual: null, ultimosErros: [],
      iniciadoEm: Date.now(), atualizadoEm: Date.now(),
    },
  });
}

async function coletarDetalhe(protocolo, autoCloseTab) {
  const url = normalizeUrl(protocolo.url);
  if (!url || !/hash=/i.test(url)) return { __ok: false, __erro: "sem url de detalhe", ...protocolo };
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabLoad(tab.id, 30000);
    await new Promise((r) => setTimeout(r, 2500));
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: scrapeDetalhe,
    });
    if (result) {
      return {
        __ok: true, ...protocolo,
        setor: result.setor || protocolo.setor,
        status: result.status || protocolo.status,
        relato: result.relato || protocolo.relato,
        data_protocolo: result.data_protocolo || protocolo.data_protocolo,
        detalhes: result.detalhes || null, url,
      };
    }
    return { __ok: false, __erro: "sem dados", ...protocolo };
  } catch (e) {
    return { __ok: false, __erro: e.message, ...protocolo, detalhes: { erro_coleta_detalhe: e.message } };
  } finally {
    if (tab && autoCloseTab !== false) {
      try { await chrome.tabs.remove(tab.id); } catch {}
    }
  }
}

// Recebe lista já lida da aba ativa pelo popup e processa: dedup + detalhes + envio
async function processarLista(protocolos) {
  const {
    backend = "", token = "", autoCloseTab = true,
    coletarDetalhes = true, delayDetalheMs = 1500, maxDetalhes = 200,
    apenasArquivado = true,
  } = await chrome.storage.local.get([
    "backend", "token", "autoCloseTab", "coletarDetalhes",
    "delayDetalheMs", "maxDetalhes", "apenasArquivado",
  ]);
  if (!backend || !token) return { ok: false, msg: "Configure backend e token." };
  if (!Array.isArray(protocolos) || protocolos.length === 0) {
    return { ok: false, msg: "Nada para processar." };
  }

  await resetProgress();
  try {
    const totalBruto = protocolos.length;
    let lista = protocolos;

    if (apenasArquivado !== false) {
      lista = lista.filter((p) => p.status === "arquivado_marcador");
      await setProgress({ totalBruto, filtrados: lista.length, filtro: "arquivado_marcador" });
      if (lista.length === 0) {
        await setProgress({ rodando: false, fase: "vazio" });
        return { ok: true, novos: 0, ignorados: 0, total: 0, msg: `Nenhum 'Arquivado✅' (de ${totalBruto}).` };
      }
    }

    // Não pré-filtramos: enviamos TUDO e o backend decide se reprocessa,
    // ignora (já concluído) ou avisa que não existe correspondência.
    await setProgress({ novos: lista.length });

    if (coletarDetalhes) {
      const limite = Math.min(lista.length, Math.max(1, Number(maxDetalhes) || 200));
      await setProgress({ fase: "detalhando", total: limite, processados: 0, sucessos: 0, erros: 0 });
      const detalhados = [];
      const ultimosErros = [];
      for (let i = 0; i < limite; i++) {
        const p = lista[i];
        await setProgress({ atual: { numero: p.numero, indice: i + 1 } });
        const det = await coletarDetalhe(p, autoCloseTab);
        const ok = det.__ok !== false;
        if (!ok) { ultimosErros.unshift({ numero: p.numero, erro: det.__erro || "erro" }); ultimosErros.splice(10); }
        delete det.__ok; delete det.__erro;
        detalhados.push(det);
        const prev = (await chrome.storage.local.get(["progress"])).progress || {};
        await setProgress({
          processados: i + 1,
          sucessos: (prev.sucessos || 0) + (ok ? 1 : 0),
          erros: (prev.erros || 0) + (ok ? 0 : 1),
          ultimosErros,
        });
        if (i < limite - 1) await new Promise((r) => setTimeout(r, Math.max(100, Number(delayDetalheMs) || 500)));
      }
      lista = detalhados.concat(lista.slice(limite));
    }

    await setProgress({ fase: "enviando", atual: null });
    const res = await fetch(`${backend.replace(/\/$/, "")}/api/public/ingest-protocolos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ protocolos: lista }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await setProgress({ rodando: false, fase: "erro" });
      return { ok: false, msg: data.error || `Falha ${res.status}` };
    }
    await setProgress({ rodando: false, fase: "concluido", novos: data.atualizados ?? data.novos ?? 0, total: data.total });
    return {
      ok: true,
      novos: data.atualizados ?? data.novos ?? 0,
      ignorados: data.ignorados || 0,
      jaConcluidos: data.jaConcluidos || 0,
      jaConcluidosLista: data.jaConcluidosLista || [],
      semCorrespondenciaLista: data.semCorrespondenciaLista || [],
      total: data.total,
    };
  } catch (e) {
    await setProgress({ rodando: false, fase: "erro" });
    return { ok: false, msg: e.message };
  }
}

chrome.runtime.onInstalled.addListener(() => { aplicarDefaults(); });
chrome.runtime.onStartup.addListener(() => { aplicarDefaults(); });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "processar-lista") {
    processarLista(msg.protocolos).then(sendResponse);
    return true;
  }
});