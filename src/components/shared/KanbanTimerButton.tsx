import { Play, Pause } from "lucide-react";
import { useMarketingTimesheet, useTimesheet, formatDuration } from "@/hooks/use-timesheet";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Props {
  entityId: string;
  type: "ticket" | "marketing";
}

export function KanbanTimerButton({ entityId, type }: Props) {
  const marketing = useMarketingTimesheet(type === "marketing" ? entityId : null as any);
  const ticket = useTimesheet(type === "ticket" ? entityId : null);
  const qc = useQueryClient();

  const hook = type === "marketing" ? marketing : ticket;
  const { running, totalSeconds } = hook;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (running) {
      await hook.pause();
    } else {
      await hook.start();
      // Auto-set progress to "Em andamento" when starting timer
      if (type === "marketing") {
        await supabase
          .from("marketing_tasks")
          .update({ progress: "Em andamento" })
          .eq("id", entityId);
        qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
      } else {
        await supabase
          .from("tickets")
          .update({ progress: "in_progress" })
          .eq("id", entityId);
        qc.invalidateQueries({ queryKey: ["tickets"] });
      }
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
        running
          ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
          : "bg-primary/15 text-primary hover:bg-primary/25"
      )}
    >
      {running ? (
        <>
          <Pause className="h-3 w-3" />
          Pausar timer
          {totalSeconds > 0 && (
            <span className="font-mono tabular-nums ml-1 animate-pulse">
              {formatDuration(totalSeconds)}
            </span>
          )}
        </>
      ) : (
        <>
          <Play className="h-3 w-3" />
          Iniciar timer
          {totalSeconds > 0 && (
            <span className="font-mono tabular-nums ml-1 text-muted-foreground">
              {formatDuration(totalSeconds)}
            </span>
          )}
        </>
      )}
    </button>
  );
}
