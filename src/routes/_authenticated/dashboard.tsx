import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { situacaoProtocolo, situacaoLabel, situacaoClasses, formatDate, PRAZOS } from "@/lib/prazo";
import { AlertTriangle, CheckCircle2, Clock, FileText, Building2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocolos")
        .select("*, secretarias(nome, sigla), responsaveis(nome)")
        .order("data_abertura", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Ouvidoria: {PRAZOS.ouvidoria.inicial}+{PRAZOS.ouvidoria.prorrogacao} dias · LAI: {PRAZOS.lai.inicial}+{PRAZOS.lai.prorrogacao} dias
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FileText} label="Total" value={enriched.length} tone="default" />
        <StatCard icon={Clock} label="Em andamento" value={ativos.length} tone="default" />
        <StatCard icon={AlertTriangle} label="Vencidos" value={vencidos.length} tone="destructive" />
        <StatCard icon={CheckCircle2} label="Concluídos" value={concluidos.length} tone="success" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon={AlertTriangle} label="Críticos (≤3 dias)" value={criticos.length} tone="destructive" />
        <StatCard icon={Clock} label="Atenção (≤7 dias)" value={atencao.length} tone="warning" />
        <StatCard icon={FileText} label="Prorrogados" value={prorrogados.length} tone="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Alertas de prazo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum protocolo em alerta. 🎉</p>
            )}
            {alertas.map(p => (
              <Link key={p.id} to="/protocolos" className="block rounded-md border p-3 hover:bg-secondary transition-colors">
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
                  <Badge className={`shrink-0 border ${situacaoClasses[p._s.situacao]}`} variant="outline">
                    {p._s.dias < 0 ? `${Math.abs(p._s.dias)}d atrasado` : `${p._s.dias}d`}
                  </Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Por secretaria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {porSecretaria.length === 0 && (
              <p className="text-sm text-muted-foreground">Cadastre uma secretaria para começar.</p>
            )}
            {porSecretaria.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.nome}</p>
                  {s.sigla && <p className="text-xs text-muted-foreground">{s.sigla}</p>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary">{s.ativos} ativos</Badge>
                  {s.vencidos > 0 && <Badge variant="destructive">{s.vencidos} venc.</Badge>}
                  <span className="text-muted-foreground">{s.total} total</span>
                </div>
              </div>
            ))}
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
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: {
  icon: any; label: string; value: number;
  tone: "default" | "destructive" | "warning" | "success";
}) {
  const toneClass = {
    default: "text-primary",
    destructive: "text-destructive",
    warning: "text-[var(--warning-foreground)]",
    success: "text-[var(--success)]",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg bg-secondary flex items-center justify-center ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}