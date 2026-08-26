import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { StatusResponse } from "../lib/types";
import { Badge, Button, Card } from "../components/ui";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

const statusTone: Record<string, "success" | "error" | "warning" | "default"> = {
  success: "success",
  error: "error",
  skipped: "warning",
  running: "default",
};

export function DashboardPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const data = await api<StatusResponse>("/status");
    setStatus(data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function runNow() {
    setRunning(true);
    setMessage(null);
    try {
      const result = await api<{ itemsFound: number; itemsSent: number; skipped: boolean; reason?: string }>(
        "/dispatch/run-now",
        { method: "POST" },
      );
      if (result.skipped) {
        setMessage(result.reason ?? "Execução ignorada.");
      } else {
        setMessage(`${result.itemsFound} ofertas encontradas, ${result.itemsSent} enviadas para o WhatsApp.`);
      }
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao executar.");
    } finally {
      setRunning(false);
    }
  }

  if (!status) return <p className="text-slate-400">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <Button onClick={runNow} disabled={running}>
          {running ? "Executando..." : "Executar agora"}
        </Button>
      </div>

      {message && (
        <Card className="border-brand-500/40 bg-brand-500/10 text-sm text-brand-400">{message}</Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase text-slate-500">Automação</p>
          <p className="mt-2 text-lg font-semibold">
            {status.enabled ? <Badge tone="success">Ativa</Badge> : <Badge tone="warning">Pausada</Badge>}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Próxima execução</p>
          <p className="mt-2 text-lg font-semibold">{formatDate(status.nextRun)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Enviados hoje</p>
          <p className="mt-2 text-lg font-semibold">{status.sentToday}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Total enviado</p>
          <p className="mt-2 text-lg font-semibold">{status.totalSent}</p>
        </Card>
      </div>

      <Card>
        <p className="mb-2 text-xs uppercase text-slate-500">Última execução</p>
        {status.lastLog ? (
          <div className="space-y-1 text-sm">
            <p>
              <Badge tone={statusTone[status.lastLog.status] ?? "default"}>{status.lastLog.status}</Badge>{" "}
              <span className="text-slate-400">({status.lastLog.trigger === "manual" ? "manual" : "agendado"})</span>
            </p>
            <p className="text-slate-300">{status.lastLog.message}</p>
            <p className="text-slate-500">
              {formatDate(status.lastLog.started_at)} · {status.lastLog.items_found} encontradas, {status.lastLog.items_sent} enviadas
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma execução ainda.</p>
        )}
      </Card>

      <Card>
        <p className="text-xs uppercase text-slate-500">Palavras-chave ativas</p>
        <p className="mt-2 text-lg font-semibold">{status.keywordsActive}</p>
        {status.keywordsActive === 0 && (
          <p className="mt-1 text-sm text-amber-400">
            Cadastre ao menos uma palavra-chave ou categoria para a coleta funcionar.
          </p>
        )}
      </Card>
    </div>
  );
}
