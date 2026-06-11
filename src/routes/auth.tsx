import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("unauthorized")) {
      toast.error("Seu e-mail não está autorizado a acessar o sistema.");
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    const { data: ud } = await supabase.auth.getUser();
    if (ud.user) {
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", ud.user.id);
      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        return toast.error("Seu e-mail não está autorizado a acessar o sistema.");
      }
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard" });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Erro ao entrar com Google");
    if (!result.redirected && !result.error) navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-accent/40 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Shield className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Ouvidoria Municipal</CardTitle>
          <CardDescription>Sistema de controle de prazos</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Entrar com Google
          </Button>
          <p className="text-[11px] text-center text-muted-foreground mt-4">
            Acesso restrito. Solicite ao administrador para cadastrar seu e-mail.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}