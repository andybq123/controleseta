import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIAS, type CategoriaProtocolo, situacaoProtocolo, formatDate, categoriaLabel, PRAZOS, type TipoProtocolo } from "@/lib/prazo";
import { Download, BarChart3, ChevronRight, FileText, Search, X } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchAllPaginated } from "@/lib/fetch-all";
import { useServerFn } from "@tanstack/react-start";
import { gerarRelatorioIA } from "@/lib/relatorio-ia.functions";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/relatorios/")({
  component: RelatoriosPage,
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function RelatoriosPage() {
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState(String(currentYear));
  const [mes, setMes] = useState<string>("all");
  const [q, setQ] = useState("");
  const [fCategoria, setFCategoria] = useState<string>("all");
  const [fTipo, setFTipo] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fSecretaria, setFSecretaria] = useState<string>("all");

  const { data: userInfo } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const { data: p } = await supabase.from("profiles").select("nome,email").eq("id", data.user.id).maybeSingle();
      return { id: data.user.id, email: data.user.email, nome: p?.nome ?? data.user.email };
    },
  });

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos"],
    queryFn: () =>
      fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("*, secretarias(nome)")
          .order("data_abertura", { ascending: false })
          .range(from, to),
      ),
  });

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("*").order("nome")).data ?? [],
  });

  const { data: locais = [] } = useQuery({
    queryKey: ["locais-all"],
    queryFn: async () => (await supabase.from("locais").select("id, nome, secretaria_id").order("nome")).data ?? [],
  });

  const anosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    protocolos.forEach(p => set.add(p.data_abertura.slice(0, 4)));
    set.add(String(currentYear));
    return Array.from(set).sort().reverse();
  }, [protocolos, currentYear]);

  const matchesFilter = (p: any) => {
    if (fCategoria !== "all" && p.categoria !== fCategoria) return false;
    if (fTipo !== "all" && p.tipo !== fTipo) return false;
    if (fStatus !== "all" && p.status !== fStatus) return false;
    if (fSecretaria !== "all" && p.secretaria_id !== fSecretaria) return false;
    if (q.trim()) {
      const needle = q.toLowerCase();
      const hay = [p.numero, p.assunto, p.descricao, p.solicitante, (p as any).secretarias?.nome]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  };

  const filtrados = protocolos.filter(matchesFilter);
  const doAno = filtrados.filter(p => {
    if (!p.data_abertura.startsWith(ano)) return false;
    if (mes !== "all" && p.data_abertura.slice(5, 7) !== mes) return false;
    return true;
  });
  const filtrosAtivos = q || fCategoria !== "all" || fTipo !== "all" || fStatus !== "all" || fSecretaria !== "all";
  const clearFilters = () => { setQ(""); setFCategoria("all"); setFTipo("all"); setFStatus("all"); setFSecretaria("all"); };

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
    return filtrados
      .filter(p => p.status !== "concluido")
      .map(p => ({ ...p, _s: situacaoProtocolo(p as any) }))
      .filter(p => p._s.situacao === "vencido")
      .sort((a, b) => a._s.dias - b._s.dias);
  }, [filtrados]);

  function exportAtrasadas() {
    const rows = atrasadas.map(p => ({
      "Número": p.numero,
      "Tipo": PRAZOS[p.tipo as TipoProtocolo].label,
      "Categoria": categoriaLabel(p.categoria as CategoriaProtocolo),
      "Assunto": p.assunto,
      "Secretaria": (p as any).secretarias?.nome ?? "",
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
    if (filtrosAtivos) {
      const partes: string[] = [];
      if (q) partes.push(`busca:"${q}"`);
      if (fCategoria !== "all") partes.push(`categoria:${categoriaLabel(fCategoria as CategoriaProtocolo)}`);
      if (fTipo !== "all") partes.push(`tipo:${PRAZOS[fTipo as TipoProtocolo]?.label}`);
      if (fStatus !== "all") partes.push(`status:${fStatus}`);
      if (fSecretaria !== "all") {
        const s = secretarias.find((x: any) => x.id === fSecretaria);
        if (s) partes.push(`secretaria:${(s as any).nome}`);
      }
      doc.text(`Filtros: ${partes.join(" · ")}`, 40, 68);
    }
  }

  function pdfSignature(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    // hash simples do conteúdo+timestamp para identificar o documento
    const seed = `${userInfo?.id ?? "anon"}|${Date.now()}|${Math.random()}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    const hash = Math.abs(h).toString(36).toUpperCase().padStart(8, "0");
    const docId = `DOC-${new Date().getFullYear()}-${hash}`;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(200);
      doc.line(40, pageHeight - 60, pageWidth - 40, pageHeight - 60);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(
        `Assinado eletronicamente por: ${userInfo?.nome ?? "—"}${userInfo?.email ? ` <${userInfo.email}>` : ""}`,
        40, pageHeight - 46
      );
      doc.text(`Documento: ${docId}  ·  Emitido em ${new Date().toLocaleString("pt-BR")}`, 40, pageHeight - 34);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 40, pageHeight - 34, { align: "right" });
    }
  }

  function exportComparativoPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pdfHeader(doc, `Comparativo mensal — ${ano}`);
    autoTable(doc, {
      startY: filtrosAtivos ? 84 : 70,
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
    pdfSignature(doc);
    doc.save(`comparativo-mensal-${ano}.pdf`);
  }

  function exportSecretariasPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pdfHeader(doc, `Resumo por secretaria — ${ano}`);
    autoTable(doc, {
      startY: filtrosAtivos ? 84 : 70,
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
    pdfSignature(doc);
    doc.save(`resumo-secretarias-${ano}.pdf`);
  }

  function exportAtrasadasPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pdfHeader(doc, `Protocolos atrasados (${atrasadas.length})`);
    autoTable(doc, {
      startY: filtrosAtivos ? 84 : 70,
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
    pdfSignature(doc);
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
        <div className="flex gap-2">
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
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="mensal" className="space-y-4">
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar por número, assunto, solicitante…" className="pl-8" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <Select value={fTipo} onValueChange={setFTipo}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
                  <SelectItem value="lai">LAI</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fCategoria} onValueChange={setFCategoria}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fSecretaria} onValueChange={setFSecretaria}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Secretaria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas secretarias</SelectItem>
                  {secretarias.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {filtrosAtivos && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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
          <TabsTrigger value="ia"><Sparkles className="h-3.5 w-3.5 mr-1" /> Relatório IA</TabsTrigger>
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