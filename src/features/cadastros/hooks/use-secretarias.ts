import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";

export type Secretaria = {
  id: string;
  nome: string;
  sigla: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  icone: string | null;
};

export function useSecretarias() {
  return useQuery({
    queryKey: queryKeys.secretarias.list(),
    queryFn: async () => {
      const { data, error } = await supabase.from("secretarias").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Secretaria[];
    },
  });
}

export function useSecretariaMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.secretarias.all() });

  const create = useMutation({
    mutationFn: async (payload: Omit<Secretaria, "id"> & { created_by?: string }) => {
      const { data, error } = await supabase
        .from("secretarias")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Secretaria> }) => {
      const { error } = await supabase.from("secretarias").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("secretarias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
