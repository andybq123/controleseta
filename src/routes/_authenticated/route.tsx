import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, Building2, LogOut, Shield, AlertTriangle, BarChart3 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: s => s.location.pathname });

  async function handleLogout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/protocolos", label: "Protocolos", icon: FileText },
    { to: "/atrasados", label: "Atrasados", icon: AlertTriangle },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/secretarias", label: "Secretarias", icon: Building2 },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Shield className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-tight">Ouvidoria</div>
              <div className="text-xs text-muted-foreground leading-tight">Controle de Prazos</div>
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
          </nav>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}