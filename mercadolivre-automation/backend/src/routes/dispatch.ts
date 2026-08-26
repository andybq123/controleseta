import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runPipeline } from "../services/pipeline.js";

export const dispatchRouter = Router();
dispatchRouter.use(requireAuth);

let running = false;

dispatchRouter.post("/run-now", async (_req, res) => {
  if (running) {
    res.status(409).json({ error: "Ja existe uma execucao em andamento." });
    return;
  }

  running = true;
  try {
    const result = await runPipeline("manual");
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    running = false;
  }
});
