import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/gmail-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { sincronizarGmailContas } = await import("@/lib/protocolo-ingest.server");
        try {
          const r = await sincronizarGmailContas();
          return Response.json({ ok: true, ...r });
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST para sincronizar" }),
    },
  },
});