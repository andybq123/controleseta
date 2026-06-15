// Helpers for the month-based filter shared by Dashboard, Protocolos and Saúde.

export const MESES_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
] as const;

/** Returns YYYY-MM for the current month. */
export function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns ISO start (YYYY-MM-01) and exclusive next-month start for a given YYYY-MM. */
export function monthRange(ym: string): { start: string; endExclusive: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const endExclusive = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { start, endExclusive };
}

/** True if the date-string (YYYY-MM-DD) falls inside the given YYYY-MM. */
export function isInMonth(dateISO: string | null | undefined, ym: string): boolean {
  if (!dateISO) return false;
  return dateISO.slice(0, 7) === ym;
}

/** Builds a descending list of {value: YYYY-MM, label} from the given ISO date strings, always including the current month. */
export function monthOptionsFromDates(dates: (string | null | undefined)[]): { value: string; label: string }[] {
  const set = new Set<string>([currentMonthValue()]);
  for (const d of dates) {
    if (d && /^\d{4}-\d{2}/.test(d)) set.add(d.slice(0, 7));
  }
  return Array.from(set)
    .sort()
    .reverse()
    .map(v => {
      const [y, m] = v.split("-").map(Number);
      return { value: v, label: `${MESES_PT[m - 1]}/${y}` };
    });
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_PT[m - 1]}/${y}`;
}