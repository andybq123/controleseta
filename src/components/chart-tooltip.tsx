import type { ReactNode } from "react";

type Row = {
  label: string;
  value: ReactNode;
  color?: string;
  hint?: string;
};

export function ChartTooltipCard({
  title,
  subtitle,
  rows,
  footer,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  rows: Row[];
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur p-3 shadow-lg min-w-[180px] text-popover-foreground">
      {(title || subtitle) && (
        <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b">
          {title && <span className="font-semibold text-sm">{title}</span>}
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      )}
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {r.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ background: r.color }}
                />
              )}
              <span className="truncate">{r.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold tabular-nums">{r.value}</span>
              {r.hint && (
                <span className="text-muted-foreground tabular-nums">{r.hint}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {footer && <div className="mt-2 pt-2 border-t text-xs">{footer}</div>}
    </div>
  );
}

/** Generic tooltip content for recharts (Pie / Bar / Line). */
export function ChartTooltipContent({
  active,
  payload,
  label,
  unit = "protocolo(s)",
  total,
}: any) {
  if (!active || !payload || payload.length === 0) return null;

  // Pie: each slice is its own payload entry with name + value
  if (payload.length === 1 && payload[0]?.payload && payload[0]?.name) {
    const p = payload[0];
    const name = p.name ?? p.payload?.name;
    const value = p.value ?? p.payload?.value ?? 0;
    const color = p.payload?.fill ?? p.payload?.color ?? p.color;
    const pct =
      typeof total === "number" && total > 0
        ? `${((value / total) * 100).toFixed(1)}%`
        : undefined;
    return (
      <ChartTooltipCard
        rows={[{ label: name, value: `${value} ${unit}`, color, hint: pct }]}
      />
    );
  }

  return (
    <ChartTooltipCard
      title={label}
      rows={payload.map((p: any) => ({
        label: p.name ?? p.dataKey,
        value: `${p.value} ${unit}`,
        color: p.color ?? p.payload?.fill,
      }))}
    />
  );
}