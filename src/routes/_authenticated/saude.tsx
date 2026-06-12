import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { situacaoProtocolo, formatDate, PRAZOS, categoriaLabel, categoriaSigla, categoriaBadgeClass, type CategoriaProtocolo, type TipoProtocolo } from "@/lib/prazo";
import { HeartPulse } from "lucide-react";
import { fetchAllPaginated } from "@/lib/fetch-all";
import { ProtocoloDetailDialog } from "@/components/protocolo-detail-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/saude")({
  component: SaudePage,
});

function SaudePage() {
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState<string>("todas");
  const [detail, setDetail] = useState<any>(null);

  const { data: saudeSec } = useQuery({
    queryKey: ["secretaria-saude"],
    queryFn: async () => {
      const { data } = await supabase.from("secretarias").select("id,nome").eq("nome", "Saúde").maybeSingle();
      return data;
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["locais-saude", saudeSec?.id],
    queryFn: async () => {
      const { data } = await supabase.from("locais").select("id,nome").eq("secretaria_id", saudeSec!.id).order("nome");
      return data ?? [];
    },
    enabled: !!saudeSec?.id,
  });

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos"],
    queryFn: () =>
      fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("*, secretarias(nome, sigla), responsaveis(nome), locais(nome,centro_custo)")
          .order("data_abertura", { ascending: false })
          .range(from, to),
      ),
  });

  const saude = protocolos.filter(p => {
    if (!saudeSec?.id || (p as any).secretaria_id !== saudeSec.id) return false;
    if (unidade !== "todas" && (p as any).local_id !== unidade) return false;
    if (busca) {
      const s = busca.toLowerCase();
      const txt = `${p.numero} ${p.assunto} ${p.solicitante ?? ""}`.toLowerCase();
      if (!txt.includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-emerald-500" /> Saúde
          </h1>
          <p className="text-sm text-muted-foreground">{saude.length} protocolo(s) da Secretaria de Saúde</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Buscar nº, assunto, solicitante…" value={busca} onChange={e => setBusca(e.target.value)} className="w-[280px]" />
        <Select value={unidade} onValueChange={setUnidade}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Unidade de saúde" /></SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="todas">Todas as unidades</SelectItem>
            {unidades.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {saude.length === 0 && (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum protocolo da Saúde encontrado. Marque um protocolo definindo a Secretaria como "Saúde" e selecione a unidade no campo Local.</CardContent></Card>
        )}
        {saude.map(p => {
          const s = situacaoProtocolo(p as any);
          return (
            <Card key={p.id} className="cursor-pointer hover:border-primary/50 transition" onClick={() => setDetail(p)}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">{PRAZOS[p.tipo as TipoProtocolo].label}</Badge>
                      <Badge
                        className={`text-[10px] ${categoriaBadgeClass(p.categoria as CategoriaProtocolo)}`}
                        title={categoriaLabel(p.categoria as CategoriaProtocolo)}
                      >
                        {categoriaSigla(p.categoria as CategoriaProtocolo)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">{p.status.replace("_", " ")}</Badge>
                      {(p as any).locais?.nome && (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">
                          {(p as any).locais.nome}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold mt-2">{p.assunto}</h3>
                    {p.descricao && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.descricao}</p>}
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Aberto {formatDate(p.data_abertura)}</span>
                      <span>Prazo {formatDate(s.prazoFinal)}</span>
                      {(p as any).secretarias && <span>{(p as any).secretarias.nome}</span>}
                      {p.solicitante && <span>{p.solicitante}</span>}
                    </div>
                  </div>
                    <div className="shrink-0">
                    <Badge className={`text-[10px] border ${s.situacao === "vencido" ? "border-destructive bg-destructive/5 text-destructive" : s.situacao === "critico" ? "border-[var(--warning)] bg-[var(--warning)]/5 text-[var(--warning-foreground)]" : s.situacao === "atencao" ? "border-yellow-500 bg-yellow-500/5 text-yellow-600" : "border-emerald-500 bg-emerald-500/5 text-emerald-500"}`}>
                      {s.situacao === "vencido" ? "Atrasado" : s.situacao === "critico" ? "Crítico" : s.situacao === "atencao" ? "Atenção" : "Em dia"} · {s.dias < 0 ? `${Math.abs(s.dias)}d atrasado` : `${s.dias}d restantes`}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ProtocoloDetailDialog protocolo={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
    </div>
  );
}
