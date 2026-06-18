import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, Building2, LogOut, AlertTriangle, BarChart3, Mail, Users, HeartPulse, Map as MapIcon, Archive, Settings, ChevronDown, PanelLeft, PanelTop, ChevronRight } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLayoutMode } from "@/hooks/use-layout-mode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import brusqueLogo from "@/assets/brusque-brasao.png";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id);
    if (!roles || roles.length === 0) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { unauthorized: "1" } as any });
    }
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { user } = Route.useRouteContext();
  const [layoutMode, toggleLayout] = useLayoutMode();

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
  });

  async function handleLogout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const nav = ([
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/protocolos", label: "Protocolos", icon: FileText },
    { to: "/protocolos-antigos", label: "Protocolos Antigos", icon: Archive },
    { to: "/saude", label: "Saúde", icon: HeartPulse },
    { to: "/mapa", label: "Mapa", icon: MapIcon },
    { to: "/atrasados", label: "Atrasados", icon: AlertTriangle },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  ]) as { to: string; label: string; icon: any }[];

  const configItems = ([
    { to: "/secretarias", label: "Secretarias", icon: Building2 },
    { to: "/email-inbox", label: "E-mails", icon: Mail },
    ...(isAdmin ? [{ to: "/users", label: "Usuários", icon: Users }] : []),
  ]) as { to: string; label: string; icon: any }[];
  const configActive = configItems.some(c => pathname.startsWith(c.to));

  const LayoutSwitch = (
    <button
      type="button"
      onClick={toggleLayout}
      title={layoutMode === "sidebar" ? "Alternar para layout superior" : "Alternar para layout lateral"}
      aria-label="Alternar layout"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/80 text-foreground shadow-sm backdrop-blur transition-all hover:bg-accent hover:scale-105"
    >
      {layoutMode === "sidebar" ? <PanelTop className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
    </button>
  );

  if (layoutMode === "sidebar") {
    const allNav = [...nav, ...configItems];
    return (
      <div className="min-h-screen flex bg-slate-50 dark:bg-background">
        <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col sticky top-0 h-screen">
          <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-800">
            <img src={brusqueLogo} alt="" className="h-10 w-10 object-contain" />
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight truncate">Ouvidoria de Brusque</div>
              <div className="text-[11px] text-slate-400 leading-tight truncate">Controladoria do Município</div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {allNav.map(item => {
              const active = pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="px-6 h-16 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-base font-semibold leading-tight truncate">Painel Executivo</div>
                <div className="text-xs text-muted-foreground leading-tight truncate">Visão geral das manifestações da Ouvidoria</div>
              </div>
              <div className="flex items-center gap-1">
                <NotificationBell />
                <ThemeToggle />
                {LayoutSwitch}
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Sair</span>
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-6 py-6 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={brusqueLogo} alt="Ouvidoria de Brusque" className="h-9 w-9 object-contain" />
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-tight">Ouvidoria de Brusque</div>
              <div className="text-xs text-muted-foreground leading-tight">Controle de Protocolos e Prazos</div>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {nav.map(item => {
              const active = pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${configActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden md:inline">Configurações</span>
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {configItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to} className="flex items-center gap-2 cursor-pointer">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            {LayoutSwitch}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}