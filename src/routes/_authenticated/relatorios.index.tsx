import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIAS, type CategoriaProtocolo, situacaoProtocolo, formatDate, categoriaLabel, PRAZOS, type TipoProtocolo } from "@/lib/prazo";
import { Download, BarChart3, ChevronRight, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/relatorios/")({
  component: RelatoriosPage,
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function RelatoriosPage() {
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState(String(currentYear));

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocolos")
        .select("*, secretarias(nome), responsaveis(nome), locais(nome,centro_custo)")
        .order("data_abertura", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("*").order("nome")).data ?? [],
  });

  const anosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    protocolos.forEach(p => set.add(p.data_abertura.slice(0, 4)));
    set.add(String(currentYear));
    return Array.from(set).sort().reverse();
  }, [protocolos, currentYear]);

  const doAno = protocolos.filter(p => p.data_abertura.startsWith(ano));

  // Comparativo mês a mês por categoria
  const comparativoMensal = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    CATEGORIAS.forEach(c => { matrix[c.value] = Array(12).fill(0); });
    doAno.forEach(p => {
      const mes = parseInt(p.data_abertura.slice(5, 7), 10) - 1;
      const cat = p.categoria as string;
      if (matrix[cat]) matrix[cat][mes]++;
    });
    return matrix;
  }, [doAno]);

  // Resumo anual por secretaria
  const resumoSecretaria = useMemo(() => {
    return secretarias.map(s => {
      const ps = doAno.filter(p => p.secretaria_id === s.id);
      const meses = Array(12).fill(0);
      ps.forEach(p => meses[parseInt(p.data_abertura.slice(5, 7), 10) - 1]++);
      const porCat: Record<string, number> = {};
      CATEGORIAS.forEach(c => { porCat[c.value] = ps.filter(p => p.categoria === c.value).length; });
      const total = ps.length;
      const abertos = ps.filter(p => p.status !== "concluido").length;
      const concluidos = ps.filter(p => p.status === "concluido").length;
      return { ...s, meses, porCat, total, abertos, concluidos };
    }).sort((a, b) => b.total - a.total);
  }, [secretarias, doAno]);

  function exportComparativoMensal() {
    const rows: any[] = [];
    CATEGORIAS.forEach(c => {
      const row: any = { Categoria: c.label };
      MESES.forEach((m, i) => row[m] = comparativoMensal[c.value][i]);
      row.Total = comparativoMensal[c.value].reduce((a, b) => a + b, 0);
      rows.push(row);
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Comparativo ${ano}`);
    XLSX.writeFile(wb, `comparativo-mensal-${ano}.xlsx`);
  }

  function exportResumoSecretaria() {
    const rows = resumoSecretaria.map(s => {
      const r: any = { Secretaria: s.nome, "Centro de Custo": s.centro_custo ?? "" };
      MESES.forEach((m, i) => r[m] = s.meses[i]);
      CATEGORIAS.forEach(c => r[c.label] = s.porCat[c.value]);
      r.Total = s.total;
      r.Abertos = s.abertos;
      r.Concluidos = s.concluidos;
      return r;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Por secretaria ${ano}`);
    XLSX.writeFile(wb, `resumo-secretarias-${ano}.xlsx`);
  }

  const totalMes = MESES.map((_, i) =>
    CATEGORIAS.reduce((sum, c) => sum + comparativoMensal[c.value][i], 0)
  );
  const maxMes = Math.max(1, ...totalMes);

  // Atrasadas com dias de atraso (todos os anos, não filtra por ano)
  const atrasadas = useMemo(() => {
    return protocolos
      .filter(p => p.status !== "concluido")
      .map(p => ({ ...p, _s: situacaoProtocolo(p as any) }))
      .filter(p => p._s.situacao === "vencido")
      .sort((a, b) => a._s.dias - b._s.dias);
  }, [protocolos]);

  function exportAtrasadas() {
    const rows = atrasadas.map(p => ({
      "Número": p.numero,
      "Tipo": PRAZOS[p.tipo as TipoProtocolo].label,
      "Categoria": categoriaLabel(p.categoria as CategoriaProtocolo),
      "Assunto": p.assunto,
      "Secretaria": (p as any).secretarias?.nome ?? "",
      "Local": (p as any).locais?.nome ?? "",
      "Responsável": (p as any).responsaveis?.nome ?? "",
      "Solicitante": p.solicitante ?? "",
      "Data Abertura": formatDate(p.data_abertura),
      "Prazo Final": formatDate(p._s.prazoFinal),
      "Dias em atraso": Math.abs(p._s.dias),
      "Prorrogado": p.prorrogado ? "Sim" : "Não",
      "Status": p.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atrasadas");
    XLSX.writeFile(wb, `protocolos-atrasadas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // Exportações PDF
  function pdfHeader(doc: jsPDF, titulo: string) {
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(titulo, 40, 40);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, 56);
  }

  function exportComparativoPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pdfHeader(doc, `Comparativo mensal — ${ano}`);
    autoTable(doc, {
      startY: 70,
      head: [["Categoria", ...MESES, "Total"]],
      body: CATEGORIAS.map(c => {
        const row = comparativoMensal[c.value];
        return [c.label, ...row.map(String), String(row.reduce((a, b) => a + b, 0))];
      }),
      foot: [["Total", ...totalMes.map(String), String(totalMes.reduce((a, b) => a + b, 0))]],
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 9 },
    });
    doc.save(`comparativo-mensal-${ano}.pdf`);
  }

  function exportSecretariasPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pdfHeader(doc, `Resumo por secretaria — ${ano}`);
    autoTable(doc, {
      startY: 70,
      head: [["Secretaria", "C. Custo", ...CATEGORIAS.map(c => c.label), "Total", "Abertos", "Concluídos"]],
      body: resumoSecretaria.map(s => [
        s.nome,
        s.centro_custo ?? "—",
        ...CATEGORIAS.map(c => String(s.porCat[c.value] ?? 0)),
        String(s.total),
        String(s.abertos),
        String(s.concluidos),
      ]),
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8 },
    });
    doc.save(`resumo-secretarias-${ano}.pdf`);
  }

  function exportAtrasadasPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pdfHeader(doc, `Protocolos atrasados (${atrasadas.length})`);
    autoTable(doc, {
      startY: 70,
      head: [["Nº", "Tipo", "Categoria", "Secretaria", "Assunto", "Aberto", "Prazo", "Atraso"]],
      body: atrasadas.map(p => [
        p.numero,
        PRAZOS[p.tipo as TipoProtocolo].label,
        categoriaLabel(p.categoria as CategoriaProtocolo),
        (p as any).secretarias?.nome ?? "—",
        (p.assunto ?? "").slice(0, 50),
        formatDate(p.data_abertura),
        formatDate(p._s.prazoFinal),
        `+${Math.abs(p._s.dias)}d`,
      ]),
      headStyles: { fillColor: [239, 68, 68] },
      styles: { fontSize: 8 },
    });
    doc.save(`atrasados-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // Resumo do ano
  const totalAno = doAno.length;
  const concluidosAno = doAno.filter(p => p.status === "concluido").length;
  const abertosAno = totalAno - concluidosAno;
  const vencidosAno = doAno.filter(p => {
    if (p.status === "concluido") return false;
    return situacaoProtocolo(p as any).situacao === "vencido";
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">{doAno.length} protocolos em {ano}</p>
        </div>
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {anosDisponiveis.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="mensal" className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total {ano}</div><div className="text-2xl font-bold">{totalAno}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Concluídos</div><div className="text-2xl font-bold text-green-600">{concluidosAno}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Em aberto</div><div className="text-2xl font-bold text-blue-600">{abertosAno}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Vencidos</div><div className="text-2xl font-bold text-destructive">{vencidosAno}</div></CardContent></Card>
        </div>

        <TabsList>
          <TabsTrigger value="mensal">Comparativo mensal</TabsTrigger>
          <TabsTrigger value="secretaria">Por secretaria</TabsTrigger>
          <TabsTrigger value="atrasadas">Atrasadas ({atrasadas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mensal" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button onClick={exportComparativoPDF} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button onClick={exportComparativoMensal} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Total por mês</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-1 items-end h-32">
                {totalMes.map((v, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="text-[10px] text-muted-foreground">{v}</div>
                    <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(v / maxMes) * 100}%`, minHeight: v > 0 ? "4px" : "0" }} />
                    <div className="text-[10px] text-muted-foreground">{MESES[i]}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Por categoria × mês</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2 font-medium">Categoria</th>
                    {MESES.map(m => <th key={m} className="py-2 px-2 font-medium text-center text-xs">{m}</th>)}
                    <th className="py-2 px-2 font-medium text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIAS.map(c => {
                    const total = comparativoMensal[c.value].reduce((a, b) => a + b, 0);
                    return (
                      <tr key={c.value} className="border-b">
                        <td className="py-2 px-2 font-medium">{c.label}</td>
                        {comparativoMensal[c.value].map((v, i) => (
                          <td key={i} className="py-2 px-2 text-center text-xs tabular-nums">{v || "—"}</td>
                        ))}
                        <td className="py-2 px-2 text-center font-semibold">{total}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-secondary font-semibold">
                    <td className="py-2 px-2">Total</td>
                    {totalMes.map((v, i) => <td key={i} className="py-2 px-2 text-center text-xs tabular-nums">{v || "—"}</td>)}
                    <td className="py-2 px-2 text-center">{totalMes.reduce((a, b) => a + b, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="secretaria" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button onClick={exportSecretariasPDF} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button onClick={exportResumoSecretaria} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left bg-secondary/40">
                    <th className="py-2 px-3 font-medium">Secretaria</th>
                    {CATEGORIAS.map(c => (
                      <th key={c.value} className="py-2 px-2 font-medium text-center text-xs">{c.label.split(" ")[0]}</th>
                    ))}
                    <th className="py-2 px-2 font-medium text-center">Total</th>
                    <th className="py-2 px-2 font-medium text-center text-destructive">Abertos</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoSecretaria.map(s => (
                    <tr key={s.id} className="border-b hover:bg-secondary/30 cursor-pointer group">
                      <td className="py-2 px-3">
                        <Link to="/relatorios/secretaria/$id" params={{ id: s.id }} className="flex items-center gap-2 hover:text-primary">
                          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                          <div>
                            <div className="font-medium underline-offset-2 group-hover:underline">{s.nome}</div>
                            {s.centro_custo && <div className="text-[10px] text-muted-foreground font-mono">{s.centro_custo}</div>}
                          </div>
                        </Link>
                      </td>
                      {CATEGORIAS.map(c => (
                        <td key={c.value} className="py-2 px-2 text-center tabular-nums text-xs">{s.porCat[c.value as CategoriaProtocolo] || "—"}</td>
                      ))}
                      <td className="py-2 px-2 text-center font-semibold">{s.total || "—"}</td>
                      <td className="py-2 px-2 text-center font-semibold text-destructive">{s.abertos || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atrasadas" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button onClick={exportAtrasadasPDF} variant="outline" size="sm" disabled={atrasadas.length === 0}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button onClick={exportAtrasadas} variant="outline" size="sm" disabled={atrasadas.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left bg-secondary/40">
                    <th className="py-2 px-3 font-medium">Nº / Assunto</th>
                    <th className="py-2 px-2 font-medium text-xs">Tipo</th>
                    <th className="py-2 px-2 font-medium text-xs">Secretaria</th>
                    <th className="py-2 px-2 font-medium text-xs">Aberto</th>
                    <th className="py-2 px-2 font-medium text-xs">Venceu</th>
                    <th className="py-2 px-2 font-medium text-xs text-right text-destructive">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {atrasadas.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma atrasada 🎉</td></tr>
                  )}
                  {atrasadas.map(p => (
                    <tr key={p.id} className="border-b hover:bg-secondary/30">
                      <td className="py-2 px-3">
                        <div className="font-mono text-[10px] text-muted-foreground">{p.numero}</div>
                        <div className="text-sm">{p.assunto}</div>
                      </td>
                      <td className="py-2 px-2 text-xs">{p.tipo}</td>
                      <td className="py-2 px-2 text-xs">{(p as any).secretarias?.nome ?? "—"}</td>
                      <td className="py-2 px-2 text-xs">{formatDate(p.data_abertura)}</td>
                      <td className="py-2 px-2 text-xs">{formatDate(p._s.prazoFinal)}</td>
                      <td className="py-2 px-2 text-right font-bold text-destructive">+{Math.abs(p._s.dias)}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}