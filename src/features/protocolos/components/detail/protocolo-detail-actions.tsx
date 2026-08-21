import type { ProtocoloRow } from "@/features/protocolos/types";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RotateCw, Trash2, Save, Pencil, X, Inbox, ExternalLink } from "lucide-react";

export function ProtocoloDetailActions({
  protocolo,
  isLegacy,
  editing,
  lockBloqueia,
  pending,
  onConcluirTriagem,
  onReabrir,
  onConcluir,
  onProrrogar,
  onSave,
  onStartEdit,
  onCancelEdit,
  onExcluir,
  wrapTooltip,
}: {
  protocolo: ProtocoloRow;
  isLegacy: boolean;
  editing: boolean;
  lockBloqueia: boolean;
  pending: boolean;
  onConcluirTriagem: () => void;
  onReabrir: () => void;
  onConcluir: () => void;
  onProrrogar: () => void;
  onSave: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onExcluir: () => void;
  wrapTooltip: (id: string, children: ReactNode, text: string) => ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-y py-3">
      <div className="flex flex-wrap items-center gap-2">
        {!isLegacy &&
          protocolo.triagem_pendente &&
          editing &&
          wrapTooltip(
            "concluir-triagem",
            <Button
              size="sm"
              onClick={onConcluirTriagem}
              disabled={pending || lockBloqueia}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              <Inbox className="h-4 w-4 mr-1" /> Concluir triagem
            </Button>,
            "Finaliza a triagem encaminhando o protocolo à secretaria/local definidos (Ctrl + Enter)",
          )}
        {protocolo?.url &&
          wrapTooltip(
            "abrir-1doc",
            <a href={protocolo.url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-sky-600 text-white hover:bg-sky-700">
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir no 1Doc
              </Button>
            </a>,
            "Abre o protocolo no sistema 1Doc em uma nova aba",
          )}
        {!isLegacy && protocolo.status === "concluido" && (
          <Button
            size="sm"
            variant="outline"
            onClick={onReabrir}
            disabled={pending || lockBloqueia}
          >
            <RotateCw className="h-4 w-4 mr-1" /> Reabrir
          </Button>
        )}
        {!isLegacy && !protocolo.triagem_pendente && protocolo.status !== "concluido" && (
          <>
            <Button
              size="sm"
              onClick={onConcluir}
              disabled={pending || lockBloqueia}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir
            </Button>
            {!protocolo.prorrogado && (
              <Button
                size="sm"
                variant="outline"
                onClick={onProrrogar}
                disabled={pending || lockBloqueia}
              >
                Prorrogar prazo
              </Button>
            )}
          </>
        )}
        {!isLegacy && !protocolo.triagem_pendente && editing && (
          <Button
            size="sm"
            onClick={onSave}
            disabled={pending || lockBloqueia}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="h-4 w-4 mr-1" /> Salvar alterações
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 ml-auto">
        {!isLegacy &&
          (!editing ? (
            <Button size="sm" variant="outline" onClick={onStartEdit} disabled={lockBloqueia}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          ) : (
            wrapTooltip(
              "cancelar-edicao",
              <Button size="sm" variant="outline" onClick={onCancelEdit}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>,
              "Descarta as alterações feitas no formulário (Esc)",
            )
          ))}
        {!isLegacy &&
          wrapTooltip(
            "excluir-protocolo",
            <Button
              size="sm"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={onExcluir}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>,
            "Remove permanentemente este protocolo e todo o seu histórico",
          )}
      </div>
    </div>
  );
}
