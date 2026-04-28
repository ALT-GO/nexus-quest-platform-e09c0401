import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { formatDuration } from "@/hooks/use-timesheet";

interface TimesheetLog {
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
}

interface TimeByCategoryChartProps {
  title?: string;
  /**
   * Map of entity ID -> category label.
   * Used to attribute each timesheet log to a category.
   */
  entityCategoryMap: Record<string, string>;
  /** Timesheet logs in the selected period. */
  logs: (TimesheetLog & { entityId: string | null })[];
  /** Singular noun for entities (e.g. "chamado", "tarefa"). Used in tooltip/labels. */
  entityNoun?: string;
  emptyMessage?: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--destructive))",
  "hsl(var(--chart-2))",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

export function TimeByCategoryChart({
  title = "Tempo por Categoria",
  entityCategoryMap,
  logs,
  entityNoun = "item",
  emptyMessage = "Nenhum tempo registrado no período",
}: TimeByCategoryChartProps) {
  const data = useMemo(() => {
    const totals: Record<string, number> = {};
    const entitySetByCat: Record<string, Set<string>> = {};
    const now = Date.now();
    logs.forEach((l) => {
      if (!l.entityId) return;
      const cat = entityCategoryMap[l.entityId];
      if (!cat) return; // skip orphan logs
      let secs = 0;
      if (l.end_time) {
        secs = l.duration_seconds;
      } else {
        // running timer — count live elapsed
        secs = Math.floor((now - new Date(l.start_time).getTime()) / 1000);
      }
      if (secs > 0) {
        totals[cat] = (totals[cat] || 0) + secs;
        if (!entitySetByCat[cat]) entitySetByCat[cat] = new Set();
        entitySetByCat[cat].add(l.entityId);
      }
    });
    return Object.entries(totals)
      .map(([name, seconds], i) => {
        const count = entitySetByCat[name]?.size || 0;
        const avgSeconds = count > 0 ? seconds / count : 0;
        return {
          name: name.length > 28 ? name.slice(0, 25) + "…" : name,
          fullName: name,
          seconds,
          hours: Math.round((seconds / 3600) * 10) / 10,
          count,
          avgSeconds,
          avgHours: Math.round((avgSeconds / 3600) * 10) / 10,
          color: COLORS[i % COLORS.length],
        };
      })
      .sort((a, b) => b.seconds - a.seconds);
  }, [logs, entityCategoryMap]);

  const totalSeconds = data.reduce((s, d) => s + d.seconds, 0);
  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const overallAvgSeconds = totalCount > 0 ? totalSeconds / totalCount : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {title}
          {totalSeconds > 0 && (
            <span className="ml-auto flex items-center gap-3 text-xs font-mono text-muted-foreground">
              <span>Total: {formatDuration(totalSeconds)}</span>
              <span className="text-primary">
                Média: {formatDuration(Math.round(overallAvgSeconds))}/{entityNoun}
              </span>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 10, right: 80, top: 4, bottom: 4 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  unit="h"
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  formatter={(_value: number, name: string, props: any) => {
                    if (name === "hours") {
                      return [
                        `${props.payload.hours}h (${formatDuration(props.payload.seconds)}) — ${props.payload.count} ${entityNoun}${props.payload.count > 1 ? "s" : ""}`,
                        "Tempo total",
                      ];
                    }
                    return [
                      `${props.payload.avgHours}h (${formatDuration(Math.round(props.payload.avgSeconds))})`,
                      `Média por ${entityNoun}`,
                    ];
                  }}
                  labelFormatter={(_label, payload) =>
                    payload?.[0]?.payload?.fullName ?? ""
                  }
                />
                <Bar dataKey="hours" name="hours" radius={[0, 4, 4, 0]} barSize={18}>
                  {data.map((entry, i) => (
                    <Cell key={`t-${i}`} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="hours"
                    position="right"
                    formatter={(v: number) => `${v}h`}
                    style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
                <Bar dataKey="avgHours" name="avgHours" radius={[0, 4, 4, 0]} barSize={10}>
                  {data.map((entry, i) => (
                    <Cell key={`a-${i}`} fill={entry.color} fillOpacity={0.4} />
                  ))}
                  <LabelList
                    dataKey="avgHours"
                    position="right"
                    formatter={(v: number) => `~${v}h/${entityNoun}`}
                    style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.length > 0 && (
          <div className="mt-3 flex items-center justify-end gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-primary" />
              Tempo total
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-primary/40" />
              Média por {entityNoun}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
