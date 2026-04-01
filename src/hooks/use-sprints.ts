import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketingSprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "planning" | "active" | "completed";
  sprint_points_goal: number;
  created_at: string;
  updated_at: string;
}

export function useMarketingSprints() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("marketing_sprints_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketing_sprints" },
        () => qc.invalidateQueries({ queryKey: ["marketing_sprints"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["marketing_sprints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_sprints")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as MarketingSprint[];
    },
  });
}

export function useActiveSprint() {
  const { data: sprints } = useMarketingSprints();
  return sprints?.find((s) => s.status === "active") || null;
}

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sprint: Partial<MarketingSprint>) => {
      const { data, error } = await supabase
        .from("marketing_sprints")
        .insert(sprint as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_sprints"] });
      toast.success("Sprint criada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingSprint> & { id: string }) => {
      const { error } = await supabase
        .from("marketing_sprints")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_sprints"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_sprints").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_sprints"] });
      toast.success("Sprint excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useSprintRollover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fromSprintId, toSprintId }: { fromSprintId: string; toSprintId: string }) => {
      // Move incomplete tasks from old sprint to new sprint
      const { data: incompleteTasks, error: fetchError } = await supabase
        .from("marketing_tasks")
        .select("id")
        .eq("sprint_id", fromSprintId)
        .neq("progress", "Concluído");
      if (fetchError) throw fetchError;

      if (incompleteTasks && incompleteTasks.length > 0) {
        const ids = incompleteTasks.map((t: any) => t.id);
        const { error: updateError } = await supabase
          .from("marketing_tasks")
          .update({ sprint_id: toSprintId, updated_at: new Date().toISOString() } as any)
          .in("id", ids);
        if (updateError) throw updateError;
        return ids.length;
      }
      return 0;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
      qc.invalidateQueries({ queryKey: ["marketing_sprints"] });
      if (count > 0) {
        toast.success(`${count} tarefa(s) movida(s) para a nova sprint`);
      } else {
        toast.info("Nenhuma tarefa pendente para mover");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
}
