import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN, MAPBOX_STYLE } from "@/lib/mapbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

// [lng, lat]
const BRUSQUE: [number, number] = [-48.9114, -27.0978];

const PIN_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">
    <path d="M15 1 C7 1 1 7 1 15 C1 25 15 41 15 41 C15 41 29 25 29 15 C29 7 23 1 15 1 Z"
      fill="#dc2626" stroke="#fff" stroke-width="2"/>
    <circle cx="15" cy="15" r="5" fill="#fff" opacity="0.95"/>
  </svg>`;

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (open) setPt(initial ?? null);
  }, [open, initial]);

  // init / teardown map with dialog lifecycle
  useEffect(() => {
    if (!open || !containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const center: [number, number] = initial
      ? [initial.lng, initial.lat]
      : BRUSQUE;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE,
      center,
      zoom: initial ? 16 : 13,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      setPt({ lat, lng });
    });
    mapRef.current = map;
    // ensure correct size after dialog mount
    setTimeout(() => map.resize(), 50);
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [open, initial]);

  // sync marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pt) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const el = document.createElement("div");
    el.innerHTML = PIN_HTML;
    if (markerRef.current) {
      markerRef.current.setLngLat([pt.lng, pt.lat]);
    } else {
      markerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([pt.lng, pt.lat])
        .addTo(map);
    }
    map.flyTo({ center: [pt.lng, pt.lat], zoom: Math.max(map.getZoom(), 16), duration: 400 });
  }, [pt]);

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
          <div ref={containerRef} style={{ height: "100%", width: "100%", borderRadius: 8, overflow: "hidden" }} />
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