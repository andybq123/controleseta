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
export async function aiChat({ messages, model, responseFormat }: AiChatOptions): Promise<string> {
  const cfg = await loadConfig();

  if (cfg.provider === "gemini") {
    const apiKey = cfg.apiKey?.trim();
    if (!apiKey) throw new Error("Gemini selecionado, mas a API key não está configurada em Configurações > IA.");
    const chosen = model || cfg.model || "gemini-2.5-flash";
    const body: any = { model: chosen, messages };
    if (responseFormat === "json_object") body.response_format = { type: "json_object" };
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429) throw new Error("Limite de requisições do Gemini atingido. Tente novamente em instantes.");
    if (res.status === 401 || res.status === 403) throw new Error("API key do Gemini inválida ou sem permissão.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Falha na IA Gemini (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "";
  }

  // Lovable (default)
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
  const chosen = model || cfg.model || "google/gemini-2.5-flash";
  const body: any = { model: chosen, messages };
  if (responseFormat === "json_object") body.response_format = { type: "json_object" };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha na IA (${res.status}): ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}