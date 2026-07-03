import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateProtocoloCaches } from "@/hooks/use-protocolos-realtime";
import { CheckCircle2, XCircle } from "lucide-react";

type ParsedLine = {
  raw: string;
  numero?: string;
  data?: string; // yyyy-mm-dd
  url?: string;
};

type ResultRow = {
  raw: string;
  numero?: string;
  status: "ok" | "skip" | "error";
  message: string;
};

function parseDate(s: string): string | undefined {
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (br) {
    const d = br[1].padStart(2, "0");
    const m = br[2].padStart(2, "0");
    let y = br[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

function parseLine(raw: string): ParsedLine | null {
  const line = raw.trim();
  if (!line) return null;
  const urlMatch = line.match(/https?:\/\/\S+/i);
  const url = urlMatch?.[0].replace(/[),.;]+$/, "");
  const rest = url ? line.replace(url, " ") : line;
  const data = parseDate(rest);
  const restNoDate = data
    ? rest.replace(/\b\d{4}-\d{2}-\d{2}\b/, " ").replace(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/, " ")
    : rest;
  // número: sequência com dígitos, possivelmente com "/" (ex: 12345/2025) ou hífen
  const numMatch = restNoDate.match(/([A-Z0-9]*\d{2,}[A-Z0-9\/\-]*)/i);
  const numero = numMatch?.[1]?.replace(/^[^\d]+/, "");
  return { raw: line, numero, data, url };
}

export function BulkConcluirDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);

  const linhas = useMemo(
    () => text.split(/\r?\n/).map(parseLine).filter(Boolean) as ParsedLine[],
    [text],
  );

  async function processar() {
    if (linhas.length === 0) return;
    setRunning(true);
    setResults([]);
    setProgress(0);
    setTotal(linhas.length);
    const out: ResultRow[] = [];

    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      try {
        if (!l.numero) {
          out.push({ raw: l.raw, status: "error", message: "Número não identificado" });
        } else if (!l.data) {
          out.push({ raw: l.raw, numero: l.numero, status: "error", message: "Data de conclusão não identificada" });
        } else {
          // Busca flexível: procura em TODA a tabela protocolos (saúde, ouvidoria,
          // e-SIC, etc.), independente de estar atrasado ou não.
          const numNorm = l.numero.toUpperCase().trim();
          const digits = numNorm.replace(/\D/g, "");
          const orParts = [
            `numero.eq.${numNorm}`,
            `numero.ilike.${numNorm}/%`,
          ];
          if (digits && digits !== numNorm) {
            orParts.push(`numero.eq.${digits}`);
            orParts.push(`numero.ilike.${digits}/%`);
          }
          const { data: encontrados, error: findErr } = await supabase
            .from("protocolos")
            .select("id, numero, status, url, data_conclusao, secretaria_id")
            .or(orParts.join(","))
            .limit(5);
          if (findErr) throw findErr;
          if (!encontrados || encontrados.length === 0) {
            out.push({ raw: l.raw, numero: l.numero, status: "error", message: "Protocolo não encontrado" });
          } else {
            const p = encontrados[0];
            const patch: { status: "concluido"; data_conclusao: string; url?: string } = {
              status: "concluido",
              data_conclusao: l.data,
            };
            if (l.url && !p.url) patch.url = l.url;
            const { error: updErr } = await supabase.from("protocolos").update(patch).eq("id", p.id);
            if (updErr) throw updErr;
            const msg = p.status === "concluido" ? "Atualizado (já estava concluído)" : "Concluído";
            const urlMsg = l.url ? (p.url ? " · link já existia" : " · link adicionado") : "";
            out.push({ raw: l.raw, numero: p.numero, status: "ok", message: msg + urlMsg });
          }
        }
      } catch (e) {
        out.push({
          raw: l.raw,
          numero: l.numero,
          status: "error",
          message: e instanceof Error ? e.message : "Erro desconhecido",
        });
      }
      setProgress(i + 1);
      setResults([...out]);
    }

    invalidateProtocoloCaches(qc);
    const ok = out.filter(r => r.status === "ok").length;
    const err = out.filter(r => r.status === "error").length;
    toast.success(`${ok} concluídos${err ? ` · ${err} com erro` : ""}`);
    setRunning(false);
  }

  function reset() {
    setText("");
    setResults([]);
    setProgress(0);
    setTotal(0);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!running) {
          if (!v) reset();
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Concluir protocolos em massa</DialogTitle>
          <DialogDescription>
            Cole uma linha por protocolo contendo: <b>número</b>, <b>data de conclusão</b> e
            (opcional) <b>link do 1Doc</b>. Ordem livre — separadores como tab, espaço, vírgula ou ponto e vírgula funcionam.
            <br />
            Ex.: <code className="text-xs">12345/2025  15/06/2026  https://1doc.com.br/...</code>
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          disabled={running}
          placeholder={"12345/2025\t15/06/2026\thttps://1doc.com.br/...\n67890/2025\t2026-06-16"}
          className="font-mono text-xs"
        />

        <div className="text-xs text-muted-foreground">
          {linhas.length} linha(s) detectada(s)
        </div>

        {(running || total > 0) && (
          <div className="space-y-1">
            <Progress value={total ? (progress / total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">
              {progress} de {total} processado(s)
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-[240px] overflow-auto border rounded-md divide-y text-xs">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-2 p-2">
                {r.status === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 text-[var(--success,theme(colors.emerald.600))] mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-mono truncate">{r.numero ?? r.raw}</p>
                  <p className="text-muted-foreground">{r.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={reset} disabled={running || (!text && results.length === 0)}>
            Limpar
          </Button>
          <Button onClick={processar} disabled={running || linhas.length === 0}>
            {running ? "Processando…" : `Concluir ${linhas.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}