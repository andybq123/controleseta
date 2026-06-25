import type { Page } from "playwright";
import { env } from "./env.js";

/** Faz login no 1Doc preenchendo os campos usuário/senha mais comuns. */
export async function login(page: Page): Promise<void> {
  await page.goto(env.base, { waitUntil: "domcontentloaded" });

  // 1Doc costuma usar inputs name="usuario" / name="senha", mas tentamos vários.
  const userSel = await firstVisible(page, [
    'input[name="usuario"]',
    'input[name="login"]',
    'input[name="email"]',
    'input[type="text"]',
  ]);
  const passSel = await firstVisible(page, [
    'input[name="senha"]',
    'input[name="password"]',
    'input[type="password"]',
  ]);
  if (!userSel || !passSel) {
    // Se não houver formulário, talvez já estejamos logados via cookie persistido.
    return;
  }

  await page.fill(userSel, env.user);
  await page.fill(passSel, env.pass);

  const submit = await firstVisible(page, [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Entrar")',
    'button:has-text("Acessar")',
  ]);
  if (submit) {
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.click(submit),
    ]);
  } else {
    await page.keyboard.press("Enter");
    await page.waitForLoadState("domcontentloaded");
  }

  // Espera curta pra qualquer redirect pós-login.
  await page.waitForTimeout(1500);
}

async function firstVisible(page: Page, selectors: string[]): Promise<string | null> {
  for (const s of selectors) {
    const loc = page.locator(s).first();
    if (await loc.count().then((n) => n > 0).catch(() => false)) {
      if (await loc.isVisible().catch(() => false)) return s;
    }
  }
  return null;
}