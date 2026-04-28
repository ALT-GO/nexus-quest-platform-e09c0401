import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
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
  emptyMessage = "Nenhum tempo registrado no período",
}: TimeByCategoryChartProps) {
  const data = useMemo(() => {
    const totals: Record<string, number> = {};
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
      if (secs > 0) totals[cat] = (totals[cat] || 0) + secs;
    });
    return Object.entries(totals)
      .map(([name, seconds], i) => ({
        name: name.length > 28 ? name.slice(0, 25) + "…" : name,
        fullName: name,
        seconds,
        hours: Math.round((seconds / 3600) * 10) / 10,
        color: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [logs, entityCategoryMap]);

  const totalSeconds = data.reduce((s, d) => s + d.seconds, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {title}
          {totalSeconds > 0 && (
            <span className="ml-auto text-xs font-mono text-muted-foreground">
              Total: {formatDuration(totalSeconds)}
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
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
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
                  formatter={(value: number, _: string, props: any) => [
                    `${value}h (${formatDuration(props.payload.seconds)})`,
                    props.payload.fullName,
                  ]}
                />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
