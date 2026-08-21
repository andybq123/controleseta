import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";

export type Assunto = {
  id: string;
  nome: string;
  grupo: string;
  secretaria_id: string | null;
  ativo: boolean;
  forcar_triagem: boolean;
};

export function useAssuntos() {
  return useQuery({
    queryKey: queryKeys.assuntos.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assuntos")
        .select("*")
        .order("grupo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Assunto[];
    },
  });
}

export function useAssuntoMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.assuntos.all() });

  const create = useMutation({
    mutationFn: async (payload: {
      nome: string;
      grupo: string | null;
      secretaria_id: string | null;
      ativo: boolean;
    }) => {
      const { error } = await supabase.from("assuntos").insert(payload);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Assunto> }) => {
      const { error } = await supabase.from("assuntos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (assunto: Pick<Assunto, "id" | "nome">) => {
      const { count, error: errCount } = await supabase
        .from("protocolos")
        .select("*", { count: "exact", head: true })
        .eq("assunto", assunto.nome);
      if (errCount) throw errCount;
      if ((count ?? 0) > 0) {
        throw new Error(
          `Não é possível excluir: ${count} protocolo(s) usam este assunto. Desative-o em vez de excluir.`,
        );
      }
      const { error } = await supabase.from("assuntos").delete().eq("id", assunto.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
