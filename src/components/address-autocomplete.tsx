import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { searchAddresses, type AddressSuggestion } from "@/lib/geocode.functions";
import { Loader2 } from "lucide-react";

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (s: AddressSuggestion) => void;
  placeholder?: string;
  id?: string;
}) {
  const search = useServerFn(searchAddresses);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const ignoreNext = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ignoreNext.current) { ignoreNext.current = false; return; }
    const q = value.trim();
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await search({ data: { q } });
        setSuggestions(r);
        setOpen(r.length > 0);
        setHighlight(-1);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value, search]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(s: AddressSuggestion) {
    ignoreNext.current = true;
    onChange(s.label);
    onSelect?.(s);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        onKeyDown={e => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && highlight >= 0) { e.preventDefault(); pick(suggestions[highlight]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-[1000] mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat},${s.lng},${i}`}
              className={`px-3 py-2 text-sm cursor-pointer ${i === highlight ? "bg-accent" : "hover:bg-accent"}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={e => { e.preventDefault(); pick(s); }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
