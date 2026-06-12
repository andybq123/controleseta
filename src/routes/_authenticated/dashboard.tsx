import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { situacaoProtocolo, situacaoLabel, situacaoClasses, formatDate } from "@/lib/prazo";
import { AlertTriangle, CheckCircle2, Clock, FileText, Building2, AlarmClock, TrendingUp, Calendar, Activity } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ProtocoloDetailDialog } from "@/components/protocolo-detail-dialog";
import { fetchAllPaginated } from "@/lib/fetch-all";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
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

  const enriched = protocolos.map(p => ({ ...p, _s: situacaoProtocolo(p as any) }));
  const ativos = enriched.filter(p => p.status !== "concluido");
  const vencidos = ativos.filter(p => p._s.situacao === "vencido");
  const criticos = ativos.filter(p => p._s.situacao === "critico");
  const atencao = ativos.filter(p => p._s.situacao === "atencao");
  const vencendoBreve = ativos
    .filter(p => p._s.dias >= 0 && p._s.dias <= 3)
    .sort((a, b) => a._s.dias - b._s.dias);
  const concluidos = enriched.filter(p => p.status === "concluido");
  const prorrogados = enriched.filter(p => p.prorrogado);

  const porSecretaria = secretarias.map(s => {
    const ps = enriched.filter(p => p.secretaria_id === s.id);
    return {
      ...s,
      total: ps.length,
      ativos: ps.filter(p => p.status !== "concluido").length,
      vencidos: ps.filter(p => p.status !== "concluido" && p._s.situacao === "vencido").length,
    };
  });

  const alertas = [...vencidos, ...criticos, ...atencao].slice(0, 8);

  // Tendência: protocolos abertos nos últimos 30 dias
  const tendencia = useMemo(() => {
    const days: { dia: string; abertos: number; concluidos: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      const key = format(d, "yyyy-MM-dd");
      const abertos = enriched.filter(p => (p.data_abertura ?? "").slice(0, 10) === key).length;
      const concluidos = enriched.filter(
        p => p.status === "concluido" && (p.updated_at ?? p.data_abertura ?? "").slice(0, 10) === key,
      ).length;
      days.push({ dia: format(d, "dd/MM", { locale: ptBR }), abertos, concluidos });
    }
    return days;
  }, [enriched]);

  // Status pie data
  const statusData = [
    { name: "No prazo", value: ativos.filter(p => p._s.situacao === "no_prazo").length, color: "hsl(142 71% 45%)" },
    { name: "Atenção", value: atencao.length, color: "hsl(38 92% 50%)" },
    { name: "Crítico", value: criticos.length, color: "hsl(0 84% 60%)" },
    { name: "Vencido", value: vencidos.length, color: "hsl(0 72% 40%)" },
    { name: "Concluído", value: concluidos.length, color: "hsl(215 16% 60%)" },
  ].filter(d => d.value > 0);

  // Tipo distribution
  const tipoData = useMemo(() => {
    const counts = enriched.reduce<Record<string, number>>((acc, p) => {
      const t = p.tipo ?? "outros";
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {});
    const labels: Record<string, string> = { ouvidoria: "Ouvidoria", esic: "e-SIC", lai: "LAI" };
    const colors: Record<string, string> = {
      ouvidoria: "hsl(217 91% 60%)",
      esic: "hsl(262 83% 58%)",
      lai: "hsl(280 70% 55%)",
    };
    return Object.entries(counts).map(([k, v]) => ({
      name: labels[k] ?? k,
      value: v,
      color: colors[k] ?? "hsl(215 16% 60%)",
    }));
  }, [enriched]);

  const topSecretarias = [...porSecretaria]
    .filter(s => s.ativos > 0)
    .sort((a, b) => b.ativos - a.ativos)
    .slice(0, 6)
    .map(s => ({ nome: s.sigla || s.nome.slice(0, 14), ativos: s.ativos, vencidos: s.vencidos }));

  const taxaConclusao = enriched.length > 0 ? Math.round((concluidos.length / enriched.length) * 100) : 0;
  const taxaRisco = ativos.length > 0 ? Math.round(((vencidos.length + criticos.length) / ativos.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão executiva e controle de prazos em tempo real</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Sincronizado agora
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={FileText} label="Total de Protocolos" value={enriched.length} tone="primary" hint={`${taxaConclusao}% concluídos`} progress={100} />
        <KpiCard icon={Activity} label="Em andamento" value={ativos.length} tone="info" hint={`${enriched.length > 0 ? Math.round((ativos.length / enriched.length) * 100) : 0}% do total`} progress={enriched.length > 0 ? (ativos.length / enriched.length) * 100 : 0} />
        <KpiCard icon={AlertTriangle} label="Vencidos / Críticos" value={vencidos.length + criticos.length} tone="destructive" hint={`${taxaRisco}% em risco`} progress={taxaRisco} accentBorder />
        <KpiCard icon={CheckCircle2} label="Concluídos" value={concluidos.length} tone="success" hint={`${taxaConclusao}% de eficiência`} progress={taxaConclusao} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat icon={AlertTriangle} label="Críticos (≤3 dias)" value={criticos.length} tone="destructive" />
        <MiniStat icon={Clock} label="Atenção (≤7 dias)" value={atencao.length} tone="warning" />
        <MiniStat icon={Calendar} label="Prorrogados" value={prorrogados.length} tone="info" />
        <MiniStat icon={TrendingUp} label="Vencendo em 3 dias" value={vencendoBreve.length} tone="warning" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Evolução nos últimos 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tendencia} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gradAbertos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradConcluidos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={3} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="abertos" name="Abertos" stroke="hsl(217 91% 60%)" strokeWidth={2} fill="url(#gradAbertos)" />
                  <Area type="monotone" dataKey="concluidos" name="Concluídos" stroke="hsl(142 71% 45%)" strokeWidth={2} fill="url(#gradConcluidos)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData.length > 0 ? statusData : [{ name: "—", value: 1, color: "hsl(var(--muted))" }]}
                       dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                    {(statusData.length > 0 ? statusData : [{ color: "hsl(var(--muted))" }]).map((d, i) => (
                      <Cell key={i} fill={(d as any).color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {statusData.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="ml-auto font-semibold">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart + tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Top secretarias por carga ativa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSecretarias} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="ativos" name="Ativos" fill="hsl(217 91% 60%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="vencidos" name="Vencidos" fill="hsl(0 84% 60%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mix por tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={tipoData.length > 0 ? tipoData : [{ name: "—", value: 1, color: "hsl(var(--muted))" }]}
                       dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {(tipoData.length > 0 ? tipoData : [{ color: "hsl(var(--muted))" }]).map((d, i) => (
                      <Cell key={i} fill={(d as any).color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {tipoData.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="ml-auto font-semibold">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <Tabs defaultValue="alertas">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="alertas" className="gap-1 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Alertas ({alertas.length})
                </TabsTrigger>
                <TabsTrigger value="breve" className="gap-1 text-xs">
                  <AlarmClock className="h-3.5 w-3.5 text-amber-600" /> Vencendo em breve ({vencendoBreve.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="alertas" className="mt-3">
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {alertas.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2">Nenhum protocolo em alerta. 🎉</p>
                  )}
                  {alertas.map(p => <AlertRow key={p.id} p={p} onClick={() => setDetail(p)} />)}
                </div>
              </TabsContent>
              <TabsContent value="breve" className="mt-3">
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {vencendoBreve.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2">Nenhum protocolo vence em até 3 dias.</p>
                  )}
                  {vencendoBreve.map(p => <AlertRow key={p.id} p={p} onClick={() => setDetail(p)} />)}
                </div>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Ranking por secretaria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {porSecretaria.length === 0 && (
              <p className="text-sm text-muted-foreground">Cadastre uma secretaria para começar.</p>
            )}
            {(() => {
              const max = Math.max(1, ...porSecretaria.map(s => s.ativos));
              return porSecretaria
                .sort((a, b) => b.ativos - a.ativos)
                .map(s => (
                  <Link
                    key={s.id}
                    to="/relatorios/secretaria/$id"
                    params={{ id: s.id }}
                    className="block rounded-md border p-3 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.nome}</p>
                        {s.sigla && <p className="text-[11px] text-muted-foreground">{s.sigla}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs shrink-0">
                        {s.vencidos > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{s.vencidos} venc.</Badge>}
                        <span className="font-semibold">{s.ativos}</span>
                        <span className="text-muted-foreground">/ {s.total}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.vencidos > 0 ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${(s.ativos / max) * 100}%` }}
                      />
                    </div>
                  </Link>
                ));
            })()}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legenda de prazos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(["no_prazo", "atencao", "critico", "vencido", "concluido"] as const).map(s => (
            <Badge key={s} variant="outline" className={`border ${situacaoClasses[s]}`}>{situacaoLabel[s]}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos os protocolos ativos ({ativos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {ativos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum protocolo ativo.</p>}
          {ativos.map(p => (
            <button key={p.id} type="button" onClick={() => setDetail(p)}
              className="w-full text-left block rounded-md border p-3 hover:bg-secondary transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{p.tipo}</Badge>
                  </div>
                  <p className="text-sm font-medium truncate mt-0.5">{p.assunto}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(p as any).secretarias?.nome ?? "Sem secretaria"} · Aberto {formatDate(p.data_abertura)}
                  </p>
                </div>
                <Badge className={`shrink-0 border ${situacaoClasses[p._s.situacao as keyof typeof situacaoClasses]}`} variant="outline">
                  {p._s.dias < 0 ? `${Math.abs(p._s.dias)}d` : `${p._s.dias}d`}
                </Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <ProtocoloDetailDialog protocolo={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
    </div>
  );
}

function AlertRow({ p, onClick }: { p: any; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left block rounded-md border p-3 hover:bg-secondary transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
            <Badge variant="outline" className="text-[10px] uppercase">{p.tipo}</Badge>
          </div>
          <p className="text-sm font-medium truncate mt-0.5">{p.assunto}</p>
          <p className="text-xs text-muted-foreground truncate">
            {(p as any).secretarias?.nome ?? "Sem secretaria"} · Vence {formatDate(p._s.prazoFinal)}
          </p>
        </div>
        <Badge className={`shrink-0 border ${situacaoClasses[p._s.situacao as keyof typeof situacaoClasses]}`} variant="outline">
          {p._s.dias < 0 ? `${Math.abs(p._s.dias)}d atrasado` : `${p._s.dias}d`}
        </Badge>
      </div>
    </button>
  );
}

function KpiCard({ icon: Icon, label, value, tone, hint, progress, accentBorder }: {
  icon: any; label: string; value: number; hint?: string; progress?: number;
  tone: "primary" | "info" | "destructive" | "warning" | "success";
  accentBorder?: boolean;
}) {
  const tones: Record<string, { bg: string; fg: string; bar: string; border: string }> = {
    primary:     { bg: "bg-primary/10",       fg: "text-primary",            bar: "bg-primary",            border: "border-l-primary" },
    info:        { bg: "bg-blue-500/10",      fg: "text-blue-600",           bar: "bg-blue-500",           border: "border-l-blue-500" },
    destructive: { bg: "bg-destructive/10",   fg: "text-destructive",        bar: "bg-destructive",        border: "border-l-destructive" },
    warning:     { bg: "bg-amber-500/10",     fg: "text-amber-600",          bar: "bg-amber-500",          border: "border-l-amber-500" },
    success:     { bg: "bg-emerald-500/10",   fg: "text-emerald-600",        bar: "bg-emerald-500",        border: "border-l-emerald-500" },
  };
  const t = tones[tone];
  return (
    <Card className={accentBorder ? `border-l-4 ${t.border}` : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className={`h-8 w-8 rounded-lg ${t.bg} ${t.fg} flex items-center justify-center`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">{value}</span>
          {hint && <span className={`text-xs font-medium ${t.fg}`}>{hint}</span>}
        </div>
        <div className="mt-4 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${t.bar} transition-all`} style={{ width: `${Math.min(100, Math.max(0, progress ?? 0))}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: {
  icon: any; label: string; value: number;
  tone: "destructive" | "warning" | "info" | "success";
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    destructive: { bg: "bg-destructive/10",   fg: "text-destructive" },
    warning:     { bg: "bg-amber-500/10",     fg: "text-amber-600" },
    info:        { bg: "bg-blue-500/10",      fg: "text-blue-600" },
    success:     { bg: "bg-emerald-500/10",   fg: "text-emerald-600" },
  };
  const t = tones[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg ${t.bg} ${t.fg} flex items-center justify-center`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}