import { db, getSettings } from "../db.js";
import { collectOffers } from "./mercadolivre.js";
import { buildAffiliateLink } from "./affiliate.js";
import { sendWhatsAppMessage } from "./evolution.js";
import { renderMessage } from "./messageTemplate.js";
import { logger } from "../logger.js";

function isWithinQuietHours(quietStart: string | null, quietEnd: string | null): boolean {
  if (!quietStart || !quietEnd) return false;

  const now = new Date();
  const [startH, startM] = quietStart.split(":").map(Number);
  const [endH, endM] = quietEnd.split(":").map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Intervalo cruza a meia-noite (ex.: 22:00 - 07:00)
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export interface PipelineResult {
  itemsFound: number;
  itemsSent: number;
  skipped: boolean;
  reason?: string;
}

export async function runPipeline(trigger: "schedule" | "manual"): Promise<PipelineResult> {
  const settings = getSettings();

  const logInsert = db
    .prepare(
      "INSERT INTO run_logs (started_at, status, trigger) VALUES (datetime('now'), 'running', ?)",
    )
    .run(trigger);
  const logId = logInsert.lastInsertRowid as number;

  const finish = (status: string, itemsFound: number, itemsSent: number, message: string) => {
    db.prepare(
      "UPDATE run_logs SET finished_at = datetime('now'), status = ?, items_found = ?, items_sent = ?, message = ? WHERE id = ?",
    ).run(status, itemsFound, itemsSent, message, logId);
  };

  if (trigger === "schedule" && !settings.schedule.enabled) {
    finish("skipped", 0, 0, "Automacao pausada nas configuracoes.");
    return { itemsFound: 0, itemsSent: 0, skipped: true, reason: "Automacao pausada." };
  }

  if (trigger === "schedule" && isWithinQuietHours(settings.schedule.quietStart, settings.schedule.quietEnd)) {
    finish("skipped", 0, 0, "Execucao dentro do horario de silencio configurado.");
    return { itemsFound: 0, itemsSent: 0, skipped: true, reason: "Horario de silencio." };
  }

  const keywords = (
    db.prepare("SELECT term FROM keywords WHERE active = 1").all() as { term: string }[]
  ).map((k) => k.term);

  if (keywords.length === 0) {
    finish("error", 0, 0, "Nenhuma palavra-chave/categoria configurada.");
    return { itemsFound: 0, itemsSent: 0, skipped: true, reason: "Nenhuma palavra-chave configurada." };
  }

  try {
    const offers = await collectOffers(keywords, settings);

    const alreadySent = new Set(
      (db.prepare("SELECT ml_item_id FROM sent_products").all() as { ml_item_id: string }[]).map(
        (r) => r.ml_item_id,
      ),
    );

    const newOffers = offers
      .filter((offer) => !alreadySent.has(offer.id))
      .slice(0, settings.schedule.maxProductsPerRun);

    let sentCount = 0;
    for (const offer of newOffers) {
      const affiliateLink = buildAffiliateLink(offer.permalink, settings);
      const message = renderMessage(settings.message.template, offer, affiliateLink);

      try {
        await sendWhatsAppMessage(settings, message, offer.thumbnail);
        db.prepare(
          `INSERT INTO sent_products
            (ml_item_id, title, price, original_price, discount_percent, permalink, affiliate_link, thumbnail, keyword, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')`,
        ).run(
          offer.id,
          offer.title,
          offer.price,
          offer.originalPrice,
          offer.discountPercent,
          offer.permalink,
          affiliateLink,
          offer.thumbnail,
          offer.keyword,
        );
        sentCount += 1;
      } catch (error) {
        logger.error(`Erro ao enviar oferta ${offer.id} para o WhatsApp:`, error);
        db.prepare(
          `INSERT INTO sent_products
            (ml_item_id, title, price, original_price, discount_percent, permalink, affiliate_link, thumbnail, keyword, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'failed')`,
        ).run(
          offer.id,
          offer.title,
          offer.price,
          offer.originalPrice,
          offer.discountPercent,
          offer.permalink,
          affiliateLink,
          offer.thumbnail,
          offer.keyword,
        );
      }
    }

    finish(
      "success",
      offers.length,
      sentCount,
      `${offers.length} ofertas encontradas, ${sentCount} enviadas.`,
    );
    return { itemsFound: offers.length, itemsSent: sentCount, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Erro na execucao do pipeline:", error);
    finish("error", 0, 0, message);
    return { itemsFound: 0, itemsSent: 0, skipped: true, reason: message };
  }
}
