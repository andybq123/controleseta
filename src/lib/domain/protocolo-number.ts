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

/** [ano, sequência] de um número "1.234/2026" — usado para ordenar. */
export function parseNumeroProtocolo(n: string | null | undefined): [number, number] {
  if (!n) return [0, 0];
  const [seqRaw, yearRaw] = String(n).split("/");
  const seq = parseInt(String(seqRaw ?? "").replace(/\D/g, ""), 10) || 0;
  const year = parseInt(String(yearRaw ?? "").replace(/\D/g, ""), 10) || 0;
  return [year, seq];
}

/** Mais recente primeiro: ano maior, depois sequência maior. */
export function compararNumeroProtocolo(
  a: { numero: string | null | undefined },
  b: { numero: string | null | undefined },
): number {
  const [ay, as] = parseNumeroProtocolo(a.numero);
  const [by, bs] = parseNumeroProtocolo(b.numero);
  if (by !== ay) return by - ay;
  return bs - as;
}
