import { createServerFn } from "@tanstack/react-start";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((d: { endereco: string }) => d)
  .handler(async ({ data }) => {
    const q = data.endereco?.trim();
    if (!q) return { lat: null as number | null, lng: null as number | null };
    const params = new URLSearchParams({
      q: `${q}, Brusque, Santa Catarina, Brasil`,
      format: "json",
      limit: "1",
      countrycodes: "br",
      addressdetails: "0",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "OuvidoriaBrusque/1.0 (controleseta.lovable.app)",
        "Accept-Language": "pt-BR",
      },
    });
    if (!res.ok) return { lat: null, lng: null };
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr.length) return { lat: null, lng: null };
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  });

export type AddressSuggestion = {
  label: string;
  lat: number;
  lng: number;
};

export const searchAddresses = createServerFn({ method: "POST" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }): Promise<AddressSuggestion[]> => {
    const q = data.q?.trim();
    if (!q || q.length < 3) return [];
    const params = new URLSearchParams({
      q: `${q}, Brusque, Santa Catarina, Brasil`,
      format: "json",
      limit: "6",
      countrycodes: "br",
      addressdetails: "1",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "OuvidoriaBrusque/1.0 (controleseta.lovable.app)",
        "Accept-Language": "pt-BR",
      },
    });
    if (!res.ok) return [];
    const arr = (await res.json()) as Array<{
      lat: string; lon: string; display_name: string;
      address?: Record<string, string>;
    }>;
    return arr.map(r => {
      const a = r.address ?? {};
      const rua = a.road || a.pedestrian || a.cycleway || a.footway || "";
      const bairro = a.suburb || a.neighbourhood || a.village || "";
      const cidade = a.city || a.town || a.municipality || "Brusque";
      const short = [rua, bairro, cidade].filter(Boolean).join(" - ");
      return {
        label: short || r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      };
    });
  });