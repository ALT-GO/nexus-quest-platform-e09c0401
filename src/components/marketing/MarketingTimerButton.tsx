import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarketingTimesheet, formatDuration } from "@/hooks/use-timesheet";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  size?: "card" | "detail";
}

export function MarketingTimerButton({ taskId, size = "card" }: Props) {
  const { running, totalSeconds, start, pause } = useMarketingTimesheet(taskId);
  const qc = useQueryClient();

  const handleToggle = async () => {
    if (running) {
      await pause();
    } else {
      await start();
      // Refresh marketing tasks to reflect progress change
      qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
    }
  };

  if (size === "card") {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 flex-shrink-0",
          running
            ? "text-destructive hover:text-destructive/80"
            : "text-muted-foreground hover:text-primary"
        )}
        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
        title={running ? "Pausar timer" : "Iniciar timer"}
      >
        {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={running ? "destructive" : "default"}
        size="sm"
        onClick={handleToggle}
        className="gap-1.5"
      >
        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {running ? "Pausar" : "Iniciar Timer"}
      </Button>
      {totalSeconds > 0 && (
        <span className="text-sm font-mono tabular-nums text-muted-foreground">
          {formatDuration(totalSeconds)}
        </span>
      )}
    </div>
  );
}
