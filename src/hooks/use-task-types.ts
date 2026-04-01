import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketingTaskType {
  id: string;
  name: string;
  icon: string;
  color: string;
  default_fields: string[];
  checklist_template: { text: string }[];
  order_index: number;
  created_at: string;
}

export function useMarketingTaskTypes() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("marketing_task_types_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketing_task_types" },
        () => {
          qc.invalidateQueries({ queryKey: ["marketing_task_types"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["marketing_task_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_task_types")
        .select("*")
        .order("order_index");
      if (error) throw error;
      return (data as any[]).map((d) => ({
        ...d,
        default_fields: Array.isArray(d.default_fields) ? d.default_fields : [],
        checklist_template: Array.isArray(d.checklist_template) ? d.checklist_template : [],
      })) as MarketingTaskType[];
    },
  });
}

export function useCreateTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (type: Partial<MarketingTaskType>) => {
      const { data, error } = await supabase
        .from("marketing_task_types")
        .insert(type as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_task_types"] });
      toast.success("Tipo criado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingTaskType> & { id: string }) => {
      const { error } = await supabase
        .from("marketing_task_types")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing_task_types"] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketing_task_types")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_task_types"] });
      toast.success("Tipo excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
