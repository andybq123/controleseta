import { addDays, differenceInCalendarDays, format } from "date-fns";

export type TipoProtocolo = "ouvidoria" | "lai";
export type StatusProtocolo = "aberto" | "em_andamento" | "concluido";
export type CategoriaProtocolo =
  | "elogio"
  | "reclamacao"
  | "pedido_informacao"
  | "denuncia"
  | "solicitacao"
  | "outros";

export const CATEGORIAS: { value: CategoriaProtocolo; label: string }[] = [
  { value: "elogio", label: "Elogio" },
  { value: "reclamacao", label: "Reclamação" },
  { value: "pedido_informacao", label: "Pedido de informação" },
  { value: "denuncia", label: "Denúncia" },
  { value: "solicitacao", label: "Solicitação" },
  { value: "outros", label: "Outros" },
];

export const categoriaLabel = (c: CategoriaProtocolo) =>
  CATEGORIAS.find(x => x.value === c)?.label ?? c;

export const PRAZOS = {
  ouvidoria: { inicial: 30, prorrogacao: 30, label: "Ouvidoria" },
  lai: { inicial: 20, prorrogacao: 10, label: "LAI" },
} as const;

export function calcularPrazo(opts: {
  tipo: TipoProtocolo;
  data_abertura: string;
  prorrogado: boolean;
}): { prazoFinal: Date; diasTotais: number } {
  const { inicial, prorrogacao } = PRAZOS[opts.tipo];
  const diasTotais = inicial + (opts.prorrogado ? prorrogacao : 0);
  const prazoFinal = addDays(new Date(opts.data_abertura + "T00:00:00"), diasTotais);
  return { prazoFinal, diasTotais };
}

export function diasRestantes(prazoFinal: Date): number {
  return differenceInCalendarDays(prazoFinal, new Date());
}

export type Situacao = "vencido" | "critico" | "atencao" | "no_prazo" | "concluido";

export function situacaoProtocolo(p: {
  tipo: TipoProtocolo;
  data_abertura: string;
  prorrogado: boolean;
  status: StatusProtocolo;
}): { situacao: Situacao; dias: number; prazoFinal: Date } {
  const { prazoFinal } = calcularPrazo(p);
  const dias = diasRestantes(prazoFinal);
  if (p.status === "concluido") return { situacao: "concluido", dias, prazoFinal };
  if (dias < 0) return { situacao: "vencido", dias, prazoFinal };
  if (dias <= 3) return { situacao: "critico", dias, prazoFinal };
  if (dias <= 7) return { situacao: "atencao", dias, prazoFinal };
  return { situacao: "no_prazo", dias, prazoFinal };
}

export const situacaoLabel: Record<Situacao, string> = {
  vencido: "Vencido",
  critico: "Crítico",
  atencao: "Atenção",
  no_prazo: "No prazo",
  concluido: "Concluído",
};

export const situacaoClasses: Record<Situacao, string> = {
  vencido: "bg-destructive/10 text-destructive border-destructive/30",
  critico: "bg-destructive/10 text-destructive border-destructive/30",
  atencao: "bg-[var(--warning)]/15 text-[var(--warning-foreground)] border-[var(--warning)]/40",
  no_prazo: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30",
  concluido: "bg-muted text-muted-foreground border-border",
};

export function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return format(date, "dd/MM/yyyy");
}

export function gerarNumeroProtocolo(tipo: TipoProtocolo): string {
  const now = new Date();
  const y = now.getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  const prefix = tipo === "lai" ? "LAI" : "OUV";
  return `${prefix}-${y}-${rand}`;
}