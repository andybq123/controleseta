import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { situacaoProtocolo, formatDate, PRAZOS, categoriaLabel, type CategoriaProtocolo, type TipoProtocolo } from "@/lib/prazo";
import { AlertTriangle, Download } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/atrasados")({
  component: AtrasadosPage,
});

function AtrasadosPage() {
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroSec, setFiltroSec] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocolos")
        .select("*, secretarias(nome, sigla), responsaveis(nome), locais(nome,centro_custo)")
        .neq("status", "concluido")
        .order("data_abertura", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("*").order("nome")).data ?? [],
  });

  const atrasados = useMemo(() => {
    return protocolos
      .map(p => ({ ...p, _s: situacaoProtocolo(p as any) }))
      .filter(p => p._s.situacao === "vencido")
      .filter(p => filtroTipo === "todos" || p.tipo === filtroTipo)
      .filter(p => filtroSec === "todos" || p.secretaria_id === filtroSec)
      .filter(p => {
        if (!busca) return true;
        const s = busca.toLowerCase();
        return `${p.numero} ${p.assunto} ${p.solicitante ?? ""}`.toLowerCase().includes(s);
      });
  }, [protocolos, filtroTipo, filtroSec, busca]);

  const buckets = {
    "+30 dias": atrasados.filter(p => Math.abs(p._s.dias) > 30).length,
    "+20 dias": atrasados.filter(p => Math.abs(p._s.dias) > 20 && Math.abs(p._s.dias) <= 30).length,
    "+10 dias": atrasados.filter(p => Math.abs(p._s.dias) > 10 && Math.abs(p._s.dias) <= 20).length,
    "Até 10 dias": atrasados.filter(p => Math.abs(p._s.dias) <= 10).length,
  };

  function exportar() {
    const rows = atrasados.map(p => ({
      "Número": p.numero,
      "Tipo": PRAZOS[p.tipo as TipoProtocolo].label,
      "Categoria": categoriaLabel(p.categoria as CategoriaProtocolo),
      "Data Abertura": formatDate(p.data_abertura),
      "Prazo Final": formatDate(p._s.prazoFinal),
      "Dias em atraso": Math.abs(p._s.dias),
      "Status": p.status,
      "Prorrogado": p.prorrogado ? "Sim" : "Não",
      "Secretaria": (p as any).secretarias?.nome ?? "",
      "Local": (p as any).locais?.nome ?? "",
      "Responsável": (p as any).responsaveis?.nome ?? "",
      "Solicitante": p.solicitante ?? "",
      "Assunto": p.assunto,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atrasados");
    XLSX.writeFile(wb, `protocolos-atrasados-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" /> Protocolos atrasados
          </h1>
          <p className="text-sm text-muted-foreground">{atrasados.length} em atraso</p>
        </div>
        <Button onClick={exportar} variant="outline" disabled={atrasados.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(buckets).map(([label, value]) => (
          <Card key={label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-destructive">{value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar…" value={busca} onChange={e => setBusca(e.target.value)} className="w-[240px]" />
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
            <SelectItem value="lai">LAI</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroSec} onValueChange={setFiltroSec}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as secretarias</SelectItem>
            {secretarias.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        {atrasados.length === 0 && (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum protocolo em atraso. 🎉</CardContent></Card>
        )}
        {atrasados.map(p => {
          const dias = Math.abs(p._s.dias);
          const cls = dias > 30 ? "border-destructive bg-destructive/5" : dias > 20 ? "border-destructive/60" : dias > 10 ? "border-[var(--warning)]/60" : "";
          return (
            <Card key={p.id} className={cls}>
              <CardContent className="p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{p.tipo}</Badge>
                    <Badge variant="outline" className="text-[10px]">{categoriaLabel(p.categoria as CategoriaProtocolo)}</Badge>
                    {p.prorrogado && <Badge variant="outline" className="text-[10px]">prorrogado</Badge>}
                  </div>
                  <p className="text-sm font-medium mt-1 truncate">{p.assunto}</p>
                  <p className="text-xs text-muted-foreground">
                    {(p as any).secretarias?.nome ?? "—"} · Aberto {formatDate(p.data_abertura)} · Venceu {formatDate(p._s.prazoFinal)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-destructive leading-none">+{dias}d</p>
                  <p className="text-[10px] text-muted-foreground">atrasado</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}