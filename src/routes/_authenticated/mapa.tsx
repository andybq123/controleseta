import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/lib/fetch-all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ManifestacoesMap, type MapPoint, type SecretariaPoint } from "@/components/manifestacoes-map";
import { Map as MapIcon, Sparkles, Loader2 } from "lucide-react";
import { ProtocoloDetailDialog } from "@/components/protocolo-detail-dialog";
import { geocodarProtocolosPendentes } from "@/lib/geocode-bulk.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mapa")({
  component: MapaPage,
});

function MapaPage() {
  const [status, setStatus] = useState<string>("todos");
  const [secretariaId, setSecretariaId] = useState<string>("todas");
  const [detail, setDetail] = useState<any | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const qc = useQueryClient();
  const geocodar = useServerFn(geocodarProtocolosPendentes);

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos-mapa"],
    queryFn: () =>
      fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("id, numero, assunto, endereco, latitude, longitude, status, secretaria_id, categoria, tipo, data_abertura, data_conclusao, locais(nome), secretarias(nome)")
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .range(from, to),
      ),
  });

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("id, nome, sigla, endereco, latitude, longitude, icone").order("nome")).data ?? [],
  });

  const points = useMemo<MapPoint[]>(() => {
    return (protocolos as any[])
      .filter(p => status === "todos" || p.status === status)
      .filter(p => secretariaId === "todas" || p.secretaria_id === secretariaId)
      .map(p => ({
        id: p.id,
        lat: p.latitude as number,
        lng: p.longitude as number,
        numero: p.numero,
        assunto: p.assunto,
        endereco: p.endereco,
        status: p.status,
        secretaria: p.secretarias?.nome,
        data_abertura: p.data_abertura,
        data_conclusao: p.data_conclusao,
        categoria: p.categoria,
        tipo: p.tipo,
        local: p.locais?.nome,
      }));
  }, [protocolos, status, secretariaId]);

  const secretariaPoints = useMemo<SecretariaPoint[]>(() => {
    return (secretarias as any[])
      .filter(s => s.latitude != null && s.longitude != null)
      .filter(s => secretariaId === "todas" || s.id === secretariaId)
      .map(s => ({
        id: s.id, lat: s.latitude, lng: s.longitude, nome: s.nome,
        sigla: s.sigla, endereco: s.endereco, icone: s.icone,
      }));
  }, [secretarias, secretariaId]);

  const { data: pendentesCount } = useQuery({
    queryKey: ["protocolos-sem-coords"],
    queryFn: async () => {
      const { count } = await supabase
        .from("protocolos")
        .select("id", { count: "exact", head: true })
        .is("latitude", null);
      return count ?? 0;
    },
  });

  const handleGeocodar = async () => {
    setLoadingGeo(true);
    try {
      const r = await geocodar({ data: { limit: 15 } });
      toast.success(
        `${r.geocodificados} protocolo(s) localizados. ${r.semDados} sem dados suficientes. ${r.restantes} restantes.`,
      );
      if (r.erros.length) {
        console.warn("Erros de geocodificação:", r.erros);
      }
      await qc.invalidateQueries({ queryKey: ["protocolos-mapa"] });
      await qc.invalidateQueries({ queryKey: ["protocolos-sem-coords"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao geocodificar protocolos");
    } finally {
      setLoadingGeo(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-primary" /> Mapa de Manifestações
          </h1>
          <p className="text-sm text-muted-foreground">
            Distribuição geográfica dos protocolos com endereço cadastrado em Brusque.
            {typeof pendentesCount === "number" && pendentesCount > 0 && (
              <> <strong>{pendentesCount}</strong> protocolo(s) ainda sem coordenadas.</>
            )}
          </p>
        </div>
        <Button onClick={handleGeocodar} disabled={loadingGeo || pendentesCount === 0} size="sm">
          {loadingGeo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Mapear próximos 15 com IA
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Secretaria</Label>
            <Select value={secretariaId} onValueChange={setSecretariaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(secretarias as any[]).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <p className="text-sm text-muted-foreground">
              <strong>{points.length}</strong> protocolo(s) no mapa.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <ManifestacoesMap
            points={points}
            height={600}
            secretarias={secretariaPoints}
            onOpenProtocolo={(id) => {
              const p = (protocolos as any[]).find((x) => x.id === id);
              if (p) setDetail(p);
            }}
          />
        </CardContent>
      </Card>
      <ProtocoloDetailDialog protocolo={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
    </div>
  );
}