export const env = {
  base: must("ONEDOC_BASE"),
  user: must("ONEDOC_USER"),
  pass: must("ONEDOC_PASS"),
  listUrl: process.env.ONEDOC_LIST_URL || `${must("ONEDOC_BASE")}/?pg=doc/lst`,
  backendUrl: must("BACKEND_URL").replace(/\/$/, ""),
  ingestToken: must("INGEST_TOKEN"),
  maxProtocolos: Number(process.env.MAX_PROTOCOLOS || 200),
  delayMs: Math.max(100, Number(process.env.DELAY_MS || 500)),
  headless: (process.env.HEADLESS ?? "true") !== "false",
};

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}