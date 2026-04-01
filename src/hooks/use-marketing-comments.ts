import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketingComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

export interface MarketingHistory {
  id: string;
  task_id: string;
  author_name: string;
  action: string;
  details: string;
  created_at: string;
}

export function useMarketingComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["marketing_task_comments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("marketing_task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as MarketingComment[];
    },
    enabled: !!taskId,
  });
}

export function useAddMarketingComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (comment: {
      task_id: string;
      author_id: string;
      author_name: string;
      avatar_url?: string | null;
      content: string;
    }) => {
      const { error } = await supabase
        .from("marketing_task_comments")
        .insert(comment as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["marketing_task_comments", vars.task_id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useMarketingHistory(taskId: string | undefined) {
  return useQuery({
    queryKey: ["marketing_task_history", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("marketing_task_history")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MarketingHistory[];
    },
    enabled: !!taskId,
  });
}

export function useAddMarketingHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      task_id: string;
      author_name: string;
      action: string;
      details: string;
    }) => {
      const { error } = await supabase
        .from("marketing_task_history")
        .insert(entry as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["marketing_task_history", vars.task_id] });
    },
  });
}
