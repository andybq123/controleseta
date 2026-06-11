import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, Building2, LogOut, Shield, AlertTriangle, BarChart3, Mail, Users } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { NotificationBell } from "@/components/notification-bell";

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
    { to: "/atrasados", label: "Atrasados", icon: AlertTriangle },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/secretarias", label: "Secretarias", icon: Building2 },
    { to: "/email-inbox", label: "E-mails", icon: Mail },
    ...(isAdmin ? [{ to: "/users", label: "Usuários", icon: Users }] : []),
  ]) as { to: string; label: string; icon: any }[];

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
          <div className="flex items-center gap-1">
            <NotificationBell />
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