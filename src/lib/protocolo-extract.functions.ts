import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `Você extrai dados estruturados de protocolos de Ouvidoria/LAI de prefeituras a partir de texto colado pelo usuário (e-mails, mensagens, formulários).
Responda APENAS com JSON válido (sem markdown, sem texto extra) com os campos:
{
  "numero": string (número do protocolo se aparecer, senão ""),
  "tipo": "ouvidoria" | "lai" (LAI se for pedido de informação/Lei de Acesso à Informação, senão ouvidoria),
  "categoria": "elogio" | "reclamacao" | "pedido_informacao" | "denuncia" | "solicitacao" | "outros",
  "assunto": string (resumo curto, até 120 caracteres),
  "descricao": string (descrição mais detalhada do que foi pedido/relatado),
  "solicitante": string (nome do solicitante se aparecer, senão ""),
  "data_abertura": string (YYYY-MM-DD se aparecer, senão ""),
  "secretaria_sugerida": string (nome da secretaria/órgão sugerido se inferível, senão ""),
  "local_sugerido": string (bairro, escola, unidade, rua se aparecer, senão "")
}
Use string vazia "" quando não houver informação. Não invente dados.`;

export const extrairProtocolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { texto: string }) => z.object({ texto: z.string().min(5).max(20000) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: data.texto },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Falha na IA (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    return {
      numero: String(parsed.numero ?? ""),
      tipo: parsed.tipo === "lai" ? "lai" : "ouvidoria",
      categoria: ["elogio", "reclamacao", "pedido_informacao", "denuncia", "solicitacao", "outros"].includes(parsed.categoria) ? parsed.categoria : "solicitacao",
      assunto: String(parsed.assunto ?? "").slice(0, 200),
      descricao: String(parsed.descricao ?? ""),
      solicitante: String(parsed.solicitante ?? ""),
      data_abertura: /^\d{4}-\d{2}-\d{2}$/.test(parsed.data_abertura ?? "") ? parsed.data_abertura : "",
      secretaria_sugerida: String(parsed.secretaria_sugerida ?? ""),
      local_sugerido: String(parsed.local_sugerido ?? ""),
    };
  });