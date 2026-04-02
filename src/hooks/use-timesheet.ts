import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface TimesheetLog {
  id: string;
  ticket_id: string | null;
  marketing_task_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  created_at: string;
}

export interface ActiveTimer extends TimesheetLog {
  ticket_title?: string;
  ticket_number?: string;
  ticket_assignee?: string;
  source?: "ti" | "marketing";
  elapsed_seconds: number;
}

export function useTimesheet(ticketId: string | null) {
  const [logs, setLogs] = useState<TimesheetLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!ticketId) { setLogs([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("timesheet_logs")
      .select("*")
      .eq("ticket_id", ticketId as any)
      .order("start_time", { ascending: true });

    const fetched = (data as unknown as TimesheetLog[]) || [];
    setLogs(fetched);

    const active = fetched.find((l) => !l.end_time);
    if (active) {
      setActiveLogId(active.id);
      setRunning(true);
    } else {
      setActiveLogId(null);
      setRunning(false);
    }
    setLoading(false);
  }, [ticketId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    const calc = () => {
      let total = 0;
      logs.forEach((l) => {
        if (l.end_time) {
          total += l.duration_seconds;
        } else {
          total += l.duration_seconds + Math.floor(
            (Date.now() - new Date(l.start_time).getTime()) / 1000
          );
        }
      });
      setElapsed(total);
    };
    calc();
    if (running) {
      intervalRef.current = setInterval(calc, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [logs, running]);

  const start = useCallback(async () => {
    if (!ticketId || running) return;
    const { data, error } = await supabase
      .from("timesheet_logs")
      .insert({ ticket_id: ticketId, start_time: new Date().toISOString(), duration_seconds: 0 } as any)
      .select("*")
      .single();
    if (!error && data) {
      const newLog = data as unknown as TimesheetLog;
      setLogs((prev) => [...prev, newLog]);
      setActiveLogId(newLog.id);
      setRunning(true);
    }
  }, [ticketId, running]);

  const pause = useCallback(async () => {
    if (!activeLogId || !running) return;
    const activeLog = logs.find((l) => l.id === activeLogId);
    if (!activeLog) return;
    const now = new Date();
    const durationSeconds = Math.floor(
      (now.getTime() - new Date(activeLog.start_time).getTime()) / 1000
    );
    await supabase
      .from("timesheet_logs")
      .update({ end_time: now.toISOString(), duration_seconds: durationSeconds } as any)
      .eq("id", activeLogId as any);
    setLogs((prev) =>
      prev.map((l) =>
        l.id === activeLogId
          ? { ...l, end_time: now.toISOString(), duration_seconds: durationSeconds }
          : l
      )
    );
    setActiveLogId(null);
    setRunning(false);
  }, [activeLogId, running, logs]);

  const stop = useCallback(async () => {
    if (running) await pause();
  }, [running, pause]);

  const totalSeconds = elapsed;
  return { logs, loading, running, totalSeconds, start, pause, stop, fetchLogs };
}

/**
 * Hook for marketing task timers - same pattern as useTimesheet but for marketing_task_id
 */
export function useMarketingTimesheet(marketingTaskId: string | null) {
  const [logs, setLogs] = useState<TimesheetLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!marketingTaskId) { setLogs([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("timesheet_logs")
      .select("*")
      .eq("marketing_task_id", marketingTaskId as any)
      .order("start_time", { ascending: true });

    const fetched = (data as unknown as TimesheetLog[]) || [];
    setLogs(fetched);

    const active = fetched.find((l) => !l.end_time);
    if (active) {
      setActiveLogId(active.id);
      setRunning(true);
    } else {
      setActiveLogId(null);
      setRunning(false);
    }
    setLoading(false);
  }, [marketingTaskId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    const calc = () => {
      let total = 0;
      logs.forEach((l) => {
        if (l.end_time) {
          total += l.duration_seconds;
        } else {
          total += l.duration_seconds + Math.floor(
            (Date.now() - new Date(l.start_time).getTime()) / 1000
          );
        }
      });
      setElapsed(total);
    };
    calc();
    if (running) {
      intervalRef.current = setInterval(calc, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [logs, running]);

  const start = useCallback(async () => {
    if (!marketingTaskId || running) return;

    // Auto-update progress to "Em andamento" if currently "Não iniciado"
    const { data: task } = await supabase
      .from("marketing_tasks")
      .select("progress")
      .eq("id", marketingTaskId as any)
      .single();

    if (task && (task as any).progress === "Não iniciado") {
      await supabase
        .from("marketing_tasks")
        .update({ progress: "Em andamento", updated_at: new Date().toISOString() } as any)
        .eq("id", marketingTaskId as any);
    }

    const { data, error } = await supabase
      .from("timesheet_logs")
      .insert({ marketing_task_id: marketingTaskId, start_time: new Date().toISOString(), duration_seconds: 0 } as any)
      .select("*")
      .single();
    if (!error && data) {
      const newLog = data as unknown as TimesheetLog;
      setLogs((prev) => [...prev, newLog]);
      setActiveLogId(newLog.id);
      setRunning(true);
    }
  }, [marketingTaskId, running]);

  const pause = useCallback(async () => {
    if (!activeLogId || !running) return;
    const activeLog = logs.find((l) => l.id === activeLogId);
    if (!activeLog) return;
    const now = new Date();
    const durationSeconds = Math.floor(
      (now.getTime() - new Date(activeLog.start_time).getTime()) / 1000
    );
    await supabase
      .from("timesheet_logs")
      .update({ end_time: now.toISOString(), duration_seconds: durationSeconds } as any)
      .eq("id", activeLogId as any);
    setLogs((prev) =>
      prev.map((l) =>
        l.id === activeLogId
          ? { ...l, end_time: now.toISOString(), duration_seconds: durationSeconds }
          : l
      )
    );
    setActiveLogId(null);
    setRunning(false);
  }, [activeLogId, running, logs]);

  const stop = useCallback(async () => {
    if (running) await pause();
  }, [running, pause]);

  const totalSeconds = elapsed;
  return { logs, loading, running, totalSeconds, start, pause, stop, fetchLogs };
}

/**
 * Hook that fetches all currently running timers (end_time IS NULL)
 * for both tickets AND marketing tasks.
 */
export function useActiveTimers(userTicketIds?: string[]) {
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isAdmin, user } = useAuth();
  const hasRoleRef = useRef<(role: string) => boolean>(() => false);

  // Keep hasRole in a ref to avoid dependency issues
  const { hasRole } = useAuth();
  hasRoleRef.current = hasRole;

  const fetchActive = useCallback(async () => {
    setLoading(true);

    const { data: logs } = await supabase
      .from("timesheet_logs")
      .select("*")
      .is("end_time", null)
      .order("start_time", { ascending: false });

    const fetched = (logs as unknown as TimesheetLog[]) || [];

    if (fetched.length === 0) {
      setActiveTimers([]);
      setLoading(false);
      return;
    }

    // Separate TI ticket logs and marketing logs
    const tiLogs = fetched.filter((l) => l.ticket_id);
    const mktLogs = fetched.filter((l) => l.marketing_task_id);

    // Fetch TI ticket info
    const ticketIds = [...new Set(tiLogs.map((l) => l.ticket_id!))];
    let ticketMap = new Map<string, any>();
    if (ticketIds.length > 0) {
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, title, ticket_number, assignee")
        .in("id", ticketIds as any);
      ticketMap = new Map(((tickets as any[]) || []).map((t: any) => [t.id, t]));
    }

    // Fetch marketing task info (include assignee_id for filtering)
    const mktIds = [...new Set(mktLogs.map((l) => l.marketing_task_id!))];
    let mktMap = new Map<string, any>();
    if (mktIds.length > 0) {
      const { data: mktTasks } = await supabase
        .from("marketing_tasks")
        .select("id, title, assignee_name, assignee_id")
        .in("id", mktIds as any);
      mktMap = new Map(((mktTasks as any[]) || []).map((t: any) => [t.id, t]));
    }

    // Get current user info for filtering
    let currentUserName = "";
    const currentUserId = user?.id || "";
    if (user && !isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      currentUserName = profile?.full_name || "";
    }

    const now = Date.now();
    let timers: ActiveTimer[] = fetched.map((l) => {
      if (l.ticket_id) {
        const ticket = ticketMap.get(l.ticket_id);
        return {
          ...l,
          ticket_title: ticket?.title || "",
          ticket_number: ticket?.ticket_number || "",
          ticket_assignee: ticket?.assignee || "",
          _assignee_id: null as string | null,
          source: "ti" as const,
          elapsed_seconds: Math.floor((now - new Date(l.start_time).getTime()) / 1000),
        };
      } else {
        const mkt = mktMap.get(l.marketing_task_id!);
        return {
          ...l,
          ticket_title: mkt?.title || "",
          ticket_number: "MKT",
          ticket_assignee: mkt?.assignee_name || "",
          _assignee_id: (mkt?.assignee_id as string) || null,
          source: "marketing" as const,
          elapsed_seconds: Math.floor((now - new Date(l.start_time).getTime()) / 1000),
        };
      }
    });

    // Admin sees all timers
    if (!isAdmin && currentUserId) {
      const isTi = hasRoleRef.current("ti" as any);
      const isMkt = hasRoleRef.current("marketing" as any);

      timers = timers.filter((t) => {
        if (t.source === "ti") {
          // TI users see TI timers assigned to them
          return isTi && t.ticket_assignee === currentUserName;
        } else {
          // Marketing users see all marketing timers (their team)
          // OR if they are the assignee by ID or name
          if (isMkt) return true;
          return (
            (t as any)._assignee_id === currentUserId ||
            t.ticket_assignee === currentUserName
          );
        }
      });
    }

    // Clean up internal field
    const cleanTimers: ActiveTimer[] = timers.map(({ _assignee_id, ...rest }: any) => rest);

    setActiveTimers(cleanTimers);
    setLoading(false);
  }, [isAdmin, user]);

  // Initial fetch
  useEffect(() => { fetchActive(); }, [fetchActive]);

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel("active_timers_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timesheet_logs" },
        () => {
          fetchActive();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActive]);

  // Tick elapsed every second
  useEffect(() => {
    if (activeTimers.length === 0) return;
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      setActiveTimers((prev) =>
        prev.map((t) => ({
          ...t,
          elapsed_seconds: Math.floor((now - new Date(t.start_time).getTime()) / 1000),
        }))
      );
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTimers.length]);

  return { activeTimers, loading, refetch: fetchActive };
}

// Utility: format seconds to HH:mm:ss
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Fetch total timesheet seconds for a list of ticket IDs (for dashboard)
export async function fetchTimesheetTotals(
  ticketIds: string[]
): Promise<Record<string, number>> {
  if (ticketIds.length === 0) return {};

  const { data } = await supabase
    .from("timesheet_logs")
    .select("ticket_id, duration_seconds")
    .in("ticket_id", ticketIds as any)
    .not("end_time", "is", null);

  const totals: Record<string, number> = {};
  ((data as unknown as { ticket_id: string; duration_seconds: number }[]) || []).forEach((row) => {
    totals[row.ticket_id] = (totals[row.ticket_id] || 0) + row.duration_seconds;
  });
  return totals;
}

// Fetch total timesheet seconds for a list of marketing task IDs
export async function fetchMarketingTimesheetTotals(
  taskIds: string[]
): Promise<Record<string, number>> {
  if (taskIds.length === 0) return {};

  const { data } = await supabase
    .from("timesheet_logs")
    .select("marketing_task_id, duration_seconds")
    .in("marketing_task_id", taskIds as any)
    .not("end_time", "is", null);

  const totals: Record<string, number> = {};
  ((data as unknown as { marketing_task_id: string; duration_seconds: number }[]) || []).forEach((row) => {
    totals[row.marketing_task_id] = (totals[row.marketing_task_id] || 0) + row.duration_seconds;
  });
  return totals;
}

// Fetch timesheet logs filtered by date range (for dashboard charts)
export async function fetchTimesheetByDateRange(
  dateRange: { start: Date; end: Date }
): Promise<{ ticket_id: string; start_time: string; end_time: string | null; duration_seconds: number }[]> {
  const { data } = await supabase
    .from("timesheet_logs")
    .select("ticket_id, start_time, end_time, duration_seconds")
    .gte("start_time", dateRange.start.toISOString())
    .lte("start_time", dateRange.end.toISOString());

  return (data as unknown as { ticket_id: string; start_time: string; end_time: string | null; duration_seconds: number }[]) || [];
}
