import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketingStage {
  id: string;
  name: string;
  meta_status: string;
  order_index: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface MarketingTask {
  id: string;
  title: string;
  description: string;
  requester_id: string | null;
  requester_name: string;
  assignee_id: string | null;
  assignee_name: string | null;
  stage_id: string | null;
  progress: string;
  priority: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  checklist: ChecklistItem[] | null;
  start_date: string | null;
  due_date: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  next_recurrence_date: string | null;
  time_estimate_minutes: number | null;
}

export function useMarketingStages() {
  return useQuery({
    queryKey: ["marketing_stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_stages")
        .select("*")
        .order("order_index");
      if (error) throw error;
      return data as MarketingStage[];
    },
  });
}

export function useMarketingTasks() {
  return useQuery({
    queryKey: ["marketing_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_tasks")
        .select("*")
        .order("order_index");
      if (error) throw error;
      return (data as any[]).map((d) => ({
        ...d,
        checklist: Array.isArray(d.checklist) ? d.checklist : [],
      })) as MarketingTask[];
    },
  });
}

export function useCreateMarketingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Partial<MarketingTask>) => {
      const { data, error } = await supabase
        .from("marketing_tasks")
        .insert(task as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
      toast.success("Tarefa criada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateMarketingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingTask> & { id: string }) => {
      const { error } = await supabase
        .from("marketing_tasks")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing_tasks"] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteMarketingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
      toast.success("Tarefa excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Stage CRUD
export function useCreateMarketingStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stage: Partial<MarketingStage>) => {
      const { data, error } = await supabase
        .from("marketing_stages")
        .insert(stage as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_stages"] });
      toast.success("Etapa criada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateMarketingStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingStage> & { id: string }) => {
      const { error } = await supabase
        .from("marketing_stages")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing_stages"] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteMarketingStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_stages"] });
      toast.success("Etapa excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
