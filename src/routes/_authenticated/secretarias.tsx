import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Building2, Trash2, MapPin, Pencil, Tag } from "lucide-react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { SECRETARIA_ICONES } from "@/components/manifestacoes-map";
import {
  useSecretarias,
  useSecretariaMutations,
  type Secretaria,
} from "@/features/cadastros/hooks/use-secretarias";
import { useLocais, useLocalMutations, type Local } from "@/features/cadastros/hooks/use-locais";

export const Route = createFileRoute("/_authenticated/secretarias")({
  component: SecretariasPage,
});

function SecretariasPage() {
  const { data: secretarias = [] } = useSecretarias();
  const { data: locais = [] } = useLocais();
  const { remove: delSec } = useSecretariaMutations();
  const { create: addLocal, update: updateLocal, remove: delLocal } = useLocalMutations();

  const { data: assuntos = [] } = useQuery({
    queryKey: ["assuntos-count"],
    queryFn: async () =>
      (await supabase.from("assuntos").select("id,secretaria_id,nome").eq("ativo", true)).data ??
      [],
  });
  const { data: protocolosOpen = [] } = useQuery({
    queryKey: ["protocolos-open-count"],
    queryFn: async () =>
      (
        await supabase
          .from("protocolos")
          .select("id,secretaria_id,status")
          .neq("status", "concluido")
      ).data ?? [],
  });

  const countAssuntos = useMemo(() => {
    const m: Record<string, number> = {};
    assuntos.forEach((a) => {
      if (a.secretaria_id) m[a.secretaria_id] = (m[a.secretaria_id] ?? 0) + 1;
    });
    return m;
  }, [assuntos]);
  const countAbertos = useMemo(() => {
    const m: Record<string, number> = {};
    protocolosOpen.forEach((p) => {
      if (p.secretaria_id) m[p.secretaria_id] = (m[p.secretaria_id] ?? 0) + 1;
    });
    return m;
  }, [protocolosOpen]);

  const [editSec, setEditSec] = useState<Secretaria | null>(null);
  const [editLocal, setEditLocal] = useState<Local | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secretarias</h1>
          <p className="text-sm text-muted-foreground">
            {secretarias.length} secretaria(s) · {locais.length} local(is)
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/assuntos">
              <Tag className="h-4 w-4 mr-1" />
              Catálogo de assuntos
            </Link>
          </Button>
          <NovaSecretariaDialog />
        </div>
      </div>

      {secretarias.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Cadastre a primeira secretaria.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {secretarias.map((s) => {
          const locs = locais.filter((l) => l.secretaria_id === s.id);
          const nAss = countAssuntos[s.id] ?? 0;
          const nAb = countAbertos[s.id] ?? 0;
          return (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2 min-w-0">
                    {s.icone && SECRETARIA_ICONES[s.icone] ? (
                      <span title={SECRETARIA_ICONES[s.icone].label}>
                        {SECRETARIA_ICONES[s.icone].emoji}
                      </span>
                    ) : (
                      <Building2 className="h-4 w-4 text-primary" />
                    )}
                    <span className="truncate">{s.nome}</span>
                    {s.sigla && (
                      <span className="text-xs text-muted-foreground font-normal">({s.sigla})</span>
                    )}
                  </CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setEditSec(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Excluir secretaria?")) delSec.mutate(s.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Link to="/assuntos" search={{ secretaria: s.id }} className="no-underline">
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                      <Tag className="h-3 w-3 mr-1" />
                      {nAss} assunto(s)
                    </Badge>
                  </Link>
                  <Badge variant={nAb > 0 ? "destructive" : "outline"}>{nAb} aberto(s)</Badge>
                </div>
                {s.endereco && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {s.endereco}
                    {s.latitude == null && (
                      <span className="ml-1 text-amber-600">(sem coordenadas)</span>
                    )}
                  </p>
                )}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Locais / Unidades</div>
                  {locs.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Sem locais cadastrados.</p>
                  )}
                  {locs.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-md border px-2 py-1 text-sm"
                    >
                      <span>{l.nome}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditLocal(l)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => delLocal.mutate(l.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <AddLocalInline
                    onAdd={(nome) => addLocal.mutate({ secretaria_id: s.id, nome })}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <EditSecretariaDialog secretaria={editSec} onClose={() => setEditSec(null)} />
      <EditLocalDialog
        local={editLocal}
        onClose={() => setEditLocal(null)}
        onUpdate={(id, nome) => updateLocal.mutate({ id, patch: { nome } })}
      />
    </div>
  );
}

function NovaSecretariaDialog() {
  const { create } = useSecretariaMutations();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [endereco, setEndereco] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [icone, setIcone] = useState("administracao");
  const { create: addLocal } = useLocalMutations();

  function reset() {
    setOpen(false);
    setNome("");
    setSigla("");
    setEndereco("");
    setCoords(null);
    setIcone("administracao");
  }

  async function handleCreate() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    create.mutate(
      {
        nome,
        sigla: sigla || null,
        endereco: endereco || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        icone,
        created_by: user?.id,
      },
      {
        onSuccess: (data) => {
          if (data) addLocal.mutate({ secretaria_id: data.id, nome });
          reset();
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Nova secretaria
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova secretaria</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sigla</Label>
            <Input
              value={sigla}
              onChange={(e) => setSigla(e.target.value)}
              placeholder="Ex: SEMSA"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ícone no mapa</Label>
            <Select value={icone} onValueChange={setIcone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SECRETARIA_ICONES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.emoji} {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Endereço da secretaria</Label>
            <AddressAutocomplete
              value={endereco}
              onChange={(v) => {
                setEndereco(v);
                setCoords(null);
              }}
              onSelect={(s) => {
                setEndereco(s.label);
                setCoords({ lat: s.lat, lng: s.lng });
              }}
              placeholder="Rua, número, bairro"
            />
            {endereco && !coords && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Selecione uma sugestão para gravar no mapa.
              </p>
            )}
            {coords && (
              <p className="text-[11px] text-muted-foreground">
                Coordenadas: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!nome || create.isPending}>
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLocalInline({ onAdd }: { onAdd: (nome: string) => void }) {
  const [nome, setNome] = useState("");
  return (
    <div className="flex gap-1.5 pt-1">
      <Input
        placeholder="Novo local / unidade"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="h-8 text-xs"
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        disabled={!nome}
        onClick={() => {
          onAdd(nome);
          setNome("");
        }}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

function EditSecretariaDialog({
  secretaria,
  onClose,
}: {
  secretaria: Secretaria | null;
  onClose: () => void;
}) {
  const { update } = useSecretariaMutations();
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [endereco, setEndereco] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [icone, setIcone] = useState("administracao");
  const open = !!secretaria;

  useEffect(() => {
    if (secretaria) {
      setNome(secretaria.nome ?? "");
      setSigla(secretaria.sigla ?? "");
      setEndereco(secretaria.endereco ?? "");
      setCoords(
        secretaria.latitude != null && secretaria.longitude != null
          ? { lat: secretaria.latitude, lng: secretaria.longitude }
          : null,
      );
      setIcone(secretaria.icone ?? "administracao");
    }
  }, [secretaria]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar secretaria</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sigla</Label>
            <Input value={sigla} onChange={(e) => setSigla(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ícone no mapa</Label>
            <Select value={icone} onValueChange={setIcone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SECRETARIA_ICONES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.emoji} {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Endereço</Label>
            <AddressAutocomplete
              value={endereco}
              onChange={(v) => {
                setEndereco(v);
                setCoords(null);
              }}
              onSelect={(s) => {
                setEndereco(s.label);
                setCoords({ lat: s.lat, lng: s.lng });
              }}
              placeholder="Rua, número, bairro"
            />
            {coords && (
              <p className="text-[11px] text-muted-foreground">
                Coordenadas: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              update.mutate(
                {
                  id: secretaria!.id,
                  patch: {
                    nome,
                    sigla: sigla || null,
                    endereco: endereco || null,
                    latitude: coords?.lat ?? null,
                    longitude: coords?.lng ?? null,
                    icone,
                  },
                },
                { onSuccess: onClose },
              )
            }
            disabled={!nome || update.isPending}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLocalDialog({
  local,
  onClose,
  onUpdate,
}: {
  local: Local | null;
  onClose: () => void;
  onUpdate: (id: string, nome: string) => void;
}) {
  const [nome, setNome] = useState("");
  const open = !!local;
  useEffect(() => {
    if (local) setNome(local.nome ?? "");
  }, [local]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar local</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onUpdate(local!.id, nome);
              onClose();
            }}
            disabled={!nome}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
