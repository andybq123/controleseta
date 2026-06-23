import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, RotateCw, Trash2, Save, Pencil, X, History } from "lucide-react";
import { MapPin } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import { geocodeAddress } from "@/lib/geocode.functions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { MapPointPicker } from "@/components/map-point-picker";
import {
  situacaoProtocolo, situacaoClasses, situacaoLabel, formatDate,
  PRAZOS, CATEGORIAS, categoriaLabel, categoriaSigla, categoriaBadgeClass,
  type TipoProtocolo, type CategoriaProtocolo,
} from "@/lib/prazo";

export function ProtocoloDetailDialog({ protocolo: protocoloProp, open, onOpenChange }: {
  protocolo: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [enderecoCoords, setEnderecoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [enderecoTemNumero, setEnderecoTemNumero] = useState<boolean>(false);
  const [enderecoExact, setEnderecoExact] = useState<boolean>(false);
  const [confirmImprecise, setConfirmImprecise] = useState<null | { patch: any }>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingPatch, setPendingPatch] = useState<any | null>(null);
  const geocode = useServerFn(geocodeAddress);

  const { data: protocoloFresh } = useQuery({
    queryKey: ["protocolo", protocoloProp?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocolos")
        .select("*, secretarias(nome, sigla), locais(nome)")
        .eq("id", protocoloProp.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!protocoloProp?.id,
  });
  const protocolo = protocoloFresh ?? protocoloProp;

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("*").order("nome")).data ?? [],
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
        local_id: protocolo.local_id ?? "",
        data_abertura: protocolo.data_abertura ?? "",
        data_conclusao: protocolo.data_conclusao ?? "",
        data_prorrogacao: protocolo.data_prorrogacao ?? "",
        prorrogado: !!protocolo.prorrogado,
        endereco: protocolo.endereco ?? "",
      });
      setEditing(false);
      setEnderecoCoords(null);
    }
  }, [protocolo]);

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("protocolos").update(patch).eq("id", protocolo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["protocolos"] });
      qc.invalidateQueries({ queryKey: ["protocolo", protocolo.id] });
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

  const locaisFiltrados = locais.filter((l: any) => !form.secretaria_id || l.secretaria_id === form.secretaria_id);

  function handleSave() {
    void runSave(false);
  }

  async function runSave(forceNoCoords: boolean) {
      const patch: any = {
      numero: form.numero,
      tipo: form.tipo,
      categoria: form.categoria,
      status: form.status,
      assunto: form.assunto,
      descricao: form.descricao || null,
      solicitante: form.solicitante || null,
      secretaria_id: form.secretaria_id || null,
      local_id: form.local_id || null,
      data_abertura: form.data_abertura,
      data_conclusao: form.data_conclusao || null,
      data_prorrogacao: form.data_prorrogacao || null,
      prorrogado: form.prorrogado,
        endereco: form.endereco || null,
      };
      const enderecoChanged = (form.endereco ?? "") !== (protocolo.endereco ?? "");
      // Se o usuário ajustou o pino manualmente (enderecoCoords definido),
      // sempre persiste — mesmo que o texto do endereço não tenha mudado.
      if (enderecoCoords) {
        patch.latitude = enderecoCoords.lat;
        patch.longitude = enderecoCoords.lng;
      } else if (enderecoChanged) {
        if (forceNoCoords) {
          patch.latitude = null;
          patch.longitude = null;
        } else if (form.endereco && form.endereco.trim()) {
          try {
            const r = await geocode({ data: { endereco: form.endereco } });
            if (r.lat != null && r.exact) {
              patch.latitude = r.lat;
              patch.longitude = r.lng;
            } else {
              // Refused: street centroid or no result → ask the user to confirm.
              setConfirmImprecise({ patch });
              return;
            }
          } catch {
            toast.warning("Falha ao geocodificar o endereço.");
            patch.latitude = null;
            patch.longitude = null;
          }
        } else {
          patch.latitude = null;
          patch.longitude = null;
        }
      }
      update.mutate(patch, { onSuccess: () => setEditing(false) });
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
            <Badge
              className={`text-[10px] ${categoriaBadgeClass(protocolo.categoria as CategoriaProtocolo)}`}
              title={categoriaLabel(protocolo.categoria as CategoriaProtocolo)}
            >
              {categoriaLabel(protocolo.categoria as CategoriaProtocolo)}
            </Badge>
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

        <Tabs defaultValue="detalhes" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1">
              <History className="h-3.5 w-3.5" /> Histórico ({historico.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="detalhes" className="space-y-4">
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
              {protocolo.locais && <Field label="Local" value={protocolo.locais.nome} />}
              <Field label="Solicitante" value={protocolo.solicitante ?? "—"} />
            </div>
            <div className="pt-2">
              <Button type="button" size="sm" variant="outline" onClick={() => { setPendingPatch({}); setPickerOpen(true); }}>
                <MapPin className="h-3 w-3 mr-1" /> Ajustar ponto no mapa
              </Button>
              {protocolo.latitude != null && protocolo.longitude != null && (
                <span className="ml-2 text-[11px] text-muted-foreground">
                  Atual: {Number(protocolo.latitude).toFixed(5)}, {Number(protocolo.longitude).toFixed(5)}
                </span>
              )}
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
                    <SelectItem value="esic">e-SIC</SelectItem>
                  </SelectContent>
                </Select>
              </Field2>
              <Field2 label="Categoria">
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="font-mono mr-2">{c.sigla}</span>{c.label}
                      </SelectItem>
                    ))}
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
                <Select value={form.secretaria_id || "none"} onValueChange={(v) => setForm({ ...form, secretaria_id: v === "none" ? "" : v, local_id: "" })}>
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
              <Field2 label="Data conclusão">
                <Input type="date" value={form.data_conclusao ?? ""} onChange={e => setForm({ ...form, data_conclusao: e.target.value })} />
              </Field2>
            </div>
            <Field2 label="Endereço (para mapa)">
              <AddressAutocomplete
                value={form.endereco ?? ""}
                onChange={(v) => { setForm({ ...form, endereco: v }); setEnderecoCoords(null); setEnderecoTemNumero(false); setEnderecoExact(false); }}
                onSelect={(s) => {
                  setForm({ ...form, endereco: s.label });
                  setEnderecoCoords({ lat: s.lat, lng: s.lng });
                  setEnderecoTemNumero(!!s.houseNumber);
                  setEnderecoExact(s.exact !== false && !!s.houseNumber);
                  if (!s.houseNumber) {
                    toast.warning("Sugestão sem número do imóvel. Inclua o número (ex.: \"Rua X, 174\") para um pino preciso.");
                  }
                }}
                placeholder="Digite e selecione uma rua de Brusque…"
              />
              <p className="text-[11px] text-muted-foreground">
                Sugestões automáticas de ruas em Brusque/SC. A localização é atualizada ao salvar.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => { setPendingPatch(null); setPickerOpen(true); }}>
                <MapPin className="h-3 w-3 mr-1" /> Ajustar ponto no mapa
              </Button>
            </Field2>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={update.isPending}>
                <Save className="h-4 w-4 mr-1" /> Salvar alterações
              </Button>
            </DialogFooter>
          </div>
        )}
          </TabsContent>
          <TabsContent value="historico">
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {historico.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma alteração registrada ainda.</p>
              )}
              {historico.map((h: any) => (
                <div key={h.id} className="border rounded-md p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {h.acao === "create" ? "Criação" : h.campo.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{h.autor_nome ?? "Sistema"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {h.acao !== "create" && (
                    <div className="text-xs grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">De: </span>
                        <span className="line-through">{h.valor_anterior ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Para: </span>
                        <span className="font-medium">{h.valor_novo ?? "—"}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
      <AlertDialog open={!!confirmImprecise} onOpenChange={(v) => !v && setConfirmImprecise(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Endereço sem localização precisa</AlertDialogTitle>
            <AlertDialogDescription>
              Não foi possível localizar este endereço com o número do imóvel. Para evitar
              um pino no meio da rua, você pode <strong>selecionar manualmente o ponto no mapa</strong>
              ou salvar o protocolo <strong>sem coordenadas</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Revisar endereço</AlertDialogCancel>
            <Button
              variant="secondary"
              onClick={() => {
                const pending = confirmImprecise;
                setConfirmImprecise(null);
                if (pending) {
                  setPendingPatch(pending.patch);
                  setPickerOpen(true);
                }
              }}
            >
              Selecionar no mapa
            </Button>
            <AlertDialogAction onClick={() => {
              const pending = confirmImprecise;
              setConfirmImprecise(null);
              if (pending) {
                const patch = { ...pending.patch, latitude: null, longitude: null };
                update.mutate(patch, { onSuccess: () => setEditing(false) });
              }
            }}>Salvar sem mapa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MapPointPicker
        open={pickerOpen}
        onOpenChange={(v) => { setPickerOpen(v); if (!v) setPendingPatch(null); }}
        initial={enderecoCoords ?? (protocolo?.latitude && protocolo?.longitude ? { lat: protocolo.latitude, lng: protocolo.longitude } : null)}
        endereco={form?.endereco}
        protocoloContext={{
          assunto: form?.assunto,
          descricao: form?.descricao,
          endereco: form?.endereco,
          solicitante: form?.solicitante,
          secretaria: secretarias.find((s: any) => s.id === form?.secretaria_id)?.nome,
          local: locais.find((l: any) => l.id === form?.local_id)?.nome,
          categoria: form?.categoria,
        }}
        onConfirm={(lat, lng) => {
          if (pendingPatch) {
            const patch = { ...pendingPatch, latitude: lat, longitude: lng };
            update.mutate(patch, { onSuccess: () => { setEditing(false); setPendingPatch(null); } });
          } else {
            setEnderecoCoords({ lat, lng });
            setEnderecoExact(true);
          }
          toast.success("Localização definida manualmente.");
        }}
      />
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