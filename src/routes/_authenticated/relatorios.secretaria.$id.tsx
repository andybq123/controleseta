import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { CATEGORIAS, type CategoriaProtocolo, situacaoProtocolo, formatDate, categoriaLabel, PRAZOS, type TipoProtocolo } from "@/lib/prazo";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/relatorios/secretaria/$id")({
  component: SecretariaRelatorio,
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function SecretariaRelatorio() {
  const { id } = Route.useParams();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: secretaria } = useQuery({
    queryKey: ["secretaria", id],
    queryFn: async () => (await supabase.from("secretarias").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos-sec", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocolos")
        .select("*, responsaveis(nome), locais(nome,centro_custo)")
        .eq("secretaria_id", id)
        .order("data_abertura", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ["resp-sec", id],
    queryFn: async () => (await supabase.from("responsaveis").select("*").eq("secretaria_id", id)).data ?? [],
  });

  const { data: locais = [] } = useQuery({
    queryKey: ["locais-sec", id],
    queryFn: async () => (await supabase.from("locais").select("*").eq("secretaria_id", id)).data ?? [],
  });

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

    // Responsáveis
    if (responsaveis.length > 0) {
      autoTable(doc, {
        head: [["Responsável", "Cargo", "E-mail", "Telefone"]],
        body: responsaveis.map(r => [r.nome, r.cargo ?? "—", r.email ?? "—", r.telefone ?? "—"]),
        theme: "grid",
      });
    }

    // Locais
    if (locais.length > 0) {
      autoTable(doc, {
        head: [["Local", "Centro de Custo"]],
        body: locais.map(l => [l.nome, l.centro_custo ?? "—"]),
        theme: "grid",
      });
    }

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
        <Button onClick={exportPDF}>
          <FileText className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
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
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={categoriaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name}: ${e.value}`}>
                      {categoriaData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Por tipo</CardTitle></CardHeader>
            <CardContent>
              {tipoData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={tipoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name}: ${e.value}`}>
                      {tipoData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

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

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Responsáveis ({responsaveis.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {responsaveis.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6 text-center">Nenhum responsável</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {responsaveis.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 px-4">
                          <div className="font-medium">{r.nome}</div>
                          {r.cargo && <div className="text-xs text-muted-foreground">{r.cargo}</div>}
                          {(r.email || r.telefone) && (
                            <div className="text-xs text-muted-foreground">{[r.email, r.telefone].filter(Boolean).join(" · ")}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Locais ({locais.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {locais.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6 text-center">Nenhum local</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {locais.map(l => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-2 px-4">
                          <div className="font-medium">{l.nome}</div>
                          {l.centro_custo && <div className="text-xs font-mono text-muted-foreground">{l.centro_custo}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

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