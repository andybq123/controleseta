import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Inbox, Eye, CheckCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { fetchAllPaginated } from "@/lib/fetch-all";
import { compararNumeroProtocolo } from "@/lib/domain/protocolo-number";
import { formatDate, PRAZOS } from "@/lib/domain/prazo";
import { categoriaLabel, categoriaBadgeClass } from "@/lib/domain/categorias";
import { queryKeys, invalidateProtocoloRelatedCaches } from "@/lib/query-keys";
import { concluirTriagem } from "@/features/triagem/api";
import { MotivoTriagemBadge } from "@/features/triagem/components/motivo-triagem-badge";
import { ProtocoloDetailDialog } from "@/features/protocolos/components/protocolo-detail-dialog";
import { useSecretarias } from "@/features/cadastros/hooks/use-secretarias";
import { useLocais } from "@/features/cadastros/hooks/use-locais";
import type { ProtocoloRow } from "@/features/protocolos/types";

export const Route = createFileRoute("/_authenticated/tarefas")({
  component: TarefasPage,
});

type TarefaRow = ProtocoloRow & { lock_profile?: { nome: string } | null };

const LOCK_TTL_MS = 10 * 60 * 1000;
function isLockAtivo(p: Pick<TarefaRow, "triagem_lock_em" | "triagem_lock_por">) {
  if (!p.triagem_lock_em || !p.triagem_lock_por) return false;
  return Date.now() - new Date(p.triagem_lock_em).getTime() < LOCK_TTL_MS;
}

function TarefasPage() {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<TarefaRow | null>(null);
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchSec, setBatchSec] = useState("");
  const [batchLocal, setBatchLocal] = useState("");

  const { data: protocolos = [] } = useQuery({
    queryKey: queryKeys.triagem.fila(),
    queryFn: async () => {
      const rows = await fetchAllPaginated<TarefaRow>((from, to) =>
        supabase
          .from("protocolos")
          .select(
            "*, secretarias(nome, sigla), locais(nome), lock_profile:profiles!protocolos_triagem_lock_por_fkey(nome)",
          )
          .eq("triagem_pendente", true)
          .order("data_abertura", { ascending: false })
          .range(from, to),
      );
      return [...rows].sort(compararNumeroProtocolo);
    },
    refetchInterval: 30_000,
  });

  const { data: meId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });

  const { data: secretarias = [] } = useSecretarias();
  const { data: locais = [] } = useLocais();

  const filtrados = protocolos.filter((p) => {
    if (!busca) return true;
    const s = busca.toLowerCase();
    return `${p.numero} ${p.assunto} ${p.solicitante ?? ""}`.toLowerCase().includes(s);
  });

  const selecionaveis = filtrados.filter((p) => !(isLockAtivo(p) && p.triagem_lock_por !== meId));
  const locaisFiltrados = locais.filter((l) => !batchSec || l.secretaria_id === batchSec);

  const batchMut = useMutation({
    mutationFn: async () => {
      if (!batchSec) throw new Error("Selecione a secretaria");
      if (selected.size === 0) throw new Error("Selecione ao menos um protocolo");
      let ok = 0;
      const conflitos: string[] = [];
      for (const id of Array.from(selected)) {
        try {
          const r = await concluirTriagem({
            protocoloId: id,
            secretariaId: batchSec,
            localId: batchLocal || null,
          });
          if (r.ok) ok++;
          else
            conflitos.push(
              r.motivo === "concluida"
                ? `já concluída por ${r.por_nome}`
                : `reservada por ${r.por_nome}`,
            );
        } catch (e) {
          conflitos.push(`${id.slice(0, 8)}: ${e instanceof Error ? e.message : "erro"}`);
        }
      }
      return { ok, conflitos };
    },
    onSuccess: ({ ok, conflitos }) => {
      if (ok > 0) toast.success(`${ok} protocolo(s) triados.`);
      if (conflitos.length > 0)
        toast.warning(`${conflitos.length} pulado(s): ${conflitos.slice(0, 3).join("; ")}`);
      setSelected(new Set());
      setBatchSec("");
      setBatchLocal("");
      invalidateProtocoloRelatedCaches(qc);
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao triar em lote"),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selected.size === selecionaveis.length) setSelected(new Set());
    else setSelected(new Set(selecionaveis.map((p) => p.id)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Tarefas — Triagem
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtrados.length} ouvidoria(s) aguardando triagem. Defina secretaria/local e salve para
            enviar ao módulo correspondente.
          </p>
        </div>
        <Input
          placeholder="Buscar nº, assunto, solicitante…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-[280px]"
        />
      </div>

      {selected.size > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3 px-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-medium">
              {selected.size} selecionado(s)
            </Badge>
            <Select
              value={batchSec}
              onValueChange={(v) => {
                setBatchSec(v);
                setBatchLocal("");
              }}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Secretaria…" />
              </SelectTrigger>
              <SelectContent>
                {secretarias.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={batchLocal || "none"}
              onValueChange={(v) => setBatchLocal(v === "none" ? "" : v)}
              disabled={!batchSec}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Local/Área (opcional)…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem local —</SelectItem>
                {locaisFiltrados.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => batchMut.mutate()}
              disabled={!batchSec || batchMut.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" /> Concluir triagem em lote
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </Button>
          </CardContent>
        </Card>
      )}

      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma ouvidoria aguardando triagem.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground pl-2 cursor-pointer">
            <Checkbox
              checked={selected.size > 0 && selected.size === filtrados.length}
              onCheckedChange={toggleAll}
            />
            Selecionar todos
          </label>
          {filtrados.map((p) => (
            <Card
              key={p.id}
              className={`hover:bg-accent/30 transition-colors ${isLockAtivo(p) && p.triagem_lock_por !== meId ? "opacity-70" : ""}`}
            >
              <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isLockAtivo(p) && p.triagem_lock_por !== meId}
                />
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {PRAZOS[p.tipo as keyof typeof PRAZOS].label}
                    </Badge>
                    <Badge className={`text-[10px] ${categoriaBadgeClass(p.categoria)}`}>
                      {categoriaLabel(p.categoria)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/10"
                    >
                      triagem pendente
                    </Badge>
                    <MotivoTriagemBadge protocolo={p} />
                    {isLockAtivo(p) && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-blue-500/50 text-blue-700 dark:text-blue-300 bg-blue-500/10 gap-1"
                      >
                        <Lock className="h-3 w-3" />
                        {p.triagem_lock_por === meId
                          ? "você está triando"
                          : `em triagem por ${p.lock_profile?.nome ?? "outro usuário"}`}
                      </Badge>
                    )}
                  </div>
                  <div className="font-medium text-sm">{p.assunto}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Aberto em {formatDate(p.data_abertura)} ·{" "}
                    {p.solicitante ?? "Solicitante não informado"}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setDetail(p)}
                  variant={isLockAtivo(p) && p.triagem_lock_por !== meId ? "outline" : "default"}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {isLockAtivo(p) && p.triagem_lock_por !== meId ? "Visualizar" : "Triar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProtocoloDetailDialog
        protocolo={detail}
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
          invalidateProtocoloRelatedCaches(qc);
        }}
      />
    </div>
  );
}
