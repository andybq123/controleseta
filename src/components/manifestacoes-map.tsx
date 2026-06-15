import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";

// Fix default marker icon paths (CDN) — Vite breaks the relative png paths
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  numero: string;
  assunto?: string | null;
  endereco?: string | null;
  status?: string | null;
  secretaria?: string | null;
  data_abertura?: string | null;
  data_conclusao?: string | null;
  categoria?: string | null;
  tipo?: string | null;
  local?: string | null;
};

// Brusque center
const BRUSQUE: [number, number] = [-27.0978, -48.9114];

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export function ManifestacoesMap({
  points,
  height = 400,
  className,
}: {
  points: MapPoint[];
  height?: number | string;
  className?: string;
}) {
  const valid = useMemo(
    () => points.filter(p => typeof p.lat === "number" && typeof p.lng === "number"),
    [points],
  );
  return (
    <div className={className} style={{ height, width: "100%" }}>
      <MapContainer
        center={BRUSQUE}
        zoom={13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", borderRadius: 8 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={valid} />
        {valid.map(p => (
          <Marker key={p.id} position={[p.lat, p.lng]}>
            <Popup maxWidth={320}>
              <div className="space-y-1.5 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-primary">{p.numero}</span>
                  {p.status && (
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-muted">
                      {p.status.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                {p.assunto && <p className="text-sm font-medium leading-snug">{p.assunto}</p>}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {p.categoria && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">Categoria:</span>
                      <span className="capitalize">{p.categoria.replace(/_/g, " ")}</span>
                    </div>
                  )}
                  {p.tipo && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">Tipo:</span>
                      <span>{p.tipo}</span>
                    </div>
                  )}
                  {p.secretaria && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">Secretaria:</span>
                      <span>{p.secretaria}</span>
                    </div>
                  )}
                  {p.local && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">Local:</span>
                      <span>{p.local}</span>
                    </div>
                  )}
                  {p.endereco && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">Endereço:</span>
                      <span>{p.endereco}</span>
                    </div>
                  )}
                  {p.data_abertura && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">Aberto em:</span>
                      <span>{formatLocalDate(p.data_abertura)}</span>
                    </div>
                  )}
                  {p.data_conclusao && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">Concluído em:</span>
                      <span>{formatLocalDate(p.data_conclusao)}</span>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {!valid.length && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Nenhum protocolo com endereço georreferenciado ainda.
        </p>
      )}
    </div>
  );
}