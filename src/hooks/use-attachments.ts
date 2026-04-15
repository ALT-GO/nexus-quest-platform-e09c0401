import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Attachment {
  id: string;
  entity_type: string;
  entity_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  added_by: string;
  created_at: string;
}

export function useAttachments(entityType: string, entityId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["attachments", entityType, entityId];

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("entity_type", entityType as any)
        .eq("entity_id", entityId as any)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Attachment[]) || [];
    },
  });

  const addAttachment = useMutation({
    mutationFn: async (input: {
      file_name: string;
      file_url: string;
      file_size?: number | null;
      mime_type?: string | null;
      added_by: string;
    }) => {
      const { error } = await supabase.from("attachments").insert({
        entity_type: entityType,
        entity_id: entityId,
        ...input,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Anexo adicionado");
    },
    onError: () => toast.error("Erro ao adicionar anexo"),
  });

  const removeAttachment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("attachments")
        .delete()
        .eq("id", id as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Anexo removido");
    },
    onError: () => toast.error("Erro ao remover anexo"),
  });

  return { attachments, isLoading, addAttachment, removeAttachment };
}
