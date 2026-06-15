import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";

// Color mapping by categoria (matches badge colors in src/lib/prazo.ts)
const CATEGORIA_COLORS: Record<string, { fill: string; label: string }> = {
  elogio:            { fill: "#16a34a", label: "Elogio" },              // green-600
  reclamacao:        { fill: "#dc2626", label: "Reclamação" },          // red-600
  pedido_informacao: { fill: "#9333ea", label: "Pedido de informação"}, // purple-600
  denuncia:          { fill: "#000000", label: "Denúncia" },
  solicitacao:       { fill: "#facc15", label: "Solicitação" },         // yellow-400
  outros:            { fill: "#94a3b8", label: "Outros" },              // slate-400
};

function pinIcon(categoria?: string | null) {
  const c = CATEGORIA_COLORS[categoria ?? "outros"] ?? CATEGORIA_COLORS.outros;
  const stroke = c.fill === "#facc15" ? "#000" : "#fff";
  const text = c.fill === "#facc15" ? "#000" : "#fff";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
      <path d="M15 1 C7 1 1 7 1 15 C1 25 15 41 15 41 C15 41 29 25 29 15 C29 7 23 1 15 1 Z"
        fill="${c.fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="15" cy="15" r="5" fill="${text}" opacity="0.95"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "manifestacao-pin",
    iconSize: [30, 42],
    iconAnchor: [15, 41],
    popupAnchor: [0, -36],
  });
}

export const SECRETARIA_ICONES: Record<string, { emoji: string; label: string }> = {
  saude:              { emoji: "🏥", label: "Saúde" },
  educacao:           { emoji: "🎓", label: "Educação" },
  obras:              { emoji: "🚧", label: "Obras" },
  seguranca:          { emoji: "🛡️", label: "Segurança" },
  meio_ambiente:      { emoji: "🌳", label: "Meio Ambiente" },
  transporte:         { emoji: "🚌", label: "Transporte" },
  cultura:            { emoji: "🎭", label: "Cultura" },
  esporte:            { emoji: "⚽", label: "Esporte" },
  agricultura:        { emoji: "🌱", label: "Agricultura" },
  assistencia_social: { emoji: "🤝", label: "Assistência Social" },
  fazenda:            { emoji: "💰", label: "Fazenda" },
  turismo:            { emoji: "🧳", label: "Turismo" },
  administracao:      { emoji: "🏛️", label: "Administração" },
};

function secretariaIcon(icone?: string | null) {
  const cfg = SECRETARIA_ICONES[icone ?? "administracao"] ?? SECRETARIA_ICONES.administracao;
  const html = `
    <div style="position:relative;width:36px;height:46px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46" style="position:absolute;inset:0;">
        <path d="M18 1 L33 1 Q35 1 35 3 L35 30 Q35 32 33 32 L24 32 L18 45 L12 32 L3 32 Q1 32 1 30 L1 3 Q1 1 3 1 Z"
          fill="#ffffff" stroke="#1d4ed8" stroke-width="2"/>
      </svg>
      <div style="position:absolute;top:3px;left:0;width:36px;height:28px;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;">${cfg.emoji}</div>
    </div>`;
  return L.divIcon({
    html,
    className: "secretaria-pin",
    iconSize: [36, 46],
    iconAnchor: [18, 45],
    popupAnchor: [0, -40],
  });
}

export type SecretariaPoint = {
  id: string;
  lat: number;
  lng: number;
  nome: string;
  sigla?: string | null;
  endereco?: string | null;
  icone?: string | null;
};

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

function formatLocalDate(s: string) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

// Brusque center
const BRUSQUE: [number, number] = [-27.0978, -48.9114];

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
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
  onOpenProtocolo,
  secretarias = [],
}: {
  points: MapPoint[];
  height?: number | string;
  className?: string;
  onOpenProtocolo?: (id: string) => void;
  secretarias?: SecretariaPoint[];
}) {
  const valid = useMemo(
    () => points.filter(p => typeof p.lat === "number" && typeof p.lng === "number"),
    [points],
  );
  const validSecs = useMemo(
    () => secretarias.filter(s => typeof s.lat === "number" && typeof s.lng === "number"),
    [secretarias],
  );
  return (
    <div className={className} style={{ height, width: "100%", isolation: "isolate", position: "relative", zIndex: 0 }}>
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
        <FitBounds points={[...valid, ...validSecs]} />
        {validSecs.map(s => {
          const cfg = SECRETARIA_ICONES[s.icone ?? "administracao"] ?? SECRETARIA_ICONES.administracao;
          return (
            <Marker key={`sec-${s.id}`} position={[s.lat, s.lng]} icon={secretariaIcon(s.icone)}>
              <Popup maxWidth={300}>
                <div className="space-y-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{cfg.emoji}</span>
                    <span className="text-sm font-bold">{s.nome}</span>
                    {s.sigla && <span className="text-xs text-muted-foreground">({s.sigla})</span>}
                  </div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Secretaria · {cfg.label}</p>
                  {s.endereco && <p className="text-xs">{s.endereco}</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
        {valid.map(p => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.categoria)}>
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
                {onOpenProtocolo && (
                  <button
                    type="button"
                    onClick={() => onOpenProtocolo(p.id)}
                    className="mt-2 w-full text-xs font-medium px-2 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 transition"
                  >
                    Abrir protocolo →
                  </button>
                )}
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