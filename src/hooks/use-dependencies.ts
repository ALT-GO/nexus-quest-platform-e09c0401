import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string; // 'blocking' | 'waiting_on'
  created_at: string;
}

export function useTaskDependencies() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("marketing_task_dependencies_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketing_task_dependencies" },
        () => {
          qc.invalidateQueries({ queryKey: ["marketing_task_dependencies"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["marketing_task_dependencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_task_dependencies")
        .select("*");
      if (error) throw error;
      return data as TaskDependency[];
    },
  });
}

export function useAddDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dep: { task_id: string; depends_on_task_id: string; dependency_type: string }) => {
      const { error } = await supabase
        .from("marketing_task_dependencies")
        .insert(dep as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_task_dependencies"] });
      toast.success("Dependência adicionada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRemoveDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketing_task_dependencies")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_task_dependencies"] });
      toast.success("Dependência removida");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

/** Get tasks that block a given task (tasks it's waiting on) */
export function getBlockingTasks(taskId: string, deps: TaskDependency[]) {
  return deps.filter((d) => d.task_id === taskId && d.dependency_type === "waiting_on");
}

/** Get tasks that this task is blocking */
export function getBlockedByThisTask(taskId: string, deps: TaskDependency[]) {
  return deps.filter((d) => d.depends_on_task_id === taskId && d.dependency_type === "waiting_on");
}

/** Check if a task is blocked (has unresolved waiting_on dependencies) */
export function isTaskBlocked(taskId: string, deps: TaskDependency[], taskProgressMap: Record<string, string>) {
  const waitingOn = getBlockingTasks(taskId, deps);
  return waitingOn.some((d) => taskProgressMap[d.depends_on_task_id] !== "Concluído");
}
