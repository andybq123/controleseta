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

export const reverificarEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dias?: number }) => ({ dias: Math.min(Math.max(d?.dias ?? 60, 1), 180) }))
  .handler(async ({ data }) => {
    const { reverificarEmailsSemProtocolo } = await import("@/lib/protocolo-ingest.server");
    return await reverificarEmailsSemProtocolo(data.dias);
  });

export const sincronizarImap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { sincronizarImapContas } = await import("@/lib/protocolo-ingest.server");
    return await sincronizarImapContas();
  });

export const backfillUrls1Doc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dias?: number }) => ({ dias: Math.min(Math.max(d?.dias ?? 180, 1), 365) }))
  .handler(async ({ data }) => {
    const { backfillUrl1DocViaGmail } = await import("@/lib/protocolo-ingest.server");
    return await backfillUrl1DocViaGmail(data.dias);
  });