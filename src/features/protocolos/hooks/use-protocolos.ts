import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "@/lib/fetch-all";
import { compararNumeroProtocolo } from "@/lib/domain/protocolo-number";
import { queryKeys, invalidateProtocoloRelatedCaches } from "@/lib/query-keys";
import type { ProtocoloRow } from "@/features/protocolos/types";

/** Protocolos ativos (não legados, não pendentes de triagem), ordenados por número. */
export function useProtocolos() {
  return useQuery({
    queryKey: queryKeys.protocolos.list({ escopo: "atuais" }),
    queryFn: async () => {
      const rows = await fetchAllPaginated<ProtocoloRow>((from, to) =>
        supabase
          .from("protocolos")
          .select("*, secretarias(nome, sigla), locais(nome)")
          .eq("triagem_pendente", false)
          .order("data_abertura", { ascending: false })
          .range(from, to),
      );
      return [...rows].sort(compararNumeroProtocolo);
    },
  });
}

export function useProtocoloMutations() {
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("protocolos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateProtocoloRelatedCaches(qc),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("protocolos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateProtocoloRelatedCaches(qc),
  });

  return { update, remove };
}
