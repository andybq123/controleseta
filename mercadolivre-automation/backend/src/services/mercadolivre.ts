import type { AppSettings } from "../db.js";
import { logger } from "../logger.js";

export interface MlOffer {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  discountPercent: number;
  permalink: string;
  thumbnail: string;
  keyword: string;
}

interface MlSearchResult {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  permalink: string;
  thumbnail: string;
}

interface MlSearchResponse {
  results: MlSearchResult[];
}

/**
 * Busca ofertas no catalogo publico do Mercado Livre para um termo/categoria.
 * Usa a API publica de busca (sem necessidade de autenticacao) e calcula o
 * desconto comparando `price` com `original_price`, quando disponivel.
 */
export async function fetchOffersForKeyword(
  keyword: string,
  settings: AppSettings,
): Promise<MlOffer[]> {
  const url = new URL(`https://api.mercadolibre.com/sites/${settings.ml.site}/search`);
  url.searchParams.set("q", keyword);
  url.searchParams.set("limit", "50");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao consultar Mercado Livre para "${keyword}": HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as MlSearchResponse;

  const offers: MlOffer[] = [];
  for (const item of data.results ?? []) {
    if (!item.original_price || item.original_price <= item.price) continue;

    const discountPercent = Math.round(
      ((item.original_price - item.price) / item.original_price) * 100,
    );

    if (discountPercent < settings.ml.minDiscountPercent) continue;
    if (settings.ml.minPrice !== null && item.price < settings.ml.minPrice) continue;
    if (settings.ml.maxPrice !== null && item.price > settings.ml.maxPrice) continue;

    offers.push({
      id: item.id,
      title: item.title,
      price: item.price,
      originalPrice: item.original_price,
      discountPercent,
      permalink: item.permalink,
      thumbnail: item.thumbnail?.replace(/^http:/, "https:") ?? "",
      keyword,
    });
  }

  logger.info(
    `Mercado Livre: "${keyword}" -> ${data.results?.length ?? 0} resultados, ${offers.length} com desconto suficiente`,
  );

  return offers.sort((a, b) => b.discountPercent - a.discountPercent);
}

export async function collectOffers(
  keywords: string[],
  settings: AppSettings,
): Promise<MlOffer[]> {
  const all: MlOffer[] = [];
  for (const keyword of keywords) {
    try {
      const offers = await fetchOffersForKeyword(keyword, settings);
      all.push(...offers);
    } catch (error) {
      logger.error(`Erro coletando ofertas para "${keyword}":`, error);
    }
  }

  const seen = new Set<string>();
  return all.filter((offer) => {
    if (seen.has(offer.id)) return false;
    seen.add(offer.id);
    return true;
  });
}
