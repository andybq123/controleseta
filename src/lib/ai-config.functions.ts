import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso negado");
    const { data, error } = await supabase.from("ai_config").select("provider, api_key, model, updated_at").eq("id", true).maybeSingle();
    if (error) throw error;
    return {
      provider: (data?.provider as "lovable" | "gemini") ?? "lovable",
      apiKeyMasked: data?.api_key ? `••••${data.api_key.slice(-4)}` : null,
      hasKey: !!data?.api_key,
      model: data?.model ?? "",
      updatedAt: data?.updated_at ?? null,
    };
  });

const SaveInput = z.object({
  provider: z.enum(["lovable", "gemini"]),
  apiKey: z.string().trim().optional(),
  clearKey: z.boolean().optional(),
  model: z.string().trim().max(120).optional(),
});

export const saveAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso negado");

    const patch: Record<string, unknown> = {
      provider: data.provider,
      model: data.model ? data.model : null,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };
    if (data.clearKey) patch.api_key = null;
    else if (data.apiKey && data.apiKey.length > 0) patch.api_key = data.apiKey;

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