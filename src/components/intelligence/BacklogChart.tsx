import { useMemo } from "react";
import { Layers, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import {
  format, startOfDay, startOfMonth,
  eachDayOfInterval, eachMonthOfInterval,
  differenceInDays, isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { BIChartCard } from "./bi/BIChartCard";
import { BIGradientDefs } from "./bi/BIGradientDefs";
import { BI_TOOLTIP_STYLE, BI_GRADIENTS } from "./bi/bi-theme";
import { cn } from "@/lib/utils";

type Bucket = "day" | "month";

interface BacklogChartProps {
  title: string;
  dateRange: { start: Date; end: Date };
  createdItems: any[];
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
  getCreatedDate, getCompletedDate, height = 280,
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
      bucket === "day" ? format(d, "dd/MM", { locale: ptBR }) : format(d, "MMM/yy", { locale: ptBR });

    const rows = buckets.map((b) => ({
      _bucket: b.getTime(), name: labelFmt(b),
      criados: 0, concluidos: 0, saldo: 0, acumulado: 0,
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

    const tot = rows.reduce(
      (acc, r) => { acc.criados += r.criados; acc.concluidos += r.concluidos; return acc; },
      { criados: 0, concluidos: 0 },
    );
    return { data: rows, totals: { ...tot, saldo: tot.criados - tot.concluidos } };
  }, [dateRange, createdItems, completedItems, getCreatedDate, getCompletedDate, bucket]);

  const hasData = totals.criados > 0 || totals.concluidos > 0;

  const SaldoIcon = totals.saldo > 0 ? TrendingUp : totals.saldo < 0 ? TrendingDown : Minus;
  const saldoTone = totals.saldo > 0 ? "destructive" : totals.saldo < 0 ? "success" : "neutral";
  const saldoColor =
    saldoTone === "destructive" ? "text-destructive"
    : saldoTone === "success" ? "text-success"
    : "text-muted-foreground";
  const saldoBg =
    saldoTone === "destructive" ? "bg-destructive/8 ring-destructive/20"
    : saldoTone === "success" ? "bg-success/8 ring-success/20"
    : "bg-muted/40 ring-border";

  return (
    <BIChartCard
      title={title}
      icon={Layers}
      iconColor="text-warning"
      hint={`Por ${bucket === "day" ? "dia" : "mês"}`}
      description="Comparativo de criados vs concluídos no período + saldo acumulado"
    >
      <div className="space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-info/5 p-3 ring-1 ring-info/20">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Criados</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-info">{totals.criados}</div>
          </div>
          <div className="rounded-lg bg-success/5 p-3 ring-1 ring-success/20">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Concluídos</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-success">{totals.concluidos}</div>
          </div>
          <div className={cn("rounded-lg p-3 ring-1", saldoBg)}>
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <SaldoIcon className={cn("h-3 w-3", saldoColor)} />
              Saldo
            </div>
            <div className={cn("mt-0.5 text-xl font-bold tabular-nums", saldoColor)}>
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
              <ComposedChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                <BIGradientDefs keys={["info", "success", "warning"]} />
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={BI_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
                <Bar
                  dataKey="criados"
                  name="Criados"
                  fill={`url(#${BI_GRADIENTS.info.id})`}
                  stroke={BI_GRADIENTS.info.color}
                  strokeWidth={1}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="concluidos"
                  name="Concluídos"
                  fill={`url(#${BI_GRADIENTS.success.id})`}
                  stroke={BI_GRADIENTS.success.color}
                  strokeWidth={1}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
                <Line
                  type="monotone"
                  dataKey="acumulado"
                  name="Backlog acumulado"
                  stroke={BI_GRADIENTS.warning.color}
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  dot={{ r: 3, fill: BI_GRADIENTS.warning.color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </BIChartCard>
  );
}
