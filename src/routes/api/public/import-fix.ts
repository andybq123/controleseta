import { createFileRoute } from "@tanstack/react-router";
import { importComments } from "@/lib/_import-comments-data";

export const Route = createFileRoute("/api/public/import-fix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const body = (await request.json().catch(() => ({}))) as
          | { action: "descricoes" }
          | { action: "finalize" }
          | { action: "all" };

        const runDescricoes = async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let updated = 0;
          for (const r of importComments) {
            const start = `${r.ano}-01-01`;
            const end = `${r.ano}-12-31`;
            const { data, error } = await supabaseAdmin
              .from("protocolos")
              .update({ descricao: r.descricao })
              .eq("numero", String(r.numero))
              .gte("data_abertura", start)
              .lte("data_abertura", end)
              .select("id");
            if (error) throw new Error(`${error.message} at numero=${r.numero}/${r.ano}`);
            updated += data?.length ?? 0;
          }
          return updated;
        };

        const runFinalize = async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: rows, error: e1 } = await supabaseAdmin
            .from("protocolos")
            .select("id, numero, data_abertura")
            .filter("numero", "~", "^[0-9]+$");
          if (e1) throw new Error(e1.message);
          let renumbered = 0;
          for (const p of rows ?? []) {
            const n = p.numero as string;
            const ano = p.data_abertura ? new Date(p.data_abertura as string).getUTCFullYear() : new Date().getFullYear();
            let formatted: string;
            if (n.length <= 2) formatted = `0.${n.padStart(2, "0")}`;
            else formatted = `${n.slice(0, n.length - 2)}.${n.slice(-2)}`;
            const novo = `${formatted}/${ano}`;
            const { error: e2 } = await supabaseAdmin
              .from("protocolos")
              .update({ numero: novo, status: "em_andamento", data_conclusao: null })
              .eq("id", p.id);
            if (!e2) renumbered++;
          }
          return renumbered;
        };

        try {
          if (body.action === "descricoes") {
            const updated = await runDescricoes();
            return new Response(JSON.stringify({ ok: true, updated }), { headers: { "content-type": "application/json" } });
          }
          if (body.action === "finalize") {
            const renumbered = await runFinalize();
            return new Response(JSON.stringify({ ok: true, renumbered }), { headers: { "content-type": "application/json" } });
          }
          if (body.action === "all") {
            const updated = await runDescricoes();
            const renumbered = await runFinalize();
            return new Response(JSON.stringify({ ok: true, updated, renumbered }), { headers: { "content-type": "application/json" } });
          }
          return new Response("Bad request", { status: 400 });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500 });
        }
      },
    },
  },
});