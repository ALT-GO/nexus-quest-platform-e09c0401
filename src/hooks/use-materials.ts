import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketingMaterial {
  id: string;
  name: string;
  description: string;
  purchase_date: string | null;
  budget: number;
  actual_cost: number | null;
  status: string;
  priority: string;
  checklist: any[];
  notes: string;
  linked_event_id: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = "marketing_materials";

export function useMarketingMaterials() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("marketing-materials-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_materials" }, () => {
        qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_materials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketingMaterial[];
    },
  });
}

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (material: Omit<MarketingMaterial, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("marketing_materials")
        .insert(material as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Material criado com sucesso");
    },
    onError: () => toast.error("Erro ao criar material"),
  });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingMaterial> & { id: string }) => {
      const { error } = await supabase
        .from("marketing_materials")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: () => toast.error("Erro ao atualizar material"),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Material excluído");
    },
    onError: () => toast.error("Erro ao excluir material"),
  });
}
