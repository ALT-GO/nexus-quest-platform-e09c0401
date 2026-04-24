import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList, ReferenceLine,
} from "recharts";
import {
  format, startOfDay, startOfMonth,
  eachDayOfInterval, eachMonthOfInterval,
  differenceInDays, isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

type Bucket = "day" | "month";

interface BadgeOpts {
  bg: string;
  fg: string;
  format?: (v: number) => string;
}

function renderBadgeLabel({ bg, fg, format }: BadgeOpts) {
  return (props: any) => {
    const { x, y, width = 0, value, position } = props;
    if (value === null || value === undefined || value === 0) return null;
    const text = format ? format(Number(value)) : String(value);
    const charW = 6.6;
    const padX = 6;
    const w = Math.max(20, text.length * charW + padX * 2);
    const h = 18;
    const cx = x + width / 2;
    const isBottom = position === "bottom";
    const ry = isBottom ? y + 2 : y - h - 2;
    return (
      <g pointerEvents="none">
        <rect
          x={cx - w / 2}
          y={ry}
          width={w}
          height={h}
          rx={4}
          ry={4}
          fill={bg}
          stroke="hsl(var(--background))"
          strokeWidth={1}
        />
        <text
          x={cx}
          y={ry + h / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={600}
          fill={fg}
        >
          {text}
        </text>
      </g>
    );
  };
}

interface BacklogChartProps {
  title: string;
  dateRange: { start: Date; end: Date };
  /** items used to count "criados" via getCreatedDate */
  createdItems: any[];
  /** items used to count "concluidos" via getCompletedDate */
  completedItems: any[];
  getCreatedDate: (item: any) => Date | null | undefined;
  getCompletedDate: (item: any) => Date | null | undefined;
  height?: number;
}

function pickBucket(start: Date, end: Date): Bucket {
  const days = Math.max(1, differenceInDays(end, start) + 1);
  if (days <= 31) return "day";
  return "month";
}

export function BacklogChart({
  title, dateRange, createdItems, completedItems,
  getCreatedDate, getCompletedDate, height = 320,
}: BacklogChartProps) {
  const bucket = pickBucket(dateRange.start, dateRange.end);

  const { data, totals } = useMemo(() => {
    const { start, end } = dateRange;
    const buckets = bucket === "day"
      ? eachDayOfInterval({ start, end })
      : eachMonthOfInterval({ start, end });
    const bucketStart = (d: Date) =>
      bucket === "day" ? startOfDay(d) : startOfMonth(d);
    const labelFmt = (d: Date) =>
      bucket === "day"
        ? format(d, "dd/MM", { locale: ptBR })
        : format(d, "MMM/yy", { locale: ptBR });

    const rows = buckets.map((b) => ({
      _bucket: b.getTime(),
      name: labelFmt(b),
      criados: 0,
      concluidos: 0,
      saldo: 0,
      acumulado: 0,
    }));
    const idx = new Map<number, typeof rows[number]>();
    rows.forEach((r) => idx.set(r._bucket, r));

    createdItems.forEach((it) => {
      const d = getCreatedDate(it);
      if (!d) return;
      const date = new Date(d);
      if (!isWithinInterval(date, { start, end })) return;
      const row = idx.get(bucketStart(date).getTime());
      if (row) row.criados += 1;
    });

    completedItems.forEach((it) => {
      const d = getCompletedDate(it);
      if (!d) return;
      const date = new Date(d);
      if (!isWithinInterval(date, { start, end })) return;
      const row = idx.get(bucketStart(date).getTime());
      if (row) row.concluidos += 1;
    });

    let running = 0;
    rows.forEach((r) => {
      r.saldo = r.criados - r.concluidos;
      running += r.saldo;
      r.acumulado = running;
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.criados += r.criados;
        acc.concluidos += r.concluidos;
        return acc;
      },
      { criados: 0, concluidos: 0 }
    );

    return { data: rows, totals: { ...totals, saldo: totals.criados - totals.concluidos } };
  }, [dateRange, createdItems, completedItems, getCreatedDate, getCompletedDate, bucket]);

  const hasData = totals.criados > 0 || totals.concluidos > 0;

  const SaldoIcon = totals.saldo > 0 ? TrendingUp : totals.saldo < 0 ? TrendingDown : Minus;
  const saldoColor =
    totals.saldo > 0 ? "text-destructive"
    : totals.saldo < 0 ? "text-success"
    : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base font-semibold">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {title}
          </div>
          <span className="text-xs font-normal text-muted-foreground">
            Backlog acumulado (criados − concluídos) por {bucket === "day" ? "dia" : "mês"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-info/5 p-3">
            <div className="text-xs font-medium text-muted-foreground">Criados no período</div>
            <div className="mt-1 text-2xl font-bold text-info">{totals.criados}</div>
          </div>
          <div className="rounded-lg border bg-success/5 p-3">
            <div className="text-xs font-medium text-muted-foreground">Concluídos no período</div>
            <div className="mt-1 text-2xl font-bold text-success">{totals.concluidos}</div>
          </div>
          <div className={`rounded-lg border p-3 ${totals.saldo > 0 ? "bg-destructive/5" : totals.saldo < 0 ? "bg-success/5" : "bg-muted/30"}`}>
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <SaldoIcon className={`h-3 w-3 ${saldoColor}`} />
              Saldo (backlog gerado)
            </div>
            <div className={`mt-1 text-2xl font-bold ${saldoColor}`}>
              {totals.saldo > 0 ? "+" : ""}{totals.saldo}
            </div>
          </div>
        </div>

        {/* Chart */}
        {!hasData ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground" style={{ height }}>
            Nenhum dado no período selecionado
          </div>
        ) : (
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
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
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
                <Bar dataKey="criados" name="Criados" fill="hsl(var(--info))" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="criados"
                    position="top"
                    content={renderBadgeLabel({ bg: "hsl(var(--info))", fg: "hsl(var(--info-foreground, 0 0% 100%))" })}
                  />
                </Bar>
                <Bar dataKey="concluidos" name="Concluídos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="concluidos"
                    position="top"
                    content={renderBadgeLabel({ bg: "hsl(var(--success))", fg: "hsl(var(--success-foreground, 0 0% 100%))" })}
                  />
                </Bar>
                <Line
                  type="monotone"
                  dataKey="acumulado"
                  name="Backlog acumulado"
                  stroke="hsl(var(--warning))"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                >
                  <LabelList
                    dataKey="acumulado"
                    position="bottom"
                    offset={10}
                    content={renderBadgeLabel({
                      bg: "hsl(var(--warning))",
                      fg: "hsl(var(--warning-foreground, 0 0% 100%))",
                    })}
                  />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
