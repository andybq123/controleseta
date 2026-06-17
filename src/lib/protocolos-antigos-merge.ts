import ouvidorias from "@/data/ouvidorias.json";
import atrasadasOficiais from "@/data/ouvidorias-atrasadas.json";

type OuvAntiga = {
  source: string;
  setor: string | null;
  responsavel: string | null;
  data: string;
  numero: number;
  situacao: string;
  comentario?: string | null;
};

const ATRASADAS_SET = new Set<string>(
  (atrasadasOficiais as { source: string; numero: number }[]).map(
    (r) => `${r.source}|${r.numero}`,
  ),
);

// Tira manifestações de jun/2026 (duplicam dados atuais), igual ao dashboard de antigos.
const ANTIGOS_RAW = (ouvidorias as OuvAntiga[]).filter(
  (r) => !r.data?.startsWith("2026-06"),
);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function matchSecretariaId(
  source: string,
  setor: string | null,
  secretarias: { id: string; nome: string }[],
): string | null {
  if (!secretarias?.length) return null;
  if (source === "Saúde") {
    const s = secretarias.find((x) => norm(x.nome).includes("saude"));
    if (s) return s.id;
  }
  if (!setor) return null;
  const ns = norm(setor);
  let best = secretarias.find((x) => norm(x.nome) === ns);
  if (best) return best.id;
  best = secretarias.find((x) => {
    const n = norm(x.nome);
    return n.includes(ns) || ns.includes(n);
  });
  return best?.id ?? null;
}

export function buildProtocolosAntigos(
  secretarias: { id: string; nome: string }[],
) {
  return ANTIGOS_RAW.map((r) => {
    const atrasada = ATRASADAS_SET.has(`${r.source}|${r.numero}`);
    const secretaria_id = matchSecretariaId(r.source, r.setor, secretarias);
    const secretariaObj = secretaria_id
      ? secretarias.find((s) => s.id === secretaria_id) ?? null
      : null;
    return {
      id: `antigo:${r.source}:${r.numero}`,
      numero: String(r.numero),
      assunto: r.setor ?? "Ouvidoria",
      descricao: r.comentario ?? null,
      solicitante: null,
      tipo: "ouvidoria" as const,
      categoria: "outros" as const,
      status: "aberto" as const,
      data_abertura: r.data,
      prorrogado: false,
      secretaria_id,
      secretarias: secretariaObj ? { nome: secretariaObj.nome } : null,
      __antigo: true as const,
      __antigoAtrasada: atrasada,
      __source: r.source,
      __setor: r.setor,
    };
  });
}

export const isAntigo = (p: any) => p?.__antigo === true;
export const isAntigoAtrasada = (p: any) =>
  p?.__antigo === true && p?.__antigoAtrasada === true;
