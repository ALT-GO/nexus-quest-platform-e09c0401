import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TicketComment {
  id: string;
  ticket_id: string;
  author: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

export function useTicketComments(ticketId: string | null) {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ticket_comments")
      .select("*")
      .eq("ticket_id", ticketId as any)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
    } else {
      setComments((data as unknown as TicketComment[]) || []);
    }
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime
  useEffect(() => {
    if (!ticketId) return;
    const channel = supabase
      .channel(`comments-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_comments", filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const newComment = payload.new as unknown as TicketComment;
          setComments((prev) => {
            if (prev.some((c) => c.id === newComment.id)) return prev;
            return [...prev, newComment];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  const addComment = useCallback(
    async (author: string, content: string, avatar_url?: string | null) => {
      if (!ticketId) return false;
      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: ticketId,
        author,
        content,
        avatar_url: avatar_url || null,
      } as any);

      if (error) {
        console.error("Error adding comment:", error);
        toast.error("Erro ao adicionar comentário");
        return false;
      }
      return true;
    },
    [ticketId]
  );

  return { comments, loading, addComment };
}
