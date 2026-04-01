import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketingGoal {
  id: string;
  title: string;
  description: string;
  target_type: string;
  current_value: number;
  target_value: number;
  due_date: string | null;
  status: string;
  color: string;
  folder: string;
  created_at: string;
  updated_at: string;
}

export interface MarketingGoalTarget {
  id: string;
  goal_id: string;
  task_id: string | null;
  manual_value: number;
  created_at: string;
}

export function useMarketingGoals() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("marketing_goals_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_goals" }, () => {
        qc.invalidateQueries({ queryKey: ["marketing_goals"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["marketing_goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_goals")
        .select("*")
        .order("folder")
        .order("created_at");
      if (error) throw error;
      return data as MarketingGoal[];
    },
  });
}

export function useGoalTargets(goalId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`goal_targets_${goalId || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_goal_targets" }, () => {
        qc.invalidateQueries({ queryKey: ["marketing_goal_targets"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, goalId]);

  return useQuery({
    queryKey: ["marketing_goal_targets", goalId],
    queryFn: async () => {
      let q = supabase.from("marketing_goal_targets").select("*");
      if (goalId) q = q.eq("goal_id", goalId);
      const { data, error } = await q;
      if (error) throw error;
      return data as MarketingGoalTarget[];
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Partial<MarketingGoal>) => {
      const { data, error } = await supabase
        .from("marketing_goals")
        .insert(goal as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_goals"] });
      toast.success("Meta criada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingGoal> & { id: string }) => {
      const { error } = await supabase
        .from("marketing_goals")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing_goals"] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_goals"] });
      toast.success("Meta excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useAddGoalTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (target: { goal_id: string; task_id?: string; manual_value?: number }) => {
      const { data, error } = await supabase
        .from("marketing_goal_targets")
        .insert(target as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_goal_targets"] });
      toast.success("Vinculação adicionada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRemoveGoalTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_goal_targets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_goal_targets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}
