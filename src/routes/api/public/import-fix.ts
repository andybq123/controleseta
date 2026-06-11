import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/import-fix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-admin-secret");
        if (!secret || secret !== process.env.LOVABLE_API_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const body = (await request.json()) as
          | { action: "descricoes"; rows: { numero: number; ano: number; descricao: string }[] }
          | { action: "finalize" };

        if (body.action === "descricoes") {
          // Apply per-row updates (PostgREST has no bulk UPDATE-FROM-VALUES, do RPC-less loop)
          // Use a single SQL via rpc? We'll iterate using update().eq() — acceptable for one-off.
          let updated = 0;
          for (const r of body.rows) {
            const start = `${r.ano}-01-01`;
            const end = `${r.ano}-12-31`;
            const { data, error } = await supabaseAdmin
              .from("protocolos")
              .update({ descricao: r.descricao })
              .eq("numero", String(r.numero))
              .gte("data_abertura", start)
              .lte("data_abertura", end)
              .select("id");
            if (error) return new Response(JSON.stringify({ ok: false, error: error.message, atRow: r }), { status: 500 });
            updated += data?.length ?? 0;
          }
          return new Response(JSON.stringify({ ok: true, updated }), { headers: { "content-type": "application/json" } });
        }

        if (body.action === "finalize") {
          // Reset all imported (numeric numero) to em_andamento and renumber to NN.NN/YYYY
          // 1) fetch ids + numero + data_abertura
          const { data: rows, error: e1 } = await supabaseAdmin
            .from("protocolos")
            .select("id, numero, data_abertura")
            .filter("numero", "~", "^[0-9]+$");
          if (e1) return new Response(JSON.stringify({ ok: false, error: e1.message }), { status: 500 });

          let reset = 0, renumbered = 0;
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
            if (!e2) { reset++; renumbered++; }
          }
          return new Response(JSON.stringify({ ok: true, reset, renumbered }), { headers: { "content-type": "application/json" } });
        }

        return new Response("Bad request", { status: 400 });
      },
    },
  },
});