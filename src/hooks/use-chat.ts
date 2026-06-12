import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type ChannelType = "public" | "private" | "dm" | "group";

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  type: ChannelType;
  icon: string;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  author_id: string;
  author_name: string;
  avatar_url: string | null;
  content: string;
  attachments: any[];
  parent_message_id: string | null;
  pinned: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  user_name: string;
  emoji: string;
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  role: "admin" | "member";
  last_read_at: string;
  muted: boolean;
  pinned: boolean;
}

// ---------- Channels ----------
export function useChatChannels() {
  return useQuery({
    queryKey: ["chat-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("archived", false)
        .order("type")
        .order("name");
      if (error) throw error;
      return data as ChatChannel[];
    },
    staleTime: 30_000,
  });
}

export function useUnreadCounts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-unread"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_chat_unread_counts");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[r.channel_id] = Number(r.unread_count);
      });
      return map;
    },
    refetchInterval: 30_000,
  });

  // Realtime: when any new message arrives in any channel, refetch
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chat-unread-watch")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-unread"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return query;
}

export function useTotalUnread() {
  const { data } = useUnreadCounts();
  return useMemo(() => Object.values(data || {}).reduce((a, b) => a + b, 0), [data]);
}

// ---------- Messages ----------
export function useChannelMessages(channelId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-messages", channelId],
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("channel_id", channelId!)
        .is("deleted_at", null)
        .is("parent_message_id", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      // Reverse to display oldest → newest in the UI
      return ((data as ChatMessage[]) || []).slice().reverse();
    },
  });

  // Realtime
  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`chat-msgs-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` },
        () => qc.invalidateQueries({ queryKey: ["chat-messages", channelId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, qc]);

  return query;
}

export function useChannelReactions(channelId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["chat-reactions", channelId],
    enabled: !!channelId,
    queryFn: async () => {
      if (!channelId) return [] as ChatReaction[];
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("channel_id", channelId)
        .limit(500);
      const ids = (msgs || []).map((m) => m.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("chat_reactions")
        .select("*")
        .in("message_id", ids);
      if (error) throw error;
      return data as ChatReaction[];
    },
  });

  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`chat-react-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions" }, () =>
        qc.invalidateQueries({ queryKey: ["chat-reactions", channelId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, qc]);

  return query;
}

export function useSendMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      channel_id,
      content,
      parent_message_id,
      attachments,
    }: {
      channel_id: string;
      content: string;
      parent_message_id?: string | null;
      attachments?: any[];
    }) => {
      if (!user) throw new Error("Not authenticated");
      // Pull profile for name + avatar
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      const { error } = await supabase.from("chat_messages").insert({
        channel_id,
        author_id: user.id,
        author_name: profile?.full_name || user.email || "Usuário",
        avatar_url: profile?.avatar_url || null,
        content,
        parent_message_id: parent_message_id || null,
        attachments: attachments || [],
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["chat-messages", vars.channel_id] });
    },
  });
}

export function useEditMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("chat_messages")
        .update({ content, edited_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-messages"] }),
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chat_messages")
        .update({ deleted_at: new Date().toISOString(), content: "[mensagem removida]" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-messages"] }),
  });
}

export function useTogglePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("chat_messages").update({ pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-messages"] }),
  });
}

export function useToggleReaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!user) throw new Error("Not authenticated");
      // Check existence
      const { data: existing } = await supabase
        .from("chat_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)
        .maybeSingle();
      if (existing) {
        await supabase.from("chat_reactions").delete().eq("id", existing.id);
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        await supabase.from("chat_reactions").insert({
          message_id: messageId,
          user_id: user.id,
          user_name: profile?.full_name || user.email || "Usuário",
          emoji,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-reactions"] }),
  });
}

export function useMarkChannelRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      if (!user) return;
      await supabase
        .from("chat_channel_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("channel_id", channelId)
        .eq("user_id", user.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-unread"] }),
  });
}

// ---------- Members ----------
export function useChannelMembers(channelId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["chat-members", channelId],
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_channel_members")
        .select("*")
        .eq("channel_id", channelId!);
      if (error) throw error;
      return data as ChannelMember[];
    },
  });

  // Realtime member changes
  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`chat-members-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_channel_members", filter: `channel_id=eq.${channelId}` },
        () => qc.invalidateQueries({ queryKey: ["chat-members", channelId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channelId, qc]);

  return query;
}

export function useAddChannelMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, userId, role = "member" }: { channelId: string; userId: string; role?: "admin" | "member" }) => {
      const { error } = await supabase
        .from("chat_channel_members")
        .insert({ channel_id: channelId, user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["chat-members", vars.channelId] }),
  });
}

export function useRemoveChannelMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, userId }: { channelId: string; userId: string }) => {
      const { error, count } = await supabase
        .from("chat_channel_members")
        .delete({ count: "exact" })
        .eq("channel_id", channelId)
        .eq("user_id", userId);
      if (error) throw error;
      if (count === 0) {
        throw new Error("Sem permissão para remover este membro ou ele já foi removido.");
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["chat-members", vars.channelId] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      qc.invalidateQueries({ queryKey: ["chat-unread"] });
    },
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, userId, role }: { channelId: string; userId: string; role: "admin" | "member" }) => {
      const { error } = await supabase
        .from("chat_channel_members")
        .update({ role })
        .eq("channel_id", channelId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["chat-members", vars.channelId] }),
  });
}

// All authenticated users (for picker)
export function useAllUsers() {
  return useQuery({
    queryKey: ["chat-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("full_name");
      if (error) throw error;
      return (data || []) as { id: string; full_name: string; avatar_url: string | null }[];
    },
    staleTime: 60_000,
  });
}

// ---------- Channel CRUD (admin) ----------
export function useCreateChannel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      type: ChannelType;
      icon?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("chat_channels")
        .insert({
          name: input.name,
          description: input.description || "",
          type: input.type,
          icon: input.icon || "hash",
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ChatChannel;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-channels"] }),
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<ChatChannel, "name" | "description" | "icon" | "archived">>;
    }) => {
      const { error } = await supabase.from("chat_channels").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-channels"] }),
  });
}

export function useArchiveChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_channels").update({ archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-channels"] }),
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-channels"] }),
  });
}

// ---------- Presence ----------
export function usePresence() {
  const { user } = useAuth();
  const lastBeatRef = useRef<number>(0);

  // Heartbeat every 30s while tab is active
  useEffect(() => {
    if (!user) return;
    const beat = async (status: "online" | "away" = "online") => {
      const now = Date.now();
      if (now - lastBeatRef.current < 5_000 && status === "online") return;
      lastBeatRef.current = now;
      await supabase
        .from("chat_presence")
        .upsert(
          { user_id: user.id, status, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
    };
    beat("online");
    const interval = setInterval(() => beat("online"), 30_000);
    const onVisibility = () => beat(document.hidden ? "away" : "online");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", () => beat("online"));
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  return useQuery({
    queryKey: ["chat-presence-all"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_presence").select("*");
      if (error) throw error;
      const map: Record<string, { status: string; last_seen_at: string }> = {};
      (data || []).forEach((p: any) => {
        map[p.user_id] = { status: p.status, last_seen_at: p.last_seen_at };
      });
      return map;
    },
    refetchInterval: 60_000,
  });
}
