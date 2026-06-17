import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MapPointPicker } from "@/components/map-point-picker";
import { CATEGORIAS, gerarNumeroProtocolo, type CategoriaProtocolo } from "@/lib/prazo";
import { ASSUNTOS_OUVIDORIA } from "@/lib/assuntos-ouvidoria";
import { MapPin, CheckCircle2, ShieldAlert, Eye, EyeOff, UserX, Send, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ouvidoria")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ouvidoria — Registre sua manifestação" },
      { name: "description", content: "Canal de ouvidoria do município. Registre denúncias, reclamações, elogios, sugestões e pedidos de informação — de forma pública, sigilosa ou anônima." },
      { property: "og:title", content: "Ouvidoria — Registre sua manifestação" },
      { property: "og:description", content: "Canal oficial de ouvidoria. Manifestações públicas, sigilosas ou anônimas." },
    ],
  }),
  component: OuvidoriaPublicaPage,
});

type Sigilo = "publico" | "sigiloso" | "anonimo";

function OuvidoriaPublicaPage() {
  const [sigilo, setSigilo] = useState<Sigilo>("publico");
  const [categoria, setCategoria] = useState<CategoriaProtocolo>("reclamacao");
  const [secretariaId, setSecretariaId] = useState<string>("");
  const [localId, setLocalId] = useState<string>("");
  const [grupoAssunto, setGrupoAssunto] = useState("");
  const [assuntoEspecifico, setAssuntoEspecifico] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sucesso, setSucesso] = useState<{ numero: string; id: string } | null>(null);

  const itensDoGrupo = ASSUNTOS_OUVIDORIA.find((a) => a.grupo === grupoAssunto)?.itens ?? [];

  const { data: secretarias = [] } = useQuery({
    queryKey: ["pub-secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("id,nome,sigla").order("nome")).data ?? [],
  });
  const { data: locais = [] } = useQuery({
    queryKey: ["pub-locais"],
    queryFn: async () => (await supabase.from("locais").select("id,nome,secretaria_id").order("nome")).data ?? [],
  });
  const locaisFiltrados = locais.filter(l => !secretariaId || l.secretaria_id === secretariaId);

  const enviar = useMutation({
    mutationFn: async () => {
      if (!grupoAssunto) throw new Error("Selecione a área/assunto.");
      if (!assuntoEspecifico) throw new Error("Selecione o assunto específico.");
      if (!descricao.trim()) throw new Error("Descreva sua manifestação.");
      if (sigilo !== "anonimo" && !nome.trim()) throw new Error("Informe seu nome.");
      if (sigilo === "publico") {
        if (!cpf.trim()) throw new Error("Informe seu CPF.");
        if (!telefone.trim() && !email.trim()) throw new Error("Informe telefone ou e-mail para contato.");
      }
      if (sigilo === "sigiloso" && !telefone.trim() && !email.trim()) {
        throw new Error("Informe telefone ou e-mail para retorno sigiloso.");
      }

      const numero = gerarNumeroProtocolo("ouvidoria");
      const contatoPartes = [
        cpf.trim() ? `CPF: ${cpf.trim()}` : null,
        telefone.trim() ? `Tel: ${telefone.trim()}` : null,
        email.trim() ? `Email: ${email.trim()}` : null,
      ].filter(Boolean);
      const contatoStr = contatoPartes.join(" | ");
      const solicitante =
        sigilo === "anonimo"
          ? "Anônimo"
          : nome.trim() + (sigilo === "publico" && (email.trim() || telefone.trim()) ? ` <${email.trim() || telefone.trim()}>` : "");

      const assuntoTexto = assuntoEspecifico === grupoAssunto ? assuntoEspecifico : `${grupoAssunto} — ${assuntoEspecifico}`;

      const payload = {
        numero,
        tipo: "ouvidoria" as const,
        categoria,
        status: "aberto" as const,
        assunto: assuntoTexto,
        descricao: descricao.trim(),
        secretaria_id: secretariaId || null,
        local_id: localId || null,
        solicitante,
        sigilo,
        contato_solicitante: sigilo === "anonimo" ? null : (contatoStr || null),
        endereco: endereco.trim() || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        origem: "Site - Ouvidoria Pública",
        data_abertura: new Date().toISOString().slice(0, 10),
        created_by: null,
      };

      const { data, error } = await supabase
        .from("protocolos")
        .insert(payload)
        .select("id,numero")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      setSucesso({ numero: d.numero, id: d.id });
      toast.success("Manifestação registrada com sucesso!");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar manifestação."),
  });

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-2">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl">Manifestação registrada</CardTitle>
            <CardDescription>
              Sua manifestação foi protocolada e será analisada pela equipe responsável.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Número do protocolo</p>
              <p className="font-mono text-2xl font-bold text-primary mt-1">{sucesso.numero}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(sucesso.numero);
                  toast.success("Número copiado!");
                }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Guarde este número para acompanhar o andamento da sua manifestação.
            </p>
            <Button className="w-full" onClick={() => { setSucesso(null); resetForm(); }}>
              Registrar outra manifestação
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  function resetForm() {
    setSigilo("publico");
    setCategoria("reclamacao");
    setSecretariaId("");
    setLocalId("");
    setGrupoAssunto("");
    setAssuntoEspecifico("");
    setDescricao("");
    setNome("");
    setCpf("");
    setTelefone("");
    setEmail("");
    setEndereco("");
    setCoords(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight">Ouvidoria Municipal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Canal oficial para registrar elogios, reclamações, denúncias, sugestões e pedidos de informação.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> Tipo de manifestação
            </CardTitle>
            <CardDescription>Escolha como deseja se identificar nesta manifestação.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={sigilo} onValueChange={(v) => setSigilo(v as Sigilo)} className="grid gap-3 md:grid-cols-3">
              <label
                htmlFor="sig-pub"
                className={`cursor-pointer rounded-lg border-2 p-4 transition ${sigilo === "publico" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <RadioGroupItem id="sig-pub" value="publico" />
                  <Eye className="h-4 w-4" />
                  <span className="font-medium">Pública</span>
                </div>
                <p className="text-xs text-muted-foreground">Sua identificação fica visível para a equipe e para o setor responsável.</p>
              </label>
              <label
                htmlFor="sig-sig"
                className={`cursor-pointer rounded-lg border-2 p-4 transition ${sigilo === "sigiloso" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <RadioGroupItem id="sig-sig" value="sigiloso" />
                  <EyeOff className="h-4 w-4" />
                  <span className="font-medium">Sigilosa</span>
                </div>
                <p className="text-xs text-muted-foreground">Sua identidade é preservada e tratada com sigilo pela ouvidoria.</p>
              </label>
              <label
                htmlFor="sig-anon"
                className={`cursor-pointer rounded-lg border-2 p-4 transition ${sigilo === "anonimo" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <RadioGroupItem id="sig-anon" value="anonimo" />
                  <UserX className="h-4 w-4" />
                  <span className="font-medium">Anônima</span>
                </div>
                <p className="text-xs text-muted-foreground">Nenhum dado pessoal é registrado. Você não receberá retorno individual.</p>
              </label>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sobre a manifestação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Tipo de solicitação *</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaProtocolo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Secretaria / Setor</Label>
                <Select value={secretariaId || "none"} onValueChange={(v) => { setSecretariaId(v === "none" ? "" : v); setLocalId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não sei / Não se aplica</SelectItem>
                    {secretarias.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}{s.sigla ? ` (${s.sigla})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Local / Unidade</Label>
                <Select value={localId || "none"} onValueChange={(v) => setLocalId(v === "none" ? "" : v)} disabled={!secretariaId}>
                  <SelectTrigger><SelectValue placeholder={secretariaId ? "Selecione" : "Escolha a secretaria primeiro"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {locaisFiltrados.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Área / Tema *</Label>
                <Select value={grupoAssunto || "none"} onValueChange={(v) => { setGrupoAssunto(v === "none" ? "" : v); setAssuntoEspecifico(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {ASSUNTOS_OUVIDORIA.map((a) => (
                      <SelectItem key={a.grupo} value={a.grupo}>{a.grupo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assunto específico *</Label>
                <Select value={assuntoEspecifico || "none"} onValueChange={(v) => setAssuntoEspecifico(v === "none" ? "" : v)} disabled={!grupoAssunto}>
                  <SelectTrigger><SelectValue placeholder={grupoAssunto ? "Selecione" : "Escolha a área primeiro"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {itensDoGrupo.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descrição detalhada *</Label>
              <Textarea
                rows={6}
                maxLength={3000}
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descreva o que aconteceu, quando, onde e quem está envolvido."
              />
              <p className="text-[11px] text-muted-foreground text-right">{descricao.length}/3000</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Localização (opcional)
            </CardTitle>
            <CardDescription>
              Informe o endereço relacionado à manifestação. Você também pode marcar o ponto exato no mapa.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label>Endereço</Label>
              <Input
                value={endereco}
                onChange={e => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
                <MapPin className="h-4 w-4 mr-1" /> {coords ? "Ajustar ponto no mapa" : "Marcar ponto no mapa"}
              </Button>
              {coords && (
                <span className="text-xs text-muted-foreground">
                  📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
              )}
              {coords && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCoords(null)}>Remover</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-10">
          <Button
            size="lg"
            onClick={() => enviar.mutate()}
            disabled={enviar.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            {enviar.isPending ? "Enviando…" : "Enviar manifestação"}
          </Button>
        </div>
      </main>

      <MapPointPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initial={coords}
        endereco={endereco}
        onConfirm={(lat, lng) => setCoords({ lat, lng })}
        protocoloContext={{
          assunto: assuntoEspecifico || grupoAssunto || "",
          descricao,
          endereco,
          secretaria: secretarias.find(s => s.id === secretariaId)?.nome,
          local: locaisFiltrados.find(l => l.id === localId)?.nome,
          categoria,
        }}
      />
    </div>
  );
}