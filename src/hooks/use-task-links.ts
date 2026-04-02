import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TaskLink {
  id: string;
  task_id: string;
  linked_task_id: string | null;
  linked_event_id: string | null;
  link_type: string;
  created_at: string;
}

const QUERY_KEY = "marketing_task_links";

export function useTaskLinks(taskId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, taskId],
    queryFn: async () => {
      if (!taskId) return [];
      // Get links where this task is the source
      const { data: outgoing } = await supabase
        .from("marketing_task_links")
        .select("*")
        .eq("task_id", taskId as any);

      // Get links where this task is the target
      const { data: incoming } = await supabase
        .from("marketing_task_links")
        .select("*")
        .eq("linked_task_id", taskId as any);

      return [...((outgoing as unknown as TaskLink[]) || []), ...((incoming as unknown as TaskLink[]) || [])];
    },
    enabled: !!taskId,
  });
}

export function useAddTaskLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (link: { task_id: string; linked_task_id?: string; linked_event_id?: string; link_type?: string }) => {
      const { error } = await supabase
        .from("marketing_task_links")
        .insert({
          task_id: link.task_id,
          linked_task_id: link.linked_task_id || null,
          linked_event_id: link.linked_event_id || null,
          link_type: link.link_type || "related",
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Link adicionado");
    },
    onError: () => toast.error("Erro ao adicionar link"),
  });
}

export function useRemoveTaskLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("marketing_task_links")
        .delete()
        .eq("id", linkId as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: () => toast.error("Erro ao remover link"),
  });
}
