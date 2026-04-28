import { useMemo } from "react";
import { differenceInBusinessDays } from "date-fns";
import { Users } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Progress } from "@/components/ui/progress";
import { BIChartCard } from "./BIChartCard";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/hooks/use-timesheet";

interface PersonWorkload {
  name: string;
  userId?: string | null;
  avatarUrl?: string | null;
  /** Total seconds worked in the period. */
  workedSeconds: number;
  /** Active items currently assigned to this person. */
  activeCount: number;
  /** Items completed in the period. */
  completedCount: number;
}

interface Props {
  title?: string;
  people: PersonWorkload[];
  dateRange: { start: Date; end: Date };
  /** Expected daily working hours per person (default 6). */
  expectedHoursPerDay?: number;
  onPersonClick?: (name: string) => void;
}

/**
 * Workload/Capacity chart — shows realized vs expected hours per person.
 * Helps the coordinator spot overload and idle resources at a glance.
 */
export function BIWorkloadChart({
  title = "Carga de Trabalho por Pessoa",
  people,
  dateRange,
  expectedHoursPerDay = 6,
  onPersonClick,
}: Props) {
  const businessDays = useMemo(() => {
    return Math.max(1, differenceInBusinessDays(dateRange.end, dateRange.start) + 1);
  }, [dateRange]);

  const expectedHours = businessDays * expectedHoursPerDay;

  const enriched = useMemo(() => {
    return people
      .map((p) => {
        const hours = p.workedSeconds / 3600;
        const utilizationPct = expectedHours > 0 ? (hours / expectedHours) * 100 : 0;
        return { ...p, hours, utilizationPct };
      })
      .sort((a, b) => b.workedSeconds - a.workedSeconds);
  }, [people, expectedHours]);

  return (
    <BIChartCard
      title={title}
      icon={Users}
      iconColor="text-primary"
      hint={`${businessDays} dias úteis · esperado ${expectedHours.toFixed(0)}h/pessoa`}
    >
      {enriched.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum registro de tempo no período.
        </p>
      ) : (
        <div className="space-y-3">
          {enriched.map((p) => {
            const pct = p.utilizationPct;
            // semantic color
            const barColor =
              pct >= 110 ? "bg-destructive" :
              pct >= 90 ? "bg-warning" :
              pct >= 60 ? "bg-success" :
              pct >= 30 ? "bg-info" :
              "bg-muted-foreground/40";
            const label =
              pct >= 110 ? "Sobrecarga" :
              pct >= 90 ? "No limite" :
              pct >= 60 ? "Saudável" :
              pct >= 30 ? "Folgado" :
              "Ocioso";
            const labelColor =
              pct >= 110 ? "text-destructive" :
              pct >= 90 ? "text-warning" :
              pct >= 60 ? "text-success" :
              pct >= 30 ? "text-info" :
              "text-muted-foreground";

            return (
              <div
                key={p.name}
                onClick={() => onPersonClick?.(p.name)}
                className={cn(
                  "rounded-lg p-2.5 transition-colors",
                  onPersonClick && "cursor-pointer hover:bg-muted/40",
                )}
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={p.name}
                    avatarUrl={p.avatarUrl}
                    userId={p.userId}
                    className="h-8 w-8 shrink-0"
                    fallbackClassName="text-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {formatDuration(p.workedSeconds)}
                        <span className="mx-1.5 text-border">·</span>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", barColor)}
                          style={{ width: `${Math.min(pct, 130)}%` }}
                        />
                      </div>
                      <span className={cn("shrink-0 text-[10px] font-semibold uppercase", labelColor)}>
                        {label}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                      <span>{p.activeCount} ativos</span>
                      <span>·</span>
                      <span>{p.completedCount} concluídos no período</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BIChartCard>
  );
}
