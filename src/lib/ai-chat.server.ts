// Cache the resolved config for a short period so we don't hit the DB on every call.
let cached: { at: number; provider: "lovable" | "gemini"; apiKey: string | null; model: string | null } | null = null;
const TTL_MS = 30_000;

async function loadConfig() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  try {
    // Uses service role so it works from any server context (ingest, cron, server fns).
    // ai_config is a single admin-only row; reading it from the server has no user impact.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("ai_config").select("provider, api_key, model").eq("id", true).maybeSingle();
    cached = {
      at: Date.now(),
      provider: (data?.provider as any) === "gemini" ? "gemini" : "lovable",
      apiKey: data?.api_key ?? null,
      model: data?.model ?? null,
    };
  } catch {
    cached = { at: Date.now(), provider: "lovable", apiKey: null, model: null };
  }
  return cached;
}

export function invalidateAiConfigCache() {
  cached = null;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AiChatOptions {
  messages: ChatMessage[];
  /** Optional model override; when unset uses configured model or provider default. */
  model?: string;
  responseFormat?: "json_object";
}

export type AiProviderUsed = "gemini" | "lovable";

export interface AiChatResult {
  content: string;
  provider: AiProviderUsed;
  model: string;
}

/**
 * Unified chat-completion helper. Dispatches to Lovable AI Gateway or Google
 * Gemini (OpenAI-compatible endpoint) based on the row saved in public.ai_config.
 */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callGemini(apiKey: string, model: string, messages: ChatMessage[], responseFormat?: "json_object") {
  const body: any = { model, messages };
  if (responseFormat === "json_object") body.response_format = { type: "json_object" };
  return fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callLovable(model: string, messages: ChatMessage[], responseFormat?: "json_object") {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
  const body: any = { model, messages };
  if (responseFormat === "json_object") body.response_format = { type: "json_object" };
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function aiChatDetailed({ messages, model, responseFormat }: AiChatOptions): Promise<AiChatResult> {
  const cfg = await loadConfig();

  if (cfg.provider === "gemini") {
    const apiKey = cfg.apiKey?.trim();
    if (!apiKey) throw new Error("Gemini selecionado, mas a API key não está configurada em Configurações > IA.");
    const chosen = model || cfg.model || "gemini-2.5-flash";

    // Cascata de modelos Gemini: começa pelo escolhido e degrada para modelos
    // mais leves/estáveis quando houver sobrecarga (503) ou instabilidade (5xx).
    // Isso mantém tudo dentro do Gemini antes de considerar qualquer fallback.
    const cascade: string[] = [];
    const push = (m: string) => { if (m && !cascade.includes(m)) cascade.push(m); };
    push(chosen);
    push("gemini-2.5-flash");
    push("gemini-2.5-flash-lite");
    push("gemini-2.0-flash");
    push("gemini-2.0-flash-lite");
    push("gemini-1.5-flash");
    push("gemini-1.5-flash-8b");

    let lastStatus = 0;
    let lastText = "";
    const transient = (s: number) => [408, 500, 502, 503, 504, 529].includes(s);

    for (const m of cascade) {
      // até 5 tentativas por modelo com backoff exponencial + jitter (máx ~8s)
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await callGemini(apiKey, m, messages, responseFormat);
        if (res.ok) {
          const json = await res.json();
          return { content: json.choices?.[0]?.message?.content ?? "", provider: "gemini", model: m };
        }
        lastStatus = res.status;
        lastText = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403) {
          throw new Error("API key do Gemini inválida ou sem permissão.");
        }
        if (res.status === 400 || res.status === 404) {
          // modelo inexistente/parâmetro inválido — tenta o próximo da cascata
          break;
        }
        if (res.status === 429) {
          // rate limit — espera mais e tenta de novo no mesmo modelo
          const wait = 1500 * Math.pow(2, attempt) + Math.random() * 400;
          await sleep(Math.min(wait, 12_000));
          continue;
        }
        if (transient(res.status) && attempt < 4) {
          const wait = 800 * Math.pow(2, attempt) + Math.random() * 400;
          await sleep(Math.min(wait, 8_000));
          continue;
        }
        break; // erro não recuperável neste modelo → cascata
      }
    }

    throw new Error(
      `Falha na IA Gemini após tentar ${cascade.length} modelo(s) (último status ${lastStatus}): ${lastText.slice(0, 200)}`,
    );
  }

  // Lovable (default)
  const chosen = model || cfg.model || "google/gemini-2.5-flash";
  let lastStatus = 0;
  let lastText = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await callLovable(chosen, messages, responseFormat);
    if (res.ok) {
      const json = await res.json();
      return { content: json.choices?.[0]?.message?.content ?? "", provider: "lovable", model: chosen };
    }
    lastStatus = res.status;
    lastText = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if ([500, 502, 503, 504].includes(res.status) && attempt < 2) {
      await sleep(800 * Math.pow(2, attempt));
      continue;
    }
    break;
  }
  throw new Error(`Falha na IA (${lastStatus}): ${lastText.slice(0, 200)}`);
}

export async function aiChat(opts: AiChatOptions): Promise<string> {
  const r = await aiChatDetailed(opts);
  return r.content;
}