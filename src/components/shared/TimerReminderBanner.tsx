import { useState, useEffect } from "react";
import { Timer, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasActiveTimer } from "@/hooks/use-timesheet";
import { cn } from "@/lib/utils";

interface Props {
  entityId: string;
  type: "ticket" | "marketing";
  isInProgress: boolean;
  onStartTimer: () => void;
}

export function TimerReminderBanner({ entityId, type, isInProgress, onStartTimer }: Props) {
  const [hasTimer, setHasTimer] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!entityId || !isInProgress) return;
    let cancelled = false;
    hasActiveTimer(entityId, type).then((result) => {
      if (!cancelled) setHasTimer(result);
    });
    const interval = setInterval(() => {
      hasActiveTimer(entityId, type).then((result) => {
        if (!cancelled) setHasTimer(result);
      });
    }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [entityId, type, isInProgress]);

  useEffect(() => {
    setDismissed(false);
  }, [entityId]);

  if (!isInProgress || hasTimer || dismissed) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 mb-3">
      <Timer className="h-4 w-4 text-warning flex-shrink-0 animate-pulse" />
      <span className="text-xs text-warning-foreground flex-1">
        Esta tarefa está em andamento sem timer ativo. Deseja iniciar?
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1 border-warning/50 hover:bg-warning/20"
        onClick={() => {
          onStartTimer();
          setHasTimer(true);
        }}
      >
        <Play className="h-3 w-3" />
        Iniciar
      </Button>
      <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
