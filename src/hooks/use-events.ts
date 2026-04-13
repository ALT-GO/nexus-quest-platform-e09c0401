import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface MarketingEvent {
  id: string;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  budget: number;
  actual_cost: number | null;
  notes: string;
  notes_participants: string;
  priority: string;
  status: string;
  checklist: any[];
  leads_gerados: number | null;
  event_type: string;
  created_at: string;
  updated_at: string;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  profile_id: string;
  created_at: string;
}

const QUERY_KEY = "marketing_events";

export function useMarketingEvents() {
  const qc = useQueryClient();

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("marketing-events-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_events" }, () => {
        qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_events")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketingEvent[];
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: Omit<MarketingEvent, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("marketing_events")
        .insert(event as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Evento criado com sucesso");
    },
    onError: () => toast.error("Erro ao criar evento"),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingEvent> & { id: string }) => {
      const { error } = await supabase
        .from("marketing_events")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: () => toast.error("Erro ao atualizar evento"),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Evento excluído");
    },
    onError: () => toast.error("Erro ao excluir evento"),
  });
}

export function useEventParticipants(eventId: string | null) {
  return useQuery({
    queryKey: ["event_participants", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("marketing_event_participants")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data ?? []) as EventParticipant[];
    },
    enabled: !!eventId,
  });
}

export function useManageEventParticipants() {
  const qc = useQueryClient();
  return {
    add: async (eventId: string, profileId: string) => {
      const { error } = await supabase
        .from("marketing_event_participants")
        .insert({ event_id: eventId, profile_id: profileId } as any);
      if (error && !error.message.includes("duplicate")) {
        toast.error("Erro ao adicionar participante");
        return;
      }
      qc.invalidateQueries({ queryKey: ["event_participants", eventId] });
    },
    remove: async (eventId: string, profileId: string) => {
      const { error } = await supabase
        .from("marketing_event_participants")
        .delete()
        .eq("event_id", eventId)
        .eq("profile_id", profileId);
      if (error) {
        toast.error("Erro ao remover participante");
        return;
      }
      qc.invalidateQueries({ queryKey: ["event_participants", eventId] });
    },
  };
}

export function useEventTasks(eventId: string | null) {
  return useQuery({
    queryKey: ["event_tasks", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("marketing_tasks")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!eventId,
  });
}
