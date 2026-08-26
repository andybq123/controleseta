import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { env } from "./env.js";

fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });

export const db = new Database(env.databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    category_id TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sent_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ml_item_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    price REAL,
    original_price REAL,
    discount_percent REAL,
    permalink TEXT,
    affiliate_link TEXT,
    thumbnail TEXT,
    keyword TEXT,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'sent'
  );

  CREATE TABLE IF NOT EXISTS run_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    items_found INTEGER NOT NULL DEFAULT 0,
    items_sent INTEGER NOT NULL DEFAULT 0,
    trigger TEXT NOT NULL DEFAULT 'schedule',
    message TEXT
  );
`);

export interface AppSettings {
  ml: {
    site: string;
    minDiscountPercent: number;
    minPrice: number | null;
    maxPrice: number | null;
    affiliateMattWord: string;
    affiliateMattTool: string;
  };
  schedule: {
    enabled: boolean;
    cron: string;
    quietStart: string | null;
    quietEnd: string | null;
    maxProductsPerRun: number;
  };
  evolution: {
    baseUrl: string;
    apiKey: string;
    instance: string;
    groupJid: string;
    sendImage: boolean;
  };
  message: {
    template: string;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  ml: {
    site: "MLB",
    minDiscountPercent: 30,
    minPrice: null,
    maxPrice: null,
    affiliateMattWord: "",
    affiliateMattTool: "",
  },
  schedule: {
    enabled: false,
    cron: "*/30 * * * *",
    quietStart: null,
    quietEnd: null,
    maxProductsPerRun: 5,
  },
  evolution: {
    baseUrl: "",
    apiKey: "",
    instance: "",
    groupJid: "",
    sendImage: true,
  },
  message: {
    template:
      "🔥 *OFERTA* 🔥\n\n📦 {titulo}\n\n~De R$ {preco_original}~\n💰 *Por R$ {preco}* ({desconto}% OFF)\n\n🛒 {link}",
  },
};

function seedSettings() {
  const row = db.prepare("SELECT data FROM app_settings WHERE id = 1").get() as
    | { data: string }
    | undefined;
  if (!row) {
    db.prepare("INSERT INTO app_settings (id, data) VALUES (1, ?)").run(
      JSON.stringify(DEFAULT_SETTINGS),
    );
  }
}

function seedAdminUser() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  if (count === 0) {
    const hash = bcrypt.hashSync(env.adminPassword, 10);
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(
      env.adminUser,
      hash,
    );
  }
}

seedSettings();
seedAdminUser();

export function getSettings(): AppSettings {
  const row = db.prepare("SELECT data FROM app_settings WHERE id = 1").get() as {
    data: string;
  };
  const stored = JSON.parse(row.data) as Partial<AppSettings>;
  return {
    ml: { ...DEFAULT_SETTINGS.ml, ...stored.ml },
    schedule: { ...DEFAULT_SETTINGS.schedule, ...stored.schedule },
    evolution: { ...DEFAULT_SETTINGS.evolution, ...stored.evolution },
    message: { ...DEFAULT_SETTINGS.message, ...stored.message },
  };
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next: AppSettings = {
    ml: { ...current.ml, ...partial.ml },
    schedule: { ...current.schedule, ...partial.schedule },
    evolution: { ...current.evolution, ...partial.evolution },
    message: { ...current.message, ...partial.message },
  };
  db.prepare("UPDATE app_settings SET data = ? WHERE id = 1").run(JSON.stringify(next));
  return next;
}
