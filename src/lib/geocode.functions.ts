import { createServerFn } from "@tanstack/react-start";
import { parseSuggestion, extractQueryNumber, type NominatimResult } from "./address-parse";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((d: { endereco: string }) => d)
  .handler(async ({ data }) => {
    const q = data.endereco?.trim();
    if (!q) return { lat: null as number | null, lng: null as number | null };
    // Try structured search first when a house number is present, for precise location
    const numero = extractQueryNumber(q);
    const headers = {
      "User-Agent": "OuvidoriaBrusque/1.0 (controleseta.lovable.app)",
      "Accept-Language": "pt-BR",
    };
    async function call(params: URLSearchParams) {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers });
      if (!res.ok) return [] as Array<{ lat: string; lon: string }>;
      return (await res.json()) as Array<{ lat: string; lon: string }>;
    }
    if (numero) {
      const idx = q.lastIndexOf(numero);
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

    function toSuggestions(arr: NominatimResult[], fallbackNumero?: string) {
      return arr.map(r => parseSuggestion(r, fallbackNumero));
    }

    // If a house number is present, try structured search for precise results.
    // Use the LAST number in the query (house numbers come after street names like "Rua 7 de Setembro, 174").
    const numero = extractQueryNumber(q);
    if (numero) {
      const idx = q.lastIndexOf(numero);
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
      if (sArr.length) return toSuggestions(sArr, numero);
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