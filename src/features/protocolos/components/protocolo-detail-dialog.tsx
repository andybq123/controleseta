import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { queryKeys, invalidateProtocoloRelatedCaches } from "@/lib/query-keys";
import {
  situacaoProtocolo,
  situacaoClasses,
  situacaoLabel,
  formatDate,
  PRAZOS,
} from "@/lib/domain/prazo";
import { categoriaLabel, categoriaBadgeClass } from "@/lib/domain/categorias";
import { reservarTriagem, liberarTriagem, concluirTriagem } from "@/features/triagem/api";
import { useSecretarias } from "@/features/cadastros/hooks/use-secretarias";
import { useLocais } from "@/features/cadastros/hooks/use-locais";
import {
  ProtocoloDetailView,
  ProtocoloDetailEdit,
  type ProtocoloForm,
} from "./detail/protocolo-detail-fields";
import { ProtocoloDetailHistorico, type HistoricoItem } from "./detail/protocolo-detail-historico";
import { ProtocoloDetailActions } from "./detail/protocolo-detail-actions";
import type { ProtocoloRow } from "@/features/protocolos/types";

type LockState =
  | { kind: "idle" }
  | { kind: "mine" }
  | { kind: "reservada"; por: string; em: string }
  | { kind: "concluida"; por: string; em: string };

export function ProtocoloDetailDialog({
  protocolo: protocoloProp,
  open,
  onOpenChange,
}: {
  protocolo: ProtocoloRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProtocoloForm>({} as ProtocoloForm);
  const [concluirOpen, setConcluirOpen] = useState(false);
  const [concluirData, setConcluirData] = useState("");
  const [lockState, setLockState] = useState<LockState>({ kind: "idle" });
  const [tooltipAberto, setTooltipAberto] = useState<string | null>(null);
  const [tooltipsLiberados, setTooltipsLiberados] = useState(false);

  const isLegacyProp = protocoloProp?.__antigo === true;

  const { data: protocoloFresh } = useQuery({
    queryKey: queryKeys.protocolos.detail(protocoloProp?.id ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocolos")
        .select("*, secretarias(nome, sigla), locais(nome)")
        .eq("id", protocoloProp.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!protocoloProp?.id && !isLegacyProp,
  });
  const protocolo = protocoloFresh ?? protocoloProp;
  const isLegacy = protocolo?.__antigo === true;

  // Tenta reservar a triagem ao abrir; libera ao fechar.
  useEffect(() => {
    if (!open || !protocolo?.id || !protocolo?.triagem_pendente) {
      setLockState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await reservarTriagem(protocolo.id);
      if (cancelled) return;
      if (r.ok) setLockState({ kind: "mine" });
      else if (r.motivo === "concluida")
        setLockState({ kind: "concluida", por: r.por_nome ?? "outro usuário", em: r.em ?? "" });
      else if (r.motivo === "reservada")
        setLockState({ kind: "reservada", por: r.por_nome ?? "outro usuário", em: r.em ?? "" });
    })();
    return () => {
      cancelled = true;
      if (protocolo?.id) void liberarTriagem(protocolo.id);
    };
  }, [open, protocolo?.id, protocolo?.triagem_pendente]);

  const lockBloqueia = lockState.kind === "reservada" || lockState.kind === "concluida";

  useEffect(() => {
    setTooltipAberto(null);
    setTooltipsLiberados(false);
    if (!open) return;
    const timer = window.setTimeout(() => setTooltipsLiberados(true), 700);
    return () => window.clearTimeout(timer);
  }, [open, protocolo?.id]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editing) {
        e.stopPropagation();
        setEditing(false);
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if (protocolo?.triagem_pendente && editing && !lockBloqueia) {
          e.preventDefault();
          void handleConcluirTriagem();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, protocolo?.triagem_pendente, lockBloqueia]);

  const { data: secretarias = [] } = useSecretarias();
  const { data: locais = [] } = useLocais();
  const { data: historico = [] } = useQuery({
    queryKey: ["protocolo-historico", protocolo?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("protocolo_historico")
        .select("*")
        .eq("protocolo_id", protocolo.id)
        .order("created_at", { ascending: false });
      return (data as HistoricoItem[]) ?? [];
    },
    enabled: open && !!protocolo?.id && !isLegacy,
  });

  useEffect(() => {
    if (protocolo) {
      setForm({
        numero: protocolo.numero ?? "",
        tipo: protocolo.tipo,
        categoria: protocolo.categoria,
        status: protocolo.status,
        assunto: protocolo.assunto ?? "",
        descricao: protocolo.triagem_pendente ? "" : (protocolo.descricao ?? ""),
        solicitante: protocolo.solicitante ?? "",
        secretaria_id: protocolo.secretaria_id ?? "",
        local_id: protocolo.local_id ?? "",
        data_abertura: protocolo.data_abertura ?? "",
        data_conclusao: protocolo.data_conclusao ?? "",
        data_prorrogacao: protocolo.data_prorrogacao ?? "",
        prorrogado: !!protocolo.prorrogado,
        endereco: protocolo.endereco ?? "",
      });
      setEditing(!!protocolo.triagem_pendente);
    }
  }, [protocolo]);

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("protocolos").update(patch).eq("id", protocolo.id);
      if (error) throw error;
      return patch;
    },
    onSuccess: (patch) => {
      invalidateProtocoloRelatedCaches(qc);
      qc.invalidateQueries({ queryKey: ["protocolo-historico", protocolo.id] });
      const mudouConclusao = "data_conclusao" in patch || "status" in patch;
      toast.success(
        mudouConclusao ? "Protocolo atualizado — KPIs recalculados" : "Protocolo atualizado",
      );
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("protocolos").delete().eq("id", protocolo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateProtocoloRelatedCaches(qc);
      toast.success("Protocolo removido");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao excluir"),
  });

  if (!protocolo) return null;
  const s = situacaoProtocolo(protocolo);

  function handleSave() {
    update.mutate(
      {
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
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  function handleConcluir() {
    setConcluirData(new Date().toISOString().slice(0, 10));
    setConcluirOpen(true);
  }
  function confirmarConclusao() {
    if (!concluirData) return toast.error("Informe a data de conclusão.");
    if (protocolo?.data_abertura && concluirData < protocolo.data_abertura) {
      return toast.error("A data de conclusão não pode ser anterior à abertura.");
    }
    const hoje = new Date().toISOString().slice(0, 10);
    if (concluirData > hoje) return toast.error("A data de conclusão não pode ser futura.");
    update.mutate(
      { status: "concluido", data_conclusao: concluirData },
      {
        onSuccess: () => {
          setConcluirOpen(false);
          setEditing(false);
          onOpenChange(false);
        },
      },
    );
  }
  function handleReabrir() {
    update.mutate({ status: "em_andamento", data_conclusao: null });
  }
  function handleProrrogar() {
    update.mutate({ prorrogado: true, data_prorrogacao: new Date().toISOString().slice(0, 10) });
  }

  async function handleConcluirTriagem() {
    if (!form.secretaria_id) return toast.error("Defina a secretaria antes de concluir a triagem.");
    const relato = (form.descricao ?? "").trim();
    if (relato.length < 5) {
      return toast.error("Informe uma descrição (breve relato) antes de concluir a triagem.");
    }
    const { error: upErr } = await supabase
      .from("protocolos")
      .update({
        descricao: relato,
        tipo: form.tipo,
        categoria: form.categoria,
        assunto: form.assunto,
      })
      .eq("id", protocolo.id);
    if (upErr) return toast.error(upErr.message);

    try {
      const r = await concluirTriagem({
        protocoloId: protocolo.id,
        secretariaId: form.secretaria_id,
        localId: form.local_id || null,
      });
      if (r.ok) {
        toast.success("Triagem concluída. Protocolo enviado ao módulo correspondente.");
        invalidateProtocoloRelatedCaches(qc);
        onOpenChange(false);
      } else if (r.motivo === "concluida") {
        toast.error(`Já triada por ${r.por_nome} em ${new Date(r.em!).toLocaleString("pt-BR")}.`);
        setLockState({ kind: "concluida", por: r.por_nome ?? "outro usuário", em: r.em ?? "" });
      } else {
        toast.error(
          `Reservada por ${r.por_nome} desde ${new Date(r.em!).toLocaleString("pt-BR")}.`,
        );
        setLockState({ kind: "reservada", por: r.por_nome ?? "outro usuário", em: r.em ?? "" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a triagem.");
    }
  }

  const wrapTooltip = (id: string, children: React.ReactNode, text: string) => (
    <Tooltip key={id} open={tooltipAberto === id}>
      <TooltipTrigger asChild>
        <span
          tabIndex={-1}
          className="inline-flex"
          onMouseEnter={() => tooltipsLiberados && setTooltipAberto(id)}
          onMouseLeave={() => setTooltipAberto(null)}
          onMouseDown={() => setTooltipAberto(null)}
          onFocus={() => setTooltipAberto(null)}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" onPointerDownOutside={() => setTooltipAberto(null)}>
        {text}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">{protocolo.numero}</span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {PRAZOS[protocolo.tipo as keyof typeof PRAZOS].label}
              </Badge>
              <Badge
                className={`text-[10px] ${categoriaBadgeClass(protocolo.categoria)}`}
                title={categoriaLabel(protocolo.categoria)}
              >
                {categoriaLabel(protocolo.categoria)}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] border ${situacaoClasses[s.situacao]}`}
              >
                {situacaoLabel[s.situacao]} ·{" "}
                {s.dias < 0 ? `${Math.abs(s.dias)}d atrasado` : `${s.dias}d`}
              </Badge>
              {protocolo.prorrogado && (
                <Badge variant="outline" className="text-[10px]">
                  prorrogado
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {lockState.kind === "reservada" && (
            <div className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm text-blue-900 dark:text-blue-200">
              Esta tarefa está em triagem por <strong>{lockState.por}</strong> desde{" "}
              {new Date(lockState.em).toLocaleString("pt-BR")}. Você pode visualizar, mas não salvar
              enquanto a reserva estiver ativa (10 min).
            </div>
          )}
          {lockState.kind === "concluida" && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
              Esta tarefa já foi triada por <strong>{lockState.por}</strong> em{" "}
              {new Date(lockState.em).toLocaleString("pt-BR")}.
            </div>
          )}

          {isAdmin && (
            <ProtocoloDetailActions
              protocolo={protocolo}
              isLegacy={isLegacy}
              editing={editing}
              lockBloqueia={lockBloqueia}
              pending={update.isPending}
              onConcluirTriagem={handleConcluirTriagem}
              onReabrir={handleReabrir}
              onConcluir={handleConcluir}
              onProrrogar={handleProrrogar}
              onSave={handleSave}
              onStartEdit={() => setEditing(true)}
              onCancelEdit={() => setEditing(false)}
              onExcluir={() => {
                if (confirm("Excluir este protocolo permanentemente?")) del.mutate();
              }}
              wrapTooltip={wrapTooltip}
            />
          )}

          <Tabs defaultValue="detalhes" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="historico" className="gap-1">
                <History className="h-3.5 w-3.5" /> Histórico ({historico.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="detalhes" className="space-y-4">
              {!editing ? (
                <ProtocoloDetailView protocolo={protocolo} prazoFinal={s.prazoFinal} />
              ) : (
                <ProtocoloDetailEdit
                  protocolo={protocolo}
                  form={form}
                  setForm={setForm}
                  secretarias={secretarias}
                  locais={locais}
                />
              )}
            </TabsContent>
            <TabsContent value="historico">
              <ProtocoloDetailHistorico historico={historico} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={concluirOpen} onOpenChange={setConcluirOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir protocolo</AlertDialogTitle>
            <AlertDialogDescription>
              Informe a data real da conclusão. Isso garante que os relatórios e a evolução de
              atrasados considerem o momento correto — mesmo que você registre a conclusão depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Data de conclusão</Label>
            <Input
              type="date"
              value={concluirData}
              max={new Date().toISOString().slice(0, 10)}
              min={protocolo?.data_abertura ?? undefined}
              onChange={(e) => setConcluirData(e.target.value)}
            />
            {protocolo?.data_abertura && (
              <p className="text-[11px] text-muted-foreground">
                Abertura: {formatDate(protocolo.data_abertura)}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={update.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarConclusao();
              }}
              disabled={update.isPending}
            >
              Confirmar conclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
