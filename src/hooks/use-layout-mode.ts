import { useEffect, useState } from "react";

export type LayoutMode = "topbar" | "sidebar";
const KEY = "layout-mode";

function getInitial(): LayoutMode {
  if (typeof window === "undefined") return "topbar";
  try {
    const v = localStorage.getItem(KEY);
    if (v === "sidebar" || v === "topbar") return v;
  } catch {}
  return "topbar";
}

export function useLayoutMode(): [LayoutMode, () => void] {
  const [mode, setMode] = useState<LayoutMode>("topbar");
  useEffect(() => {
    setMode(getInitial());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === "sidebar" || e.newValue === "topbar")) {
        setMode(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const toggle = () => {
    setMode(prev => {
      const next: LayoutMode = prev === "sidebar" ? "topbar" : "sidebar";
      try { localStorage.setItem(KEY, next); } catch {}
      return next;
    });
  };
  return [mode, toggle];
}