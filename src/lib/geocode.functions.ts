import { createServerFn } from "@tanstack/react-start";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((d: { endereco: string }) => d)
  .handler(async ({ data }) => {
    const q = data.endereco?.trim();
    if (!q) return { lat: null as number | null, lng: null as number | null };
    // Try structured search first when a house number is present, for precise location
    const allNums = [...q.matchAll(/\b(\d{1,6})\b/g)];
    const numMatch = allNums.length ? allNums[allNums.length - 1] : null;
    const headers = {
      "User-Agent": "OuvidoriaBrusque/1.0 (controleseta.lovable.app)",
      "Accept-Language": "pt-BR",
    };
    async function call(params: URLSearchParams) {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers });
      if (!res.ok) return [] as Array<{ lat: string; lon: string }>;
      return (await res.json()) as Array<{ lat: string; lon: string }>;
    }
    if (numMatch) {
      const numero = numMatch[0];
      const idx = numMatch.index ?? 0;
      const street = (q.slice(0, idx) + q.slice(idx + numero.length))
        .replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim().replace(/^,|,$/g, "");
      const structured = new URLSearchParams({
        street: `${numero} ${street}`.trim(),
        city: "Brusque",
        state: "Santa Catarina",
        country: "Brasil",
        format: "json",
        limit: "1",
        countrycodes: "br",
      });
      const sArr = await call(structured);
      if (sArr.length) return { lat: parseFloat(sArr[0].lat), lng: parseFloat(sArr[0].lon) };
    }
    const params = new URLSearchParams({
      q: `${q}, Brusque, Santa Catarina, Brasil`,
      format: "json",
      limit: "1",
      countrycodes: "br",
      addressdetails: "0",
    });
    const arr = await call(params);
    if (!arr.length) return { lat: null, lng: null };
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  });

export type AddressSuggestion = {
  label: string;
  lat: number;
  lng: number;
  houseNumber?: string;
};

export const searchAddresses = createServerFn({ method: "POST" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }): Promise<AddressSuggestion[]> => {
    const q = data.q?.trim();
    if (!q || q.length < 3) return [];

    const headers = {
      "User-Agent": "OuvidoriaBrusque/1.0 (controleseta.lovable.app)",
      "Accept-Language": "pt-BR",
    };

    async function call(params: URLSearchParams) {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers });
      if (!res.ok) return [] as Array<{
        lat: string; lon: string; display_name: string;
        address?: Record<string, string>;
      }>;
      return (await res.json()) as Array<{
        lat: string; lon: string; display_name: string;
        address?: Record<string, string>;
      }>;
    }

    function toSuggestions(arr: Array<{
      lat: string; lon: string; display_name: string;
      address?: Record<string, string>;
    }>) {
      return arr.map(r => {
        const a = r.address ?? {};
        const rua = a.road || a.pedestrian || a.cycleway || a.footway || "";
        const numero = a.house_number || "";
        const bairro = a.suburb || a.neighbourhood || a.village || "";
        const cidade = a.city || a.town || a.municipality || "Brusque";
        const ruaComNumero = rua ? (numero ? `${rua}, ${numero}` : rua) : "";
        const short = [ruaComNumero, bairro, cidade].filter(Boolean).join(" - ");
        return {
          label: short || r.display_name,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          houseNumber: numero || undefined,
        };
      });
    }

    // If a house number is present, try structured search for precise results.
    // Use the LAST number in the query (house numbers come after street names like "Rua 7 de Setembro, 174").
    const allNums = [...q.matchAll(/\b(\d{1,6})\b/g)];
    const numMatch = allNums.length ? allNums[allNums.length - 1] : null;
    if (numMatch) {
      const numero = numMatch[0];
      const idx = numMatch.index ?? 0;
      const street = (q.slice(0, idx) + q.slice(idx + numero.length))
        .replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim().replace(/^,|,$/g, "");
      const structured = new URLSearchParams({
        street: `${numero} ${street}`.trim(),
        city: "Brusque",
        state: "Santa Catarina",
        country: "Brasil",
        format: "json",
        limit: "6",
        countrycodes: "br",
        addressdetails: "1",
      });
      const sArr = await call(structured);
      if (sArr.length) return toSuggestions(sArr);
    }

    const params = new URLSearchParams({
      q: `${q}, Brusque, Santa Catarina, Brasil`,
      format: "json",
      limit: "6",
      countrycodes: "br",
      addressdetails: "1",
    });
    const arr = await call(params);
    return toSuggestions(arr);
  });