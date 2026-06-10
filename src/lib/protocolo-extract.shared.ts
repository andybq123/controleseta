export const PROTOCOLO_EXTRACT_SYSTEM = `Você extrai dados estruturados de protocolos de Ouvidoria/LAI de prefeituras a partir de texto colado pelo usuário (e-mails, mensagens, formulários).
Responda APENAS com JSON válido (sem markdown, sem texto extra) com os campos:
{
  "numero": string (número do protocolo se aparecer, ex: "1.940/2026", "Nº: 1940/2026", "Ouvidoria 1.940/2026", "Protocolo 12345"; preserve a formatação original incluindo pontos e barras; senão ""),
  "tipo": "ouvidoria" | "lai" (LAI se for pedido de informação/Lei de Acesso à Informação, senão ouvidoria),
  "categoria": "elogio" | "reclamacao" | "pedido_informacao" | "denuncia" | "solicitacao" | "outros",
  "assunto": string (procure o campo "Assunto:" do e-mail/notificação; senão um resumo curto, até 120 caracteres),
  "descricao": string (descrição mais detalhada do que foi pedido/relatado),
  "solicitante": string (nome do solicitante — geralmente após "De:" no e-mail; ignore o nome da prefeitura/remetente automático; senão ""),
  "data_abertura": string (YYYY-MM-DD se aparecer — converta datas em português como "10 de junho de 2026" para "2026-06-10"; senão ""),
  "secretaria_sugerida": string (nome da secretaria/órgão sugerido — geralmente após "Para:" no e-mail, ex: "SETA - OUV - Ouvidoria Geral", "Secretaria de Saúde"; senão ""),
  "local_sugerido": string (bairro, escola, unidade, rua se aparecer, senão "")
}
Use string vazia "" quando não houver informação. Não invente dados.
Categorize "Demora em marcar consulta", "Falta de atendimento", etc. como "reclamacao". "Pedido de informação" / "LAI" => tipo "lai" e categoria "pedido_informacao".`;

export type ExtracaoProtocolo = {
  numero: string;
  tipo: "ouvidoria" | "lai";
  categoria: "elogio" | "reclamacao" | "pedido_informacao" | "denuncia" | "solicitacao" | "outros";
  assunto: string;
  descricao: string;
  solicitante: string;
  data_abertura: string;
  secretaria_sugerida: string;
  local_sugerido: string;
};

export function normalizarExtracao(parsed: any): ExtracaoProtocolo {
  return {
    numero: String(parsed?.numero ?? ""),
    tipo: parsed?.tipo === "lai" ? "lai" : "ouvidoria",
    categoria: ["elogio", "reclamacao", "pedido_informacao", "denuncia", "solicitacao", "outros"].includes(parsed?.categoria) ? parsed.categoria : "solicitacao",
    assunto: String(parsed?.assunto ?? "").slice(0, 200),
    descricao: String(parsed?.descricao ?? ""),
    solicitante: String(parsed?.solicitante ?? ""),
    data_abertura: /^\d{4}-\d{2}-\d{2}$/.test(parsed?.data_abertura ?? "") ? parsed.data_abertura : "",
    secretaria_sugerida: String(parsed?.secretaria_sugerida ?? ""),
    local_sugerido: String(parsed?.local_sugerido ?? ""),
  };
}