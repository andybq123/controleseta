export function parseNumProtocolo(n: string | null | undefined): [number, number] {
  if (!n) return [0, 0];
  const [seqRaw, yearRaw] = String(n).split("/");
  const seq = parseInt(String(seqRaw ?? "").replace(/\D/g, ""), 10) || 0;
  const year = parseInt(String(yearRaw ?? "").replace(/\D/g, ""), 10) || 0;
  return [year, seq];
}

export function sortProtocolosPorNumero(a: any, b: any): number {
  const [ay, as] = parseNumProtocolo(a.numero);
  const [by, bs] = parseNumProtocolo(b.numero);
  if (by !== ay) return by - ay;   // ano maior primeiro
  return bs - as;                    // sequência maior primeiro
}
