import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ProtocoloDetailDialog } from "@/components/protocolo-detail-dialog";
import { situacaoProtocolo, CATEGORIAS, type CategoriaProtocolo } from "@/lib/prazo";
import {
  AlertTriangle, CheckCircle2, Clock, FileText, Smile,
  Timer, Download, MapPin, TrendingUp,
} from "lucide-react";
import { fetchAllPaginated } from "@/lib/fetch-all";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { format, startOfMonth, subMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const CAT_COLORS: Record<CategoriaProtocolo, string> = {
  solicitacao: "hsl(217 91% 60%)",
  reclamacao: "hsl(25 95% 53%)",
  elogio: "hsl(142 71% 45%)",
  denuncia: "hsl(0 84% 60%)",
  pedido_informacao: "hsl(262 83% 58%)",
  outros: "hsl(215 16% 60%)",
};

function Dashboard() {
  const [drill, setDrill] = useState<{ title: string; items: any[] } | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

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

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("secretarias").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const enriched = useMemo(
    () => protocolos.map(p => ({ ...p, _s: situacaoProtocolo(p as any) })),
    [protocolos],
  );
  const total = enriched.length;
  const ativos = enriched.filter(p => p.status !== "concluido");
  const concluidos = enriched.filter(p => p.status === "concluido");
  const vencidos = ativos.filter(p => p._s.situacao === "vencido");
  const noPrazo = ativos.filter(p => p._s.situacao !== "vencido");

  // Prazo médio de resposta (dias) — entre data_abertura e data_conclusao
  const prazoMedio = useMemo(() => {
    const fechados = concluidos.filter(p => p.data_conclusao && p.data_abertura);
    if (fechados.length === 0) return 0;
    const soma = fechados.reduce(
      (acc, p) => acc + Math.max(0, differenceInDays(new Date(p.data_conclusao!), new Date(p.data_abertura))),
      0,
    );
    return Math.round((soma / fechados.length) * 10) / 10;
  }, [concluidos]);

  // Satisfação proxy: % no prazo (sem vencidos) sobre total
  const satisfacao = total > 0 ? Math.round(((total - vencidos.length) / total) * 100) : 100;
  const pctConcluidos = total > 0 ? ((concluidos.length / total) * 100).toFixed(2) : "0";
  const pctAndamento = total > 0 ? ((ativos.length / total) * 100).toFixed(2) : "0";
  const pctAtrasados = total > 0 ? ((vencidos.length / total) * 100).toFixed(2) : "0";
  const slaNoPrazo = ativos.length > 0 ? Math.round((noPrazo.length / ativos.length) * 100) : 100;

  // Evolução por mês — últimos 6 meses (acumulado)
  const evolucao = useMemo(() => {
    const meses: { mes: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = startOfMonth(subMonths(new Date(), i));
      const fim = startOfMonth(subMonths(new Date(), i - 1));
      const acum = enriched.filter(p => new Date(p.data_abertura) < fim).length;
      meses.push({ mes: format(ref, "MMM/yy", { locale: ptBR }), total: acum });
    }
    return meses;
  }, [enriched]);

  // Distribuição por categoria
  const categoriaData = useMemo(() => {
    const counts: Record<string, number> = {};
    enriched.forEach(p => {
      const c = (p.categoria as CategoriaProtocolo) ?? "outros";
      counts[c] = (counts[c] ?? 0) + 1;
    });
    return CATEGORIAS.map(c => ({
      name: c.label,
      value: counts[c.value] ?? 0,
      color: CAT_COLORS[c.value],
    })).filter(d => d.value > 0);
  }, [enriched]);

  // Top 10 assuntos
  const topAssuntos = useMemo(() => {
    const counts: Record<string, number> = {};
    enriched.forEach(p => {
      const a = (p.assunto ?? "Outros").slice(0, 40);
      counts[a] = (counts[a] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [enriched]);

  // Manifestações por secretaria
  const porSecretaria = useMemo(() => {
    return secretarias
      .map(s => {
        const qtd = enriched.filter(p => p.secretaria_id === s.id).length;
        return { nome: s.sigla || s.nome.slice(0, 14), full: s.nome, qtd };
      })
      .filter(s => s.qtd > 0)
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 8);
  }, [enriched, secretarias]);

  // Reclamações - Área da Saúde (por assunto)
  const reclamacoesSaude = useMemo(() => {
    const saudeIds = secretarias.filter(s => /sa[uú]de/i.test(s.nome)).map(s => s.id);
    const recs = enriched.filter(
      p => p.secretaria_id != null && saudeIds.includes(p.secretaria_id) && p.categoria === "reclamacao",
    );
    const counts: Record<string, number> = {};
    recs.forEach(p => {
      const a = (p.assunto ?? "Outros").slice(0, 30);
      counts[a] = (counts[a] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 6);
  }, [enriched, secretarias]);

  // Por unidade (local) na saúde
  const porUnidade = useMemo(() => {
    const saudeIds = secretarias.filter(s => /sa[uú]de/i.test(s.nome)).map(s => s.id);
    const counts: Record<string, number> = {};
    enriched
      .filter(p => p.secretaria_id != null && saudeIds.includes(p.secretaria_id))
      .forEach(p => {
        const nome = (p as any).locais?.nome ?? "Sem unidade";
        counts[nome] = (counts[nome] ?? 0) + 1;
      });
    return Object.entries(counts)
      .map(([nome, qtd]) => ({ nome: nome.slice(0, 18), qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 8);
  }, [enriched, secretarias]);

  // Situação dos protocolos (donut)
  const situacaoData = [
    { name: "Em andamento", value: ativos.length, color: "hsl(217 91% 60%)" },
    { name: "Concluídos", value: concluidos.length, color: "hsl(142 71% 45%)" },
    { name: "Atrasados", value: vencidos.length, color: "hsl(0 84% 60%)" },
  ].filter(d => d.value > 0);

  // Concentração por região (top locais)
  const porRegiao = useMemo(() => {
    const counts: Record<string, number> = {};
    enriched.forEach(p => {
      const nome = (p as any).locais?.nome ?? "Sem local";
      counts[nome] = (counts[nome] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [enriched]);

  const openDrill = (title: string, predicate: (p: any) => boolean) => {
    const items = enriched.filter(predicate);
    setDrill({ title: `${title} (${items.length})`, items });
  };

  const exportarRelatorio = () => {
    const linhas = [
      ["Numero", "Tipo", "Categoria", "Assunto", "Secretaria", "Status", "Aberto", "Concluído"].join(";"),
      ...enriched.map(p =>
        [
          p.numero, p.tipo, p.categoria, (p.assunto ?? "").replace(/;/g, ","),
          (p as any).secretarias?.nome ?? "", p.status, p.data_abertura, p.data_conclusao ?? "",
        ].join(";"),
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + linhas], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-ouvidoria-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Executivo</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral das manifestações da Ouvidoria — {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportarRelatorio} className="gap-2">
          <Download className="h-4 w-4" /> Exportar Relatório
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={FileText} tone="primary" label="Total de Protocolos" value={total} hint="100% do período"
          onClick={() => openDrill("Todos os protocolos", () => true)} />
        <KpiCard icon={Clock} tone="info" label="Em Andamento" value={ativos.length} hint={`${pctAndamento}% do total`}
          onClick={() => openDrill("Protocolos em andamento", p => p.status !== "concluido")} />
        <KpiCard icon={CheckCircle2} tone="success" label="Concluídos" value={concluidos.length} hint={`${pctConcluidos}% do total`}
          onClick={() => openDrill("Protocolos concluídos", p => p.status === "concluido")} />
        <KpiCard icon={AlertTriangle} tone="destructive" label="Atrasados" value={vencidos.length} hint={`${pctAtrasados}% do total`}
          onClick={() => openDrill("Protocolos atrasados", p => p.status !== "concluido" && p._s.situacao === "vencido")} />
        <KpiCard icon={Timer} tone="violet" label="Prazo Médio de Resposta" value={`${prazoMedio}`} suffix="dias" hint="Meta: 5 dias"
          onClick={() => openDrill("Protocolos concluídos (prazo médio)", p => p.status === "concluido" && !!p.data_conclusao)} />
        <KpiCard icon={Smile} tone="emerald" label="Satisfação do Usuário" value={`${satisfacao}%`}
          hint={satisfacao >= 80 ? "Ótimo" : satisfacao >= 60 ? "Bom" : "Atenção"}
          hintTrend={satisfacao >= 80 ? "up" : "down"}
          onClick={() => openDrill("Protocolos no prazo", p => p._s.situacao !== "vencido")} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução de Manifestações por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucao} margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="total" stroke="hsl(217 91% 60%)" strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(217 91% 60%)" }} label={{ position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoriaData.length > 0 ? categoriaData : [{ name: "—", value: 1, color: "hsl(var(--muted))" }]}
                    dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {(categoriaData.length > 0 ? categoriaData : [{ color: "hsl(var(--muted))" }]).map((d, i) => (
                      <Cell key={i} fill={(d as any).color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold">{total}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {categoriaData.map(d => {
                const pct = total > 0 ? ((d.value / total) * 100).toFixed(2) : "0";
                const cat = CATEGORIAS.find(c => c.label === d.name);
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => openDrill(`Categoria: ${d.name}`, p => (p.categoria ?? "outros") === (cat?.value ?? "outros"))}
                    className="w-full flex items-center gap-2 text-xs rounded px-1 py-0.5 hover:bg-muted/60 transition"
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="font-medium">{d.name}</span>
                    <span className="ml-auto text-muted-foreground">{pct}% ({d.value})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 10 Assuntos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topAssuntos.length === 0 && <p className="text-xs text-muted-foreground">Sem dados.</p>}
              {(() => {
                const max = Math.max(1, ...topAssuntos.map(a => a.qtd));
                return topAssuntos.map(a => (
                  <button
                    key={a.nome}
                    type="button"
                    onClick={() => openDrill(`Assunto: ${a.nome}`, p => (p.assunto ?? "Outros").slice(0, 40) === a.nome)}
                    className="w-full grid grid-cols-[1fr_auto] items-center gap-2 text-left rounded px-1 py-0.5 hover:bg-muted/60 transition"
                  >
                    <div className="min-w-0">
                      <p className="text-xs truncate" title={a.nome}>{a.nome}</p>
                      <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(a.qtd / max) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-semibold tabular-nums">{a.qtd}</span>
                  </button>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Manifestações por Secretaria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porSecretaria} margin={{ top: 20, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="qtd"
                    fill="hsl(217 91% 60%)"
                    radius={[6, 6, 0, 0]}
                    label={{ position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    cursor="pointer"
                    onClick={(d: any) => {
                      const sec = secretarias.find(s => s.nome === d?.full);
                      if (sec) openDrill(`Secretaria: ${sec.nome}`, p => p.secretaria_id === sec.id);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reclamações — Área da Saúde</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-2">Por assunto</p>
                <div className="space-y-1.5">
                  {reclamacoesSaude.length === 0 && <p className="text-xs text-muted-foreground">Sem reclamações.</p>}
                  {(() => {
                    const max = Math.max(1, ...reclamacoesSaude.map(r => r.qtd));
                    const saudeIds = secretarias.filter(s => /sa[uú]de/i.test(s.nome)).map(s => s.id);
                    return reclamacoesSaude.map(r => (
                      <button
                        key={r.nome}
                        type="button"
                        onClick={() => openDrill(`Saúde — Reclamação: ${r.nome}`, p =>
                          p.secretaria_id != null && saudeIds.includes(p.secretaria_id) &&
                          p.categoria === "reclamacao" &&
                          (p.assunto ?? "Outros").slice(0, 30) === r.nome,
                        )}
                        className="w-full flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/60 transition"
                      >
                        <span className="text-[11px] truncate flex-1" title={r.nome}>{r.nome}</span>
                        <div className="h-2 w-16 rounded-sm bg-muted overflow-hidden">
                          <div className="h-full bg-orange-500" style={{ width: `${(r.qtd / max) * 100}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold w-5 text-right">{r.qtd}</span>
                      </button>
                    ));
                  })()}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-2">Por unidade (UBS)</p>
                <div className="space-y-1">
                  {porUnidade.length === 0 && <p className="text-xs text-muted-foreground">Sem dados.</p>}
                  {(() => {
                    const max = Math.max(1, ...porUnidade.map(u => u.qtd));
                    const saudeIds = secretarias.filter(s => /sa[uú]de/i.test(s.nome)).map(s => s.id);
                    return porUnidade.map(u => {
                      const intensity = Math.ceil((u.qtd / max) * 5);
                      return (
                        <button
                          key={u.nome}
                          type="button"
                          onClick={() => openDrill(`Saúde — Unidade: ${u.nome}`, p =>
                            p.secretaria_id != null && saudeIds.includes(p.secretaria_id) &&
                            (((p as any).locais?.nome ?? "Sem unidade").slice(0, 18) === u.nome),
                          )}
                          className="w-full flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/60 transition"
                        >
                          <span className="text-[11px] truncate flex-1" title={u.nome}>{u.nome}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className="h-3 w-3 rounded-sm"
                                style={{ background: i < intensity ? `hsl(25 95% ${65 - i * 6}%)` : "hsl(var(--muted))" }} />
                            ))}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Situação dos Protocolos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={situacaoData.length > 0 ? situacaoData : [{ name: "—", value: 1, color: "hsl(var(--muted))" }]}
                    dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
                    {(situacaoData.length > 0 ? situacaoData : [{ color: "hsl(var(--muted))" }]).map((d, i) => (
                      <Cell key={i} fill={(d as any).color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold">{total}</span>
                <span className="text-[10px] uppercase text-muted-foreground">Total</span>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {situacaoData.map(d => {
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                const pred =
                  d.name === "Em andamento" ? (p: any) => p.status !== "concluido"
                  : d.name === "Concluídos" ? (p: any) => p.status === "concluido"
                  : (p: any) => p.status !== "concluido" && p._s.situacao === "vencido";
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => openDrill(`Situação: ${d.name}`, pred)}
                    className="w-full flex items-center gap-2 text-xs rounded px-1 py-0.5 hover:bg-muted/60 transition"
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="font-medium">{d.name}</span>
                    <span className="ml-auto text-muted-foreground">{d.value} ({pct}%)</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: SLA + Regiões */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SLA — Prazos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <Gauge label="Protocolos no Prazo" value={slaNoPrazo} suffix="%" meta="Meta: 90%" good={slaNoPrazo >= 90} />
              <Gauge label="Tempo Médio de Resposta" value={prazoMedio} suffix="dias" meta="Meta: 5 dias" good={prazoMedio <= 5} max={15} />
              <Gauge label="Protocolos Atrasados" value={vencidos.length} meta="Meta: 0" good={vencidos.length === 0} max={Math.max(20, vencidos.length)} invert />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Concentração de Manifestações por Local
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                {porRegiao.slice(0, 5).map((r, i) => (
                  <RegiaoRow key={r.nome} pos={i + 1} nome={r.nome} qtd={r.qtd} max={porRegiao[0]?.qtd ?? 1}
                    onClick={() => openDrill(`Local: ${r.nome}`, p => ((p as any).locais?.nome ?? "Sem local") === r.nome)} />
                ))}
              </div>
              <div className="space-y-1.5">
                {porRegiao.slice(5, 10).map((r, i) => (
                  <RegiaoRow key={r.nome} pos={i + 6} nome={r.nome} qtd={r.qtd} max={porRegiao[0]?.qtd ?? 1}
                    onClick={() => openDrill(`Local: ${r.nome}`, p => ((p as any).locais?.nome ?? "Sem local") === r.nome)} />
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground border-t pt-3">
              <Legenda dot="hsl(0 84% 60%)" label="Alta concentração" />
              <Legenda dot="hsl(25 95% 53%)" label="Média concentração" />
              <Legenda dot="hsl(142 71% 45%)" label="Baixa concentração" />
              <Legenda dot="hsl(215 16% 60%)" label="Muito baixa" />
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Dados atualizados em {format(new Date(), "dd/MM/yyyy HH:mm")}
      </p>

      <DrillDialog
        data={drill}
        onOpenChange={(v) => !v && setDrill(null)}
        onSelect={(p) => { setDetail(p); setDrill(null); }}
      />
      <ProtocoloDetailDialog protocolo={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
} as const;

function KpiCard({ icon: Icon, label, value, hint, hintTrend, suffix, tone, onClick }: {
  icon: any; label: string; value: number | string; hint?: string; suffix?: string;
  hintTrend?: "up" | "down";
  tone: "primary" | "info" | "success" | "destructive" | "violet" | "emerald";
  onClick?: () => void;
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    primary:     { bg: "bg-primary/10",     fg: "text-primary" },
    info:        { bg: "bg-amber-500/10",   fg: "text-amber-600" },
    success:     { bg: "bg-emerald-500/10", fg: "text-emerald-600" },
    destructive: { bg: "bg-destructive/10", fg: "text-destructive" },
    violet:      { bg: "bg-violet-500/10",  fg: "text-violet-600" },
    emerald:     { bg: "bg-teal-500/10",    fg: "text-teal-600" },
  };
  const t = tones[tone];
  return (
    <Card
      onClick={onClick}
      className={onClick ? "cursor-pointer transition hover:shadow-md hover:-translate-y-0.5" : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full ${t.bg} ${t.fg} flex items-center justify-center shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            <p className="text-2xl font-bold leading-tight">
              {value}{suffix && <span className="text-sm font-medium text-muted-foreground ml-1">{suffix}</span>}
            </p>
          </div>
        </div>
        {hint && (
          <p className={`mt-2 text-[11px] flex items-center gap-1 ${hintTrend === "up" ? "text-emerald-600" : hintTrend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
            {hint}{hintTrend === "up" && <TrendingUp className="h-3 w-3" />}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Gauge({ label, value, suffix, meta, good, max = 100, invert }: {
  label: string; value: number; suffix?: string; meta: string;
  good: boolean; max?: number; invert?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = good ? "hsl(142 71% 45%)" : invert ? "hsl(0 84% 60%)" : "hsl(38 92% 50%)";
  const radius = 42;
  const circ = Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[11px] text-muted-foreground mb-2">{label}</p>
      <div className="relative w-28 h-16">
        <svg viewBox="0 0 100 60" className="w-full h-full">
          <path d={`M 8 56 A ${radius} ${radius} 0 0 1 92 56`} stroke="hsl(var(--muted))" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d={`M 8 56 A ${radius} ${radius} 0 0 1 92 56`}
            stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-xl font-bold leading-none">
            {value}{suffix && <span className="text-xs font-medium text-muted-foreground ml-0.5">{suffix}</span>}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{meta}</p>
    </div>
  );
}

function RegiaoRow({ pos, nome, qtd, max, onClick }: { pos: number; nome: string; qtd: number; max: number; onClick?: () => void }) {
  const ratio = qtd / max;
  const color = ratio > 0.66 ? "hsl(0 84% 60%)" : ratio > 0.33 ? "hsl(25 95% 53%)" : ratio > 0.1 ? "hsl(142 71% 45%)" : "hsl(215 16% 60%)";
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/60 transition text-left">
      <span className="h-6 w-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: color }}>
        {qtd}
      </span>
      <span className="text-xs text-muted-foreground w-4 text-right">{pos}.</span>
      <span className="text-xs font-medium truncate flex-1" title={nome}>{nome}</span>
    </button>
  );
}

function Legenda({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}