import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-chat";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const ORIGINAL_TITLE = typeof document !== "undefined" ? document.title : "Nexus";

/**
 * Global chat notifier:
 * - Updates document.title with unread count
 * - Plays a subtle sound on incoming messages
 * - Shows toast + Web Push when user is mentioned
 */
export function useChatNotifier() {
  const { user } = useAuth();
  const total = useTotalUnread();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSeenIdRef = useRef<Set<string>>(new Set());

  // Title badge
  useEffect(() => {
    if (total > 0) {
      document.title = `(${total}) ${ORIGINAL_TITLE}`;
    } else {
      document.title = ORIGINAL_TITLE;
    }
  }, [total]);

  // Pre-create audio (data URI: short sine beep)
  useEffect(() => {
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRiQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAEAAB/f39/f39/gICAgICAgICAgIB/f39/f39/f39+fn5+fn5+fn5+fn9/f3+AgICAgICAgICAgICAgICAgICAgIB/f39/f39/f3+AgICAgICAgIB/f39/f39/f4CAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f4CAgICAgICAgIB/f39/f4CAgICAgICAgICAgIB/f39/f4CAgICAgIB/f39/gICAgICAgICAgICAgIB/f39/f3+AgICAgICAgIB/f39/f39/gICAgICAgIB/f39/f4CAgICAgIB/f39/gICAgICAgIB/f39/gICAgIB/f4CAgIB/f4CAgIB/f4CAgIB/f4CAgIB/gICAf4CAgH+AgIB/gICAf4CAgH+AgIB/gICAf4CAgH+AgIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/gIB/"
    );
    audioRef.current.volume = 0.25;
  }, []);

  // Listen to ALL new messages globally
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chat-notifier-global")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload: any) => {
        const msg = payload.new;
        if (!msg || msg.author_id === user.id) return;
        if (lastSeenIdRef.current.has(msg.id)) return;
        lastSeenIdRef.current.add(msg.id);

        // Play subtle beep (silenced if blocked)
        try {
          await audioRef.current?.play();
        } catch {
          /* autoplay blocked */
        }

        // Check for mention of current user
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        const myName = profile?.full_name || "";
        const mentioned =
          myName && new RegExp(`@${myName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(msg.content);

        if (mentioned) {
          toast.info(`${msg.author_name} mencionou você`, {
            description: msg.content.slice(0, 100),
            action: {
              label: "Abrir",
              onClick: () => navigate(`/chat?canal=${msg.channel_id}`),
            },
          });
          // Web Push
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(`${msg.author_name} mencionou você`, {
              body: msg.content.slice(0, 140),
              icon: "/favicon.ico",
              tag: `chat-${msg.channel_id}`,
            });
          }
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  // Request notification permission once
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      // Defer until first user interaction
      const ask = () => {
        Notification.requestPermission().catch(() => {});
        window.removeEventListener("click", ask);
      };
      window.addEventListener("click", ask, { once: true });
    }
  }, []);
}
