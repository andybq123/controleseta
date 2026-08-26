import { Router } from "express";
import { z } from "zod";
import { getSettings, saveSettings } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { refreshSchedule } from "../scheduler.js";
import { checkEvolutionConnection, sendWhatsAppMessage } from "../services/evolution.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const settingsSchema = z.object({
  ml: z
    .object({
      site: z.string().min(2).optional(),
      minDiscountPercent: z.number().min(0).max(100).optional(),
      minPrice: z.number().min(0).nullable().optional(),
      maxPrice: z.number().min(0).nullable().optional(),
      affiliateMattWord: z.string().optional(),
      affiliateMattTool: z.string().optional(),
    })
    .partial()
    .optional(),
  schedule: z
    .object({
      enabled: z.boolean().optional(),
      cron: z.string().min(1).optional(),
      quietStart: z.string().nullable().optional(),
      quietEnd: z.string().nullable().optional(),
      maxProductsPerRun: z.number().min(1).max(50).optional(),
    })
    .partial()
    .optional(),
  evolution: z
    .object({
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
      instance: z.string().optional(),
      groupJid: z.string().optional(),
      sendImage: z.boolean().optional(),
    })
    .partial()
    .optional(),
  message: z
    .object({
      template: z.string().min(1).optional(),
    })
    .partial()
    .optional(),
});

settingsRouter.get("/", (_req, res) => {
  res.json(getSettings());
});

settingsRouter.put("/", (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Configuracoes invalidas.", details: parsed.error.flatten() });
    return;
  }

  const updated = saveSettings(parsed.data as never);
  refreshSchedule();
  res.json(updated);
});

settingsRouter.post("/test-whatsapp", async (_req, res) => {
  const settings = getSettings();
  try {
    await sendWhatsAppMessage(
      settings,
      "✅ Teste de conexao do painel de automacao Mercado Livre. Se voce recebeu esta mensagem, esta tudo certo!",
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

settingsRouter.get("/evolution-status", async (_req, res) => {
  const settings = getSettings();
  const result = await checkEvolutionConnection(settings);
  res.json(result);
});
