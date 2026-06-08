import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { calcularPrazo, situacaoProtocolo, situacaoClasses, situacaoLabel, formatDate, gerarNumeroProtocolo, PRAZOS, type TipoProtocolo, type StatusProtocolo } from "@/lib/prazo";
import { Plus, Calendar, RotateCw, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/protocolos")({
  component: ProtocolosPage,
});

function ProtocolosPage() {
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocolos")
        .select("*, secretarias(nome, sigla), responsaveis(nome)")
        .order("data_abertura", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("*").order("nome")).data ?? [],
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => (await supabase.from("responsaveis").select("*").order("nome")).data ?? [],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("protocolos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["protocolos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("protocolos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["protocolos"] }); toast.success("Protocolo removido"); },
  });

  const filtrados = protocolos.filter(p => {
    if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
    if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Protocolos</h1>
          <p className="text-sm text-muted-foreground">{filtrados.length} de {protocolos.length}</p>
        </div>
        <NovoProtocoloDialog secretarias={secretarias} responsaveis={responsaveis} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
            <SelectItem value="lai">LAI</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {filtrados.length === 0 && (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum protocolo encontrado.</CardContent></Card>
        )}
        {filtrados.map(p => {
          const s = situacaoProtocolo(p as any);
          return (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">{PRAZOS[p.tipo as TipoProtocolo].label}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{p.status.replace("_", " ")}</Badge>
                      {p.prorrogado && <Badge variant="outline" className="text-[10px]">prorrogado</Badge>}
                      <Badge variant="outline" className={`text-[10px] border ${situacaoClasses[s.situacao]}`}>
                        {situacaoLabel[s.situacao]} · {s.dias < 0 ? `${Math.abs(s.dias)}d atrasado` : `${s.dias}d`}
                      </Badge>
                    </div>
                    <h3 className="font-semibold mt-2">{p.assunto}</h3>
                    {p.descricao && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.descricao}</p>}
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <span><Calendar className="inline h-3 w-3 mr-1" />Aberto {formatDate(p.data_abertura)}</span>
                      <span>Prazo {formatDate(s.prazoFinal)}</span>
                      {(p as any).secretarias && <span>📍 {(p as any).secretarias.nome}</span>}
                      {(p as any).responsaveis && <span>👤 {(p as any).responsaveis.nome}</span>}
                      {p.solicitante && <span>✉ {p.solicitante}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {p.status !== "concluido" && !p.prorrogado && (
                      <Button size="sm" variant="outline"
                        onClick={() => updateMutation.mutate({ id: p.id, patch: { prorrogado: true, data_prorrogacao: new Date().toISOString().slice(0, 10) } })}>
                        <RotateCw className="h-3 w-3 mr-1" /> Prorrogar
                      </Button>
                    )}
                    {p.status !== "concluido" && (
                      <Button size="sm"
                        onClick={() => updateMutation.mutate({ id: p.id, patch: { status: "concluido", data_conclusao: new Date().toISOString().slice(0, 10) } })}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
                      </Button>
                    )}
                    {p.status === "aberto" && (
                      <Button size="sm" variant="secondary"
                        onClick={() => updateMutation.mutate({ id: p.id, patch: { status: "em_andamento" } })}>
                        Iniciar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir protocolo?")) deleteMutation.mutate(p.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NovoProtocoloDialog({ secretarias, responsaveis }: { secretarias: any[]; responsaveis: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoProtocolo>("ouvidoria");
  const [numero, setNumero] = useState("");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [secretariaId, setSecretariaId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [solicitante, setSolicitante] = useState("");
  const [dataAbertura, setDataAbertura] = useState(new Date().toISOString().slice(0, 10));

  const respFiltrados = responsaveis.filter(r => !secretariaId || r.secretaria_id === secretariaId);

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("protocolos").insert({
        numero: numero || gerarNumeroProtocolo(tipo),
        tipo, assunto, descricao: descricao || null,
        secretaria_id: secretariaId || null,
        responsavel_id: responsavelId || null,
        solicitante: solicitante || null,
        data_abertura: dataAbertura,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["protocolos"] });
      toast.success("Protocolo cadastrado");
      setOpen(false);
      setNumero(""); setAssunto(""); setDescricao(""); setSecretariaId(""); setResponsavelId(""); setSolicitante("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const previewPrazo = calcularPrazo({ tipo, data_abertura: dataAbertura, prorrogado: false });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> Novo protocolo</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo protocolo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as TipoProtocolo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ouvidoria">Ouvidoria (30+30d)</SelectItem>
                  <SelectItem value="lai">LAI (20+10d)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de abertura *</Label>
              <Input type="date" value={dataAbertura} onChange={e => setDataAbertura(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Número (auto se vazio)</Label>
            <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder={gerarNumeroProtocolo(tipo)} />
          </div>
          <div className="space-y-1.5">
            <Label>Assunto *</Label>
            <Input value={assunto} onChange={e => setAssunto(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Breve descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Solicitante</Label>
            <Input value={solicitante} onChange={e => setSolicitante(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Secretaria</Label>
            <Select value={secretariaId} onValueChange={v => { setSecretariaId(v); setResponsavelId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {secretarias.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId} disabled={!secretariaId}>
              <SelectTrigger><SelectValue placeholder={secretariaId ? "Selecione" : "Escolha uma secretaria"} /></SelectTrigger>
              <SelectContent>
                {respFiltrados.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md bg-secondary p-3 text-xs">
            <strong>Prazo previsto:</strong> {formatDate(previewPrazo.prazoFinal)} ({previewPrazo.diasTotais} dias)
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!assunto || create.isPending}>Cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}