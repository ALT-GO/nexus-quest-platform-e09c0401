import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketingTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export function useMarketingTags() {
  return useQuery({
    queryKey: ["marketing_tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_tags")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as MarketingTag[];
    },
  });
}

export function useTaskTags(taskId: string | undefined) {
  return useQuery({
    queryKey: ["marketing_task_tags", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("marketing_task_tags")
        .select("tag_id, marketing_tags(*)")
        .eq("task_id", taskId);
      if (error) throw error;
      return (data || []).map((d: any) => d.marketing_tags as MarketingTag).filter(Boolean);
    },
    enabled: !!taskId,
  });
}

export function useAllTaskTags() {
  return useQuery({
    queryKey: ["marketing_task_tags_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_task_tags")
        .select("task_id, tag_id, marketing_tags(*)");
      if (error) throw error;
      const map: Record<string, MarketingTag[]> = {};
      (data || []).forEach((d: any) => {
        if (!d.marketing_tags) return;
        if (!map[d.task_id]) map[d.task_id] = [];
        map[d.task_id].push(d.marketing_tags as MarketingTag);
      });
      return map;
    },
  });
}

export function useCreateMarketingTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tag: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from("marketing_tags")
        .insert(tag as any)
        .select()
        .single();
      if (error) throw error;
      return data as MarketingTag;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_tags"] });
      toast.success("Tag criada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useToggleTaskTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, tagId, action }: { taskId: string; tagId: string; action: "add" | "remove" }) => {
      if (action === "add") {
        const { error } = await supabase
          .from("marketing_task_tags")
          .insert({ task_id: taskId, tag_id: tagId } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("marketing_task_tags")
          .delete()
          .eq("task_id", taskId)
          .eq("tag_id", tagId);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["marketing_task_tags", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["marketing_task_tags_all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}
