import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { situacaoProtocolo, situacaoClasses, situacaoLabel, formatDate, PRAZOS, categoriaLabel, type TipoProtocolo, type CategoriaProtocolo } from "@/lib/prazo";

export function ProtocoloDetailDialog({ protocolo, open, onOpenChange }: {
  protocolo: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!protocolo) return null;
  const s = situacaoProtocolo(protocolo);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{protocolo.numero}</span>
            <Badge variant="outline" className="text-[10px] uppercase">{PRAZOS[protocolo.tipo as TipoProtocolo].label}</Badge>
            <Badge variant="outline" className="text-[10px]">{categoriaLabel(protocolo.categoria as CategoriaProtocolo)}</Badge>
            <Badge variant="outline" className={`text-[10px] border ${situacaoClasses[s.situacao]}`}>
              {situacaoLabel[s.situacao]} · {s.dias < 0 ? `${Math.abs(s.dias)}d atrasado` : `${s.dias}d`}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg">{protocolo.assunto}</h3>
            {protocolo.descricao && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{protocolo.descricao}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Status" value={protocolo.status?.replace("_", " ")} />
            <Field label="Prorrogado" value={protocolo.prorrogado ? "Sim" : "Não"} />
            <Field label="Data de abertura" value={formatDate(protocolo.data_abertura)} />
            <Field label="Prazo final" value={formatDate(s.prazoFinal)} />
            {protocolo.data_prorrogacao && <Field label="Data prorrogação" value={formatDate(protocolo.data_prorrogacao)} />}
            {protocolo.data_conclusao && <Field label="Data conclusão" value={formatDate(protocolo.data_conclusao)} />}
            <Field label="Secretaria" value={protocolo.secretarias?.nome ?? "—"} />
            <Field label="Responsável" value={protocolo.responsaveis?.nome ?? "—"} />
            {protocolo.locais && <Field label="Local" value={`${protocolo.locais.nome}${protocolo.locais.centro_custo ? ` · ${protocolo.locais.centro_custo}` : ""}`} />}
            <Field label="Solicitante" value={protocolo.solicitante ?? "—"} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}