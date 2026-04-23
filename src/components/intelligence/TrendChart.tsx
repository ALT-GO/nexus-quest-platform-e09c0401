import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from "recharts";
import {
  format, startOfDay, startOfWeek, startOfMonth,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  differenceInDays, isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

export type TrendBucket = "day" | "week" | "month";

export interface TrendSeries {
  /** unique key for the series */
  key: string;
  /** label shown in legend / tooltip */
  label: string;
  /** HSL color string (already wrapped in hsl()) */
  color: string;
  /** "bar" or "line" */
  type?: "bar" | "line";
  /** date getter for each item; return null to skip */
  getDate: (item: any) => Date | null | undefined;
  /** items to count/aggregate */
  items: any[];
}

interface TrendChartProps {
  title: string;
  dateRange: { start: Date; end: Date };
  series: TrendSeries[];
  /** force a specific bucket; otherwise auto */
  bucket?: TrendBucket;
  /** chart height (px) */
  height?: number;
}

function pickBucket(start: Date, end: Date): TrendBucket {
  const days = Math.max(1, differenceInDays(end, start) + 1);
  if (days <= 31) return "day";
  return "month";
}

function bucketLabel(bucket: TrendBucket) {
  switch (bucket) {
    case "day": return "Diário";
    case "week": return "Semanal";
    case "month": return "Mensal";
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

    // Initialize rows
    const rows = buckets.map((b) => {
      const row: Record<string, any> = { _bucket: b.getTime(), name: labelFmt(b) };
      series.forEach((s) => { row[s.key] = 0; });
      return row;
    });

    const indexByTime = new Map<number, Record<string, any>>();
    rows.forEach((r) => indexByTime.set(r._bucket, r));

    // Count items per series
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base font-semibold">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {title}
          </div>
          <span className="text-xs font-normal text-muted-foreground">
            Visão {bucketLabel(bucket).toLowerCase()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground" style={{ height }}>
            Nenhum dado no período selecionado
          </div>
        ) : (
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {series.map((s) =>
                  (s.type ?? "bar") === "line" ? (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    >
                      <LabelList
                        dataKey={s.key}
                        position="top"
                        offset={8}
                        style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }}
                        formatter={(v: number) => (v > 0 ? v : "")}
                      />
                    </Line>
                  ) : (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={s.color}
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList
                        dataKey={s.key}
                        position="top"
                        style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }}
                        formatter={(v: number) => (v > 0 ? v : "")}
                      />
                    </Bar>
                  )
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
