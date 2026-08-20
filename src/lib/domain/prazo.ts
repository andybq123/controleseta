import { addDays, differenceInCalendarDays, format } from "date-fns";

export type TipoProtocolo = "ouvidoria" | "lai" | "esic";
export type StatusProtocolo = "aberto" | "em_andamento" | "concluido";

export const PRAZOS = {
  ouvidoria: { inicial: 30, prorrogacao: 30, label: "Ouvidoria" },
  lai: { inicial: 20, prorrogacao: 10, label: "LAI" },
  esic: { inicial: 20, prorrogacao: 10, label: "e-SIC" },
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

export function diasRestantes(prazoFinal: Date, hoje: Date = new Date()): number {
  return differenceInCalendarDays(prazoFinal, hoje);
}

export type Situacao = "vencido" | "critico" | "atencao" | "no_prazo" | "concluido";

export function situacaoProtocolo(
  p: {
    tipo: TipoProtocolo;
    data_abertura: string;
    prorrogado: boolean;
    status: StatusProtocolo;
  },
  hoje: Date = new Date(),
): { situacao: Situacao; dias: number; prazoFinal: Date } {
  const { prazoFinal } = calcularPrazo(p);
  const dias = diasRestantes(prazoFinal, hoje);
  if (p.status === "concluido") return { situacao: "concluido", dias, prazoFinal };
  if (dias < 0) return { situacao: "vencido", dias, prazoFinal };
  if (dias <= 3) return { situacao: "critico", dias, prazoFinal };
  if (dias <= 7) return { situacao: "atencao", dias, prazoFinal };
  return { situacao: "no_prazo", dias, prazoFinal };
}

/**
 * Se o protocolo já estava atrasado numa data de referência: prazo final
 * anterior a refDate, e não estava concluído em refDate (útil para
 * relatórios históricos "quantos estavam atrasados em tal mês").
 */
export function estavaAtrasadoNaData(
  p: {
    tipo: TipoProtocolo;
    data_abertura: string;
    prorrogado: boolean;
    status: StatusProtocolo;
    data_conclusao?: string | null;
  },
  refDate: Date,
): { atrasado: boolean; diasAtraso: number; prazoFinal: Date } {
  const { prazoFinal } = calcularPrazo(p);
  const diasAtraso = differenceInCalendarDays(refDate, prazoFinal);
  const venceuAntes = prazoFinal < refDate;
  const dataConclusao = p.data_conclusao
    ? new Date(p.data_conclusao + (p.data_conclusao.length === 10 ? "T00:00:00" : ""))
    : null;
  const concluidoNaData = p.status === "concluido" && !!dataConclusao && dataConclusao <= refDate;
  return { atrasado: venceuAntes && !concluidoNaData, diasAtraso, prazoFinal };
}

/** Fim do mês (23:59:59) para YYYY-MM. Se for o mês corrente, retorna "agora". */
export function endOfMonthOrNow(ym: string, agora: Date = new Date()): Date {
  const [y, m] = ym.split("-").map(Number);
  const currentYm = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  if (ym === currentYm) return agora;
  const lastDay = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, lastDay, 23, 59, 59, 999);
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
