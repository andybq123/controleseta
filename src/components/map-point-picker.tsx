import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

const BRUSQUE: [number, number] = [-27.0978, -48.9114];

const pinIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
      <path d="M15 1 C7 1 1 7 1 15 C1 25 15 41 15 41 C15 41 29 25 29 15 C29 7 23 1 15 1 Z"
        fill="#dc2626" stroke="#fff" stroke-width="2"/>
      <circle cx="15" cy="15" r="5" fill="#fff" opacity="0.95"/>
    </svg>`,
  className: "manifestacao-pin",
  iconSize: [30, 42],
  iconAnchor: [15, 41],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ point }: { point: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView(point, Math.max(map.getZoom(), 16));
  }, [point, map]);
  return null;
}

export function MapPointPicker({
  open,
  onOpenChange,
  initial,
  endereco,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: { lat: number; lng: number } | null;
  endereco?: string;
  onConfirm: (lat: number, lng: number) => void;
}) {
  const [pt, setPt] = useState<{ lat: number; lng: number } | null>(initial ?? null);

  useEffect(() => {
    if (open) setPt(initial ?? null);
  }, [open, initial]);

  const center: [number, number] = pt ? [pt.lat, pt.lng] : (initial ? [initial.lat, initial.lng] : BRUSQUE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Selecionar ponto no mapa
          </DialogTitle>
          <DialogDescription>
            {endereco ? <>Clique no mapa para marcar a localização exata de <strong>{endereco}</strong>.</> : "Clique no mapa para marcar a localização exata."}
          </DialogDescription>
        </DialogHeader>
        <div style={{ height: 420, width: "100%" }}>
          <MapContainer
            center={center}
            zoom={pt || initial ? 16 : 13}
            scrollWheelZoom
            style={{ height: "100%", width: "100%", borderRadius: 8 }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={(lat, lng) => setPt({ lat, lng })} />
            <Recenter point={pt ? [pt.lat, pt.lng] : null} />
            {pt && <Marker position={[pt.lat, pt.lng]} icon={pinIcon} />}
          </MapContainer>
        </div>
        {pt && (
          <p className="text-xs text-muted-foreground">
            Coordenadas: {pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!pt}
            onClick={() => {
              if (pt) {
                onConfirm(pt.lat, pt.lng);
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