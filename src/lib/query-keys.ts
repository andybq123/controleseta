import type { QueryClient } from "@tanstack/react-query";

/**
 * Fábrica única de chaves do React Query. Cada domínio expõe `.all()` como
 * prefixo — invalidar `queryKeys.protocolos.all()` invalida toda query cujo
 * array de chave comece por ["protocolos", ...], sem precisar de predicate
 * manual varrendo strings (como era feito antes).
 */
export const queryKeys = {
  protocolos: {
    all: () => ["protocolos"] as const,
    list: (filters?: Record<string, unknown>) => ["protocolos", "list", filters ?? {}] as const,
    detail: (id: string) => ["protocolos", "detail", id] as const,
    atrasados: (filters?: Record<string, unknown>) =>
      ["protocolos", "atrasados", filters ?? {}] as const,
  },
  triagem: {
    all: () => ["triagem"] as const,
    fila: () => ["triagem", "fila"] as const,
    stats: () => ["triagem", "stats"] as const,
  },
  dashboard: {
    all: () => ["dashboard"] as const,
    metrics: (filters?: Record<string, unknown>) =>
      ["dashboard", "metrics", filters ?? {}] as const,
  },
  relatorios: {
    all: () => ["relatorios"] as const,
    geral: (filters?: Record<string, unknown>) => ["relatorios", "geral", filters ?? {}] as const,
    secretaria: (id: string, filters?: Record<string, unknown>) =>
      ["relatorios", "secretaria", id, filters ?? {}] as const,
  },
  secretarias: {
    all: () => ["secretarias"] as const,
    list: () => ["secretarias", "list"] as const,
  },
  locais: {
    all: () => ["locais"] as const,
    bySecretaria: (secretariaId: string) => ["locais", "secretaria", secretariaId] as const,
  },
  assuntos: {
    all: () => ["assuntos"] as const,
    list: () => ["assuntos", "list"] as const,
  },
  users: {
    all: () => ["users"] as const,
    isAdmin: (userId?: string) => ["users", "is-admin", userId ?? null] as const,
  },
} as const;

/**
 * Alteração em um protocolo (criação, triagem, conclusão, reabertura...)
 * afeta todos estes domínios — invalidação única em vez de espalhada.
 */
export function invalidateProtocoloRelatedCaches(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.protocolos.all() });
  qc.invalidateQueries({ queryKey: queryKeys.triagem.all() });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
  qc.invalidateQueries({ queryKey: queryKeys.relatorios.all() });
}
