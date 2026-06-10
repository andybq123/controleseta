import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, RotateCw, Trash2, Save, Pencil, X, History } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  situacaoProtocolo, situacaoClasses, situacaoLabel, formatDate,
  PRAZOS, CATEGORIAS, categoriaLabel,
  type TipoProtocolo, type CategoriaProtocolo,
} from "@/lib/prazo";

export function ProtocoloDetailDialog({ protocolo, open, onOpenChange }: {
  protocolo: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("*").order("nome")).data ?? [],
    enabled: open,
  });
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => (await supabase.from("responsaveis").select("*").order("nome")).data ?? [],
    enabled: open,
  });
  const { data: locais = [] } = useQuery({
    queryKey: ["locais"],
    queryFn: async () => (await supabase.from("locais").select("*").order("nome")).data ?? [],
    enabled: open,
  });
  const { data: historico = [] } = useQuery({
    queryKey: ["historico", protocolo?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("protocolo_historico" as any)
        .select("*")
        .eq("protocolo_id", protocolo.id)
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
    enabled: open && !!protocolo?.id,
  });

  useEffect(() => {
    if (protocolo) {
      setForm({
        numero: protocolo.numero ?? "",
        tipo: protocolo.tipo,
        categoria: protocolo.categoria,
        status: protocolo.status,
        assunto: protocolo.assunto ?? "",
        descricao: protocolo.descricao ?? "",
        solicitante: protocolo.solicitante ?? "",
        secretaria_id: protocolo.secretaria_id ?? "",
        responsavel_id: protocolo.responsavel_id ?? "",
        local_id: protocolo.local_id ?? "",
        data_abertura: protocolo.data_abertura ?? "",
        data_conclusao: protocolo.data_conclusao ?? "",
        data_prorrogacao: protocolo.data_prorrogacao ?? "",
        prorrogado: !!protocolo.prorrogado,
      });
      setEditing(false);
    }
  }, [protocolo]);

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("protocolos").update(patch).eq("id", protocolo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["protocolos"] });
      qc.invalidateQueries({ queryKey: ["historico", protocolo.id] });
      toast.success("Protocolo atualizado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("protocolos").delete().eq("id", protocolo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["protocolos"] });
      toast.success("Protocolo removido");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  if (!protocolo) return null;
  const s = situacaoProtocolo(protocolo);

  const respFiltrados = responsaveis.filter((r: any) => !form.secretaria_id || r.secretaria_id === form.secretaria_id);
  const locaisFiltrados = locais.filter((l: any) => !form.secretaria_id || l.secretaria_id === form.secretaria_id);

  function handleSave() {
    update.mutate({
      numero: form.numero,
      tipo: form.tipo,
      categoria: form.categoria,
      status: form.status,
      assunto: form.assunto,
      descricao: form.descricao || null,
      solicitante: form.solicitante || null,
      secretaria_id: form.secretaria_id || null,
      responsavel_id: form.responsavel_id || null,
      local_id: form.local_id || null,
      data_abertura: form.data_abertura,
      data_conclusao: form.data_conclusao || null,
      data_prorrogacao: form.data_prorrogacao || null,
      prorrogado: form.prorrogado,
    }, { onSuccess: () => setEditing(false) });
  }

  function handleConcluir() {
    const hoje = new Date().toISOString().slice(0, 10);
    update.mutate({ status: "concluido", data_conclusao: hoje });
  }
  function handleReabrir() {
    update.mutate({ status: "em_andamento", data_conclusao: null });
  }
  function handleIniciar() {
    update.mutate({ status: "em_andamento" });
  }
  function handleProrrogar() {
    update.mutate({ prorrogado: true, data_prorrogacao: new Date().toISOString().slice(0, 10) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{protocolo.numero}</span>
            <Badge variant="outline" className="text-[10px] uppercase">{PRAZOS[protocolo.tipo as TipoProtocolo].label}</Badge>
            <Badge variant="outline" className="text-[10px]">{categoriaLabel(protocolo.categoria as CategoriaProtocolo)}</Badge>
            <Badge variant="outline" className={`text-[10px] border ${situacaoClasses[s.situacao]}`}>
              {situacaoLabel[s.situacao]} · {s.dias < 0 ? `${Math.abs(s.dias)}d atrasado` : `${s.dias}d`}
            </Badge>
            {protocolo.prorrogado && <Badge variant="outline" className="text-[10px]">prorrogado</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Ações rápidas */}
        <div className="flex flex-wrap gap-2 border-y py-3">
          {protocolo.status !== "concluido" ? (
            <Button size="sm" onClick={handleConcluir} disabled={update.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleReabrir} disabled={update.isPending}>
              Reabrir
            </Button>
          )}
          {protocolo.status === "aberto" && (
            <Button size="sm" variant="secondary" onClick={handleIniciar} disabled={update.isPending}>
              Iniciar atendimento
            </Button>
          )}
          {protocolo.status !== "concluido" && !protocolo.prorrogado && (
            <Button size="sm" variant="outline" onClick={handleProrrogar} disabled={update.isPending}>
              <RotateCw className="h-4 w-4 mr-1" /> Prorrogar prazo
            </Button>
          )}
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="ml-auto">
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="ml-auto">
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
            onClick={() => { if (confirm("Excluir este protocolo permanentemente?")) del.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {!editing ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{protocolo.assunto}</h3>
              {protocolo.descricao && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{protocolo.descricao}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Status" value={protocolo.status?.replace("_", " ")} />
              <Field label="Prorrogado" value={protocolo.prorrogado ? "Sim" : "Não"} />
              <Field label="Data de abertura" value={formatDate(protocolo.data_abertura)} />
              <Field label="Prazo final" value={formatDate(s.prazoFinal)} />
              {protocolo.data_prorrogacao && <Field label="Data prorrogação" value={formatDate(protocolo.data_prorrogacao)} />}
              {protocolo.data_conclusao && <Field label="Data conclusão" value={formatDate(protocolo.data_conclusao)} />}
              <Field label="Secretaria" value={protocolo.secretarias?.nome ?? "—"} />
              <Field label="Responsável" value={protocolo.responsaveis?.nome ?? "—"} />
              {protocolo.locais && <Field label="Local" value={`${protocolo.locais.nome}${protocolo.locais.centro_custo ? ` · ${protocolo.locais.centro_custo}` : ""}`} />}
              <Field label="Solicitante" value={protocolo.solicitante ?? "—"} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field2 label="Número">
                <Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} />
              </Field2>
              <Field2 label="Tipo">
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
                    <SelectItem value="lai">LAI</SelectItem>
                  </SelectContent>
                </Select>
              </Field2>
              <Field2 label="Categoria">
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field2>
              <Field2 label="Status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </Field2>
            </div>
            <Field2 label="Assunto">
              <Input value={form.assunto} onChange={e => setForm({ ...form, assunto: e.target.value })} />
            </Field2>
            <Field2 label="Descrição">
              <Textarea rows={4} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            </Field2>
            <div className="grid grid-cols-2 gap-3">
              <Field2 label="Solicitante">
                <Input value={form.solicitante} onChange={e => setForm({ ...form, solicitante: e.target.value })} />
              </Field2>
              <Field2 label="Data de abertura">
                <Input type="date" value={form.data_abertura} onChange={e => setForm({ ...form, data_abertura: e.target.value })} />
              </Field2>
              <Field2 label="Secretaria">
                <Select value={form.secretaria_id || "none"} onValueChange={(v) => setForm({ ...form, secretaria_id: v === "none" ? "" : v, responsavel_id: "", local_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {secretarias.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field2>
              <Field2 label="Local">
                <Select value={form.local_id || "none"} onValueChange={(v) => setForm({ ...form, local_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {locaisFiltrados.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field2>
              <Field2 label="Responsável">
                <Select value={form.responsavel_id || "none"} onValueChange={(v) => setForm({ ...form, responsavel_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {respFiltrados.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field2>
              <Field2 label="Data conclusão">
                <Input type="date" value={form.data_conclusao ?? ""} onChange={e => setForm({ ...form, data_conclusao: e.target.value })} />
              </Field2>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={update.isPending}>
                <Save className="h-4 w-4 mr-1" /> Salvar alterações
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}