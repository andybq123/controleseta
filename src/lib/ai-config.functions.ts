import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso negado");
    const { data, error } = await supabase
      .from("ai_config")
      .select("provider, api_key, model, grok_api_key, gemini_api_key, grok_model, gemini_model, lovable_model, priority, updated_at")
      .eq("id", true)
      .maybeSingle();
    if (error) throw error;
    const d: any = data ?? {};
    const geminiKey: string | null = d.gemini_api_key ?? (d.provider === "gemini" ? d.api_key : null) ?? null;
    const geminiModel: string | null = d.gemini_model ?? (d.provider === "gemini" ? d.model : null) ?? null;
    const lovableModel: string | null = d.lovable_model ?? (d.provider === "lovable" ? d.model : null) ?? null;
    const rawPriority = Array.isArray(d.priority) ? d.priority : ["lovable", "gemini", "grok"];
    const KNOWN = ["grok", "gemini", "lovable"] as const;
    const priority = [
      ...rawPriority.filter((p: string) => (KNOWN as readonly string[]).includes(p)),
      ...KNOWN.filter((p) => !rawPriority.includes(p)),
    ] as ("grok" | "gemini" | "lovable")[];
    const mask = (k: string | null) => (k ? `••••${k.slice(-4)}` : null);
    return {
      priority,
      grok: { hasKey: !!d.grok_api_key, apiKeyMasked: mask(d.grok_api_key ?? null), model: d.grok_model ?? "" },
      gemini: { hasKey: !!geminiKey, apiKeyMasked: mask(geminiKey), model: geminiModel ?? "" },
      lovable: { model: lovableModel ?? "" },
      updatedAt: d.updated_at ?? null,
    };
  });

const SaveInput = z.object({
  priority: z.array(z.enum(["grok", "gemini", "lovable"])).min(1).max(3),
  grokApiKey: z.string().trim().optional(),
  clearGrokKey: z.boolean().optional(),
  grokModel: z.string().trim().max(120).optional(),
  geminiApiKey: z.string().trim().optional(),
  clearGeminiKey: z.boolean().optional(),
  geminiModel: z.string().trim().max(120).optional(),
  lovableModel: z.string().trim().max(120).optional(),
});

export const saveAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso negado");

    // Deduplicate priority preserving order.
    const seen = new Set<string>();
    const priority = data.priority.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));

    const patch: {
      priority: string[];
      provider: string;
      grok_model: string | null;
      gemini_model: string | null;
      lovable_model: string | null;
      updated_at: string;
      updated_by: string;
      grok_api_key?: string | null;
      gemini_api_key?: string | null;
    } = {
      priority,
      provider: priority[0] === "grok" ? "lovable" : priority[0],
      grok_model: data.grokModel ? data.grokModel : null,
      gemini_model: data.geminiModel ? data.geminiModel : null,
      lovable_model: data.lovableModel ? data.lovableModel : null,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };
    if (data.clearGrokKey) patch.grok_api_key = null;
    else if (data.grokApiKey && data.grokApiKey.length > 0) patch.grok_api_key = data.grokApiKey;
    if (data.clearGeminiKey) patch.gemini_api_key = null;
    else if (data.geminiApiKey && data.geminiApiKey.length > 0) patch.gemini_api_key = data.geminiApiKey;

    const { error } = await supabase.from("ai_config").update(patch).eq("id", true);
    if (error) throw error;

    // Best-effort cache invalidation in this process.
    try {
      const mod = await import("./ai-chat.server");
      mod.invalidateAiConfigCache();
    } catch {}

    return { ok: true };
  });

export const testAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso negado");
    const { aiChat, invalidateAiConfigCache } = await import("./ai-chat.server");
    invalidateAiConfigCache();
    const out = await aiChat({
      messages: [
        { role: "system", content: "Responda apenas com a palavra: OK" },
        { role: "user", content: "ping" },
      ],
    });
    return { ok: true, reply: out.slice(0, 200) };
  });