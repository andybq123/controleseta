import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/lib/fetch-all";
import { situacaoProtocolo, formatDate } from "@/lib/prazo";
import { ProtocoloDetailDialog } from "@/components/protocolo-detail-dialog";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos"],
    queryFn: () =>
      fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("*, secretarias(nome, sigla), locais(nome)")
          .order("data_abertura", { ascending: false })
          .range(from, to),
      ),
    refetchInterval: 60_000,
  });

  const alertas = protocolos
    .filter((p: any) => p.status !== "concluido")
    .map((p: any) => ({ ...p, _s: situacaoProtocolo(p) }))
    .filter((p: any) => p._s.situacao === "vencido" || p._s.situacao === "critico" || p._s.situacao === "atencao")
    .sort((a: any, b: any) => a._s.dias - b._s.dias);

  const total = alertas.length;
  const vencidos = alertas.filter((p: any) => p._s.situacao === "vencido").length;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="relative" aria-label="Notificações">
            <Bell className="h-5 w-5" />
            {total > 0 && (
              <span
                className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  vencidos > 0 ? "bg-red-600 text-white" : "bg-yellow-400 text-black"
                }`}
              >
                {total > 99 ? "99+" : total}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 p-0">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-sm">Notificações</div>
            <div className="text-xs text-muted-foreground">{total} alerta{total === 1 ? "" : "s"}</div>
          </div>
          <div className="max-h-96 overflow-auto">
            {alertas.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum protocolo próximo do vencimento.
              </div>
            ) : (
              <ul className="divide-y">
                {alertas.map((p: any) => {
                  const vencido = p._s.situacao === "vencido";
                  const critico = p._s.situacao === "critico";
                  const Icon = vencido ? AlertTriangle : Clock;
                  const tone = vencido
                    ? "text-red-600"
                    : critico
                    ? "text-orange-600"
                    : "text-yellow-600";
                  const msg = vencido
                    ? `Vencido há ${Math.abs(p._s.dias)} dia${Math.abs(p._s.dias) === 1 ? "" : "s"}`
                    : `Vence em ${p._s.dias} dia${p._s.dias === 1 ? "" : "s"}`;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => { setOpen(false); setDetail(p); }}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 items-start"
                      >
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${tone}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold">{p.numero}</span>
                            <Badge variant="outline" className="text-[10px] py-0 h-4">{p.tipo === "esic" ? "e-SIC" : p.tipo === "lai" ? "LAI" : "OUV"}</Badge>
                          </div>
                          <div className="text-sm truncate">{p.assunto}</div>
                          <div className={`text-xs ${tone} font-medium`}>
                            {msg} · prazo {formatDate(p._s.prazoFinal)}
                          </div>
                          {p.secretarias?.sigla && (
                            <div className="text-xs text-muted-foreground truncate">{p.secretarias.sigla}</div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <ProtocoloDetailDialog protocolo={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
    </>
  );
}