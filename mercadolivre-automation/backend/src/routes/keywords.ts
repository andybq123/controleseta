import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const keywordsRouter = Router();
keywordsRouter.use(requireAuth);

keywordsRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM keywords ORDER BY created_at DESC").all();
  res.json(rows);
});

const createSchema = z.object({
  term: z.string().min(2),
  active: z.boolean().optional(),
});

keywordsRouter.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe um termo/categoria valido." });
    return;
  }

  const result = db
    .prepare("INSERT INTO keywords (term, active) VALUES (?, ?)")
    .run(parsed.data.term.trim(), parsed.data.active === false ? 0 : 1);

  const created = db.prepare("SELECT * FROM keywords WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

const updateSchema = z.object({
  term: z.string().min(2).optional(),
  active: z.boolean().optional(),
});

keywordsRouter.put("/:id", (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados invalidos." });
    return;
  }

  const existing = db.prepare("SELECT * FROM keywords WHERE id = ?").get(req.params.id) as
    | { id: number; term: string; active: number }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: "Palavra-chave nao encontrada." });
    return;
  }

  const term = parsed.data.term ?? existing.term;
  const active = parsed.data.active === undefined ? existing.active : parsed.data.active ? 1 : 0;

  db.prepare("UPDATE keywords SET term = ?, active = ? WHERE id = ?").run(term, active, existing.id);
  res.json(db.prepare("SELECT * FROM keywords WHERE id = ?").get(existing.id));
});

keywordsRouter.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM keywords WHERE id = ?").run(req.params.id);
  res.status(204).send();
});
