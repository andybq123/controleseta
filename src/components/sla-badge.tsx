import { Badge } from "@/components/ui/badge";
import { calcularSla, formatDate, type ProtocoloSlaInput } from "@/lib/prazo";

/**
 * Badge única de prazo/SLA. Use em qualquer tela em vez de recalcular
 * prazos manualmente (motor central em src/lib/prazo.ts).
 */
export function SlaBadge({
  protocolo,
  showPrazo = false,
  className = "",
}: {
  protocolo: ProtocoloSlaInput;
  showPrazo?: boolean;
  className?: string;
}) {
  const s = calcularSla(protocolo);
  return (
    <Badge variant="outline" className={`text-[10px] border ${s.classes} ${className}`} title={`Prazo final ${formatDate(s.prazoFinal)}`}>
      {s.label} · {s.labelDias}
      {showPrazo && ` · ${formatDate(s.prazoFinal)}`}
    </Badge>
  );
}
