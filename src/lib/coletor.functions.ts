import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ColetorInfo = {
  token: string;
  backendUrl: string;
  ultimaColeta: string | null;
  totalColetado: number;
  novosHoje: number;
  coletas: Array<{
    id: string;
    executado_em: string;
    total: number;
    novos: number;
    sucesso: boolean;
    erro: string | null;
    duracao_ms: number | null;
  }>;
};

export const getColetorInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ColetorInfo> => {
    // Apenas admins enxergam o token.
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ count: totalColetado }, { data: ultimas }] = await Promise.all([
      supabaseAdmin
        .from("protocolos")
        .select("id", { count: "exact", head: true })
        .ilike("url", "%1doc%"),
      supabaseAdmin
        .from("coletas")
        .select("id, executado_em, total, novos, sucesso, erro, duracao_ms")
        .order("executado_em", { ascending: false })
        .limit(50),
    ]);

    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const { count: novosHoje } = await supabaseAdmin
      .from("protocolos")
      .select("id", { count: "exact", head: true })
      .ilike("url", "%1doc%")
      .gte("updated_at", inicioHoje.toISOString());

    const coletas = (ultimas ?? []) as ColetorInfo["coletas"];
    const ultimaColeta = coletas.find((c) => c.sucesso)?.executado_em ?? coletas[0]?.executado_em ?? null;

    return {
      token: process.env.INGEST_TOKEN ?? "",
      backendUrl: "https://controleseta.lovable.app",
      ultimaColeta,
      totalColetado: totalColetado ?? 0,
      novosHoje: novosHoje ?? 0,
      coletas,
    };
  });