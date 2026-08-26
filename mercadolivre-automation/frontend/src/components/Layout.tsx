import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/palavras-chave", label: "Palavras-chave" },
  { to: "/configuracoes", label: "Configurações" },
  { to: "/historico", label: "Histórico" },
  { to: "/logs", label: "Logs" },
];

export function Layout() {
  const { username, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-8 px-2">
          <h1 className="text-lg font-bold text-brand-500">ML Automation</h1>
          <p className="text-xs text-slate-500">Ofertas → WhatsApp</p>
        </div>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
          <span className="text-sm text-slate-400">Logado como <strong className="text-slate-200">{username}</strong></span>
          <Button variant="secondary" onClick={logout}>Sair</Button>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
