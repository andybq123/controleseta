import { Badge } from "@/components/ui/badge";

export type HistoricoItem = {
  id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  acao: "create" | "update";
  autor_nome: string | null;
  created_at: string;
};

export function ProtocoloDetailHistorico({ historico }: { historico: HistoricoItem[] }) {
  if (historico.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma alteração registrada ainda.
      </p>
    );
  }
  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
      {historico.map((h) => (
        <div key={h.id} className="border rounded-md p-3 text-sm">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {h.acao === "create" ? "Criação" : h.campo.replace("_", " ")}
              </Badge>
              <span className="text-xs text-muted-foreground">{h.autor_nome ?? "Sistema"}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(h.created_at).toLocaleString("pt-BR")}
            </span>
          </div>
          {h.acao !== "create" && (
            <div className="text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">De: </span>
                <span className="line-through">{h.valor_anterior ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Para: </span>
                <span className="font-medium">{h.valor_novo ?? "—"}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
