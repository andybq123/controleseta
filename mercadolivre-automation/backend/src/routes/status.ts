import { Router } from "express";
import cronParser from "cron-parser";
import { db, getSettings } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const statusRouter = Router();
statusRouter.use(requireAuth);

statusRouter.get("/", (_req, res) => {
  const settings = getSettings();

  const lastLog = db.prepare("SELECT * FROM run_logs ORDER BY id DESC LIMIT 1").get();

  const today = new Date().toISOString().slice(0, 10);
  const sentToday = (
    db
      .prepare("SELECT COUNT(*) as c FROM sent_products WHERE status = 'sent' AND date(sent_at) = ?")
      .get(today) as { c: number }
  ).c;

  const totalSent = (
    db.prepare("SELECT COUNT(*) as c FROM sent_products WHERE status = 'sent'").get() as {
      c: number;
    }
  ).c;

  const keywordsActive = (
    db.prepare("SELECT COUNT(*) as c FROM keywords WHERE active = 1").get() as { c: number }
  ).c;

  let nextRun: string | null = null;
  if (settings.schedule.enabled) {
    try {
      const interval = cronParser.parseExpression(settings.schedule.cron);
      nextRun = interval.next().toISOString();
    } catch {
      nextRun = null;
    }
  }

  res.json({
    enabled: settings.schedule.enabled,
    nextRun,
    lastLog,
    sentToday,
    totalSent,
    keywordsActive,
  });
});
