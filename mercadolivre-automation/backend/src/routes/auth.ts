import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, signToken } from "../middleware/auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Usuario e senha sao obrigatorios." });
    return;
  }

  const { username, password } = parsed.data;
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | { id: number; username: string; password_hash: string }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Usuario ou senha invalidos." });
    return;
  }

  const token = signToken({ sub: user.id, username: user.username });
  res.json({ token, username: user.username });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

authRouter.post("/change-password", requireAuth, (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados invalidos. A nova senha precisa ter ao menos 6 caracteres." });
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.sub) as
    | { id: number; password_hash: string }
    | undefined;

  if (!user || !bcrypt.compareSync(parsed.data.currentPassword, user.password_hash)) {
    res.status(401).json({ error: "Senha atual incorreta." });
    return;
  }

  const hash = bcrypt.hashSync(parsed.data.newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ username: req.user!.username });
});
