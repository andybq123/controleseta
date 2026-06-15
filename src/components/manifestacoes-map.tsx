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
            <Popup>
              <div className="text-xs space-y-0.5">
                <div className="font-mono font-semibold">{p.numero}</div>
                {p.assunto && <div>{p.assunto}</div>}
                {p.endereco && <div className="text-muted-foreground">{p.endereco}</div>}
                {p.secretaria && <div className="text-muted-foreground">{p.secretaria}</div>}
                {p.status && <div className="capitalize">{p.status.replace(/_/g, " ")}</div>}
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