import type { TipoProtocolo } from "./prazo";

/**
 * Número de protocolo no formato "1.234/AAAA". A unicidade real é garantida
 * pela constraint no banco (supabase/migrations/0002_protocolos.sql); em
 * caso de colisão, quem chama deve gerar de novo e tentar o insert outra vez.
 */
export function gerarNumeroProtocolo(
  _tipo: TipoProtocolo,
  ano: number = new Date().getFullYear(),
  random: () => number = Math.random,
): string {
  const seq = Math.floor(random() * 9000) + 1000;
  const formatted = seq.toLocaleString("pt-BR");
  return `${formatted}/${ano}`;
}
