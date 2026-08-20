export type CategoriaProtocolo =
  | "elogio"
  | "reclamacao"
  | "pedido_informacao"
  | "denuncia"
  | "solicitacao"
  | "sugestao"
  | "outros";

export const CATEGORIAS: {
  value: CategoriaProtocolo;
  label: string;
  sigla: string;
  badgeClass: string;
}[] = [
  {
    value: "elogio",
    label: "Elogio",
    sigla: "E",
    badgeClass: "bg-green-600 text-white border-transparent",
  },
  {
    value: "reclamacao",
    label: "Reclamação",
    sigla: "R",
    badgeClass: "bg-red-600 text-white border-transparent",
  },
  {
    value: "pedido_informacao",
    label: "Pedido de informação",
    sigla: "LAI",
    badgeClass: "bg-purple-600 text-white border-transparent",
  },
  {
    value: "denuncia",
    label: "Denúncia",
    sigla: "D",
    badgeClass: "bg-black text-white border-transparent",
  },
  {
    value: "solicitacao",
    label: "Solicitação",
    sigla: "S",
    badgeClass: "bg-yellow-400 text-black border-transparent",
  },
  {
    value: "sugestao",
    label: "Sugestão",
    sigla: "SG",
    badgeClass: "bg-blue-600 text-white border-transparent",
  },
  {
    value: "outros",
    label: "Outros",
    sigla: "—",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
];

export const categoriaLabel = (c: CategoriaProtocolo) =>
  CATEGORIAS.find((x) => x.value === c)?.label ?? c;

export const categoriaSigla = (c: CategoriaProtocolo) =>
  CATEGORIAS.find((x) => x.value === c)?.sigla ?? "—";

export const categoriaBadgeClass = (c: CategoriaProtocolo) =>
  CATEGORIAS.find((x) => x.value === c)?.badgeClass ??
  "bg-muted text-muted-foreground border-border";
