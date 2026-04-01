import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TimesheetLog {
  id: string;
  ticket_id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  created_at: string;
}

export interface ActiveTimer extends TimesheetLog {
  ticket_title?: string;
  ticket_number?: string;
  ticket_assignee?: string;
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
 * Hook that fetches all currently running timers (end_time IS NULL)
 * for tickets assigned to the logged-in user.
 * Returns the list ordered by most recently started, with live elapsed seconds.
 */
export function useActiveTimers(userTicketIds?: string[]) {
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActive = useCallback(async () => {
    setLoading(true);

    // Fetch ALL active timers (end_time IS NULL) regardless of user
    let query = supabase
      .from("timesheet_logs")
      .select("*")
      .is("end_time", null)
      .order("start_time", { ascending: false });

    const { data: logs } = await query;

    const fetched = (logs as unknown as TimesheetLog[]) || [];

    if (fetched.length === 0) {
      setActiveTimers([]);
      setLoading(false);
      return;
    }

    // Fetch ticket info for each running timer
    const ticketIds = [...new Set(fetched.map((l) => l.ticket_id))];
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, title, ticket_number, assignee")
      .in("id", ticketIds as any);

    const ticketMap = new Map(
      ((tickets as any[]) || []).map((t: any) => [t.id, t])
    );

    const now = Date.now();
    const timers: ActiveTimer[] = fetched.map((l) => {
      const ticket = ticketMap.get(l.ticket_id);
      return {
        ...l,
        ticket_title: ticket?.title || "",
        ticket_number: ticket?.ticket_number || "",
        ticket_assignee: ticket?.assignee || "",
        elapsed_seconds: Math.floor((now - new Date(l.start_time).getTime()) / 1000),
      };
    });

    setActiveTimers(timers);
    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => { fetchActive(); }, [fetchActive]);

  // Live tick every second to update elapsed
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
