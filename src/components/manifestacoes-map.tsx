import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createRoot, type Root } from "react-dom/client";
import { MAPBOX_TOKEN, MAPBOX_STYLE } from "@/lib/mapbox";

// Color mapping by categoria (matches badge colors in src/lib/prazo.ts)
const CATEGORIA_COLORS: Record<string, { fill: string; label: string }> = {
  elogio:            { fill: "#16a34a", label: "Elogio" },              // green-600
  reclamacao:        { fill: "#dc2626", label: "Reclamação" },          // red-600
  pedido_informacao: { fill: "#9333ea", label: "Pedido de informação"}, // purple-600
  denuncia:          { fill: "#000000", label: "Denúncia" },
  solicitacao:       { fill: "#facc15", label: "Solicitação" },         // yellow-400
  outros:            { fill: "#94a3b8", label: "Outros" },              // slate-400
};

function pinSvg(categoria?: string | null) {
  const c = CATEGORIA_COLORS[categoria ?? "outros"] ?? CATEGORIA_COLORS.outros;
  const stroke = c.fill === "#facc15" ? "#000" : "#fff";
  const text = c.fill === "#facc15" ? "#000" : "#fff";
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">
      <path d="M15 1 C7 1 1 7 1 15 C1 25 15 41 15 41 C15 41 29 25 29 15 C29 7 23 1 15 1 Z"
        fill="${c.fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="15" cy="15" r="5" fill="${text}" opacity="0.95"/>
    </svg>`;
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

function secretariaSvg(icone?: string | null) {
  const cfg = SECRETARIA_ICONES[icone ?? "administracao"] ?? SECRETARIA_ICONES.administracao;
  return `
    <div style="position:relative;width:36px;height:46px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46" style="position:absolute;inset:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">
        <path d="M18 1 L33 1 Q35 1 35 3 L35 30 Q35 32 33 32 L24 32 L18 45 L12 32 L3 32 Q1 32 1 30 L1 3 Q1 1 3 1 Z"
          fill="#ffffff" stroke="#1d4ed8" stroke-width="2"/>
      </svg>
      <div style="position:absolute;top:3px;left:0;width:36px;height:28px;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;">${cfg.emoji}</div>
    </div>`;
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

export type LocalPoint = {
  id: string;
  lat: number;
  lng: number;
  nome: string;
  secretaria?: string | null;
  secretariaIcone?: string | null;
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
  local_id?: string | null;
};

function formatLocalDate(s: string) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

// Brusque center [lng, lat]
const BRUSQUE: [number, number] = [-48.9114, -27.0978];

function localSvg(emoji: string) {
  return `
    <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" style="position:absolute;inset:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">
        <circle cx="16" cy="16" r="14" fill="#ffffff" stroke="#10b981" stroke-width="2.5"/>
      </svg>
      <div style="position:relative;font-size:16px;line-height:1;">${emoji}</div>
    </div>`;
}

export function ManifestacoesMap({
  points,
  height = 400,
  className,
  onOpenProtocolo,
  secretarias = [],
  locais = [],
}: {
  points: MapPoint[];
  height?: number | string;
  className?: string;
  onOpenProtocolo?: (id: string) => void;
  secretarias?: SecretariaPoint[];
  locais?: LocalPoint[];
}) {
  const valid = useMemo(
    () => points.filter(p => typeof p.lat === "number" && typeof p.lng === "number"),
    [points],
  );
  const validSecs = useMemo(
    () => secretarias.filter(s => typeof s.lat === "number" && typeof s.lng === "number"),
    [secretarias],
  );
  const validLocais = useMemo(
    () => locais.filter(l => typeof l.lat === "number" && typeof l.lng === "number"),
    [locais],
  );
  const protocolosPorLocal = useMemo(() => {
    const map = new Map<string, MapPoint[]>();
    points.forEach(p => {
      if (!p.local_id) return;
      const arr = map.get(p.local_id) ?? [];
      arr.push(p);
      map.set(p.local_id, arr);
    });
    return map;
  }, [points]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const rootsRef = useRef<Root[]>([]);
  const onOpenRef = useRef(onOpenProtocolo);
  useEffect(() => { onOpenRef.current = onOpenProtocolo; }, [onOpenProtocolo]);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE,
      center: BRUSQUE,
      zoom: 13,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    mapRef.current = map;
    return () => {
      const roots = rootsRef.current;
      const markers = markersRef.current;
      rootsRef.current = [];
      markersRef.current = [];
      mapRef.current = null;
      // Defer unmount to avoid "synchronously unmount a root while React was already rendering"
      queueMicrotask(() => {
        roots.forEach(r => { try { r.unmount(); } catch { /* noop */ } });
        markers.forEach(m => m.remove());
        try { map.remove(); } catch { /* noop */ }
      });
    };
  }, []);

  // update markers when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      // cleanup existing
      const oldRoots = rootsRef.current;
      const oldMarkers = markersRef.current;
      rootsRef.current = [];
      markersRef.current = [];
      queueMicrotask(() => {
        oldRoots.forEach(r => { try { r.unmount(); } catch { /* noop */ } });
        oldMarkers.forEach(m => m.remove());
      });

      // secretarias
      validSecs.forEach(s => {
        const cfg = SECRETARIA_ICONES[s.icone ?? "administracao"] ?? SECRETARIA_ICONES.administracao;
        const el = document.createElement("div");
        el.innerHTML = secretariaSvg(s.icone);
        el.style.cursor = "pointer";
        const popupNode = document.createElement("div");
        const root = createRoot(popupNode);
        root.render(
          <div className="space-y-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{cfg.emoji}</span>
              <span className="text-sm font-bold">{s.nome}</span>
              {s.sigla && <span className="text-xs text-muted-foreground">({s.sigla})</span>}
            </div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Secretaria · {cfg.label}</p>
            {s.endereco && <p className="text-xs">{s.endereco}</p>}
          </div>,
        );
        rootsRef.current.push(root);
        const popup = new mapboxgl.Popup({ offset: 28, maxWidth: "300px" }).setDOMContent(popupNode);
        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([s.lng, s.lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
      });

      // locais (UBS / pontos de atendimento)
      validLocais.forEach(l => {
        const emoji = SECRETARIA_ICONES[l.secretariaIcone ?? "administracao"]?.emoji ?? "📍";
        const el = document.createElement("div");
        el.innerHTML = localSvg(emoji);
        el.style.cursor = "pointer";
        const lista = protocolosPorLocal.get(l.id) ?? [];
        const popupNode = document.createElement("div");
        const root = createRoot(popupNode);
        root.render(
          <div className="space-y-2 min-w-[260px] max-w-[320px]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{emoji}</span>
                <span className="text-sm font-bold">{l.nome}</span>
              </div>
              {l.secretaria && <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l.secretaria}</p>}
              <p className="text-xs mt-1"><strong>{lista.length}</strong> protocolo(s) neste local</p>
            </div>
            {lista.length > 0 && (
              <div className="max-h-[260px] overflow-y-auto -mx-1 pr-1 space-y-1">
                {lista.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenRef.current?.(p.id)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded border border-border hover:bg-muted/60 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-primary">{p.numero}</span>
                      {p.status && (
                        <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted">
                          {p.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    {p.assunto && <p className="mt-0.5 line-clamp-2 text-foreground">{p.assunto}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>,
        );
        rootsRef.current.push(root);
        const popup = new mapboxgl.Popup({ offset: 22, maxWidth: "340px" }).setDOMContent(popupNode);
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([l.lng, l.lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
      });

      // protocolos
      valid.forEach(p => {
        const el = document.createElement("div");
        el.innerHTML = pinSvg(p.categoria);
        el.style.cursor = "pointer";
        const popupNode = document.createElement("div");
        const root = createRoot(popupNode);
        root.render(
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
              {p.categoria && (<div><span className="font-medium text-foreground">Categoria: </span><span className="capitalize">{p.categoria.replace(/_/g, " ")}</span></div>)}
              {p.tipo && (<div><span className="font-medium text-foreground">Tipo: </span>{p.tipo}</div>)}
              {p.secretaria && (<div><span className="font-medium text-foreground">Secretaria: </span>{p.secretaria}</div>)}
              {p.local && (<div><span className="font-medium text-foreground">Local: </span>{p.local}</div>)}
              {p.endereco && (<div><span className="font-medium text-foreground">Endereço: </span>{p.endereco}</div>)}
              {p.data_abertura && (<div><span className="font-medium text-foreground">Aberto em: </span>{formatLocalDate(p.data_abertura)}</div>)}
              {p.data_conclusao && (<div><span className="font-medium text-foreground">Concluído em: </span>{formatLocalDate(p.data_conclusao)}</div>)}
            </div>
            {onOpenRef.current && (
              <button
                type="button"
                onClick={() => onOpenRef.current?.(p.id)}
                className="mt-2 w-full text-xs font-medium px-2 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 transition"
              >
                Abrir protocolo →
              </button>
            )}
          </div>,
        );
        rootsRef.current.push(root);
        const popup = new mapboxgl.Popup({ offset: 28, maxWidth: "320px" }).setDOMContent(popupNode);
        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([p.lng, p.lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
      });

      // fit bounds
      const all = [...valid, ...validSecs, ...validLocais];
      if (all.length === 1) {
        map.flyTo({ center: [all[0].lng, all[0].lat], zoom: 15, duration: 0 });
      } else if (all.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        all.forEach(p => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [valid, validSecs, validLocais, protocolosPorLocal]);

  return (
    <div className={className} style={{ height, width: "100%", isolation: "isolate", position: "relative", zIndex: 0 }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%", borderRadius: 8, overflow: "hidden" }} />
      {!valid.length && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Nenhum protocolo com endereço georreferenciado ainda.
        </p>
      )}
    </div>
  );
}