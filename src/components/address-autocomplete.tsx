import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MAPBOX_TOKEN } from "@/lib/mapbox";
import { MapPin, Loader2 } from "lucide-react";

type Suggestion = {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
  address?: string;
  place_type?: string[];
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (s: {
    endereco: string;
    label: string;
    lat: number;
    lng: number;
    houseNumber?: string;
    exact: boolean;
  }) => void;
  onResolve?: (s: {
    endereco: string;
    label: string;
    lat: number;
    lng: number;
    houseNumber?: string;
    exact: boolean;
  }) => void;
  placeholder?: string;
};

// Brusque-SC bounding box and center for proximity bias
const BRUSQUE_BBOX = "-49.10,-27.30,-48.70,-26.90";
const BRUSQUE_PROX = "-48.9197,-27.0978";

function toAddressResult(s: Suggestion) {
  return {
    endereco: s.place_name,
    label: s.place_name,
    lng: s.center[0],
    lat: s.center[1],
    houseNumber: s.address,
    exact: (s.place_type ?? []).includes("address"),
  };
}

export function AddressAutocomplete({ value, onChange, onSelect, onResolve, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextFetch = useRef(false);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          q + ", Brusque, SC"
        )}.json?access_token=${MAPBOX_TOKEN}&country=br&language=pt&autocomplete=true&limit=6&bbox=${BRUSQUE_BBOX}&proximity=${BRUSQUE_PROX}&types=address,street,place,locality,neighborhood,poi`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Falha ao buscar endereços");
        const data = await res.json();
        const feats: Suggestion[] = (data.features ?? []).map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          text: f.text,
          center: f.center,
          address: f.address,
          place_type: f.place_type,
        }));
        setSuggestions(feats);
        setOpen(feats.length > 0);
        if (feats[0]) onResolve?.(toAddressResult(feats[0]));
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(s: Suggestion) {
    skipNextFetch.current = true;
    onChange(s.place_name);
    setOpen(false);
    setSuggestions([]);
    onSelect?.(toAddressResult(s));
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Comece a digitar a rua…"}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2"
              >
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  <span className="font-medium">{s.text}</span>
                  <span className="block text-xs text-muted-foreground">{s.place_name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}