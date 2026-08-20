/** Parsing/matching puro usado na conclusão em lote de protocolos colados em texto livre. */

export type LinhaColada = {
  raw: string;
  numero?: string;
  data?: string; // yyyy-mm-dd
  url?: string;
};

export function parseData(s: string): string | undefined {
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (br) {
    const d = br[1].padStart(2, "0");
    const m = br[2].padStart(2, "0");
    let y = br[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

export function parseLinha(raw: string): LinhaColada | null {
  const line = raw.trim();
  if (!line) return null;
  const urlMatch = line.match(/https?:\/\/\S+/i);
  const url = urlMatch?.[0].replace(/[),.;]+$/, "");
  const rest = url ? line.replace(url, " ") : line;
  const data = parseData(rest);
  const restNoDate = data
    ? rest
        .replace(/\b\d{4}-\d{2}-\d{2}\b/, " ")
        .replace(/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/, " ")
    : rest;
  // número: sequência com dígitos, possivelmente com "/" (ex: 12345/2025) ou hífen
  const numMatch = restNoDate.match(/([A-Z0-9]*\d{2,}[A-Z0-9/-]*)/i);
  const numero = numMatch?.[1]?.replace(/^[^\d]+/, "");
  return { raw: line, numero, data, url };
}

export function formatMilhar(value: string) {
  return value.length > 3 ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : value;
}

/** Variantes de busca (com/sem pontuação, com/sem ano) para o `.or()` do Supabase. */
export function construirBuscaNumero(numero: string) {
  const numNorm = numero.toUpperCase().trim();
  const [baseRaw, ...rest] = numNorm.split("/");
  const anoRaw = rest.join("/").replace(/\D/g, "");
  const baseDigits = baseRaw.replace(/\D/g, "");
  const allDigits = numNorm.replace(/\D/g, "");
  const baseDot = formatMilhar(baseDigits);
  const variants = new Set<string>();

  [numNorm, baseDigits, baseDot].forEach((v) => {
    if (v) variants.add(v);
  });

  if (baseDigits && anoRaw) {
    variants.add(`${baseDigits}/${anoRaw}`);
    variants.add(`${baseDot}/${anoRaw}`);
  }

  const orParts: string[] = [];
  variants.forEach((v) => {
    orParts.push(`numero.eq.${v}`);
    orParts.push(`numero.ilike.${v}/%`);
  });

  return { orParts, baseDigits, anoRaw, allDigits };
}

export function pontuarMatchNumero(
  numeroBanco: string,
  baseDigits: string,
  anoRaw: string,
  allDigits: string,
) {
  const bancoDigits = numeroBanco.replace(/\D/g, "");
  let score = 0;
  if (allDigits && bancoDigits === allDigits) score += 100;
  if (baseDigits && bancoDigits.startsWith(baseDigits)) score += 30;
  if (anoRaw && numeroBanco.includes(anoRaw)) score += 50;
  return score;
}

/** Escolhe o melhor candidato dentre vários protocolos retornados pela busca `.or()`. */
export function melhorMatch<T extends { numero: string }>(
  candidatos: T[],
  baseDigits: string,
  anoRaw: string,
  allDigits: string,
): T | undefined {
  return [...candidatos].sort(
    (a, b) =>
      pontuarMatchNumero(b.numero, baseDigits, anoRaw, allDigits) -
      pontuarMatchNumero(a.numero, baseDigits, anoRaw, allDigits),
  )[0];
}
