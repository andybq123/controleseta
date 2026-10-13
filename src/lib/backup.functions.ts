import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Tabelas permitidas e colunas secretas removidas do backup.
const TABELAS: Record<string, { omit?: string[]; order?: string }> = {
  protocolos: { order: "created_at" },
  protocolo_historico: { order: "created_at" },
  protocolos_antigos_conclusoes: { order: "created_at" },
  secretarias: { order: "created_at" },
  secretaria_responsaveis: { order: "created_at" },
  locais: { order: "created_at" },
  assuntos: { order: "created_at" },
  profiles: { order: "created_at" },
  user_roles: { order: "created_at" },
  allowed_emails: { order: "created_at" },
  coletas: { order: "executado_em" },
  email_inbox_accounts: { omit: ["token", "imap_password"], order: "created_at" },
  email_inbox_log: { order: "recebido_em" },
  ai_config: { omit: ["api_key", "grok_api_key", "gemini_api_key"] },
};

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem gerar backup");
}

export const exportarPaginaBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tabela: string; from: number; to: number }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const cfg = TABELAS[data.tabela];
    if (!cfg) throw new Error("Tabela não permitida");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q: any = (supabaseAdmin as any).from(data.tabela).select("*");
    if (cfg.order) q = q.order(cfg.order, { ascending: true }).order("id", { ascending: true });
    const { data: rows, error } = await q.range(data.from, data.to);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => {
      const c = { ...r };
      for (const k of cfg.omit ?? []) delete c[k];
      return c;
    });
  });

export const exportarContasUsuarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: any[] = [];
    for (let page = 1; page < 50; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const users = data?.users ?? [];
      for (const u of users) {
        out.push({
          id: u.id,
          email: u.email,
          nome: (u.user_metadata as any)?.nome ?? null,
          criado_em: u.created_at,
          ultimo_acesso: u.last_sign_in_at,
          email_confirmado: !!u.email_confirmed_at,
          senha: "[protegida - armazenada criptografada pelo sistema]",
        });
      }
      if (users.length < 200) break;
    }
    return out;
  });
