import { Badge } from "@/components/ui/badge";

const ASSUNTOS_SAUDE_TRIAGEM = new Set([
  "demora em marcar consulta / procedimento",
  "falta de materiais em posto de saude",
  "falta de medicacao",
  "medicos",
  "postos de saude",
  "transporte para tratamento",
  "vacinas",
]);

const normAssunto = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function MotivoTriagemBadge({
  protocolo,
}: {
  protocolo: { secretaria_id: string | null; assunto: string };
}) {
  if (!protocolo.secretaria_id) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] border-rose-500/50 text-rose-700 dark:text-rose-300 bg-rose-500/10"
      >
        sem secretaria identificada
      </Badge>
    );
  }
  if (ASSUNTOS_SAUDE_TRIAGEM.has(normAssunto(protocolo.assunto))) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
      >
        Saúde · definir UBS/CAPS
      </Badge>
    );
  }
  return null;
}
