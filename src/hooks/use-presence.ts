import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type PresenceStatus = "online" | "away" | "offline";

export interface PresenceRow {
  status: string;
  last_seen_at: string;
}

const HEARTBEAT_INTERVAL_MS = 30_000; // beat every 30s
const AWAY_THRESHOLD_MS = 5 * 60_000; // 5 min idle => away
const OFFLINE_THRESHOLD_MS = 90_000; // no beat for 90s => treat as offline

/**
 * Initializes presence tracking for the current user.
 * Sends "online" while tab is visible AND there was recent user activity.
 * Sends "away" when tab is hidden or user idle >5min.
 * Marks "offline" via beforeunload (best-effort).
 * Should be mounted ONCE globally (in App.tsx).
 */
export function usePresenceTracker() {
  const { user } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const lastBeatRef = useRef<number>(0);
  const lastStatusRef = useRef<PresenceStatus | null>(null);

  useEffect(() => {
    if (!user) return;

    const beat = async (status: PresenceStatus, force = false) => {
      const now = Date.now();
      if (!force && status === lastStatusRef.current && now - lastBeatRef.current < HEARTBEAT_INTERVAL_MS) {
        return;
      }
      lastBeatRef.current = now;
      lastStatusRef.current = status;
      await supabase.from("chat_presence").upsert(
        {
          user_id: user.id,
          status,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    };

    const computeStatus = (): PresenceStatus => {
      if (document.hidden) return "away";
      const idle = Date.now() - lastActivityRef.current;
      if (idle > AWAY_THRESHOLD_MS) return "away";
      return "online";
    };

    const tick = () => {
      void beat(computeStatus());
    };

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      // If we were away due to idle, immediately come back online
      if (lastStatusRef.current !== "online" && !document.hidden) {
        void beat("online", true);
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        void beat("away", true);
      } else {
        lastActivityRef.current = Date.now();
        void beat("online", true);
      }
    };

    const onUnload = () => {
      // Best-effort offline marker via keepalive fetch
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_presence?user_id=eq.${user.id}`;
        const body = JSON.stringify({
          status: "offline",
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        fetch(url, {
          method: "PATCH",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            Prefer: "return=minimal",
          },
          body,
        });
      } catch {
        // ignore
      }
    };

    // Initial beat
    void beat("online", true);

    const interval = setInterval(tick, HEARTBEAT_INTERVAL_MS);

    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "focus"] as const;
    activityEvents.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);

    return () => {
      clearInterval(interval);
      activityEvents.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [user]);
}

/**
 * Subscribes to ALL users' presence with realtime updates.
 * Returns a map of user_id => derived PresenceStatus.
 * "online" only if heartbeat within 90s, otherwise "offline".
 */
export function usePresenceMap() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["presence-map"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_presence").select("user_id,status,last_seen_at");
      if (error) throw error;
      const map: Record<string, { status: string; last_seen_at: string }> = {};
      (data || []).forEach((p: any) => {
        map[p.user_id] = { status: p.status, last_seen_at: p.last_seen_at };
      });
      return map;
    },
    // Re-fetch every 45s so stale rows get re-evaluated as offline
    refetchInterval: 45_000,
    staleTime: 20_000,
  });

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chat_presence_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_presence" },
        (payload: any) => {
          const row = (payload.new || payload.old) as any;
          if (!row?.user_id) return;
          qc.setQueryData<Record<string, { status: string; last_seen_at: string }>>(
            ["presence-map"],
            (prev = {}) => {
              if (payload.eventType === "DELETE") {
                const { [row.user_id]: _, ...rest } = prev;
                return rest;
              }
              return {
                ...prev,
                [row.user_id]: { status: row.status, last_seen_at: row.last_seen_at },
              };
            }
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return query.data || {};
}

/** Pure helper — derive a status from raw row. */
export function derivePresenceStatus(row?: { status: string; last_seen_at: string } | null): PresenceStatus {
  if (!row) return "offline";
  const last = new Date(row.last_seen_at).getTime();
  if (Number.isNaN(last)) return "offline";
  const age = Date.now() - last;
  if (age > OFFLINE_THRESHOLD_MS) return "offline";
  if (row.status === "away") return "away";
  if (row.status === "offline") return "offline";
  return "online";
}
