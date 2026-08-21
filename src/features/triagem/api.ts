import { supabase } from "@/integrations/supabase/client";

export type TriagemResultado = {
  ok: boolean;
  motivo: "reservada" | "concluida" | null;
  por_nome: string | null;
  em: string | null;
};

export async function reservarTriagem(protocoloId: string): Promise<TriagemResultado> {
  const { data, error } = await supabase.rpc("reservar_triagem", { p_protocolo_id: protocoloId });
  if (error) throw error;
  return data as TriagemResultado;
}

export async function liberarTriagem(protocoloId: string): Promise<void> {
  const { error } = await supabase.rpc("liberar_triagem", { p_protocolo_id: protocoloId });
  if (error) throw error;
}

export async function concluirTriagem(params: {
  protocoloId: string;
  secretariaId: string;
  localId?: string | null;
}): Promise<TriagemResultado> {
  const { data, error } = await supabase.rpc("concluir_triagem", {
    p_protocolo_id: params.protocoloId,
    p_secretaria_id: params.secretariaId,
    p_local_id: params.localId ?? null,
  });
  if (error) throw error;
  return data as TriagemResultado;
}
