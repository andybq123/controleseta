import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const ProtocoloSchema = z.object({
  numero: z.string().min(1).max(100),
  setor: z.string().max(500).nullable().optional(),
  relato: z.string().max(20000).nullable().optional(),
  status: z.string().max(100).nullable().optional(),
  data_protocolo: z.string().max(50).nullable().optional(),
  url: z.string().max(1000).nullable().optional(),
  detalhes: z.record(z.string(), z.any()).nullable().optional(),
});

const BodySchema = z.object({
  protocolos: z.array(ProtocoloSchema).max(2000),
});

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function variantesNumero(n: string): string[] {
  const trim = (n || "").trim();
  if (!trim) return [];
  const [num, ano] = trim.split("/");
  if (!num || !ano) return [trim];
  const semPontos = num.replace(/\./g, "");
  const numLimpo = String(parseInt(semPontos, 10));
  const out = new Set<string>([trim, `${numLimpo}/${ano}`]);
  if (numLimpo.length > 3) {
    const comPonto = numLimpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    out.add(`${comPonto}/${ano}`);
  }
  return Array.from(out);
}

// Converte "dd/mm/yyyy" (e variações com horário) para ISO "yyyy-mm-dd"
function parseDataBr(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function statusConcluido(s: string | null | undefined): boolean {
  const n = norm(s);
  if (!n) return false;
  return (
    n.includes("ja cumprido") ||
    n.includes("cumprido") ||
    n.includes("arquivad") ||
    n.includes("finaliz") ||
    n.includes("baixad") ||
    n.includes("encerrad") ||
    n.includes("concluid")
  );
}

// Tenta casar o "setor" recebido do 1doc com uma secretaria existente.
function acharSecretaria(
  secretarias: Array<{ id: string; nome: string; sigla: string | null }>,
  setor: string | null | undefined,
): string | null {
  const alvo = norm(setor);
  if (!alvo) return null;
  // 1) match exato por nome ou sigla
  for (const s of secretarias) {
    if (norm(s.nome) === alvo) return s.id;
    if (s.sigla && norm(s.sigla) === alvo) return s.id;
  }
  // 2) inclusão de termos (nome contém alvo, alvo contém nome, ou sigla aparece no alvo)
  for (const s of secretarias) {
    const n = norm(s.nome);
    if (n && (alvo.includes(n) || n.includes(alvo))) return s.id;
    const sg = norm(s.sigla || "");
    if (sg && (alvo.includes(` ${sg} `) || alvo.startsWith(`${sg} `) || alvo.endsWith(` ${sg}`) || alvo === sg)) {
      return s.id;
    }
  }
  return null;
}

export const Route = createFileRoute("/api/public/ingest-protocolos")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request }) => {
        const inicio = Date.now();
        const expected = process.env.INGEST_TOKEN;
        if (!expected) {
          return Response.json({ error: "INGEST_TOKEN não configurado" }, { status: 500, headers: corsHeaders() });
        }
        const auth = request.headers.get("authorization") || "";
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        if (!token || token !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
        }

        let body: unknown;
        try { body = await request.json(); } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400, headers: corsHeaders() });
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Payload inválido", detalhes: parsed.error.flatten() },
            { status: 400, headers: corsHeaders() },
          );
        }

        const { protocolos } = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          if (protocolos.length === 0) {
            await supabaseAdmin.from("coletas").insert({
              total: 0, novos: 0, sucesso: true,
              erro: "Coleta via extensão (vazia)", duracao_ms: Date.now() - inicio,
            });
            return Response.json({ sucesso: true, total: 0, novos: 0, ignorados: 0 }, { headers: corsHeaders() });
          }

          // Dedup: buscar todas as variantes equivalentes em uma única query.
          const todasVariantes = new Set<string>();
          const mapaVariantes = new Map<string, string[]>();
          for (const p of protocolos) {
            const v = variantesNumero(p.numero);
            mapaVariantes.set(p.numero, v);
            for (const x of v) todasVariantes.add(x);
          }
          const { data: existentes } = await supabaseAdmin
            .from("protocolos")
            .select("numero")
            .in("numero", Array.from(todasVariantes));
          const setExistentes = new Set((existentes || []).map((r) => r.numero));
          const novosProtocolos = protocolos.filter(
            (p) => !(mapaVariantes.get(p.numero) || [p.numero]).some((v) => setExistentes.has(v)),
          );
          const novos = novosProtocolos.length;
          const ignorados = protocolos.length - novos;

          if (novosProtocolos.length > 0) {
            const { data: secretarias } = await supabaseAdmin
              .from("secretarias")
              .select("id, nome, sigla");
            const secs = secretarias || [];

            const hoje = new Date().toISOString().slice(0, 10);
            const agora = new Date().toISOString();

            const linhas = novosProtocolos.map((p) => {
              const det = (p.detalhes || {}) as Record<string, any>;
              const assuntoTxt = (det.assunto as string | undefined) || (p.setor || "Ouvidoria coletada do 1doc");
              const setorAlvo = (det.setor as string | undefined) || p.setor || null;
              const secretariaId = acharSecretaria(secs, setorAlvo);
              const concluido = statusConcluido(p.status);
              const dataAbertura = parseDataBr(p.data_protocolo) || hoje;
              const solicitante = (det.solicitante as string | undefined) || null;
              const descricao = (p.relato && p.relato.trim().length > 0
                ? p.relato
                : (det.descricao as string | undefined) || (det.mensagem as string | undefined) || null);

              return {
                numero: p.numero,
                tipo: "ouvidoria" as const,
                categoria: "reclamacao" as const,
                assunto: (assuntoTxt || "Ouvidoria").slice(0, 500),
                descricao,
                status: concluido ? ("concluido" as const) : ("em_andamento" as const),
                secretaria_id: secretariaId,
                solicitante,
                data_abertura: dataAbertura,
                data_conclusao: concluido ? (parseDataBr((det.data_arquivamento || det.data_finalizacao) as string | undefined) || hoje) : null,
                url: p.url ?? null,
                detalhes: p.detalhes ?? null,
                coletado_em: agora,
                // Não passa pela triagem manual — já vem do sistema oficial.
                triagem_pendente: false,
                origem: "1doc-coletor",
              };
            });

            const { error } = await supabaseAdmin.from("protocolos").insert(linhas);
            if (error) throw new Error(`Erro ao salvar: ${error.message}`);
          }

          await supabaseAdmin.from("coletas").insert({
            total: protocolos.length, novos, sucesso: true,
            erro: "Coleta via extensão do navegador",
            duracao_ms: Date.now() - inicio,
          });

          return Response.json(
            { sucesso: true, total: protocolos.length, novos, ignorados },
            { headers: corsHeaders() },
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          await supabaseAdmin.from("coletas").insert({
            total: 0, novos: 0, sucesso: false,
            erro: `Extensão: ${msg}`, duracao_ms: Date.now() - inicio,
          });
          return Response.json({ sucesso: false, erro: msg }, { status: 500, headers: corsHeaders() });
        }
      },
    },
  },
});