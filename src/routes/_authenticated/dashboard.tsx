import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { situacaoProtocolo, situacaoLabel, situacaoClasses, formatDate, PRAZOS } from "@/lib/prazo";
import { AlertTriangle, CheckCircle2, Clock, FileText, Building2, AlarmClock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ProtocoloDetailDialog } from "@/components/protocolo-detail-dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [detail, setDetail] = useState<any | null>(null);
  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocolos")
        .select("*, secretarias(nome, sigla), responsaveis(nome), locais(nome,centro_custo)")
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
  // Vencendo em até 3 dias (críticos + vencidos)
  const vencendoBreve = ativos
    .filter(p => p._s.dias <= 3)
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
              <Building2 className="h-4 w-4" /> Por secretaria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {porSecretaria.length === 0 && (
              <p className="text-sm text-muted-foreground">Cadastre uma secretaria para começar.</p>
            )}
            {porSecretaria.map(s => (
              <Link
                key={s.id}
                to="/relatorios/secretaria/$id"
                params={{ id: s.id }}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-secondary transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.nome}</p>
                  {s.sigla && <p className="text-xs text-muted-foreground">{s.sigla}</p>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary">{s.ativos} ativos</Badge>
                  {s.vencidos > 0 && <Badge variant="destructive">{s.vencidos} venc.</Badge>}
                  <span className="text-muted-foreground">{s.total} total</span>
                </div>
              </Link>
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