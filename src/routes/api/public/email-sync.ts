import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/email-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { sincronizarGmailContas, sincronizarImapContas } = await import(
          "@/lib/protocolo-ingest.server"
        );
        const result: any = { ok: true };
        try {
          result.gmail = await sincronizarGmailContas();
        } catch (e: any) {
          result.gmail = { error: String(e?.message ?? e) };
        }
        try {
          result.imap = await sincronizarImapContas();
        } catch (e: any) {
          result.imap = { error: String(e?.message ?? e) };
        }
        return Response.json(result);
      },
      GET: async () => Response.json({ ok: true, hint: "POST para sincronizar" }),
    },
  },
});