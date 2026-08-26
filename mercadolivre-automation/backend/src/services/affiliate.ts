import type { AppSettings } from "../db.js";

/**
 * Gera o link de afiliado a partir do link do produto (permalink).
 *
 * O programa de Afiliados do Mercado Livre usa parametros de rastreio
 * (`matt_word` e `matt_tool`) anexados a URL do produto. Esses valores sao
 * obtidos no painel de afiliados do Mercado Livre (Central de Afiliados) e
 * devem ser configurados em Configuracoes > Mercado Livre no painel.
 *
 * Se nenhum dos dois estiver configurado, o link original do produto e
 * retornado sem alteracoes.
 */
export function buildAffiliateLink(permalink: string, settings: AppSettings): string {
  const { affiliateMattWord, affiliateMattTool } = settings.ml;
  if (!affiliateMattWord && !affiliateMattTool) return permalink;

  try {
    const url = new URL(permalink);
    if (affiliateMattWord) url.searchParams.set("matt_word", affiliateMattWord);
    if (affiliateMattTool) url.searchParams.set("matt_tool", affiliateMattTool);
    return url.toString();
  } catch {
    return permalink;
  }
}
