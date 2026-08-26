import type { MlOffer } from "./mercadolivre.js";

function formatMoney(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function renderMessage(template: string, offer: MlOffer, affiliateLink: string): string {
  return template
    .replaceAll("{titulo}", offer.title)
    .replaceAll("{preco}", formatMoney(offer.price))
    .replaceAll("{preco_original}", formatMoney(offer.originalPrice))
    .replaceAll("{desconto}", String(offer.discountPercent))
    .replaceAll("{link}", affiliateLink)
    .replaceAll("{imagem}", offer.thumbnail);
}
