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

export async function aiChat({ messages, model, responseFormat }: AiChatOptions): Promise<string> {
  const cfg = await loadConfig();

  if (cfg.provider === "gemini") {
    const apiKey = cfg.apiKey?.trim();
    if (!apiKey) throw new Error("Gemini selecionado, mas a API key não está configurada em Configurações > IA.");
    const chosen = model || cfg.model || "gemini-2.5-flash";

    // Retry on 503/overload with exponential backoff.
    let lastStatus = 0;
    let lastText = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await callGemini(apiKey, chosen, messages, responseFormat);
      if (res.ok) {
        const json = await res.json();
        return json.choices?.[0]?.message?.content ?? "";
      }
      lastStatus = res.status;
      lastText = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) throw new Error("API key do Gemini inválida ou sem permissão.");
      if (res.status === 429) throw new Error("Limite de requisições do Gemini atingido. Tente novamente em instantes.");
      // 503/500/502/504 → backoff and retry
      if ([500, 502, 503, 504].includes(res.status) && attempt < 2) {
        await sleep(800 * Math.pow(2, attempt));
        continue;
      }
      break;
    }

    // Fallback to Lovable when Gemini is overloaded/unavailable, if LOVABLE_API_KEY exists.
    if ([500, 502, 503, 504].includes(lastStatus) && process.env.LOVABLE_API_KEY) {
      try {
        const res = await callLovable("google/gemini-2.5-flash", messages, responseFormat);
        if (res.ok) {
          const json = await res.json();
          return json.choices?.[0]?.message?.content ?? "";
        }
      } catch {}
    }
    throw new Error(`Falha na IA Gemini (${lastStatus}): ${lastText.slice(0, 200)}`);
  }

  // Lovable (default)
  const chosen = model || cfg.model || "google/gemini-2.5-flash";
  let lastStatus = 0;
  let lastText = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await callLovable(chosen, messages, responseFormat);
    if (res.ok) {
      const json = await res.json();
      return json.choices?.[0]?.message?.content ?? "";
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