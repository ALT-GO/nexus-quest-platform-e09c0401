import { useMemo } from "react";
import { PieChart as PieIcon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { BIChartCard } from "./BIChartCard";
import { BI_COLORS, BI_TOOLTIP_STYLE } from "./bi-theme";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  name: string;
  value: number;
  /** Optional explicit color (HSL). Otherwise pulls from BI_COLORS. */
  color?: string;
}

interface Props {
  title: string;
  data: DonutSlice[];
  /** Total count shown at the center. */
  centerLabel?: string;
  /** Right-side hint. */
  hint?: React.ReactNode;
  onSliceClick?: (slice: DonutSlice) => void;
  emptyMessage?: string;
}

/**
 * Standardized donut + legend layout used in both T.I. and Marketing for parity.
 */
export function BIStatusDonut({
  title,
  data,
  centerLabel,
  hint,
  onSliceClick,
  emptyMessage = "Sem dados no período",
}: Props) {
  const { enriched, total } = useMemo(() => {
    const t = data.reduce((s, d) => s + d.value, 0);
    const e = data.map((d, i) => ({ ...d, color: d.color ?? BI_COLORS[i % BI_COLORS.length] }));
    return { enriched: e, total: t };
  }, [data]);

  const isClickable = !!onSliceClick;

  return (
    <BIChartCard title={title} icon={PieIcon} iconColor="text-primary" hint={hint}>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[200px_1fr]">
          {/* Donut */}
          <div className="relative mx-auto h-[200px] w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={enriched}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="value"
                  className={isClickable ? "cursor-pointer" : ""}
                  onClick={(_, idx) => isClickable && onSliceClick!(enriched[idx])}
                >
                  {enriched.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={BI_TOOLTIP_STYLE} formatter={(v: number, n: string) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums">{total}</span>
              {centerLabel && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {centerLabel}
                </span>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-1.5">
            {enriched.map((s) => {
              const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
              return (
                <div
                  key={s.name}
                  onClick={() => onSliceClick?.(s)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    isClickable && "cursor-pointer hover:bg-muted/50",
                  )}
                >
                  <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                  <span className="truncate text-muted-foreground">{s.name}</span>
                  <span className="ml-auto font-medium tabular-nums">{s.value}</span>
                  <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </BIChartCard>
  );
}
