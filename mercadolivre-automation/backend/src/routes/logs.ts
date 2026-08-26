import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const logsRouter = Router();
logsRouter.use(requireAuth);

logsRouter.get("/", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const rows = db.prepare("SELECT * FROM run_logs ORDER BY id DESC LIMIT ?").all(limit);
  res.json(rows);
});
