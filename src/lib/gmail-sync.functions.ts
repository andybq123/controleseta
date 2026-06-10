import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sincronizarGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { sincronizarGmailContas } = await import("@/lib/protocolo-ingest.server");
    return await sincronizarGmailContas();
  });