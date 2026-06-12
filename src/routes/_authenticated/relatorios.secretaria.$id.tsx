import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { CATEGORIAS, type CategoriaProtocolo, situacaoProtocolo, formatDate, categoriaLabel, PRAZOS, type TipoProtocolo } from "@/lib/prazo";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchAllPaginated } from "@/lib/fetch-all";

export const Route = createFileRoute("/_authenticated/relatorios/secretaria/$id")({
  component: SecretariaRelatorio,
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function SecretariaRelatorio() {
  const { id } = Route.useParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [mes, setMes] = useState<string>("all");
  const [ano, setAno] = useState<string>(String(new Date().getFullYear()));

  const { data: secretaria } = useQuery({
    queryKey: ["secretaria", id],
    queryFn: async () => (await supabase.from("secretarias").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: protocolosAll = [] } = useQuery({
    queryKey: ["protocolos-sec", id],
    queryFn: () =>
      fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("*")
          .eq("secretaria_id", id)
          .order("data_abertura", { ascending: false })
          .range(from, to),
      ),
  });

  const { data: locais = [] } = useQuery({
    queryKey: ["locais-sec", id],
    queryFn: async () => (await supabase.from("locais").select("id,nome").eq("secretaria_id", id)).data ?? [],
  });

  const anosDisponiveis = useMemo(() => {
    const set = new Set<string>([String(new Date().getFullYear())]);
    protocolosAll.forEach(p => set.add(p.data_abertura.slice(0, 4)));
    return Array.from(set).sort().reverse();
  }, [protocolosAll]);

  const protocolos = useMemo(() => protocolosAll.filter(p => {
    if (!p.data_abertura.startsWith(ano)) return false;
    if (mes !== "all" && p.data_abertura.slice(5, 7) !== mes) return false;
    return true;
  }), [protocolosAll, ano, mes]);

  const stats = useMemo(() => {
    const enriched = protocolos.map(p => ({ ...p, _s: situacaoProtocolo(p as any) }));
    const total = enriched.length;
    const concluidos = enriched.filter(p => p.status === "concluido").length;
    const abertos = total - concluidos;
    const vencidos = enriched.filter(p => p.status !== "concluido" && p._s.situacao === "vencido").length;
    const noPrazo = enriched.filter(p => p.status !== "concluido" && p._s.situacao !== "vencido").length;
    return { total, concluidos, abertos, vencidos, noPrazo, enriched };
  }, [protocolos]);

  const categoriaData = useMemo(() =>
    CATEGORIAS.map(c => ({
      name: c.label,
      value: protocolos.filter(p => p.categoria === c.value).length,
    })).filter(d => d.value > 0)
  , [protocolos]);

  const tipoData = useMemo(() => {
    const counts: Record<string, number> = {};
    protocolos.forEach(p => { counts[p.tipo] = (counts[p.tipo] || 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({ name: PRAZOS[k as TipoProtocolo]?.label ?? k, value: v }));
  }, [protocolos]);

  const localData = useMemo(() => {
    const map = new Map(locais.map((l: any) => [l.id, l.nome]));
    const counts: Record<string, number> = {};
    protocolos.forEach(p => {
      const nome = (p as any).local_id ? (map.get((p as any).local_id) ?? "—") : "Sem unidade";
      counts[nome] = (counts[nome] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [protocolos, locais]);

  const crossTab = useMemo(() => {
    const map = new Map(locais.map((l: any) => [l.id, l.nome]));
    const rows = CATEGORIAS.map(c => {
      const filtered = protocolos.filter(p => p.categoria === c.value);
      const porLocal: Record<string, number> = {};
      let concluidos = 0, abertos = 0, vencidos = 0;
      filtered.forEach(p => {
        const nome = (p as any).local_id ? (map.get((p as any).local_id) ?? "—") : "Sem unidade";
        porLocal[nome] = (porLocal[nome] || 0) + 1;
        if (p.status === "concluido") concluidos++;
        else {
          abertos++;
          if (situacaoProtocolo(p as any).situacao === "vencido") vencidos++;
        }
      });
      return {
        categoria: c.label,
        total: filtered.length,
        concluidos,
        abertos,
        vencidos,
        unidades: Object.entries(porLocal).sort((a, b) => b[1] - a[1]),
      };
    }).filter(r => r.total > 0);
    return rows;
  }, [protocolos, locais]);

  const mensalData = useMemo(() => {
    const year = new Date().getFullYear();
    const counts = Array(12).fill(0);
    protocolos.forEach(p => {
      if (p.data_abertura.startsWith(String(year))) {
        counts[parseInt(p.data_abertura.slice(5, 7), 10) - 1]++;
      }
    });
    return MESES.map((m, i) => ({ mes: m, total: counts[i] }));
  }, [protocolos]);

  function exportPDF() {
    if (!secretaria) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Relatório — ${secretaria.nome}`, 40, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    let y = 70;
    if (secretaria.sigla) { doc.text(`Sigla: ${secretaria.sigla}`, 40, y); y += 14; }
    if (secretaria.centro_custo) { doc.text(`Centro de Custo: ${secretaria.centro_custo}`, 40, y); y += 14; }
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 40, y); y += 20;

    // Resumo
    autoTable(doc, {
      startY: y,
      head: [["Total", "Abertos", "Concluídos", "Vencidos", "No prazo"]],
      body: [[stats.total, stats.abertos, stats.concluidos, stats.vencidos, stats.noPrazo].map(String)],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Por categoria
    autoTable(doc, {
      head: [["Categoria", "Quantidade"]],
      body: categoriaData.map(c => [c.name, String(c.value)]),
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129] },
    });

    // Por tipo
    autoTable(doc, {
      head: [["Tipo", "Quantidade"]],
      body: tipoData.map(t => [t.name, String(t.value)]),
      theme: "striped",
      headStyles: { fillColor: [139, 92, 246] },
    });

    // Protocolos
    autoTable(doc, {
      head: [["Nº", "Data", "Tipo", "Categoria", "Assunto", "Status", "Situação"]],
      body: stats.enriched.map(p => [
        p.numero,
        formatDate(p.data_abertura),
        PRAZOS[p.tipo as TipoProtocolo]?.label ?? p.tipo,
        categoriaLabel(p.categoria as CategoriaProtocolo),
        (p.assunto ?? "").slice(0, 50),
        p.status,
        p.status === "concluido" ? "Concluído" : (p._s.situacao === "vencido" ? `Atrasado ${Math.abs(p._s.dias)}d` : `${p._s.dias}d restantes`),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] },
    });

    doc.save(`relatorio-${secretaria.nome.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  if (!secretaria) {
    return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/relatorios"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{secretaria.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {secretaria.sigla && <span className="mr-2">{secretaria.sigla}</span>}
              {secretaria.centro_custo && <span className="font-mono">CC: {secretaria.centro_custo}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ano inteiro</SelectItem>
              {MESES_FULL.map((m, i) => (
                <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={exportPDF}>
            <FileText className="h-4 w-4 mr-1" /> Exportar PDF
          </Button>
        </div>
      </div>

      <div ref={printRef} className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Abertos", value: stats.abertos, color: "text-blue-600" },
            { label: "Concluídos", value: stats.concluidos, color: "text-green-600" },
            { label: "Vencidos", value: stats.vencidos, color: "text-destructive" },
            { label: "No prazo", value: stats.noPrazo, color: "text-amber-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Por categoria</CardTitle></CardHeader>
            <CardContent>
              {categoriaData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={categoriaData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={120}
                      minAngle={6}
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                      labelLine={false}
                      label={({ percent, name }: any) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {categoriaData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} protocolos`, name]}
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(value: string) => <span className="text-xs">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Por unidade</CardTitle></CardHeader>
            <CardContent>
              {localData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={localData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={120}
                      minAngle={6}
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                      labelLine={false}
                      label={({ value }: any) => `${value}`}
                    >
                      {localData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} protocolos`, name]}
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(value: string) => <span className="text-xs">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Manifestações por tipo × unidade</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-left">
                  <th className="py-2 px-3 font-medium">Tipo</th>
                  <th className="py-2 px-2 font-medium text-xs text-center">Total</th>
                  <th className="py-2 px-2 font-medium text-xs text-center">Concluídos</th>
                  <th className="py-2 px-2 font-medium text-xs text-center">Abertos</th>
                  <th className="py-2 px-2 font-medium text-xs text-center">Vencidos</th>
                  <th className="py-2 px-3 font-medium text-xs">Unidades</th>
                </tr>
              </thead>
              <tbody>
                {crossTab.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Sem dados</td></tr>
                )}
                {crossTab.map(row => (
                  <tr key={row.categoria} className="border-b hover:bg-secondary/30 align-top">
                    <td className="py-2 px-3 font-medium">{row.categoria}</td>
                    <td className="py-2 px-2 text-center">{row.total}</td>
                    <td className="py-2 px-2 text-center text-green-600">{row.concluidos}</td>
                    <td className="py-2 px-2 text-center text-blue-600">{row.abertos}</td>
                    <td className="py-2 px-2 text-center text-destructive">{row.vencidos}</td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {row.unidades.map(([nome, qtd]) => (
                          <Badge key={nome} variant="outline" className="text-xs">
                            {nome} · {qtd}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Protocolos por mês ({new Date().getFullYear()})</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mensalData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Todos os protocolos ({stats.enriched.length})</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-left">
                  <th className="py-2 px-3 font-medium">Nº / Assunto</th>
                  <th className="py-2 px-2 font-medium text-xs">Tipo</th>
                  <th className="py-2 px-2 font-medium text-xs">Categoria</th>
                  <th className="py-2 px-2 font-medium text-xs">Aberto</th>
                  <th className="py-2 px-2 font-medium text-xs">Status</th>
                  <th className="py-2 px-2 font-medium text-xs text-right">Situação</th>
                </tr>
              </thead>
              <tbody>
                {stats.enriched.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Sem protocolos</td></tr>
                )}
                {stats.enriched.map(p => (
                  <tr key={p.id} className="border-b hover:bg-secondary/30">
                    <td className="py-2 px-3">
                      <div className="font-mono text-[10px] text-muted-foreground">{p.numero}</div>
                      <div>{p.assunto}</div>
                    </td>
                    <td className="py-2 px-2 text-xs">{PRAZOS[p.tipo as TipoProtocolo]?.label ?? p.tipo}</td>
                    <td className="py-2 px-2 text-xs">{categoriaLabel(p.categoria as CategoriaProtocolo)}</td>
                    <td className="py-2 px-2 text-xs">{formatDate(p.data_abertura)}</td>
                    <td className="py-2 px-2 text-xs"><Badge variant="outline">{p.status}</Badge></td>
                    <td className="py-2 px-2 text-xs text-right">
                      {p.status === "concluido" ? (
                        <span className="text-green-600">Concluído</span>
                      ) : p._s.situacao === "vencido" ? (
                        <span className="text-destructive font-semibold">+{Math.abs(p._s.dias)}d</span>
                      ) : (
                        <span className="text-muted-foreground">{p._s.dias}d</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}