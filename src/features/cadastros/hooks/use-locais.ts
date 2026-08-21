import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";

export type Local = {
  id: string;
  secretaria_id: string;
  nome: string;
  latitude: number | null;
  longitude: number | null;
};

export function useLocais() {
  return useQuery({
    queryKey: queryKeys.locais.all(),
    queryFn: async () => {
      const { data, error } = await supabase.from("locais").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Local[];
    },
  });
}

export function useLocalMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.locais.all() });

  const create = useMutation({
    mutationFn: async (payload: { secretaria_id: string; nome: string }) => {
      const { error } = await supabase.from("locais").insert(payload);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Local> }) => {
      const { error } = await supabase.from("locais").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
