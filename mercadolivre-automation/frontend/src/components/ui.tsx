import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "bg-brand-500 text-slate-950 hover:bg-brand-400",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500 ${props.className ?? ""}`}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{children}</label>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-brand-500" : "bg-slate-700"}`}
      aria-label={label}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "error" | "warning" }) {
  const tones: Record<string, string> = {
    default: "bg-slate-800 text-slate-300",
    success: "bg-emerald-900 text-emerald-300",
    error: "bg-red-900 text-red-300",
    warning: "bg-amber-900 text-amber-300",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
