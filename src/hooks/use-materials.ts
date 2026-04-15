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
  unit_cost: number | null;
  total_quantity: number | null;
  status: string;
  priority: string;
  checklist: any[];
  notes: string;
  linked_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialAllocation {
  id: string;
  material_id: string;
  event_id: string;
  allocation_type: "value" | "quantity";
  quantity_used: number;
  allocated_value: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = "marketing_materials";
const ALLOC_KEY = "material_allocations";

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

export function useMaterialAllocations() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("material-allocations-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_material_allocations" }, () => {
        qc.invalidateQueries({ queryKey: [ALLOC_KEY] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: [ALLOC_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_material_allocations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MaterialAllocation[];
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

export function useUpsertAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alloc: Omit<MaterialAllocation, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase
        .from("marketing_material_allocations")
        .upsert(alloc as any, { onConflict: "material_id,event_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ALLOC_KEY] });
      toast.success("Alocação salva");
    },
    onError: () => toast.error("Erro ao salvar alocação"),
  });
}

export function useDeleteAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_material_allocations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ALLOC_KEY] });
      toast.success("Alocação removida");
    },
    onError: () => toast.error("Erro ao remover alocação"),
  });
}
