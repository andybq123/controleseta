import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Inbox, Eye, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { fetchAllPaginated } from "@/lib/fetch-all";
import { sortProtocolosPorNumero } from "@/lib/sort-protocolos";
import { formatDate, PRAZOS, categoriaLabel, categoriaBadgeClass, type TipoProtocolo, type CategoriaProtocolo } from "@/lib/prazo";
import { ProtocoloDetailDialog } from "@/components/protocolo-detail-dialog";

export const Route = createFileRoute("/_authenticated/tarefas")({
  component: TarefasPage,
});

function TarefasPage() {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<any | null>(null);
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchSec, setBatchSec] = useState<string>("");
  const [batchLocal, setBatchLocal] = useState<string>("");

  const { data: protocolos = [] } = useQuery({
    queryKey: ["protocolos-triagem"],
    queryFn: async () => {
      const rows = await fetchAllPaginated((from, to) =>
        supabase
          .from("protocolos")
          .select("*, secretarias(nome, sigla), locais(nome)")
          .eq("triagem_pendente", true)
          .order("data_abertura", { ascending: false })
          .range(from, to),
      );
      return [...rows].sort(sortProtocolosPorNumero);
    },
  });

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("*").order("nome")).data ?? [],
  });
  const { data: locais = [] } = useQuery({
    queryKey: ["locais"],
    queryFn: async () => (await supabase.from("locais").select("*").order("nome")).data ?? [],
  });

  const filtrados = protocolos.filter((p: any) => {
    if (!busca) return true;
    const s = busca.toLowerCase();
    return `${p.numero} ${p.assunto} ${p.solicitante ?? ""}`.toLowerCase().includes(s);
  });

  const locaisFiltrados = (locais as any[]).filter((l) => !batchSec || l.secretaria_id === batchSec);

  const batchMut = useMutation({
    mutationFn: async () => {
      if (!batchSec) throw new Error("Selecione a secretaria");
      if (selected.size === 0) throw new Error("Selecione ao menos um protocolo");
      const patch: any = {
        secretaria_id: batchSec,
        local_id: batchLocal || null,
        triagem_pendente: false,
      };
      const { error } = await supabase
        .from("protocolos")
        .update(patch)
        .in("id", Array.from(selected));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selected.size} protocolo(s) triados em lote.`);
      setSelected(new Set());
      setBatchSec("");
      setBatchLocal("");
      qc.invalidateQueries({ queryKey: ["protocolos-triagem"] });
      qc.invalidateQueries({ queryKey: ["protocolos"] });
      qc.invalidateQueries({ queryKey: ["triagem-stats"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao triar em lote"),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selected.size === filtrados.length) setSelected(new Set());
    else setSelected(new Set(filtrados.map((p: any) => p.id)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Tarefas — Triagem
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtrados.length} ouvidoria(s) aguardando triagem. Defina secretaria/local e salve para enviar ao módulo correspondente.
          </p>
        </div>
        <Input placeholder="Buscar nº, assunto, solicitante…" value={busca} onChange={e => setBusca(e.target.value)} className="w-[280px]" />
      </div>

      {selected.size > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3 px-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-medium">{selected.size} selecionado(s)</Badge>
            <Select value={batchSec} onValueChange={(v) => { setBatchSec(v); setBatchLocal(""); }}>
              <SelectTrigger className="w-[240px]"><SelectValue placeholder="Secretaria…" /></SelectTrigger>
              <SelectContent>
                {(secretarias as any[]).map((x) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={batchLocal || "none"} onValueChange={(v) => setBatchLocal(v === "none" ? "" : v)} disabled={!batchSec}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Local/Área (opcional)…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem local —</SelectItem>
                {locaisFiltrados.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => batchMut.mutate()} disabled={!batchSec || batchMut.isPending}>
              <CheckCheck className="h-4 w-4 mr-1" /> Concluir triagem em lote
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
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
          {filtrados.map((p: any) => (
            <Card key={p.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{PRAZOS[p.tipo as TipoProtocolo].label}</Badge>
                    <Badge className={`text-[10px] ${categoriaBadgeClass(p.categoria as CategoriaProtocolo)}`}>
                      {categoriaLabel(p.categoria as CategoriaProtocolo)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/10">
                      triagem pendente
                    </Badge>
                  </div>
                  <div className="font-medium text-sm">{p.assunto}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Aberto em {formatDate(p.data_abertura)} · {p.solicitante ?? "Solicitante não informado"}
                  </div>
                </div>
                <Button size="sm" onClick={() => setDetail(p)}>
                  <Eye className="h-4 w-4 mr-1" /> Triar
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
          qc.invalidateQueries({ queryKey: ["protocolos-triagem"] });
          qc.invalidateQueries({ queryKey: ["protocolos"] });
          qc.invalidateQueries({ queryKey: ["triagem-stats"] });
        }}
      />
    </div>
  );
}