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