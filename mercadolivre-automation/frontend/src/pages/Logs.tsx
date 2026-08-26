import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { RunLog } from "../lib/types";
import { Badge, Card } from "../components/ui";

const tone: Record<string, "success" | "error" | "warning" | "default"> = {
  success: "success",
  error: "error",
  skipped: "warning",
  running: "default",
};

export function LogsPage() {
  const [logs, setLogs] = useState<RunLog[]>([]);

  useEffect(() => {
    api<RunLog[]>("/logs").then(setLogs);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Logs de execução</h2>
      <Card>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma execução registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {logs.map((log) => (
              <li key={log.id} className="py-3">
                <div className="flex items-center gap-2">
                  <Badge tone={tone[log.status] ?? "default"}>{log.status}</Badge>
                  <span className="text-xs text-slate-500">{log.trigger === "manual" ? "manual" : "agendado"}</span>
                  <span className="text-xs text-slate-500">{new Date(log.started_at).toLocaleString("pt-BR")}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{log.message}</p>
                <p className="text-xs text-slate-500">
                  {log.items_found} encontradas · {log.items_sent} enviadas
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
