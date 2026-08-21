import type { ProtocoloRow } from "@/features/protocolos/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/domain/prazo";
import { CATEGORIAS, type CategoriaProtocolo } from "@/lib/domain/categorias";
import type { TipoProtocolo } from "@/lib/domain/prazo";

export type ProtocoloForm = {
  numero: string;
  tipo: TipoProtocolo;
  categoria: CategoriaProtocolo;
  status: string;
  assunto: string;
  descricao: string;
  solicitante: string;
  secretaria_id: string;
  local_id: string;
  data_abertura: string;
  data_conclusao: string;
  data_prorrogacao: string;
  prorrogado: boolean;
  endereco: string;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function ProtocoloDetailView({
  protocolo,
  prazoFinal,
}: {
  protocolo: ProtocoloRow;
  prazoFinal: Date;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">{protocolo.assunto}</h3>
        {protocolo.descricao && (
          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
            {protocolo.descricao}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Status" value={protocolo.status?.replace("_", " ")} />
        <Field label="Prorrogado" value={protocolo.prorrogado ? "Sim" : "Não"} />
        <Field label="Data de abertura" value={formatDate(protocolo.data_abertura)} />
        <Field label="Prazo final" value={formatDate(prazoFinal)} />
        {protocolo.data_prorrogacao && (
          <Field label="Data prorrogação" value={formatDate(protocolo.data_prorrogacao)} />
        )}
        {protocolo.data_conclusao && (
          <Field label="Data conclusão" value={formatDate(protocolo.data_conclusao)} />
        )}
        <Field label="Secretaria" value={protocolo.secretarias?.nome ?? "—"} />
        {protocolo.locais && <Field label="Local" value={protocolo.locais.nome} />}
        <Field label="Solicitante" value={protocolo.solicitante ?? "—"} />
      </div>
    </div>
  );
}

export function ProtocoloDetailEdit({
  protocolo,
  form,
  setForm,
  secretarias,
  locais,
}: {
  protocolo: ProtocoloRow;
  form: ProtocoloForm;
  setForm: (f: ProtocoloForm) => void;
  secretarias: { id: string; nome: string }[];
  locais: { id: string; nome: string; secretaria_id: string }[];
}) {
  const locaisFiltrados = locais.filter(
    (l) => !form.secretaria_id || l.secretaria_id === form.secretaria_id,
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field2 label="Número">
          <Input
            value={form.numero}
            onChange={(e) => setForm({ ...form, numero: e.target.value })}
          />
        </Field2>
        <Field2 label="Tipo">
          <Select
            value={form.tipo}
            onValueChange={(v) => setForm({ ...form, tipo: v as TipoProtocolo })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
              <SelectItem value="esic">e-SIC</SelectItem>
              <SelectItem value="lai">LAI</SelectItem>
            </SelectContent>
          </Select>
        </Field2>
        <Field2 label="Categoria">
          <Select
            value={form.categoria}
            onValueChange={(v) => setForm({ ...form, categoria: v as CategoriaProtocolo })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="font-mono mr-2">{c.sigla}</span>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field2>
        <Field2 label="Status">
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </Field2>
      </div>
      <Field2 label="Assunto">
        <Input
          value={form.assunto}
          onChange={(e) => setForm({ ...form, assunto: e.target.value })}
        />
      </Field2>
      <Field2 label={protocolo.triagem_pendente ? "Descrição (breve relato) *" : "Descrição"}>
        <Textarea
          rows={4}
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          placeholder={
            protocolo.triagem_pendente
              ? "Descreva brevemente o relato desta manifestação para a secretaria responsável."
              : undefined
          }
          className={
            protocolo.triagem_pendente && !form.descricao.trim()
              ? "border-amber-500 focus-visible:ring-amber-500"
              : undefined
          }
        />
        {protocolo.triagem_pendente && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Obrigatório para concluir a triagem.
          </p>
        )}
      </Field2>
      <div className="grid grid-cols-2 gap-3">
        <Field2 label="Solicitante">
          <Input
            value={form.solicitante}
            onChange={(e) => setForm({ ...form, solicitante: e.target.value })}
          />
        </Field2>
        <Field2 label="Data de abertura">
          <Input
            type="date"
            value={form.data_abertura}
            onChange={(e) => setForm({ ...form, data_abertura: e.target.value })}
          />
        </Field2>
        <Field2 label="Secretaria">
          <Select
            value={form.secretaria_id || "none"}
            onValueChange={(v) =>
              setForm({ ...form, secretaria_id: v === "none" ? "" : v, local_id: "" })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {secretarias.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field2>
        <Field2 label="Local">
          <Select
            value={form.local_id || "none"}
            onValueChange={(v) => setForm({ ...form, local_id: v === "none" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {locaisFiltrados.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field2>
        <Field2 label="Data conclusão">
          <Input
            type="date"
            value={form.data_conclusao ?? ""}
            onChange={(e) => setForm({ ...form, data_conclusao: e.target.value })}
          />
        </Field2>
      </div>
    </div>
  );
}
