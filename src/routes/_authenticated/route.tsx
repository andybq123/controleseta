import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, Building2, LogOut, AlertTriangle, BarChart3, Mail, Users, HeartPulse, Map as MapIcon, Archive, Settings, ChevronDown } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
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