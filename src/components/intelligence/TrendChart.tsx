import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from "recharts";
import {
  format, startOfDay, startOfWeek, startOfMonth,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  differenceInDays, isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { BIChartCard } from "./bi/BIChartCard";
import { BI_TOOLTIP_STYLE, BI_GRADIENTS, type BIGradientKey } from "./bi/bi-theme";
import { BIGradientDefs } from "./bi/BIGradientDefs";

export type TrendBucket = "day" | "week" | "month";

export interface TrendSeries {
  key: string;
  label: string;
  /** A BI gradient key — color is derived from the design system. */
  gradient: BIGradientKey;
  /** "bar" (filled with gradient), "line" (thin stroke), or "area" (gradient fill). */
  type?: "bar" | "line" | "area";
  getDate: (item: any) => Date | null | undefined;
  items: any[];
}

interface TrendChartProps {
  title: string;
  dateRange: { start: Date; end: Date };
  series: TrendSeries[];
  bucket?: TrendBucket;
  height?: number;
}

function pickBucket(start: Date, end: Date): TrendBucket {
  const days = Math.max(1, differenceInDays(end, start) + 1);
  if (days <= 31) return "day";
  return "month";
}

function bucketLabel(bucket: TrendBucket) {
  switch (bucket) {
    case "day": return "diária";
    case "week": return "semanal";
    case "month": return "mensal";
  }
}

export function TrendChart({
  title, dateRange, series, bucket: forcedBucket, height = 300,
}: TrendChartProps) {
  const bucket = forcedBucket ?? pickBucket(dateRange.start, dateRange.end);

  const data = useMemo(() => {
    const { start, end } = dateRange;
    let buckets: Date[] = [];
    let bucketStart: (d: Date) => Date;
    let labelFmt: (d: Date) => string;

    if (bucket === "day") {
      buckets = eachDayOfInterval({ start, end });
      bucketStart = (d) => startOfDay(d);
      labelFmt = (d) => format(d, "dd/MM", { locale: ptBR });
    } else if (bucket === "week") {
      buckets = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      bucketStart = (d) => startOfWeek(d, { weekStartsOn: 1 });
      labelFmt = (d) => format(d, "dd/MM", { locale: ptBR });
    } else {
      buckets = eachMonthOfInterval({ start, end });
      bucketStart = (d) => startOfMonth(d);
      labelFmt = (d) => format(d, "MMM/yy", { locale: ptBR });
    }

    const rows = buckets.map((b) => {
      const row: Record<string, any> = { _bucket: b.getTime(), name: labelFmt(b) };
      series.forEach((s) => { row[s.key] = 0; });
      return row;
    });

    const indexByTime = new Map<number, Record<string, any>>();
    rows.forEach((r) => indexByTime.set(r._bucket, r));

    series.forEach((s) => {
      s.items.forEach((item) => {
        const d = s.getDate(item);
        if (!d) return;
        const date = new Date(d);
        if (!isWithinInterval(date, { start, end })) return;
        const key = bucketStart(date).getTime();
        const row = indexByTime.get(key);
        if (row) row[s.key] = (row[s.key] || 0) + 1;
      });
    });

    return rows;
  }, [dateRange, series, bucket]);

  const hasData = data.some((row) => series.some((s) => row[s.key] > 0));
  const usedGradients = Array.from(new Set(series.map((s) => s.gradient)));

  return (
    <BIChartCard
      title={title}
      icon={TrendingUp}
      iconColor="text-primary"
      hint={<span>Visão {bucketLabel(bucket)}</span>}
    >
      {!hasData ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground" style={{ height }}>
          Nenhum dado no período selecionado
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
              <BIGradientDefs keys={usedGradients} />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={BI_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
              {series.map((s) => {
                const grad = BI_GRADIENTS[s.gradient];
                const type = s.type ?? "bar";
                if (type === "line") {
                  return (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={grad.color}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: grad.color, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    >
                      <LabelList
                        dataKey={s.key}
                        position="top"
                        offset={8}
                        style={{ fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 600 }}
                        formatter={(v: number) => (v > 0 ? v : "")}
                      />
                    </Line>
                  );
                }
                if (type === "area") {
                  return (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={grad.color}
                      strokeWidth={2}
                      fill={`url(#${grad.id})`}
                      dot={{ r: 3, fill: grad.color, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  );
                }
                return (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={`url(#${grad.id})`}
                    stroke={grad.color}
                    strokeWidth={1}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  >
                    <LabelList
                      dataKey={s.key}
                      position="top"
                      style={{ fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 600 }}
                      formatter={(v: number) => (v > 0 ? v : "")}
                    />
                  </Bar>
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </BIChartCard>
  );
}
