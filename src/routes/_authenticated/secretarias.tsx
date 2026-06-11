import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, User, Trash2, Mail, Phone, MapPin, Pencil } from "lucide-react";
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

  const { data: locais = [] } = useQuery({
    queryKey: ["locais"],
    queryFn: async () => (await supabase.from("locais").select("*").order("nome")).data ?? [],
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

  const delLocal = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("locais").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locais"] }); toast.success("Local removido"); },
  });

  const addLocal = useMutation({
    mutationFn: async (payload: { secretaria_id: string; nome: string; centro_custo: string }) => {
      const { error } = await supabase.from("locais").insert({ secretaria_id: payload.secretaria_id, nome: payload.nome, centro_custo: payload.centro_custo || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locais"] }); toast.success("Local adicionado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [editSec, setEditSec] = useState<any | null>(null);
  const [editLocal, setEditLocal] = useState<any | null>(null);
  const [editResp, setEditResp] = useState<any | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secretarias e Responsáveis</h1>
          <p className="text-sm text-muted-foreground">{secretarias.length} secretaria(s) · {locais.length} local(is) · {responsaveis.length} responsável(is)</p>
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
          const locs = locais.filter(l => l.secretaria_id === s.id);
          return (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {s.nome}
                    {s.sigla && <span className="text-xs text-muted-foreground font-normal">({s.sigla})</span>}
                    {s.centro_custo && <span className="text-xs text-muted-foreground font-normal font-mono">CC {s.centro_custo}</span>}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditSec(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir secretaria e seus responsáveis?")) delSec.mutate(s.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Locais</div>
                  {locs.length === 0 && <p className="text-xs text-muted-foreground">Sem locais cadastrados.</p>}
                  {locs.map(l => (
                    <div key={l.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>{l.nome}{l.centro_custo && <span className="text-xs text-muted-foreground font-mono ml-2">{l.centro_custo}</span>}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditLocal(l)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => delLocal.mutate(l.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                  <AddLocalInline secretariaId={s.id} onAdd={(nome, cc) => addLocal.mutate({ secretaria_id: s.id, nome, centro_custo: cc })} />
                </div>
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 pt-2"><User className="h-3 w-3" />Responsáveis</div>
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
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditResp(r)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => delResp.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <EditSecretariaDialog secretaria={editSec} onClose={() => setEditSec(null)} />
      <EditLocalDialog local={editLocal} onClose={() => setEditLocal(null)} />
      <EditResponsavelDialog responsavel={editResp} secretarias={secretarias} onClose={() => setEditResp(null)} />
    </div>
  );
}

function NovaSecretariaDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [centroCusto, setCentroCusto] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("secretarias").insert({ nome, sigla: sigla || null, centro_custo: centroCusto || null, created_by: user?.id }).select("id").single();
      if (error) throw error;
      // cria um local default com mesmo nome/cc
      if (data) {
        await supabase.from("locais").insert({ secretaria_id: data.id, nome, centro_custo: centroCusto || null });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["secretarias"] }); qc.invalidateQueries({ queryKey: ["locais"] }); toast.success("Secretaria criada"); setOpen(false); setNome(""); setSigla(""); setCentroCusto(""); },
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
          <div className="space-y-1.5"><Label>Centro de Custo</Label><Input value={centroCusto} onChange={e => setCentroCusto(e.target.value)} placeholder="Ex: 25001006004" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!nome || create.isPending}>Cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLocalInline({ secretariaId, onAdd }: { secretariaId: string; onAdd: (nome: string, cc: string) => void }) {
  const [nome, setNome] = useState("");
  const [cc, setCc] = useState("");
  return (
    <div className="flex gap-1.5 pt-1">
      <Input placeholder="Nome do local" value={nome} onChange={e => setNome(e.target.value)} className="h-8 text-xs" />
      <Input placeholder="Centro de Custo" value={cc} onChange={e => setCc(e.target.value)} className="h-8 text-xs w-32 font-mono" />
      <Button size="sm" variant="outline" className="h-8" disabled={!nome} onClick={() => { onAdd(nome, cc); setNome(""); setCc(""); }}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
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
function EditSecretariaDialog({ secretaria, onClose }: { secretaria: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [centroCusto, setCentroCusto] = useState("");
  const open = !!secretaria;

  useEffect(() => {
    if (secretaria) {
      setNome(secretaria.nome ?? "");
      setSigla(secretaria.sigla ?? "");
      setCentroCusto(secretaria.centro_custo ?? "");
    }
  }, [secretaria]);

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("secretarias").update({ nome, sigla: sigla || null, centro_custo: centroCusto || null }).eq("id", secretaria.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["secretarias"] }); toast.success("Secretaria atualizada"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar secretaria</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Sigla</Label><Input value={sigla} onChange={e => setSigla(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Centro de Custo</Label><Input value={centroCusto} onChange={e => setCentroCusto(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => update.mutate()} disabled={!nome || update.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLocalDialog({ local, onClose }: { local: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cc, setCc] = useState("");
  const open = !!local;
  useEffect(() => {
    if (local) {
      setNome(local.nome ?? "");
      setCc(local.centro_custo ?? "");
    }
  }, [local]);
  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("locais").update({ nome, centro_custo: cc || null }).eq("id", local.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locais"] }); toast.success("Local atualizado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar local</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Centro de Custo</Label><Input value={cc} onChange={e => setCc(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => update.mutate()} disabled={!nome || update.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditResponsavelDialog({ responsavel, secretarias, onClose }: { responsavel: any | null; secretarias: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [secId, setSecId] = useState("");
  const open = !!responsavel;
  useEffect(() => {
    if (responsavel) {
      setNome(responsavel.nome ?? "");
      setEmail(responsavel.email ?? "");
      setTelefone(responsavel.telefone ?? "");
      setCargo(responsavel.cargo ?? "");
      setSecId(responsavel.secretaria_id ?? "");
    }
  }, [responsavel]);
  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("responsaveis").update({
        nome, email: email || null, telefone: telefone || null, cargo: cargo || null, secretaria_id: secId,
      }).eq("id", responsavel.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["responsaveis"] }); toast.success("Responsável atualizado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar responsável</DialogTitle></DialogHeader>
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
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => update.mutate()} disabled={!nome || !secId || update.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
