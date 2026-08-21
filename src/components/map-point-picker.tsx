import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { sugerirLocalizacaoIA } from "@/lib/location-ia.functions";
import { reverseGeocode } from "@/lib/geocode.functions";
import { toast } from "sonner";

const BRUSQUE: [number, number] = [-27.0978, -48.9114]; // [lat, lng]

const PIN_ICON = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">
    <path d="M15 1 C7 1 1 7 1 15 C1 25 15 41 15 41 C15 41 29 25 29 15 C29 7 23 1 15 1 Z"
      fill="#dc2626" stroke="#fff" stroke-width="2"/>
    <circle cx="15" cy="15" r="5" fill="#fff" opacity="0.95"/>
  </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 41],
});

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterOnChange({ pt }: { pt: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (pt) map.flyTo([pt.lat, pt.lng], Math.max(map.getZoom(), 15), { duration: 0.3 });
  }, [pt, map]);
  return null;
}

/** Chama map.invalidateSize() depois que o dialog termina de animar/abrir. */
function InvalidateSizeOnOpen() {
  const map = useMap();
  useEffect(() => {
    const timeouts = [50, 150, 350].map((ms) => setTimeout(() => map.invalidateSize(), ms));
    return () => timeouts.forEach(clearTimeout);
  }, [map]);
  return null;
}

export function MapPointPicker({
  open,
  onOpenChange,
  initial,
  endereco,
  onConfirm,
  protocoloContext,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: { lat: number; lng: number } | null;
  endereco?: string;
  onConfirm: (lat: number, lng: number, endereco?: string) => void;
  protocoloContext?: {
    assunto?: string;
    descricao?: string;
    endereco?: string;
    solicitante?: string;
    secretaria?: string;
    local?: string;
    categoria?: string;
  };
}) {
  const [pt, setPt] = useState<{ lat: number; lng: number } | null>(initial ?? null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInfo, setAiInfo] = useState<{
    label?: string;
    confianca?: string;
    justificativa?: string;
  } | null>(null);
  const [reverseAddr, setReverseAddr] = useState<string | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const sugerirIA = useServerFn(sugerirLocalizacaoIA);
  const reverseGeo = useServerFn(reverseGeocode);
  const reverseSeq = useRef(0);

  const hasContext =
    !!protocoloContext &&
    Object.values(protocoloContext).some((v) => (v ?? "").toString().trim().length > 0);

  async function handleSugerirIA() {
    if (!protocoloContext) return;
    setAiLoading(true);
    setAiInfo(null);
    try {
      const r = await sugerirIA({ data: protocoloContext });
      if (r.lat != null && r.lng != null) {
        setPt({ lat: r.lat, lng: r.lng });
        setAiInfo({
          label: r.label ?? r.query,
          confianca: r.confianca,
          justificativa: r.justificativa,
        });
        toast.success("Localização aproximada sugerida pela IA. Ajuste se necessário.");
      } else {
        setAiInfo({
          confianca: r.confianca,
          justificativa: r.justificativa || "Não foi possível sugerir uma localização.",
        });
        toast.warning(r.justificativa || "Sem dados suficientes para sugerir uma localização.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar a IA.");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setPt(initial ?? null);
      setAiInfo(null);
      setReverseAddr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reverse-geocode o ponto selecionado para exibir o nome da rua.
  useEffect(() => {
    if (!pt) {
      setReverseAddr(null);
      return;
    }
    const seq = ++reverseSeq.current;
    setReverseLoading(true);
    reverseGeo({ data: { lat: pt.lat, lng: pt.lng } })
      .then((r) => {
        if (reverseSeq.current !== seq) return;
        setReverseAddr(r.label);
      })
      .catch(() => {
        if (reverseSeq.current === seq) setReverseAddr(null);
      })
      .finally(() => {
        if (reverseSeq.current === seq) setReverseLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pt]);

  const center: [number, number] = initial ? [initial.lat, initial.lng] : BRUSQUE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Selecionar ponto no mapa
          </DialogTitle>
          <DialogDescription>
            {endereco ? (
              <>
                Clique no mapa para marcar a localização exata de <strong>{endereco}</strong>.
              </>
            ) : (
              "Clique no mapa para marcar a localização exata."
            )}
          </DialogDescription>
        </DialogHeader>
        <div
          style={{
            height: 360,
            width: "100%",
            position: "relative",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {open && (
            <MapContainer
              center={center}
              zoom={initial ? 16 : 13}
              style={{ height: "100%", width: "100%", cursor: "crosshair" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickHandler onClick={(lat, lng) => setPt({ lat, lng })} />
              <RecenterOnChange pt={pt} />
              <InvalidateSizeOnOpen />
              {pt && <Marker position={[pt.lat, pt.lng]} icon={PIN_ICON} />}
            </MapContainer>
          )}
        </div>
        {hasContext && (
          <div className="flex items-start gap-2 rounded-md border border-dashed p-2 bg-muted/30">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSugerirIA}
              disabled={aiLoading}
              className="shrink-0"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Sugerir com IA
            </Button>
            <div className="text-xs text-muted-foreground leading-snug">
              {aiInfo ? (
                <>
                  {aiInfo.label && (
                    <div>
                      <strong>Sugestão:</strong> {aiInfo.label}
                    </div>
                  )}
                  {aiInfo.confianca && (
                    <div>
                      Confiança: <strong>{aiInfo.confianca}</strong>
                    </div>
                  )}
                  {aiInfo.justificativa && <div className="italic">{aiInfo.justificativa}</div>}
                </>
              ) : (
                <>
                  A IA usará assunto, descrição, endereço e secretaria do protocolo para tentar
                  localizar o ponto aproximado.
                </>
              )}
            </div>
          </div>
        )}
        {pt && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              Coordenadas: {pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {reverseLoading ? (
                <span className="italic">Identificando endereço…</span>
              ) : reverseAddr ? (
                <span>
                  <strong>Endereço:</strong> {reverseAddr}
                </span>
              ) : (
                <span className="italic">Endereço não identificado</span>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!pt}
            onClick={() => {
              if (pt) {
                onConfirm(pt.lat, pt.lng, reverseAddr ?? undefined);
                onOpenChange(false);
              }
            }}
          >
            Confirmar localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
