import type { TipoProtocolo, StatusProtocolo } from "@/lib/domain/prazo";
import type { CategoriaProtocolo } from "@/lib/domain/categorias";

/** Formato de uma linha da tabela `protocolos`, com os joins usados na UI. */
export type ProtocoloRow = {
  id: string;
  numero: string;
  tipo: TipoProtocolo;
  categoria: CategoriaProtocolo;
  status: StatusProtocolo;
  assunto: string;
  descricao: string | null;
  solicitante: string | null;
  sigilo: string | null;
  secretaria_id: string | null;
  local_id: string | null;
  data_abertura: string;
  data_conclusao: string | null;
  data_prorrogacao: string | null;
  prorrogado: boolean;
  triagem_pendente: boolean;
  triagem_lock_por: string | null;
  triagem_lock_em: string | null;
  url: string | null;
  secretarias?: { nome: string; sigla: string | null } | null;
  locais?: { nome: string } | null;
  /** Legado: só presente quando o item vem de um dataset em memória, não de uma row real. */
  __antigo?: boolean;
};
