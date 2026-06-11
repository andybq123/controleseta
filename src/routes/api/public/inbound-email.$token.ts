import { createFileRoute } from "@tanstack/react-router";
import { PROTOCOLO_EXTRACT_SYSTEM, normalizarExtracao } from "@/lib/protocolo-extract.shared";
import { gerarNumeroProtocolo } from "@/lib/prazo";

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function extrairComIA(texto: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: PROTOCOLO_EXTRACT_SYSTEM },
        { role: "user", content: texto.slice(0, 18000) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`IA ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch {}
  return normalizarExtracao(parsed);
}

async function processInbound(token: string, request: Request) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Parse body — accept JSON, form-data ou form-urlencoded
  let payload: any = {};
  const ct = request.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      payload = await request.json();
    } else if (ct.includes("form")) {
      const fd = await request.formData();
      payload = Object.fromEntries(fd.entries());
    } else {
      const txt = await request.text();
      try { payload = JSON.parse(txt); } catch { payload = { text: txt }; }
    }
  } catch {
    payload = {};
  }

  const remetente = String(payload.from ?? payload.sender ?? payload.From ?? "");
  const destinatario = String(payload.to ?? payload.recipient ?? payload.To ?? "");
  const assunto = String(payload.subject ?? payload.Subject ?? "");
  const textoBruto = String(payload.text ?? payload["body-plain"] ?? payload.plain ?? "");
  const html = String(payload.html ?? payload["body-html"] ?? payload.Html ?? "");
  const corpo = textoBruto.trim() || (html ? stripHtml(html) : "");

  // Busca conta pelo token
  const { data: account } = await supabaseAdmin
    .from("email_inbox_accounts")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!account) {
    return Response.json({ ok: false, error: "token inválido" }, { status: 404 });
  }
  if (!account.ativo) {
    await supabaseAdmin.from("email_inbox_log").insert({
      account_id: account.id, remetente, destinatario, assunto, corpo,
      status: "ignorado", erro: "conta inativa", processado_em: new Date().toISOString(),
    });
    return Response.json({ ok: false, error: "conta inativa" }, { status: 200 });
  }

  const textoCompleto = [
    `De: ${remetente}`,
    `Para: ${destinatario}`,
    `Assunto: ${assunto}`,
    "",
    corpo,
  ].join("\n");

  // Log inicial
  const { data: logRow } = await supabaseAdmin
    .from("email_inbox_log")
    .insert({
      account_id: account.id, remetente, destinatario, assunto,
      corpo: textoCompleto.slice(0, 20000), status: "pendente",
    })
    .select("id")
    .single();

  try {
    if (textoCompleto.trim().length < 10) {
      throw new Error("Conteúdo vazio");
    }

    const extr = await extrairComIA(textoCompleto);

    // Match secretaria
    let secretariaId: string | null = account.secretaria_id;
    if (!secretariaId && extr.secretaria_sugerida) {
      const { data: secs } = await supabaseAdmin.from("secretarias").select("id, nome, sigla");
      const alvo = norm(extr.secretaria_sugerida);
      const hit = (secs ?? []).find(s =>
        norm(s.nome).includes(alvo) || alvo.includes(norm(s.nome)) ||
        (s.sigla && norm(s.sigla) === alvo)
      );
      if (hit) secretariaId = hit.id;
    }

    let localId: string | null = null;
    if (secretariaId && extr.local_sugerido) {
      const { data: locs } = await supabaseAdmin
        .from("locais").select("id, nome").eq("secretaria_id", secretariaId);
      const alvo = norm(extr.local_sugerido);
      const hit = (locs ?? []).find(l => norm(l.nome).includes(alvo) || alvo.includes(norm(l.nome)));
      if (hit) localId = hit.id;
    }

    const numero = extr.numero || gerarNumeroProtocolo(extr.tipo);
    const dataAbertura = extr.data_abertura || new Date().toISOString().slice(0, 10);

    const { data: novo, error: errIns } = await supabaseAdmin
      .from("protocolos")
      .insert({
        numero,
        tipo: extr.tipo,
        categoria: extr.categoria,
        assunto: extr.assunto || assunto || "Sem assunto",
        descricao: null,
        solicitante: extr.solicitante || remetente || null,
        secretaria_id: secretariaId,
        local_id: localId,
        data_abertura: dataAbertura,
        created_by: account.created_by,
      })
      .select("id, numero")
      .single();

    if (errIns) throw errIns;

    await supabaseAdmin.from("email_inbox_log").update({
      status: "processado",
      protocolo_id: novo!.id,
      processado_em: new Date().toISOString(),
    }).eq("id", logRow!.id);

    return Response.json({ ok: true, protocolo_id: novo!.id, numero: novo!.numero });
  } catch (e: any) {
    await supabaseAdmin.from("email_inbox_log").update({
      status: "erro",
      erro: String(e?.message ?? e).slice(0, 1000),
      processado_em: new Date().toISOString(),
    }).eq("id", logRow!.id);
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/inbound-email/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => processInbound(params.token, request),
      GET: async ({ params }) => Response.json({ ok: true, hint: "POST email JSON aqui", token: params.token.slice(0, 8) + "…" }),
    },
  },
});