import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { MapPointPicker } from "@/components/map-point-picker";
import { geocodeAddress } from "@/lib/geocode.functions";
import { calcularPrazo, formatDate, type TipoProtocolo } from "@/lib/domain/prazo";
import { CATEGORIAS, type CategoriaProtocolo } from "@/lib/domain/categorias";
import { gerarNumeroProtocolo } from "@/lib/domain/protocolo-number";
import { invalidateProtocoloRelatedCaches } from "@/lib/query-keys";

type Secretaria = { id: string; nome: string };
type Local = { id: string; nome: string; secretaria_id: string };

export function NovoProtocoloDialog({
  secretarias,
  locais,
}: {
  secretarias: Secretaria[];
  locais: Local[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoProtocolo>("ouvidoria");
  const [categoria, setCategoria] = useState<CategoriaProtocolo>("reclamacao");
  const [numero, setNumero] = useState("");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [secretariaId, setSecretariaId] = useState("");
  const [localId, setLocalId] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [dataAbertura, setDataAbertura] = useState(new Date().toISOString().slice(0, 10));
  const [endereco, setEndereco] = useState("");
  const [enderecoCoords, setEnderecoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [enderecoExact, setEnderecoExact] = useState(false);
  const [confirmImprecise, setConfirmImprecise] = useState(false);
  const [forceSaveNoCoords, setForceSaveNoCoords] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const geocode = useServerFn(geocodeAddress);

  const locaisFiltrados = locais.filter((l) => !secretariaId || l.secretaria_id === secretariaId);

  function resetForm() {
    setNumero("");
    setAssunto("");
    setDescricao("");
    setSecretariaId("");
    setLocalId("");
    setSolicitante("");
    setEndereco("");
    setEnderecoCoords(null);
    setEnderecoExact(false);
    setForceSaveNoCoords(false);
  }

  const create = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let lat: number | null = null;
      let lng: number | null = null;
      if (enderecoCoords && enderecoExact) {
        lat = enderecoCoords.lat;
        lng = enderecoCoords.lng;
      } else if (!forceSaveNoCoords && endereco.trim()) {
        try {
          const r = await geocode({ data: { endereco } });
          lat = r.lat;
          lng = r.lng;
        } catch {
          toast.warning("Falha ao geocodificar o endereço.");
        }
      }
      const { error } = await supabase.from("protocolos").insert({
        numero: numero || gerarNumeroProtocolo(tipo),
        tipo,
        categoria,
        assunto,
        descricao: descricao || null,
        secretaria_id: secretariaId || null,
        local_id: localId || null,
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
      invalidateProtocoloRelatedCaches(qc);
      toast.success("Protocolo cadastrado");
      setOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleSubmit() {
    if (endereco.trim() && !(enderecoCoords && enderecoExact)) {
      try {
        const r = await geocode({ data: { endereco } });
        if (r.lat != null && r.exact) {
          setEnderecoCoords({ lat: r.lat, lng: r.lng! });
          setEnderecoExact(true);
          create.mutate();
          return;
        }
      } catch {
        // segue para confirmação
      }
      setConfirmImprecise(true);
      return;
    }
    create.mutate();
  }

  const previewPrazo = calcularPrazo({ tipo, data_abertura: dataAbertura, prorrogado: false });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> Novo protocolo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo protocolo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoProtocolo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
                  <SelectItem value="esic">e-SIC</SelectItem>
                  <SelectItem value="lai">LAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de abertura *</Label>
              <Input
                type="date"
                value={dataAbertura}
                onChange={(e) => setDataAbertura(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaProtocolo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="font-mono mr-2">{c.sigla}</span>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Número (auto se vazio)</Label>
            <Input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder={gerarNumeroProtocolo(tipo)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Assunto *</Label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Breve descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Solicitante</Label>
            <Input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Endereço (para mapa)</Label>
            <AddressAutocomplete
              value={endereco}
              onChange={(v) => {
                setEndereco(v);
                setEnderecoCoords(null);
                setEnderecoExact(false);
              }}
              onSelect={(s) => {
                setEndereco(s.label);
                setEnderecoCoords({ lat: s.lat, lng: s.lng });
                setEnderecoExact(s.exact !== false && !!s.houseNumber);
                if (!s.houseNumber) {
                  toast.warning(
                    'Sugestão sem número do imóvel. Inclua o número (ex.: "Rua X, 174") para um pino preciso.',
                  );
                }
              }}
              placeholder="Digite e selecione uma rua de Brusque…"
            />
            <p className="text-[11px] text-muted-foreground">
              Sugestões automáticas de ruas em Brusque/SC.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Secretaria</Label>
            <Select
              value={secretariaId}
              onValueChange={(v) => {
                setSecretariaId(v);
                setLocalId(locais.find((l) => l.secretaria_id === v)?.id ?? "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {secretarias.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Local</Label>
            <Select value={localId} onValueChange={setLocalId} disabled={!secretariaId}>
              <SelectTrigger>
                <SelectValue placeholder={secretariaId ? "Selecione" : "Escolha uma secretaria"} />
              </SelectTrigger>
              <SelectContent>
                {locaisFiltrados.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md bg-secondary p-3 text-xs">
            <strong>Prazo previsto:</strong> {formatDate(previewPrazo.prazoFinal)} (
            {previewPrazo.diasTotais} dias)
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!assunto || create.isPending}>
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmImprecise} onOpenChange={setConfirmImprecise}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Endereço sem localização precisa</AlertDialogTitle>
            <AlertDialogDescription>
              Não foi possível localizar este endereço com o número do imóvel. Para evitar um pino
              no meio da rua, você pode <strong>selecionar manualmente o ponto no mapa</strong> ou
              salvar o protocolo <strong>sem coordenadas</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Revisar endereço</AlertDialogCancel>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmImprecise(false);
                setPickerOpen(true);
              }}
            >
              Selecionar no mapa
            </Button>
            <AlertDialogAction
              onClick={() => {
                setForceSaveNoCoords(true);
                setConfirmImprecise(false);
                setTimeout(() => create.mutate(), 0);
              }}
            >
              Salvar sem mapa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MapPointPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initial={enderecoCoords}
        endereco={endereco}
        protocoloContext={{
          assunto,
          descricao,
          endereco,
          solicitante,
          secretaria: secretarias.find((s) => s.id === secretariaId)?.nome,
          local: locais.find((l) => l.id === localId)?.nome,
          categoria,
        }}
        onConfirm={(lat, lng) => {
          setEnderecoCoords({ lat, lng });
          setEnderecoExact(true);
          setForceSaveNoCoords(false);
          toast.success("Localização definida manualmente.");
          setTimeout(() => create.mutate(), 0);
        }}
      />
    </Dialog>
  );
}
