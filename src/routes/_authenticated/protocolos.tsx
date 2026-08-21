import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, RotateCw, CheckCircle2, Trash2, Eye } from "lucide-react";
import {
  situacaoProtocolo,
  situacaoClasses,
  situacaoLabel,
  formatDate,
  PRAZOS,
} from "@/lib/domain/prazo";
import { CATEGORIAS, categoriaLabel, categoriaBadgeClass } from "@/lib/domain/categorias";
import { currentMonthValue, monthOptionsFromDates, isInMonth } from "@/lib/month-filter";
import { useProtocolos, useProtocoloMutations } from "@/features/protocolos/hooks/use-protocolos";
import { NovoProtocoloDialog } from "@/features/protocolos/components/novo-protocolo-dialog";
import { ProtocoloDetailDialog } from "@/features/protocolos/components/protocolo-detail-dialog";
import { useSecretarias } from "@/features/cadastros/hooks/use-secretarias";
import { useLocais } from "@/features/cadastros/hooks/use-locais";
import type { ProtocoloRow } from "@/features/protocolos/types";

export const Route = createFileRoute("/_authenticated/protocolos")({
  component: ProtocolosPage,
});

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d)\.(?=\d)/g, "$1");

function ProtocolosPage() {
  const [detail, setDetail] = useState<ProtocoloRow | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroSec, setFiltroSec] = useState("todos");
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState(currentMonthValue());

  const { data: protocolos = [] } = useProtocolos();
  const { update, remove } = useProtocoloMutations();
  const { data: secretarias = [] } = useSecretarias();
  const { data: locais = [] } = useLocais();

  const filtrados = protocolos.filter((p) => {
    if (
      p.status === "concluido" &&
      filtroStatus !== "concluido" &&
      !(busca.trim() && normalize(String(p.numero ?? "")).includes(normalize(busca.trim())))
    ) {
      return false;
    }
    if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
    if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
    if (filtroCategoria !== "todos" && p.categoria !== filtroCategoria) return false;
    if (filtroSec !== "todos" && p.secretaria_id !== filtroSec) return false;
    if (mes !== "all" && !busca.trim() && !isInMonth(p.data_abertura, mes)) return false;
    if (busca) {
      const s = normalize(busca);
      const txt = normalize(
        `${p.numero ?? ""} ${p.assunto ?? ""} ${p.solicitante ?? ""} ${p.descricao ?? ""}`,
      );
      if (!txt.includes(s)) return false;
    }
    return true;
  });

  const opcoesMes = monthOptionsFromDates(protocolos.map((p) => p.data_abertura));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Protocolos</h1>
          <p className="text-sm text-muted-foreground">
            {filtrados.length} de {protocolos.length}
          </p>
        </div>
        <NovoProtocoloDialog secretarias={secretarias} locais={locais} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar nº, assunto, solicitante…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-[240px]"
        />
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
            <SelectItem value="esic">e-SIC</SelectItem>
            <SelectItem value="lai">LAI</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as categorias</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                <span className="font-mono mr-2">{c.sigla}</span>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroSec} onValueChange={setFiltroSec}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as secretarias</SelectItem>
            {secretarias.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            <SelectItem value="all">Todos os meses</SelectItem>
            {opcoesMes.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {filtrados.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhum protocolo encontrado.
            </CardContent>
          </Card>
        )}
        {filtrados.map((p) => {
          const s = situacaoProtocolo(p);
          return (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{p.numero}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {PRAZOS[p.tipo as keyof typeof PRAZOS].label}
                      </Badge>
                      <Badge className={`text-[10px] ${categoriaBadgeClass(p.categoria)}`}>
                        {categoriaLabel(p.categoria)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {p.status.replace("_", " ")}
                      </Badge>
                      {p.prorrogado && (
                        <Badge variant="outline" className="text-[10px]">
                          prorrogado
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] border ${situacaoClasses[s.situacao]}`}
                      >
                        {situacaoLabel[s.situacao]} ·{" "}
                        {s.dias < 0 ? `${Math.abs(s.dias)}d atrasado` : `${s.dias}d`}
                      </Badge>
                      {p.sigilo && p.sigilo !== "publico" && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300"
                        >
                          {p.sigilo === "anonimo" ? "Anônimo" : "Sigiloso"}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold mt-2">{p.assunto}</h3>
                    {p.descricao && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {p.descricao}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        <Calendar className="inline h-3 w-3 mr-1" />
                        Aberto {formatDate(p.data_abertura)}
                      </span>
                      <span>Prazo {formatDate(s.prazoFinal)}</span>
                      {p.secretarias && <span>📍 {p.secretarias.nome}</span>}
                      {p.solicitante && <span>✉ {p.solicitante}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setDetail(p)}>
                      <Eye className="h-3 w-3 mr-1" /> Detalhes
                    </Button>
                    {p.status !== "concluido" && !p.prorrogado && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          update.mutate({
                            id: p.id,
                            patch: {
                              prorrogado: true,
                              data_prorrogacao: new Date().toISOString().slice(0, 10),
                            },
                          })
                        }
                      >
                        <RotateCw className="h-3 w-3 mr-1" /> Prorrogar
                      </Button>
                    )}
                    {p.status !== "concluido" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          update.mutate({
                            id: p.id,
                            patch: {
                              status: "concluido",
                              data_conclusao: new Date().toISOString().slice(0, 10),
                            },
                          })
                        }
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
                      </Button>
                    )}
                    {p.status === "aberto" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          update.mutate({ id: p.id, patch: { status: "em_andamento" } })
                        }
                      >
                        Iniciar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Excluir protocolo?")) remove.mutate(p.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ProtocoloDetailDialog
        protocolo={detail}
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
      />
    </div>
  );
}
