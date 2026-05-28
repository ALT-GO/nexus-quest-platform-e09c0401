import { useMemo } from "react";
import { Activity, CalendarDays, Clock } from "lucide-react";
import { BIChartCard } from "./BIChartCard";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  items: any[];
  getDate: (item: any) => Date | null | undefined;
  entityNoun?: string;
  mode: "weekday" | "hour";
  description?: string;
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const JS_TO_DISPLAY = [6, 0, 1, 2, 3, 4, 5];

export function BIDimensionHeatmap({
  title,
  items,
  getDate,
  entityNoun = "item",
  mode,
  description,
}: Props) {
  const { buckets, labels, max, total } = useMemo(() => {
    const isWeekday = mode === "weekday";
    const labelsArr = isWeekday ? DAY_LABELS : HOURS.map((h) => `${h}h`);
    const counts = new Array(labelsArr.length).fill(0);
    let totalCount = 0;
    items.forEach((it) => {
      const d = getDate(it);
      if (!d) return;
      const date = new Date(d);
      if (isWeekday) {
        const idx = JS_TO_DISPLAY[date.getDay()];
        counts[idx]++;
        totalCount++;
      } else {
        const hourIdx = HOURS.indexOf(date.getHours());
        if (hourIdx === -1) return;
        counts[hourIdx]++;
        totalCount++;
      }
    });
    const maxV = counts.reduce((m, v) => (v > m ? v : m), 0);
    return { buckets: counts, labels: labelsArr, max: maxV, total: totalCount };
  }, [items, getDate, mode]);

  const intensity = (v: number) => (max === 0 || v === 0 ? 0 : v / max);

  return (
    <BIChartCard
      title={title}
      icon={mode === "weekday" ? CalendarDays : Clock}
      iconColor="text-primary"
      hint={`${total} ${entityNoun}${total !== 1 ? "s" : ""}${mode === "hour" ? " no horário comercial" : ""}`}
      description={
        description ??
        (mode === "weekday"
          ? "Distribuição por dia da semana"
          : "Distribuição por horário (08h–18h)")
      }
    >
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sem dados no período selecionado.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
            {buckets.map((v, idx) => {
              const i = intensity(v);
              return (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div
                    title={`${labels[idx]} — ${v} ${entityNoun}${v !== 1 ? "s" : ""}`}
                    className={cn(
                      "aspect-square w-full rounded-md border border-border/40 transition-transform hover:scale-110 hover:ring-2 hover:ring-primary/40",
                      i === 0 ? "bg-muted/40" : "",
                    )}
                    style={i > 0 ? { background: `hsl(var(--primary) / ${0.15 + i * 0.75})` } : undefined}
                  >
                    {v > 0 && i >= 0.4 && (
                      <div className="flex h-full items-center justify-center text-[11px] font-bold text-primary-foreground">
                        {v}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">{labels[idx]}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2 px-2 pt-2 text-[10px] text-muted-foreground">
            <span>menos</span>
            {[0.15, 0.4, 0.65, 0.9].map((op) => (
              <div
                key={op}
                className="h-3 w-3 rounded-sm border border-border/40"
                style={{ background: `hsl(var(--primary) / ${op})` }}
              />
            ))}
            <span>mais</span>
          </div>
        </div>
      )}
    </BIChartCard>
  );
}
