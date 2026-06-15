export type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

export type ParsedAddress = {
  label: string;
  lat: number;
  lng: number;
  houseNumber?: string;
};

/**
 * Extract the house number for a Nominatim result.
 * Priority:
 *   1. address.house_number (when Nominatim returns it explicitly)
 *   2. number that appears right after the street name in display_name
 *      (e.g. "Rua 7 de Setembro, 174, Centro, Brusque...")
 *   3. fallback number (typically the one the user typed)
 */
export function extractHouseNumber(
  r: Pick<NominatimResult, "display_name" | "address">,
  fallbackNumero?: string,
): string | undefined {
  const a = r.address ?? {};
  if (a.house_number) return a.house_number;
  const rua = a.road || a.pedestrian || a.cycleway || a.footway || "";
  if (rua && r.display_name) {
    const esc = rua.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = r.display_name.match(new RegExp(`${esc},\\s*(\\d{1,6})\\b`));
    if (m) return m[1];
  }
  return fallbackNumero || undefined;
}

export function parseSuggestion(
  r: NominatimResult,
  fallbackNumero?: string,
): ParsedAddress {
  const a = r.address ?? {};
  const rua = a.road || a.pedestrian || a.cycleway || a.footway || "";
  const numero = extractHouseNumber(r, fallbackNumero);
  const bairro = a.suburb || a.neighbourhood || a.village || "";
  const cidade = a.city || a.town || a.municipality || "Brusque";
  const ruaComNumero = rua ? (numero ? `${rua}, ${numero}` : rua) : "";
  const short = [ruaComNumero, bairro, cidade].filter(Boolean).join(" - ");
  return {
    label: short || r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    houseNumber: numero,
  };
}

/** Returns the last 1-6 digit number in the query, or null. */
export function extractQueryNumber(q: string): string | null {
  const all = [...q.matchAll(/\b(\d{1,6})\b/g)];
  return all.length ? all[all.length - 1][1] : null;
}