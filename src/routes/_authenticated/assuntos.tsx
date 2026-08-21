import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Tag, ArrowLeft, Search, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  useAssuntos,
  useAssuntoMutations,
  type Assunto,
} from "@/features/cadastros/hooks/use-assuntos";
import { useSecretarias } from "@/features/cadastros/hooks/use-secretarias";

const searchSchema = z.object({
  q: z.string().optional(),
  secretaria: z.string().optional(),
  ativo: z.enum(["all", "true", "false"]).optional(),
});

export const Route = createFileRoute("/_authenticated/assuntos")({
  validateSearch: zodValidator(searchSchema),
  component: AssuntosPage,
});

function AssuntosPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const q = search.q ?? "";
  const secFilter = search.secretaria ?? "all";
  const ativoFilter = search.ativo ?? "all";

  const setSearch = (next: Partial<typeof search>) =>
    navigate({ search: (prev: typeof search) => ({ ...prev, ...next }) });

  const { data: assuntos = [] } = useAssuntos();
  const { data: secretarias = [] } = useSecretarias();
  const { update, remove } = useAssuntoMutations();

  const grupos = useMemo(() => {
    const set = new Set<string>();
    assuntos.forEach((a) => {
      if (a.grupo) set.add(a.grupo);
    });
    return Array.from(set).sort();
  }, [assuntos]);

  const secMap = useMemo(
    () => Object.fromEntries(secretarias.map((s) => [s.id, s])),
    [secretarias],
  );

  const filtrados = useMemo(() => {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const qq = norm(q);
    return assuntos.filter((a) => {
      if (ativoFilter === "true" && !a.ativo) return false;
      if (ativoFilter === "false" && a.ativo) return false;
      if (secFilter === "none" && a.secretaria_id) return false;
      if (secFilter !== "all" && secFilter !== "none" && a.secretaria_id !== secFilter)
        return false;
      if (qq && !norm(`${a.nome} ${a.grupo ?? ""}`).includes(qq)) return false;
      return true;
    });
  }, [assuntos, q, secFilter, ativoFilter]);

  const semSec = assuntos.filter((a) => !a.secretaria_id && a.ativo).length;

  const [editAssunto, setEditAssunto] = useState<Assunto | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/secretarias">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Secretarias
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Catálogo de assuntos
            </h1>
            <p className="text-sm text-muted-foreground">
              {assuntos.length} assunto(s) · vinculados a secretarias para roteamento automático
              {semSec > 0 && (
                <span className="ml-2 text-amber-600">· {semSec} sem secretaria vinculada</span>
              )}
            </p>
          </div>
        </div>
        <NovoAssuntoDialog secretarias={secretarias} grupos={grupos} />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por assunto ou grupo…"
            value={q}
            onChange={(e) => setSearch({ q: e.target.value || undefined })}
            className="w-[260px] pl-7"
          />
        </div>
        <Select
          value={secFilter}
          onValueChange={(v) => setSearch({ secretaria: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as secretarias</SelectItem>
            <SelectItem value="none">Sem secretaria vinculada</SelectItem>
            {secretarias.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={ativoFilter}
          onValueChange={(v) =>
            setSearch({ ativo: v === "all" ? undefined : (v as "true" | "false") })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Ativos e inativos</SelectItem>
            <SelectItem value="true">Apenas ativos</SelectItem>
            <SelectItem value="false">Apenas inativos</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center ml-auto">
          {filtrados.length} resultado(s)
        </span>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/40 text-left">
                <th className="py-2 px-3 font-medium">Assunto</th>
                <th className="py-2 px-3 font-medium">Grupo</th>
                <th className="py-2 px-3 font-medium">Secretaria</th>
                <th className="py-2 px-3 font-medium text-center">Ativo</th>
                <th className="py-2 px-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum assunto encontrado.
                  </td>
                </tr>
              )}
              {filtrados.map((a) => (
                <tr
                  key={a.id}
                  className={`border-b hover:bg-secondary/30 ${!a.ativo ? "opacity-60" : ""}`}
                >
                  <td className="py-2 px-3 font-medium">{a.nome}</td>
                  <td className="py-2 px-3">
                    {a.grupo && (
                      <Badge variant="outline" className="text-[10px]">
                        {a.grupo}
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <Select
                      value={a.forcar_triagem ? "triagem" : (a.secretaria_id ?? "none")}
                      onValueChange={(v) => {
                        if (v === "triagem") {
                          update.mutate({
                            id: a.id,
                            patch: { secretaria_id: null, forcar_triagem: true },
                          });
                        } else {
                          update.mutate({
                            id: a.id,
                            patch: {
                              secretaria_id: v === "none" ? null : v,
                              forcar_triagem: false,
                            },
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-[240px]">
                        <SelectValue>
                          {a.forcar_triagem ? (
                            <span className="text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                              <Inbox className="h-3 w-3" /> Triagem manual
                            </span>
                          ) : a.secretaria_id ? (
                            (secMap[a.secretaria_id]?.nome ?? "—")
                          ) : (
                            <span className="text-amber-600">Sem vínculo</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="triagem">
                          🔍 Triagem manual (sempre cair na fila)
                        </SelectItem>
                        <SelectItem value="none">Sem vínculo</SelectItem>
                        {secretarias.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Switch
                      checked={a.ativo}
                      onCheckedChange={(v) => update.mutate({ id: a.id, patch: { ativo: v } })}
                    />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditAssunto(a)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Excluir "${a.nome}"?`)) {
                          remove.mutate(a, {
                            onError: (e: Error) => toast.error(e.message),
                          });
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <EditAssuntoDialog
        assunto={editAssunto}
        secretarias={secretarias}
        grupos={grupos}
        onClose={() => setEditAssunto(null)}
      />
    </div>
  );
}

function NovoAssuntoDialog({
  secretarias,
  grupos,
}: {
  secretarias: { id: string; nome: string }[];
  grupos: string[];
}) {
  const { create } = useAssuntoMutations();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState("");
  const [secId, setSecId] = useState("");
  const [ativo, setAtivo] = useState(true);

  function reset() {
    setOpen(false);
    setNome("");
    setGrupo("");
    setSecId("");
    setAtivo(true);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Novo assunto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo assunto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Foco de dengue"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Grupo</Label>
            <Input
              list="grupos-list"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              placeholder="Ex: Saúde"
            />
            <datalist id="grupos-list">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Secretaria vinculada</Label>
            <Select value={secId || "none"} onValueChange={(v) => setSecId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem vínculo</SelectItem>
                {secretarias.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={ativo} onCheckedChange={setAtivo} id="ativo-new" />
            <Label htmlFor="ativo-new" className="cursor-pointer">
              Ativo
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              create.mutate(
                { nome, grupo: grupo || null, secretaria_id: secId || null, ativo },
                { onSuccess: reset, onError: (e: Error) => toast.error(e.message) },
              )
            }
            disabled={!nome || create.isPending}
          >
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAssuntoDialog({
  assunto,
  secretarias,
  grupos,
  onClose,
}: {
  assunto: Assunto | null;
  secretarias: { id: string; nome: string }[];
  grupos: string[];
  onClose: () => void;
}) {
  const { update } = useAssuntoMutations();
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState("");
  const [secId, setSecId] = useState("");
  const [ativo, setAtivo] = useState(true);
  const open = !!assunto;

  useEffect(() => {
    if (assunto) {
      setNome(assunto.nome ?? "");
      setGrupo(assunto.grupo ?? "");
      setSecId(assunto.secretaria_id ?? "");
      setAtivo(!!assunto.ativo);
    }
  }, [assunto]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar assunto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Grupo</Label>
            <Input
              list="grupos-list-edit"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
            />
            <datalist id="grupos-list-edit">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Secretaria vinculada</Label>
            <Select value={secId || "none"} onValueChange={(v) => setSecId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem vínculo</SelectItem>
                {secretarias.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={ativo} onCheckedChange={setAtivo} id="ativo-edit" />
            <Label htmlFor="ativo-edit" className="cursor-pointer">
              Ativo
            </Label>
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
                  id: assunto!.id,
                  patch: { nome, grupo: grupo || null, secretaria_id: secId || null, ativo },
                },
                { onSuccess: onClose, onError: (e: Error) => toast.error(e.message) },
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
