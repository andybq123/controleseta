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
import { calcularPrazo, situacaoProtocolo, situacaoClasses, situacaoLabel, formatDate, gerarNumeroProtocolo, PRAZOS, CATEGORIAS, categoriaLabel, categoriaSigla, categoriaBadgeClass, type TipoProtocolo, type CategoriaProtocolo } from "@/lib/prazo";
import { Plus, Calendar, RotateCw, CheckCircle2, Trash2, Sparkles, Eye } from "lucide-react";
import { toast } from "sonner";
import { fetchAllPaginated } from "@/lib/fetch-all";
import { extrairProtocolo } from "@/lib/protocolo-extract.functions";
import { geocodeAddress } from "@/lib/geocode.functions";
import { useServerFn } from "@tanstack/react-start";
import { ProtocoloDetailDialog } from "@/components/protocolo-detail-dialog";

export const Route = createFileRoute("/_authenticated/protocolos")({
  component: ProtocolosPage,
});

function ProtocolosPage() {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<any | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");
  const [filtroSec, setFiltroSec] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos"],
    queryFn: () =>
      fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("*, secretarias(nome, sigla), responsaveis(nome), locais(nome,centro_custo)")
          .order("data_abertura", { ascending: false })
          .range(from, to),
      ),
  });

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
    if (filtroCategoria !== "todos" && p.categoria !== filtroCategoria) return false;
    if (filtroSec !== "todos" && p.secretaria_id !== filtroSec) return false;
    if (busca) {
      const s = busca.toLowerCase();
      const txt = `${p.numero} ${p.assunto} ${p.solicitante ?? ""}`.toLowerCase();
      if (!txt.includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Protocolos</h1>
          <p className="text-sm text-muted-foreground">{filtrados.length} de {protocolos.length}</p>
        </div>
        <NovoProtocoloDialog secretarias={secretarias} responsaveis={responsaveis} locais={locais} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar nº, assunto, solicitante…" value={busca} onChange={e => setBusca(e.target.value)} className="w-[240px]" />
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
            <SelectItem value="esic">e-SIC</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as categorias</SelectItem>
            {CATEGORIAS.map(c => (
              <SelectItem key={c.value} value={c.value}>
                <span className="font-mono mr-2">{c.sigla}</span>{c.label}
              </SelectItem>
            ))}
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
        <Select value={filtroSec} onValueChange={setFiltroSec}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as secretarias</SelectItem>
            {secretarias.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
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
                      <Badge
                        className={`text-[10px] ${categoriaBadgeClass(p.categoria as CategoriaProtocolo)}`}
                        title={categoriaLabel(p.categoria as CategoriaProtocolo)}
                      >
                        {categoriaLabel(p.categoria as CategoriaProtocolo)}
                      </Badge>
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
                    <Button size="sm" variant="outline" onClick={() => setDetail(p)}>
                      <Eye className="h-3 w-3 mr-1" /> Detalhes
                    </Button>
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

      <ProtocoloDetailDialog protocolo={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
    </div>
  );
}

function NovoProtocoloDialog({ secretarias, responsaveis, locais }: { secretarias: any[]; responsaveis: any[]; locais: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoProtocolo>("ouvidoria");
  const [categoria, setCategoria] = useState<CategoriaProtocolo>("reclamacao");
  const [numero, setNumero] = useState("");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [secretariaId, setSecretariaId] = useState<string>("");
  const [localId, setLocalId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [solicitante, setSolicitante] = useState("");
  const [dataAbertura, setDataAbertura] = useState(new Date().toISOString().slice(0, 10));
  const [endereco, setEndereco] = useState("");
  const [textoColar, setTextoColar] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [sugestao, setSugestao] = useState<{ secretaria?: string; local?: string } | null>(null);
  const extrair = useServerFn(extrairProtocolo);
  const geocode = useServerFn(geocodeAddress);

  const respFiltrados = responsaveis.filter(r => !secretariaId || r.secretaria_id === secretariaId);
  const locaisFiltrados = locais.filter(l => !secretariaId || l.secretaria_id === secretariaId);

  async function handleExtrair() {
    if (!textoColar.trim()) return;
    setExtraindo(true);
    try {
      const r = await extrair({ data: { texto: textoColar } });
      if (r.numero) setNumero(r.numero);
      setTipo(r.tipo as TipoProtocolo);
      setCategoria(r.categoria as CategoriaProtocolo);
      if (r.assunto) setAssunto(r.assunto);
      if (r.descricao) setDescricao(r.descricao);
      if (r.solicitante) setSolicitante(r.solicitante);
      if (r.data_abertura) setDataAbertura(r.data_abertura);

      // tenta casar secretaria sugerida
      let secMatched = "";
      if (r.secretaria_sugerida) {
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const alvo = norm(r.secretaria_sugerida);
        const hit = secretarias.find(s => norm(s.nome).includes(alvo) || alvo.includes(norm(s.nome)) || (s.sigla && norm(s.sigla) === alvo));
        if (hit) { setSecretariaId(hit.id); secMatched = hit.id; }
      }
      if (r.local_sugerido && secMatched) {
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const alvo = norm(r.local_sugerido);
        const hit = locais.find(l => l.secretaria_id === secMatched && (norm(l.nome).includes(alvo) || alvo.includes(norm(l.nome))));
        if (hit) setLocalId(hit.id);
      }
      setSugestao({ secretaria: r.secretaria_sugerida, local: r.local_sugerido });
      toast.success("Dados extraídos. Revise antes de salvar.");
    } catch (e: any) {
      toast.error(e.message ?? "Falha na extração");
    } finally {
      setExtraindo(false);
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let lat: number | null = null;
      let lng: number | null = null;
      if (endereco.trim()) {
        try {
          const r = await geocode({ data: { endereco } });
          lat = r.lat;
          lng = r.lng;
          if (lat == null) toast.warning("Endereço não encontrado no mapa, salvando sem coordenadas.");
        } catch {
          toast.warning("Falha ao geocodificar o endereço.");
        }
      }
      const { error } = await supabase.from("protocolos").insert({
        numero: numero || gerarNumeroProtocolo(tipo),
        tipo, categoria, assunto, descricao: descricao || null,
        secretaria_id: secretariaId || null,
        local_id: localId || null,
        responsavel_id: responsavelId || null,
        solicitante: solicitante || null,
        data_abertura: dataAbertura,
        endereco: endereco || null,
        latitude: lat,
        longitude: lng,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["protocolos"] });
      toast.success("Protocolo cadastrado");
      setOpen(false);
      setNumero(""); setAssunto(""); setDescricao(""); setSecretariaId(""); setLocalId(""); setResponsavelId(""); setSolicitante(""); setEndereco("");
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
          <div className="rounded-md border-2 border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Extração automática com IA
            </div>
            <p className="text-xs text-muted-foreground">
              Cole o e-mail / texto do protocolo abaixo. A IA preenche os campos automaticamente. Revise antes de salvar.
            </p>
            <Textarea
              placeholder="Cole aqui o texto do protocolo, e-mail ou mensagem…"
              value={textoColar}
              onChange={e => setTextoColar(e.target.value)}
              rows={4}
            />
            <div className="flex items-center justify-between gap-2">
              <Button type="button" size="sm" onClick={handleExtrair} disabled={!textoColar.trim() || extraindo}>
                <Sparkles className="h-3 w-3 mr-1" />
                {extraindo ? "Extraindo…" : "Extrair dados"}
              </Button>
              {textoColar && (
                <Button type="button" size="sm" variant="ghost" onClick={() => { setTextoColar(""); setSugestao(null); }}>
                  Limpar
                </Button>
              )}
            </div>
            {sugestao && (sugestao.secretaria || sugestao.local) && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {sugestao.secretaria && <p>💡 Secretaria sugerida: <strong>{sugestao.secretaria}</strong></p>}
                {sugestao.local && <p>💡 Local sugerido: <strong>{sugestao.local}</strong></p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as TipoProtocolo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de abertura *</Label>
              <Input type="date" value={dataAbertura} onChange={e => setDataAbertura(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={v => setCategoria(v as CategoriaProtocolo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="font-mono mr-2">{c.sigla}</span>{c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={secretariaId} onValueChange={v => {
              setSecretariaId(v);
              const locaisDaSec = locais.filter(l => l.secretaria_id === v);
              setLocalId(locaisDaSec[0]?.id ?? "");
              const respDaSec = responsaveis.filter(r => r.secretaria_id === v);
              setResponsavelId(respDaSec[0]?.id ?? "");
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {secretarias.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Local / Centro de Custo</Label>
            <Select value={localId} onValueChange={setLocalId} disabled={!secretariaId}>
              <SelectTrigger><SelectValue placeholder={secretariaId ? "Selecione" : "Escolha uma secretaria"} /></SelectTrigger>
              <SelectContent>
                {locaisFiltrados.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}{l.centro_custo ? ` · ${l.centro_custo}` : ""}</SelectItem>)}
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