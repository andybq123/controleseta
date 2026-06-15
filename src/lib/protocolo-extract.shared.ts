// Lista fechada de assuntos/categorias reconhecidas pelo sistema.
// Use exatamente um destes valores em "assunto_categoria" (ou "" se não houver match claro).
export const ASSUNTOS_CATEGORIAS = [
  "Assistência Social",
  "Conduta de Funcionários",
  "Creches e Escolas",
  "Denúncia de Assédio",
  "Esgoto",
  "Condição sanitária irregular",
  "Estabelecimento com acessibilidade irregular",
  "Estabelecimento sem alvará",
  "Estabelecimento sem nota fiscal",
  "Estabelecimento sem saída de emergência",
  "Falta de Higiene",
  "Mercadorias vencidas",
  "Ocupação irregular de área pública",
  "Abuso de poder",
  "Demora em processo",
  "Desorganização",
  "Desvio de função",
  "Desvio de verba pública",
  "Nepotismo",
  "Iluminação e Energia",
  "Coleta de Lixo Comum",
  "Coleta pesada",
  "Entulho em via pública",
  "Limpeza em terreno baldio",
  "Limpeza urbana",
  "Mato alto",
  "Poda de árvores de rua",
  "Aterro sanitário irregular",
  "Desmatamento irregular",
  "Maus tratos a animais",
  "Poluição Ambiental",
  "Queimada irregular",
  "Pagamentos",
  "Praça e ou quadra para lazer e esportes",
  "Programas Sociais",
  "Recursos Humanos",
  "Demora em marcar consulta / procedimento",
  "Falta de materiais em Posto de Saúde",
  "Falta de medicação",
  "Foco de dengue",
  "Infestação / Proliferação de animais ou pragas",
  "Médicos",
  "Postos de Saúde",
  "Transporte para tratamento",
  "Vacinas",
  "Baderna",
  "Ponto de assalto/roubo",
  "Ponto de tráfico de drogas",
  "Risco de desmoronamento",
  "Acessibilidade para deficientes visuais",
  "Asfalto",
  "Bloqueio na via",
  "Buraco",
  "Calçadas",
  "Estacionamento irregular",
  "Faixa de pedestre",
  "Lombadas",
  "Placas de sinalização",
  "Semáforos",
  "Via sem pavimentação (Estrada de chão)",
  "Horários de Ônibus",
  "Ônibus danificado",
  "Ponto de ônibus",
  "Super-lotação em ônibus",
  "Transporte irregular",
  "Construção Irregular",
  "Demora em Obra Pública",
  "Fiscalização de Obras",
  "Imóvel abandonado",
  "Invasão de área pública",
  "Serviço mal feito",
] as const;

export const PROTOCOLO_EXTRACT_SYSTEM = `Você extrai campos de e-mails de protocolos de Ouvidoria/LAI de prefeituras.
Responda APENAS com JSON válido (sem markdown, sem texto extra) com EXATAMENTE estes 5 campos:
{
  "numero": string (valor após "Nº:" ou "Número:" ou "Protocolo:" — ex: "1.940/2026", "1940/2026", "12345"; preserve a formatação original incluindo pontos e barras; senão ""),
  "assunto": string (valor após "Assunto:"; senão ""),
  "solicitante": string (valor após "De:" — nome de quem enviou; ignore endereços automáticos da prefeitura; senão ""),
  "destinatario": string (valor após "Para:" — para quem foi enviado, ex: "SETA - OUV - Ouvidoria Geral"; senão ""),
  "assunto_categoria": string (classifique o teor da manifestação em EXATAMENTE UM dos rótulos abaixo, copiando o texto IDÊNTICO; se nenhum se aplica, use "")
}

Rótulos válidos para "assunto_categoria":
${ASSUNTOS_CATEGORIAS.map(a => `- ${a}`).join("\n")}

Use string vazia "" quando não houver informação. Não invente dados. Não inclua outros campos.`;

export type ExtracaoProtocolo = {
  numero: string;
  assunto: string;
  solicitante: string;
  destinatario: string;
  assunto_categoria: string;
  // Campos derivados/padrão mantidos para compatibilidade com o restante do fluxo
  tipo: "ouvidoria" | "lai" | "esic";
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
    assunto_categoria: String(parsed?.assunto_categoria ?? ""),
    // Defaults: a IA não extrai mais estes campos
    tipo: "ouvidoria",
    categoria: "solicitacao",
    descricao: "",
    data_abertura: "",
    secretaria_sugerida: String(parsed?.destinatario ?? ""),
    local_sugerido: "",
  };
}

/**
 * Remove cabeçalhos de e-mail (Responder a:, Para: lista de e-mails, De: <email>, etc.)
 * e isola apenas o bloco útil do protocolo (a partir de "Nova Ouvidoria recebida"
 * até antes do rodapé "Atenção: Ao responder..." / "Acompanhar online").
 *
 * Isso evita que a IA confunda destinatários do e-mail (caixas internas da prefeitura)
 * com o campo "Para:" do protocolo (ex.: "SETA - OUV - Ouvidoria Geral").
 */
export function sanitizarTextoProtocolo(input: string): string {
  if (!input) return "";
  const text = input.replace(/\r\n/g, "\n");

  // 1) Tenta isolar o bloco "Nova {Ouvidoria|LAI|E-SIC|Manifestação} ... recebida"
  const startRe = /Nova\s+(?:Ouvidoria|LAI|E-?SIC|Manifesta(?:ç|c)(?:ã|a)o)[^\n]*recebid[ao][^\n]*/i;
  const startMatch = text.match(startRe);
  if (startMatch && typeof startMatch.index === "number") {
    const rest = text.slice(startMatch.index);
    const stopRe = /(Atenção:\s*Ao responder|Ao responder este e-?mail|Acompanhar online)/i;
    const stopIdx = rest.search(stopRe);
    const block = stopIdx >= 0 ? rest.slice(0, stopIdx) : rest;
    return block.trim();
  }

  // 2) Fallback: remove linhas típicas de cabeçalho de e-mail
  const headerLineRe =
    /^\s*(Responder a:|Reply-to:|Cc:|Bcc:|Enviado em:|Sent:|Data:|Date:|Assinado por:)/i;
  // "De:" / "Para:" / "From:" / "To:" só são descartados quando contêm e-mail (@)
  const headerWithEmailRe = /^\s*(De|Para|From|To):.*@.*$/i;

  return text
    .split("\n")
    .filter((l) => !headerLineRe.test(l) && !headerWithEmailRe.test(l))
    .join("\n")
    .trim();
}