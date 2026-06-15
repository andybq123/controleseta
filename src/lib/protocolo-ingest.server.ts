import { PROTOCOLO_EXTRACT_SYSTEM, normalizarExtracao, sanitizarTextoProtocolo } from "@/lib/protocolo-extract.shared";
import { gerarNumeroProtocolo } from "@/lib/prazo";

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Mapeamento de assunto/categoria → nome da secretaria responsável.
// Os valores devem bater (após normalização) com `secretarias.nome` no banco.
const ASSUNTO_PARA_SECRETARIA: Record<string, string> = {
  // Assistência Social / Programas Sociais
  "Assistência Social": "SDS - Assistencia Social",
  "Programas Sociais": "SDS - Assistencia Social",
  // Educação
  "Creches e Escolas": "SME - Educação",
  // RH / Conduta
  "Conduta de Funcionários": "SAGE RH",
  "Denúncia de Assédio": "SAGE RH",
  "Recursos Humanos": "SAGE RH",
  // Saneamento
  "Esgoto": "Administração/SAMAE",
  // Vigilância Sanitária → subgrupo de Saúde
  "Condição sanitária irregular": "Saúde",
  "Falta de Higiene": "Saúde",
  "Foco de dengue": "Saúde",
  "Infestação / Proliferação de animais ou pragas": "Saúde",
  // PROCON
  "Estabelecimento sem nota fiscal": "PROCON",
  "Mercadorias vencidas": "PROCON",
  // SEFAZ
  "Estabelecimento sem alvará": "SEFAZ",
  "Pagamentos": "SEFAZ",
  // Defesa Civil
  "Estabelecimento sem saída de emergência": "Defesa Civil",
  "Risco de desmoronamento": "Defesa Civil",
  // SEPLAN / Urbanismo
  "Estabelecimento com acessibilidade irregular": "SEPLAN",
  "Ocupação irregular de área pública": "SEPLAN",
  "Construção Irregular": "SEPLAN",
  "Fiscalização de Obras": "SEPLAN",
  "Imóvel abandonado": "SEPLAN",
  "Invasão de área pública": "SEPLAN",
  // Controladoria / Governo
  "Abuso de poder": "Controladoria",
  "Demora em processo": "Controladoria",
  "Desorganização": "Controladoria",
  "Desvio de função": "Controladoria",
  "Desvio de verba pública": "Controladoria",
  "Nepotismo": "Controladoria",
  // Infraestrutura / Energia
  "Iluminação e Energia": "SIE - Infraestrutura Estratégica",
  // Obras / Limpeza urbana
  "Coleta de Lixo Comum": "Secretaria de Obras",
  "Coleta pesada": "Secretaria de Obras",
  "Entulho em via pública": "Secretaria de Obras",
  "Limpeza em terreno baldio": "Secretaria de Obras",
  "Limpeza urbana": "Secretaria de Obras",
  "Mato alto": "Secretaria de Obras",
  "Poda de árvores de rua": "Secretaria de Obras",
  "Asfalto": "Secretaria de Obras",
  "Buraco": "Secretaria de Obras",
  "Calçadas": "Secretaria de Obras",
  "Via sem pavimentação (Estrada de chão)": "Secretaria de Obras",
  "Demora em Obra Pública": "Secretaria de Obras",
  "Serviço mal feito": "Secretaria de Obras",
  // Meio Ambiente
  "Aterro sanitário irregular": "Fundema",
  "Desmatamento irregular": "Fundema",
  "Poluição Ambiental": "Fundema",
  "Queimada irregular": "Fundema",
  // Animais
  "Maus tratos a animais": "Bem-Estar Animal",
  // Esportes
  "Praça e ou quadra para lazer e esportes": "Esportes",
  // Saúde
  "Demora em marcar consulta / procedimento": "Saúde",
  "Falta de materiais em Posto de Saúde": "Saúde",
  "Falta de medicação": "Saúde",
  "Médicos": "Saúde",
  "Postos de Saúde": "Saúde",
  "Transporte para tratamento": "Saúde",
  "Vacinas": "Saúde",
  // Segurança
  "Baderna": "COPPEASM",
  "Ponto de assalto/roubo": "COPPEASM",
  "Ponto de tráfico de drogas": "COPPEASM",
  // Trânsito
  "Acessibilidade para deficientes visuais": "SETRAM",
  "Bloqueio na via": "SETRAM",
  "Estacionamento irregular": "SETRAM",
  "Faixa de pedestre": "SETRAM",
  "Lombadas": "SETRAM",
  "Placas de sinalização": "SETRAM",
  "Semáforos": "SETRAM",
  // Transporte Público
  "Horários de Ônibus": "SETRAM",
  "Ônibus danificado": "SETRAM",
  "Ponto de ônibus": "SETRAM",
  "Super-lotação em ônibus": "SETRAM",
  "Transporte irregular": "SETRAM",
};

function normalizarNumero(n: string): string[] {
  // Retorna variantes equivalentes do mesmo número (com/sem pontos de milhar)
  const trim = (n || "").trim();
  if (!trim) return [];
  const [num, ano] = trim.split("/");
  if (!num || !ano) return [trim];
  const semPontos = num.replace(/\./g, "");
  const numLimpo = String(parseInt(semPontos, 10));
  const variantes = new Set<string>([trim]);
  // sem separador de milhar
  variantes.add(`${numLimpo}/${ano}`);
  // com ponto a cada 3 dígitos (pt-BR)
  if (numLimpo.length > 3) {
    const comPonto = numLimpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    variantes.add(`${comPonto}/${ano}`);
  }
  return Array.from(variantes);
}

function detectarAcao(assunto: string, corpo: string): "conclusao" | "atualizacao" {
  const texto = norm(`${assunto}\n${corpo}`);
  const padroesConclusao = [
    "encerrad", "encerramento", "finalizad", "finalizacao",
    "conclui", "conclus", "concluid",
    "baixa", "dar baixa", "deu baixa",
    "arquivad", "arquivamento",
    "respondida e encerrada", "atendid",
  ];
  if (padroesConclusao.some(p => texto.includes(p))) return "conclusao";
  return "atualizacao";
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
        { role: "user", content: (sanitizarTextoProtocolo(texto) || texto).slice(0, 18000) },
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

export type IngestInput = {
  account: any;
  remetente: string;
  destinatario: string;
  assunto: string;
  corpo: string;
  externalId?: string;
};

export async function ingerirEmail(input: IngestInput): Promise<{ ok: boolean; protocoloId?: string; numero?: string; logId?: string; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { account, remetente, destinatario, assunto, corpo, externalId } = input;

  if (externalId) {
    const { data: existente } = await supabaseAdmin
      .from("email_inbox_log").select("id")
      .eq("account_id", account.id).eq("external_id", externalId).maybeSingle();
    if (existente) return { ok: true, logId: existente.id };
  }

  const textoCompleto = [`De: ${remetente}`, `Para: ${destinatario}`, `Assunto: ${assunto}`, "", corpo].join("\n");

  const { data: logRow, error: logErr } = await supabaseAdmin
    .from("email_inbox_log")
    .insert({
      account_id: account.id, remetente, destinatario, assunto,
      corpo: textoCompleto.slice(0, 20000), status: "pendente",
      external_id: externalId ?? null,
    })
    .select("id").single();
  if (logErr) throw logErr;

  try {
    if (textoCompleto.trim().length < 10) throw new Error("Conteúdo vazio");
    const extr = await extrairComIA(textoCompleto);

    // Detecta e-SIC pelo assunto/corpo do e-mail (ex: "Pedido de e-SIC")
    {
      const t = norm(`${assunto}\n${corpo}`);
      if (/\be[\s\-]?sic\b/.test(t) || t.includes("pedido de e sic") || t.includes("pedido de esic")) {
        extr.tipo = "esic" as any;
      }
    }

    // ===== Detectar se é atualização/baixa de protocolo já existente =====
    if (extr.numero) {
      const variantes = normalizarNumero(extr.numero);
      const { data: existente } = await supabaseAdmin
        .from("protocolos")
        .select("id, numero, status")
        .in("numero", variantes)
        .maybeSingle();

      if (existente) {
        const acao = detectarAcao(assunto, corpo);
        const resumoEmail = [
          `E-mail recebido em ${new Date().toLocaleString("pt-BR")}`,
          `De: ${remetente}`,
          `Assunto: ${assunto}`,
          "",
          (corpo || "").slice(0, 4000),
        ].join("\n");

        if (acao === "conclusao" && existente.status !== "concluido") {
          const hoje = new Date().toISOString().slice(0, 10);
          await supabaseAdmin
            .from("protocolos")
            .update({ status: "concluido", data_conclusao: hoje })
            .eq("id", existente.id);
        }

        await supabaseAdmin.from("protocolo_historico").insert({
          protocolo_id: existente.id,
          campo: acao === "conclusao" ? "_baixa_email" : "_atualizacao_email",
          valor_anterior: null,
          valor_novo: resumoEmail.slice(0, 8000),
          acao: acao === "conclusao" ? "baixa" : "atualizacao",
          autor_nome: `E-mail · ${remetente}`.slice(0, 200),
        });

        await supabaseAdmin.from("email_inbox_log").update({
          status: "processado",
          protocolo_id: existente.id,
          processado_em: new Date().toISOString(),
          erro: acao === "conclusao" ? "baixa registrada" : "atualização registrada",
        }).eq("id", logRow!.id);

        return { ok: true, protocoloId: existente.id, numero: existente.numero, logId: logRow!.id };
      }
    }

    let secretariaId: string | null = account.secretaria_id;
    if (!secretariaId) {
      const { data: secs } = await supabaseAdmin.from("secretarias").select("id, nome, sigla");

      // 1) Tenta pelo destinatário do e-mail (header "Para:")
      if (extr.secretaria_sugerida) {
        const alvo = norm(extr.secretaria_sugerida);
        const hit = (secs ?? []).find(s =>
          norm(s.nome).includes(alvo) || alvo.includes(norm(s.nome)) ||
          (s.sigla && norm(s.sigla) === alvo)
        );
        if (hit) secretariaId = hit.id;
      }

      // 2) Fallback: classifica pelo assunto/categoria detectada pela IA
      if (!secretariaId && extr.assunto_categoria) {
        const alvoNome = ASSUNTO_PARA_SECRETARIA[extr.assunto_categoria];
        if (alvoNome) {
          const alvo = norm(alvoNome);
          const hit = (secs ?? []).find(s => norm(s.nome) === alvo);
          if (hit) secretariaId = hit.id;
        }
      }
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

    const resumo = [
      "Nova Ouvidoria recebida.",
      "",
      `Nº: ${extr.numero || numero}`,
      `Assunto: ${extr.assunto || assunto || ""}`,
      `De: ${extr.solicitante || "-"}`,
      `Para: ${extr.destinatario || ""}`,
    ].join("\n");

    const { data: novo, error: errIns } = await supabaseAdmin
      .from("protocolos")
      .insert({
        numero, tipo: extr.tipo, categoria: extr.categoria,
        assunto: extr.assunto || assunto || "Sem assunto",
        descricao: resumo,
        solicitante: extr.solicitante || remetente || null,
        secretaria_id: secretariaId, local_id: localId,
        data_abertura: dataAbertura, created_by: account.created_by,
      })
      .select("id, numero").single();
    if (errIns) throw errIns;

    await supabaseAdmin.from("email_inbox_log").update({
      status: "processado", protocolo_id: novo!.id, processado_em: new Date().toISOString(),
    }).eq("id", logRow!.id);

    return { ok: true, protocoloId: novo!.id, numero: novo!.numero, logId: logRow!.id };
  } catch (e: any) {
    await supabaseAdmin.from("email_inbox_log").update({
      status: "erro", erro: String(e?.message ?? e).slice(0, 1000),
      processado_em: new Date().toISOString(),
    }).eq("id", logRow!.id);
    return { ok: false, error: String(e?.message ?? e), logId: logRow!.id };
  }
}

// ============ GMAIL ============

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function gmailHeaders(): HeadersInit {
  const lov = process.env.LOVABLE_API_KEY;
  const gm = process.env.GOOGLE_MAIL_API_KEY;
  if (!lov || !gm) throw new Error("Conexão Gmail não configurada");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": gm };
}

function decodeB64Url(data: string): string {
  try {
    const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
    if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf-8");
    return atob(b64);
  } catch { return ""; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractBody(payload: any): string {
  if (!payload) return "";
  const parts: any[] = [];
  const walk = (p: any) => {
    if (!p) return;
    if (p.body?.data) parts.push({ mime: p.mimeType, data: p.body.data });
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  };
  walk(payload);
  const plain = parts.find(p => p.mime === "text/plain");
  if (plain) return decodeB64Url(plain.data);
  const html = parts.find(p => p.mime === "text/html");
  if (html) return stripHtml(decodeB64Url(html.data));
  if (parts[0]) return decodeB64Url(parts[0].data);
  return "";
}

function header(headers: any[], name: string): string {
  const h = headers?.find((x: any) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

export async function sincronizarGmailContas(): Promise<{ contas: number; novos: number; erros: number; detalhes: any[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: contas } = await supabaseAdmin
    .from("email_inbox_accounts")
    .select("*")
    .eq("ativo", true)
    .eq("provider", "gmail");

  let novos = 0, erros = 0;
  const detalhes: any[] = [];

  for (const conta of contas ?? []) {
    let contaNovos = 0, contaErros = 0, contaProc = 0;
    try {
      // Lista as últimas 20 mensagens da INBOX (não-lidas têm prioridade)
      const listRes = await fetch(`${GMAIL_GATEWAY}/users/me/messages?maxResults=20&q=in:inbox newer_than:2d`, {
        headers: gmailHeaders(),
      });
      if (!listRes.ok) throw new Error(`Gmail list ${listRes.status}: ${(await listRes.text()).slice(0, 200)}`);
      const listJson = await listRes.json();
      const msgs: { id: string }[] = listJson.messages ?? [];

      for (const m of msgs) {
        // Dedup rápido
        const { data: existe } = await supabaseAdmin.from("email_inbox_log")
          .select("id").eq("account_id", conta.id).eq("external_id", m.id).maybeSingle();
        if (existe) continue;

        const mr = await fetch(`${GMAIL_GATEWAY}/users/me/messages/${m.id}?format=full`, { headers: gmailHeaders() });
        if (!mr.ok) { erros++; contaErros++; continue; }
        const mj = await mr.json();
        const hdrs = mj.payload?.headers ?? [];
        const from = header(hdrs, "From");
        const to = header(hdrs, "To");
        const subject = header(hdrs, "Subject");
        const body = extractBody(mj.payload) || mj.snippet || "";

        const res = await ingerirEmail({
          account: conta, remetente: from, destinatario: to,
          assunto: subject, corpo: body, externalId: m.id,
        });
        contaProc++;
        if (res.ok && res.protocoloId) { novos++; contaNovos++; }
        else if (!res.ok) { erros++; contaErros++; }
        detalhes.push({ id: m.id, subject, ok: res.ok, numero: res.numero, error: res.error });
      }

      await supabaseAdmin.from("email_inbox_accounts")
        .update({
          ultima_sincronizacao: new Date().toISOString(),
          ultima_sync_novos: contaNovos,
          ultima_sync_erros: contaErros,
          ultima_sync_processados: contaProc,
        })
        .eq("id", conta.id);
    } catch (e: any) {
      erros++;
      detalhes.push({ conta: conta.email, error: String(e?.message ?? e) });
    }
  }

  return { contas: contas?.length ?? 0, novos, erros, detalhes };
}

// ============ IMAP (senha de app) ============

export async function sincronizarImapContas(): Promise<{ contas: number; novos: number; erros: number; detalhes: any[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");

  const { data: contas } = await supabaseAdmin
    .from("email_inbox_accounts")
    .select("*")
    .eq("ativo", true)
    .eq("provider", "imap");

  let novos = 0, erros = 0;
  const detalhes: any[] = [];

  for (const conta of contas ?? []) {
    let contaNovos = 0, contaErros = 0, contaProc = 0;
    let client: any = null;
    try {
      if (!conta.imap_host || !conta.imap_user || !conta.imap_password) {
        throw new Error("Credenciais IMAP incompletas (host/usuário/senha)");
      }
      client = new ImapFlow({
        host: conta.imap_host,
        port: conta.imap_port ?? 993,
        secure: conta.imap_tls ?? true,
        auth: { user: conta.imap_user, pass: conta.imap_password },
        logger: false,
      });
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        // Busca as últimas 20 mensagens (mais recentes primeiro)
        const status = await client.status("INBOX", { messages: true });
        const total = status.messages ?? 0;
        if (total === 0) {
          await supabaseAdmin.from("email_inbox_accounts").update({
            ultima_sincronizacao: new Date().toISOString(),
            ultima_sync_novos: 0, ultima_sync_erros: 0, ultima_sync_processados: 0,
          }).eq("id", conta.id);
          continue;
        }
        const from = Math.max(1, total - 19);
        const range = `${from}:${total}`;

        for await (const msg of client.fetch(range, { uid: true, envelope: true, source: true })) {
          const externalId = `uid:${msg.uid}`;
          const { data: existe } = await supabaseAdmin.from("email_inbox_log")
            .select("id").eq("account_id", conta.id).eq("external_id", externalId).maybeSingle();
          if (existe) continue;

          try {
            const parsed = await simpleParser(msg.source as Buffer);
            const remetente = parsed.from?.text ?? msg.envelope?.from?.[0]?.address ?? "";
            const destinatario = parsed.to && "text" in parsed.to ? (parsed.to as any).text : (conta.email ?? "");
            const assunto = parsed.subject ?? msg.envelope?.subject ?? "";
            const corpo = (parsed.text || (parsed.html ? stripHtml(parsed.html) : "") || "").trim();

            const res = await ingerirEmail({
              account: conta, remetente, destinatario, assunto, corpo, externalId,
            });
            contaProc++;
            if (res.ok && res.protocoloId) { novos++; contaNovos++; }
            else if (!res.ok) { erros++; contaErros++; }
            detalhes.push({ uid: msg.uid, subject: assunto, ok: res.ok, numero: res.numero, error: res.error });
          } catch (e: any) {
            erros++; contaErros++;
            detalhes.push({ uid: msg.uid, error: String(e?.message ?? e) });
          }
        }
      } finally {
        lock.release();
      }

      await supabaseAdmin.from("email_inbox_accounts").update({
        ultima_sincronizacao: new Date().toISOString(),
        ultima_sync_novos: contaNovos,
        ultima_sync_erros: contaErros,
        ultima_sync_processados: contaProc,
      }).eq("id", conta.id);
    } catch (e: any) {
      erros++;
      detalhes.push({ conta: conta.email, error: String(e?.message ?? e) });
    } finally {
      try { await client?.logout(); } catch {}
    }
  }

  return { contas: contas?.length ?? 0, novos, erros, detalhes };
}