import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, MousePointerClick } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { formatDuration } from "@/hooks/use-timesheet";

interface TimesheetLog {
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  entityId: string | null;
}

interface TimeByCategoryChartProps {
  title?: string;
  /** Map of entity ID -> category label. */
  entityCategoryMap: Record<string, string>;
  /** Timesheet logs in the selected period. */
  logs: TimesheetLog[];
  /** Singular noun for entities (e.g. "chamado", "tarefa"). */
  entityNoun?: string;
  emptyMessage?: string;
  /** Called with the full category name when a bar/row is clicked. */
  onCategoryClick?: (categoryName: string) => void;
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
  fontSize: "12px",
};

function buildCategoryData(
  logs: TimesheetLog[],
  entityCategoryMap: Record<string, string>,
) {
  const totals: Record<string, number> = {};
  const entitySetByCat: Record<string, Set<string>> = {};
  const now = Date.now();
  logs.forEach((l) => {
    if (!l.entityId) return;
    const cat = entityCategoryMap[l.entityId];
    if (!cat) return;
    const secs = l.end_time
      ? l.duration_seconds
      : Math.floor((now - new Date(l.start_time).getTime()) / 1000);
    if (secs > 0) {
      totals[cat] = (totals[cat] || 0) + secs;
      if (!entitySetByCat[cat]) entitySetByCat[cat] = new Set();
      entitySetByCat[cat].add(l.entityId);
    }
  });
  return Object.entries(totals).map(([name, seconds], i) => {
    const count = entitySetByCat[name]?.size || 0;
    const avgSeconds = count > 0 ? seconds / count : 0;
    return {
      name: name.length > 26 ? name.slice(0, 23) + "…" : name,
      fullName: name,
      seconds,
      hours: Math.round((seconds / 3600) * 10) / 10,
      count,
      avgSeconds,
      avgHours: Math.round((avgSeconds / 3600) * 10) / 10,
      color: COLORS[i % COLORS.length],
    };
  });
}

type CatDatum = ReturnType<typeof buildCategoryData>[number];

interface SingleChartProps {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  data: CatDatum[];
  metric: "total" | "avg";
  entityNoun: string;
  emptyMessage: string;
  summary: string;
  onCategoryClick?: (name: string) => void;
}

function SingleMetricChart({
  title, icon: Icon, iconColor, data, metric, entityNoun, emptyMessage, summary, onCategoryClick,
}: SingleChartProps) {
  const dataKey = metric === "total" ? "hours" : "avgHours";
  const isClickable = !!onCategoryClick;

  // Dynamic height — 38px per row, min 200, max 480
  const chartHeight = Math.min(480, Math.max(200, data.length * 44 + 40));

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
          {isClickable && data.length > 0 && (
            <MousePointerClick className="ml-1 h-3 w-3 text-muted-foreground/60" />
          )}
          {summary && (
            <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
              {summary}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {data.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ left: 4, right: 56, top: 4, bottom: 4 }}
                barCategoryGap={10}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  unit="h"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={140}
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  formatter={(_v: number, _n: string, props: any) => {
                    const p = props.payload;
                    if (metric === "total") {
                      return [
                        `${formatDuration(p.seconds)} · ${p.count} ${entityNoun}${p.count > 1 ? "s" : ""}`,
                        "Tempo total",
                      ];
                    }
                    return [
                      `${formatDuration(Math.round(p.avgSeconds))} por ${entityNoun}`,
                      "Média",
                    ];
                  }}
                  labelFormatter={(_l, payload) => payload?.[0]?.payload?.fullName ?? ""}
                />
                <Bar
                  dataKey={dataKey}
                  radius={[0, 6, 6, 0]}
                  barSize={22}
                  className={isClickable ? "cursor-pointer" : ""}
                  onClick={(d: any) => {
                    if (isClickable && d?.fullName) onCategoryClick!(d.fullName);
                  }}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey={dataKey}
                    position="right"
                    formatter={(v: number) => `${v}h`}
                    style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {isClickable && data.length > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground/70">
            Clique em uma barra para ver os {entityNoun}s
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function TimeByCategoryChart({
  title = "Tempo por Categoria",
  entityCategoryMap,
  logs,
  entityNoun = "item",
  emptyMessage = "Nenhum tempo registrado no período",
  onCategoryClick,
}: TimeByCategoryChartProps) {
  const totalData = useMemo(
    () => buildCategoryData(logs, entityCategoryMap).sort((a, b) => b.seconds - a.seconds),
    [logs, entityCategoryMap],
  );
  const avgData = useMemo(
    () => [...totalData].sort((a, b) => b.avgSeconds - a.avgSeconds),
    [totalData],
  );

  const totalSeconds = totalData.reduce((s, d) => s + d.seconds, 0);
  const totalCount = totalData.reduce((s, d) => s + d.count, 0);
  const overallAvgSeconds = totalCount > 0 ? totalSeconds / totalCount : 0;

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <SingleMetricChart
          title="Tempo total"
          icon={Clock}
          iconColor="text-primary"
          data={totalData}
          metric="total"
          entityNoun={entityNoun}
          emptyMessage={emptyMessage}
          summary={totalSeconds > 0 ? formatDuration(totalSeconds) : ""}
          onCategoryClick={onCategoryClick}
        />
        <SingleMetricChart
          title={`Média por ${entityNoun}`}
          icon={TrendingUp}
          iconColor="text-success"
          data={avgData}
          metric="avg"
          entityNoun={entityNoun}
          emptyMessage={emptyMessage}
          summary={
            overallAvgSeconds > 0
              ? `${formatDuration(Math.round(overallAvgSeconds))} geral`
              : ""
          }
          onCategoryClick={onCategoryClick}
        />
      </div>
    </div>
  );
}
