import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sincronizarGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { sincronizarGmailContas } = await import("@/lib/protocolo-ingest.server");
    return await sincronizarGmailContas();
  });

export const ressincronizarGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dias?: number }) => ({ dias: Math.min(Math.max(d?.dias ?? 30, 1), 90) }))
  .handler(async ({ data }) => {
    const { ressincronizarGmailContas } = await import("@/lib/protocolo-ingest.server");
    return await ressincronizarGmailContas(data.dias);
  });

export const sincronizarImap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { sincronizarImapContas } = await import("@/lib/protocolo-ingest.server");
    return await sincronizarImapContas();
  });