import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, Eye } from "lucide-react";
import { fetchAllPaginated } from "@/lib/fetch-all";
import { sortProtocolosPorNumero } from "@/lib/sort-protocolos";
import { formatDate, PRAZOS, categoriaLabel, categoriaBadgeClass, type TipoProtocolo, type CategoriaProtocolo } from "@/lib/prazo";
import { ProtocoloDetailDialog } from "@/components/protocolo-detail-dialog";

export const Route = createFileRoute("/_authenticated/tarefas")({
  component: TarefasPage,
});

function TarefasPage() {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<any | null>(null);
  const [busca, setBusca] = useState("");

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos-triagem"],
    queryFn: async () => {
      const rows = await fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("*, secretarias(nome, sigla), locais(nome)")
          .eq("triagem_pendente", true)
          .order("data_abertura", { ascending: false })
          .range(from, to),
      );
      return [...rows].sort(sortProtocolosPorNumero);
    },
  });

  const filtrados = protocolos.filter((p: any) => {
    if (!busca) return true;
    const s = busca.toLowerCase();
    return `${p.numero} ${p.assunto} ${p.solicitante ?? ""}`.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Tarefas — Triagem
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtrados.length} ouvidoria(s) aguardando triagem. Defina secretaria/local e salve para enviar ao módulo correspondente.
          </p>
        </div>
        <Input placeholder="Buscar nº, assunto, solicitante…" value={busca} onChange={e => setBusca(e.target.value)} className="w-[280px]" />
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma ouvidoria aguardando triagem.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtrados.map((p: any) => (
            <Card key={p.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{PRAZOS[p.tipo as TipoProtocolo].label}</Badge>
                    <Badge className={`text-[10px] ${categoriaBadgeClass(p.categoria as CategoriaProtocolo)}`}>
                      {categoriaLabel(p.categoria as CategoriaProtocolo)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/10">
                      triagem pendente
                    </Badge>
                  </div>
                  <div className="font-medium text-sm">{p.assunto}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Aberto em {formatDate(p.data_abertura)} · {p.solicitante ?? "Solicitante não informado"}
                  </div>
                </div>
                <Button size="sm" onClick={() => setDetail(p)}>
                  <Eye className="h-4 w-4 mr-1" /> Triar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProtocoloDetailDialog
        protocolo={detail}
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
          qc.invalidateQueries({ queryKey: ["protocolos-triagem"] });
          qc.invalidateQueries({ queryKey: ["protocolos"] });
        }}
      />
    </div>
  );
}