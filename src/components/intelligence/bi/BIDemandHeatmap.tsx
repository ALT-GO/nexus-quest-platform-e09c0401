import { useMemo } from "react";
import { Activity } from "lucide-react";
import { BIChartCard } from "./BIChartCard";
import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  /** Items to plot. */
  items: any[];
  /** Get a Date from an item, or null to skip. */
  getDate: (item: any) => Date | null | undefined;
  entityNoun?: string;
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
// JS getDay(): 0=Sun..6=Sat. Map to display index where 0=Mon..6=Sun.
const JS_TO_DISPLAY = [6, 0, 1, 2, 3, 4, 5];

/**
 * Demand heatmap — Day of week × Hour of day.
 * Reveals when the team gets hit hardest.
 */
export function BIDemandHeatmap({
  title = "Mapa de Calor da Demanda",
  items,
  getDate,
  entityNoun = "item",
}: Props) {
  const { matrix, max, total } = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () => Array(HOURS.length).fill(0));
    let totalCount = 0;
    items.forEach((it) => {
      const d = getDate(it);
      if (!d) return;
      const date = new Date(d);
      const dayDisplay = JS_TO_DISPLAY[date.getDay()];
      const hour = date.getHours();
      const hourIdx = HOURS.indexOf(hour);
      if (hourIdx === -1) return;
      m[dayDisplay][hourIdx]++;
      totalCount++;
    });
    let maxV = 0;
    m.forEach((row) => row.forEach((v) => { if (v > maxV) maxV = v; }));
    return { matrix: m, max: maxV, total: totalCount };
  }, [items, getDate]);

  const intensity = (v: number) => {
    if (max === 0 || v === 0) return 0;
    return v / max;
  };

  return (
    <BIChartCard
      title={title}
      icon={Activity}
      iconColor="text-primary"
      hint={`${total} ${entityNoun}${total !== 1 ? "s" : ""} no horário comercial`}
      description="Identifique picos de demanda por dia e horário (08h–18h)"
    >
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sem dados no período selecionado.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Hour header */}
            <div className="flex">
              <div className="w-10 shrink-0" />
              {HOURS.map((h) => (
                <div key={h} className="flex-1 px-0.5 text-center text-[10px] text-muted-foreground">
                  {h}h
                </div>
              ))}
            </div>
            {/* Rows */}
            {matrix.map((row, dayIdx) => (
              <div key={dayIdx} className="mt-1 flex items-center">
                <div className="w-10 shrink-0 text-[11px] font-medium text-muted-foreground">
                  {DAY_LABELS[dayIdx]}
                </div>
                {row.map((v, hIdx) => {
                  const i = intensity(v);
                  return (
                    <div key={hIdx} className="flex-1 px-0.5">
                      <div
                        title={`${DAY_LABELS[dayIdx]} ${HOURS[hIdx]}h — ${v} ${entityNoun}${v !== 1 ? "s" : ""}`}
                        className={cn(
                          "aspect-square w-full rounded-md border border-border/40 transition-transform hover:scale-110 hover:ring-2 hover:ring-primary/40",
                          i === 0 ? "bg-muted/40" : "",
                        )}
                        style={
                          i > 0
                            ? {
                                background: `hsl(var(--primary) / ${0.15 + i * 0.75})`,
                              }
                            : undefined
                        }
                      >
                        {v > 0 && i >= 0.4 && (
                          <div className="flex h-full items-center justify-center text-[10px] font-bold text-primary-foreground">
                            {v}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Scale legend */}
            <div className="mt-3 flex items-center justify-end gap-2 px-2 text-[10px] text-muted-foreground">
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
        </div>
      )}
    </BIChartCard>
  );
}
