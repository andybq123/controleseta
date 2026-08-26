import "dotenv/config";
import path from "node:path";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  adminUser: required("ADMIN_USER", "admin"),
  adminPassword: required("ADMIN_PASSWORD", "admin123"),
  databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "./data/app.db"),
};
