import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/lib/fetch-all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ManifestacoesMap, type MapPoint } from "@/components/manifestacoes-map";
import { Map as MapIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mapa")({
  component: MapaPage,
});

function MapaPage() {
  const [status, setStatus] = useState<string>("todos");
  const [secretariaId, setSecretariaId] = useState<string>("todas");

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos-mapa"],
    queryFn: () =>
      fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("id, numero, assunto, endereco, latitude, longitude, status, secretaria_id, secretarias(nome)")
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .range(from, to),
      ),
  });

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("id, nome").order("nome")).data ?? [],
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
      }));
  }, [protocolos, status, secretariaId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MapIcon className="h-6 w-6 text-primary" /> Mapa de Manifestações
        </h1>
        <p className="text-sm text-muted-foreground">
          Distribuição geográfica dos protocolos com endereço cadastrado em Brusque.
        </p>
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
          <ManifestacoesMap points={points} height={600} />
        </CardContent>
      </Card>
    </div>
  );
}