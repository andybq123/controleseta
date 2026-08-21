import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { searchAddresses, type AddressSuggestion } from "@/lib/geocode.functions";
import { MapPin, Loader2 } from "lucide-react";

type AddressResult = {
  endereco: string;
  label: string;
  lat: number;
  lng: number;
  houseNumber?: string;
  exact: boolean;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (s: AddressResult) => void;
  onResolve?: (s: AddressResult) => void;
  placeholder?: string;
};

function toAddressResult(s: AddressSuggestion): AddressResult {
  return {
    endereco: s.label,
    label: s.label,
    lat: s.lat,
    lng: s.lng,
    houseNumber: s.houseNumber,
    exact: !!s.exact,
  };
}

export function AddressAutocomplete({ value, onChange, onSelect, onResolve, placeholder }: Props) {
  const buscar = useServerFn(searchAddresses);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
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
        const feats = await buscar({ data: { q } });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(s: AddressSuggestion) {
    skipNextFetch.current = true;
    onChange(s.label);
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
          {suggestions.map((s, i) => (
            <li key={`${s.label}-${i}`}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2"
              >
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  <span className="font-medium">{s.label}</span>
                  {!s.exact && (
                    <span className="block text-[11px] text-muted-foreground">
                      Localização aproximada
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
