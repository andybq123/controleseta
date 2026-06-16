export type Override = {
  situacao?: string;
  notas?: string;
  updatedAt?: string;
};

const KEY = "ouvidoria-overrides-v1";

function readAll(): Record<string, Override> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, Override>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new Event("ouvidoria-overrides-changed"));
}

export function keyOf(source: string, numero: number | string) {
  return `${source}|${numero}`;
}

export function getOverride(source: string, numero: number | string): Override | undefined {
  return readAll()[keyOf(source, numero)];
}

export function setOverride(source: string, numero: number | string, patch: Override) {
  const all = readAll();
  const k = keyOf(source, numero);
  all[k] = { ...all[k], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
}

export function clearOverride(source: string, numero: number | string) {
  const all = readAll();
  delete all[keyOf(source, numero)];
  writeAll(all);
}

export function getAllOverrides(): Record<string, Override> {
  return readAll();
}

export const SITUACOES_DISPONIVEIS = [
  "Em dia",
  "Em análise",
  "Aguardando setor",
  "Atrasada",
  "Resolvida",
  "Arquivada",
];