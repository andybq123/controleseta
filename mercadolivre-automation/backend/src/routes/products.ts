import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const productsRouter = Router();
productsRouter.use(requireAuth);

productsRouter.get("/", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);

  const rows = db
    .prepare("SELECT * FROM sent_products ORDER BY sent_at DESC LIMIT ? OFFSET ?")
    .all(limit, offset);
  const total = (db.prepare("SELECT COUNT(*) as c FROM sent_products").get() as { c: number }).c;

  res.json({ items: rows, total });
});
