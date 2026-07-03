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
import { ManifestacoesMap, type MapPoint, type SecretariaPoint, type LocalPoint } from "@/components/manifestacoes-map";
import { Map as MapIcon, Sparkles, Loader2 } from "lucide-react";
import { ProtocoloDetailDialog } from "@/components/protocolo-detail-dialog";
import { geocodarProtocolosPendentes } from "@/lib/geocode-bulk.functions";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/mapa")({
  component: MapaPage,
});

function MapaPage() {
  const [status, setStatus] = useState<string>("todos");
  const [secretariaId, setSecretariaId] = useState<string>("todas");
  const [detail, setDetail] = useState<any | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    kind: "local" | "secretaria";
    id: string;
    nome: string;
    oldLat: number;
    oldLng: number;
    newLat: number;
    newLng: number;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const [savingMove, setSavingMove] = useState(false);
  const qc = useQueryClient();
  const geocodar = useServerFn(geocodarProtocolosPendentes);

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos-mapa"],
    queryFn: () =>
      fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("id, numero, assunto, endereco, latitude, longitude, status, secretaria_id, local_id, categoria, tipo, data_abertura, data_conclusao, locais(nome), secretarias(nome)")
          .eq("triagem_pendente", false)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .range(from, to),
      ),
  });

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("id, nome, sigla, endereco, latitude, longitude, icone").order("nome")).data ?? [],
  });

  const { data: locaisComCoord = [] } = useQuery({
    queryKey: ["locais-com-coordenadas"],
    queryFn: async () => (
      await supabase
        .from("locais")
        .select("id, nome, latitude, longitude, secretaria_id, secretarias(nome, icone)")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("nome")
    ).data ?? [],
  });

  // Inclui TODOS os protocolos (mesmo sem coordenadas) para listar no popup do local.
  const { data: protocolosTodos = [] } = useQuery({
    queryKey: ["protocolos-por-local"],
    queryFn: () =>
      fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("id, numero, assunto, status, local_id, secretaria_id")
          .eq("triagem_pendente", false)
          .not("local_id", "is", null)
          .range(from, to),
      ),
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
        local_id: p.local_id,
      }));
  }, [protocolos, status, secretariaId]);

  // Para popups dos locais: lista de protocolos por local_id (independe de coordenadas)
  const pointsParaLocais = useMemo<MapPoint[]>(() => {
    return (protocolosTodos as any[])
      .filter(p => status === "todos" || p.status === status)
      .filter(p => secretariaId === "todas" || p.secretaria_id === secretariaId)
      .map(p => ({
        id: p.id,
        lat: NaN,
        lng: NaN,
        numero: p.numero,
        assunto: p.assunto,
        status: p.status,
        local_id: p.local_id,
      }));
  }, [protocolosTodos, status, secretariaId]);

  const secretariaPoints = useMemo<SecretariaPoint[]>(() => {
    return (secretarias as any[])
      .filter(s => s.latitude != null && s.longitude != null)
      .filter(s => secretariaId === "todas" || s.id === secretariaId)
      .map(s => ({
        id: s.id, lat: s.latitude, lng: s.longitude, nome: s.nome,
        sigla: s.sigla, endereco: s.endereco, icone: s.icone,
      }));
  }, [secretarias, secretariaId]);

  const localPoints = useMemo<LocalPoint[]>(() => {
    return (locaisComCoord as any[])
      .filter(l => secretariaId === "todas" || l.secretaria_id === secretariaId)
      .map(l => ({
        id: l.id,
        lat: l.latitude as number,
        lng: l.longitude as number,
        nome: l.nome,
        secretaria: l.secretarias?.nome,
        secretariaIcone: l.secretarias?.icone,
      }));
  }, [locaisComCoord, secretariaId]);

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
            points={[...points, ...pointsParaLocais.filter(pp => !points.some(p => p.id === pp.id))]}
            height={600}
            secretarias={secretariaPoints}
            locais={localPoints}
            onOpenProtocolo={(id) => {
              const p = (protocolos as any[]).find((x) => x.id === id)
                ?? (protocolosTodos as any[]).find((x) => x.id === id);
              if (p) setDetail(p);
            }}
            onMoveLocal={async (id, lat, lng) => {
              const local = (locaisComCoord as any[]).find(l => l.id === id);
              if (!local) return false;
              return await new Promise<boolean>((resolve) => {
                setPendingMove({
                  kind: "local",
                  id,
                  nome: local.nome,
                  oldLat: local.latitude,
                  oldLng: local.longitude,
                  newLat: lat,
                  newLng: lng,
                  resolve,
                });
              });
            }}
            onMoveSecretaria={async (id, lat, lng) => {
              const sec = (secretarias as any[]).find(s => s.id === id);
              if (!sec) return false;
              return await new Promise<boolean>((resolve) => {
                setPendingMove({
                  kind: "secretaria",
                  id,
                  nome: sec.nome,
                  oldLat: sec.latitude,
                  oldLng: sec.longitude,
                  newLat: lat,
                  newLng: lng,
                  resolve,
                });
              });
            }}
          />
        </CardContent>
      </Card>
      <ProtocoloDetailDialog protocolo={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
      <AlertDialog
        open={!!pendingMove}
        onOpenChange={(open) => {
          if (!open && pendingMove && !savingMove) {
            pendingMove.resolve(false);
            setPendingMove(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar nova localização</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  Mover <strong>{pendingMove?.nome}</strong> para uma nova coordenada?
                </div>
                {pendingMove && (
                  <div className="rounded border border-border bg-muted/40 p-2 font-mono text-xs space-y-1">
                    <div>
                      <span className="text-muted-foreground">Antes: </span>
                      {pendingMove.oldLat.toFixed(5)}, {pendingMove.oldLng.toFixed(5)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Agora: </span>
                      <span className="text-foreground font-semibold">
                        {pendingMove.newLat.toFixed(5)}, {pendingMove.newLng.toFixed(5)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={savingMove}
              onClick={() => {
                pendingMove?.resolve(false);
                setPendingMove(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={savingMove}
              onClick={async (e) => {
                e.preventDefault();
                if (!pendingMove) return;
                setSavingMove(true);
                const table = pendingMove.kind === "local" ? "locais" : "secretarias";
                const { error } = await supabase
                  .from(table)
                  .update({ latitude: pendingMove.newLat, longitude: pendingMove.newLng })
                  .eq("id", pendingMove.id);
                setSavingMove(false);
                if (error) {
                  toast.error(`Falha ao salvar: ${error.message}`);
                  pendingMove.resolve(false);
                } else {
                  toast.success(`${pendingMove.nome} reposicionado.`);
                  await qc.invalidateQueries({
                    queryKey: pendingMove.kind === "local" ? ["locais-com-coordenadas"] : ["secretarias"],
                  });
                  pendingMove.resolve(true);
                }
                setPendingMove(null);
              }}
            >
              {savingMove ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}