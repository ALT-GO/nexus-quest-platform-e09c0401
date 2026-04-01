import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Timer, Pause } from "lucide-react";
import { useActiveTimers, formatDuration } from "@/hooks/use-timesheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function GlobalTimerBadge() {
  const [open, setOpen] = useState(false);
  const { activeTimers, refetch } = useActiveTimers();

  const handlePause = async (logId: string, startTime: string) => {
    const now = new Date();
    const durationSeconds = Math.floor(
      (now.getTime() - new Date(startTime).getTime()) / 1000
    );
    const { error } = await supabase
      .from("timesheet_logs")
      .update({
        end_time: now.toISOString(),
        duration_seconds: durationSeconds,
      } as any)
      .eq("id", logId as any);

    if (error) {
      toast.error("Erro ao pausar timer");
    } else {
      toast.success("Timer pausado");
      refetch();
    }
  };

  if (activeTimers.length === 0) return null;

  const latest = activeTimers[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20">
          <Timer className="h-3.5 w-3.5 animate-pulse" />
          <span className="font-mono tabular-nums text-xs">
            {formatDuration(latest.elapsed_seconds)}
          </span>
          {activeTimers.length > 1 && (
            <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] leading-none">
              +{activeTimers.length - 1}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Timers Ativos</p>
          <p className="text-xs text-muted-foreground">
            {activeTimers.length} timer{activeTimers.length > 1 ? "s" : ""} rodando
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {activeTimers.map((timer) => (
            <div
              key={timer.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {timer.ticket_title || "Sem título"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {timer.ticket_number} {timer.ticket_assignee ? `· ${timer.ticket_assignee}` : ""}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-primary tabular-nums">
                {formatDuration(timer.elapsed_seconds)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handlePause(timer.id, timer.start_time)}
                title="Pausar"
              >
                <Pause className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
