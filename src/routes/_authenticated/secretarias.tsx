import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, User, Trash2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/secretarias")({
  component: SecretariasPage,
});

function SecretariasPage() {
  const qc = useQueryClient();

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("*").order("nome")).data ?? [],
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => (await supabase.from("responsaveis").select("*").order("nome")).data ?? [],
  });

  const delSec = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("secretarias").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["secretarias"] }); qc.invalidateQueries({ queryKey: ["responsaveis"] }); toast.success("Removida"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delResp = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("responsaveis").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["responsaveis"] }); toast.success("Removido"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secretarias e Responsáveis</h1>
          <p className="text-sm text-muted-foreground">{secretarias.length} secretaria(s) · {responsaveis.length} responsável(is)</p>
        </div>
        <div className="flex gap-2">
          <NovaSecretariaDialog />
          <NovoResponsavelDialog secretarias={secretarias} />
        </div>
      </div>

      {secretarias.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Cadastre a primeira secretaria.</CardContent></Card>
      )}

      <div className="grid gap-3">
        {secretarias.map(s => {
          const resps = responsaveis.filter(r => r.secretaria_id === s.id);
          return (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {s.nome} {s.sigla && <span className="text-xs text-muted-foreground font-normal">({s.sigla})</span>}
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir secretaria e seus responsáveis?")) delSec.mutate(s.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {resps.length === 0 && <p className="text-xs text-muted-foreground">Sem responsáveis cadastrados.</p>}
                {resps.map(r => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium flex items-center gap-1.5"><User className="h-3 w-3" />{r.nome}{r.cargo && <span className="text-xs text-muted-foreground font-normal">— {r.cargo}</span>}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        {r.email && <span><Mail className="inline h-3 w-3 mr-1" />{r.email}</span>}
                        {r.telefone && <span><Phone className="inline h-3 w-3 mr-1" />{r.telefone}</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => delResp.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NovaSecretariaDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("secretarias").insert({ nome, sigla: sigla || null, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["secretarias"] }); toast.success("Secretaria criada"); setOpen(false); setNome(""); setSigla(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-1" />Secretaria</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova secretaria</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Sigla</Label><Input value={sigla} onChange={e => setSigla(e.target.value)} placeholder="Ex: SEMSA" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!nome || create.isPending}>Cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoResponsavelDialog({ secretarias }: { secretarias: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [secId, setSecId] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("responsaveis").insert({
        nome, email: email || null, telefone: telefone || null, cargo: cargo || null, secretaria_id: secId,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["responsaveis"] }); toast.success("Responsável cadastrado"); setOpen(false); setNome(""); setEmail(""); setTelefone(""); setCargo(""); setSecId(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button disabled={secretarias.length === 0}><Plus className="h-4 w-4 mr-1" />Responsável</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo responsável</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Secretaria *</Label>
            <Select value={secId} onValueChange={setSecId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{secretarias.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Cargo</Label><Input value={cargo} onChange={e => setCargo(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Telefone</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!nome || !secId || create.isPending}>Cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}