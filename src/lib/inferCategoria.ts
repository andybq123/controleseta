import type { CategoriaProtocolo } from "@/lib/prazo";

/**
 * Inferência heurística da categoria de uma manifestação antiga a partir
 * do texto livre (comentário/assunto). A planilha original possuía a coluna
 * "tipo de manifestação", mas ela não foi preservada no JSON. Esta função
 * tenta recuperar essa informação pelo texto.
 *
 * Ordem importa: padrões mais específicos primeiro.
 */
export function inferCategoriaFromTexto(texto: string | null | undefined): CategoriaProtocolo {
  const t = (texto ?? "").toLowerCase();
  if (!t.trim()) return "outros";

  // Elogio
  if (/\belogio|parab[eé]ns|agradec|cumpriment/.test(t)) return "elogio";

  // Denúncia
  if (/\bden[uú]nci|maus[- ]tratos|ilegal|clandestin|irregular|sem alvar[aá]|abandonad[oa]s?\b|perturba(ç|c)[aã]o|som alto|barulho excessivo|invas[aã]o|fraude|corrup(ç|c)|indevidamente|depositand|entulho|bloqueando a (rua|via)|c[aã]o solto|cachorro solto|maus tratos/.test(t))
    return "denuncia";

  // Reclamação
  if (/\breclama|insatisf|descontent|demora|atraso|p[eé]ssim|prec[aá]ri|n[aã]o (foi|fui|fomos) atend|sem retorno|sem resposta|m[aá] qualidade|atendimento ruim|grosseria|grossei?ro|constrangedor|negativa de atendiment|falta de funcion|falta de m[eé]dic|falta de medicament/.test(t))
    return "reclamacao";

  // Pedido de informação
  if (/\b(gostaria de saber|pedido de informa|solicita(ç|c)[aã]o de informa|esclarec|informa(ç|c)[oõ]es sobre|questiona|d[uú]vida|tirar d[uú]vida)/.test(t))
    return "pedido_informacao";

  // Solicitação (verbos de pedido / serviços / problemas urbanos típicos)
  if (/\bsolicit|requer|pede(\b|m)|pedido|vistoria|fiscaliza|manuten(ç|c)[aã]o|reparo|conserto|poda|capina|ro(ç|c)ada|tapa[- ]?buraco|buraco|coleta|recolhiment|remo(ç|c)[aã]o|instala(ç|c)[aã]o|providenci|troca de l[aâ]mpada|l[aâ]mpada queim|esgoto|ilumina(ç|c)[aã]o|sinaliza(ç|c)[aã]o/.test(t))
    return "solicitacao";

  // Padrão: a esmagadora maioria das ouvidorias é solicitação.
  return "solicitacao";
}