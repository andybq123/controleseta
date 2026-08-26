import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import "./db.js";
import { authRouter } from "./routes/auth.js";
import { settingsRouter } from "./routes/settings.js";
import { keywordsRouter } from "./routes/keywords.js";
import { productsRouter } from "./routes/products.js";
import { logsRouter } from "./routes/logs.js";
import { dispatchRouter } from "./routes/dispatch.js";
import { statusRouter } from "./routes/status.js";
import { startScheduler } from "./scheduler.js";
import { logger } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/keywords", keywordsRouter);
app.use("/api/products", productsRouter);
app.use("/api/logs", logsRouter);
app.use("/api/dispatch", dispatchRouter);
app.use("/api/status", statusRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Serve o painel (build do frontend), quando presente. Permite rodar
// backend + painel em um unico processo/porta na VPS.
const frontendDist = path.resolve(__dirname, "../public");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Erro nao tratado:", err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

startScheduler();

app.listen(env.port, () => {
  logger.info(`Painel/API de automacao Mercado Livre rodando na porta ${env.port}`);
});
