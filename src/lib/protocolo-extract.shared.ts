export const PROTOCOLO_EXTRACT_SYSTEM = `Você extrai 4 campos de e-mails de protocolos de Ouvidoria/LAI de prefeituras.
Responda APENAS com JSON válido (sem markdown, sem texto extra) com EXATAMENTE estes 4 campos:
{
  "numero": string (valor após "Nº:" ou "Número:" ou "Protocolo:" — ex: "1.940/2026", "1940/2026", "12345"; preserve a formatação original incluindo pontos e barras; senão ""),
  "assunto": string (valor após "Assunto:"; senão ""),
  "solicitante": string (valor após "De:" — nome de quem enviou; ignore endereços automáticos da prefeitura; senão ""),
  "destinatario": string (valor após "Para:" — para quem foi enviado, ex: "SETA - OUV - Ouvidoria Geral"; senão "")
}
Use string vazia "" quando não houver informação. Não invente dados. Não inclua outros campos.`;

export type ExtracaoProtocolo = {
  numero: string;
  assunto: string;
  solicitante: string;
  destinatario: string;
  // Campos derivados/padrão mantidos para compatibilidade com o restante do fluxo
  tipo: "ouvidoria" | "lai";
  categoria: "elogio" | "reclamacao" | "pedido_informacao" | "denuncia" | "solicitacao" | "outros";
  descricao: string;
  data_abertura: string;
  secretaria_sugerida: string;
  local_sugerido: string;
};

export function normalizarExtracao(parsed: any): ExtracaoProtocolo {
  return {
    numero: String(parsed?.numero ?? ""),
    assunto: String(parsed?.assunto ?? "").slice(0, 200),
    solicitante: String(parsed?.solicitante ?? ""),
    destinatario: String(parsed?.destinatario ?? ""),
    // Defaults: a IA não extrai mais estes campos
    tipo: "ouvidoria",
    categoria: "solicitacao",
    descricao: "",
    data_abertura: "",
    secretaria_sugerida: String(parsed?.destinatario ?? ""),
    local_sugerido: "",
  };
}