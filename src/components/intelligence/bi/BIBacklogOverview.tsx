import { useMemo, useState } from "react";
import { Layers, Target, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  startOfMonth, endOfMonth, isWithinInterval, subMonths, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BIChartCard } from "./BIChartCard";
import { BI_TOOLTIP_STYLE } from "./bi-theme";
import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  createdItems: any[];
  getCreatedDate: (item: any) => Date | null | undefined;
  getCompletedDate: (item: any) => Date | null | undefined;
  goal?: number;
  monthsWindow?: number;
}

const GOAL_DEFAULT = 90;

export function BIBacklogOverview({
  title = "Visão de Backlog & Conclusão",
  createdItems,
  getCreatedDate,
  getCompletedDate,
  goal = GOAL_DEFAULT,
  monthsWindow = 6,
}: Props) {
  const [tab, setTab] = useState<"visao" | "mes">("visao");

  const stats = useMemo(() => {
    const now = new Date();
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);

    let openedInMonth = 0;
    let completedOfMonth = 0;
    let totalOpened = 0;
    let totalCompleted = 0;

    createdItems.forEach((it) => {
      const c = getCreatedDate(it);
      if (!c) return;
      totalOpened += 1;
      const done = getCompletedDate(it);
      if (done) totalCompleted += 1;

      const cd = new Date(c);
      if (isWithinInterval(cd, { start: mStart, end: mEnd })) {
        openedInMonth += 1;
        if (done) completedOfMonth += 1;
      }
    });

    const monthPct = openedInMonth > 0 ? Math.round((completedOfMonth / openedInMonth) * 100) : 0;
    const overallPct = totalOpened > 0 ? Math.round((totalCompleted / totalOpened) * 100) : 0;

    // History: last N months — bars = completed (of those opened that month), line = opened that month
    const months: { name: string; abertos: number; concluidos: number }[] = [];
    for (let i = monthsWindow - 1; i >= 0; i--) {
      const ref = subMonths(now, i);
      const s = startOfMonth(ref);
      const e = endOfMonth(ref);
      let abertos = 0;
      let concluidos = 0;
      createdItems.forEach((it) => {
        const c = getCreatedDate(it);
        if (!c) return;
        const cd = new Date(c);
        if (!isWithinInterval(cd, { start: s, end: e })) return;
        abertos += 1;
        if (getCompletedDate(it)) concluidos += 1;
      });
      months.push({ name: format(ref, "MMM", { locale: ptBR }), abertos, concluidos });
    }

    return { openedInMonth, completedOfMonth, monthPct, totalOpened, totalCompleted, overallPct, months };
  }, [createdItems, getCreatedDate, getCompletedDate, monthsWindow]);

  return (
    <BIChartCard
      title={title}
      icon={Layers}
      iconColor="text-warning"
      hint={
        <span>
          {stats.openedInMonth} no mês ·{" "}
          <span className={cn("font-semibold", stats.monthPct >= goal ? "text-success" : "text-warning")}>
            {stats.monthPct}% concluídos
          </span>
        </span>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="visao">Visão Geral</TabsTrigger>
          <TabsTrigger value="mes">Mês Atual</TabsTrigger>
        </TabsList>

        {/* === Visão Geral === */}
        <TabsContent value="visao" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiBox label="Abertos (Total)" value={stats.totalOpened} tone="info" Icon={Layers} />
            <KpiBox label="Concluídos (Total)" value={stats.totalCompleted} tone="success" Icon={CheckCircle2} />
            <KpiBox label="% Encerrados Geral" value={`${stats.overallPct}%`} tone={stats.overallPct >= goal ? "success" : "warning"} Icon={TrendingUp} />
            <KpiBox label="Meta" value={`${goal}%`} tone="neutral" Icon={Target} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <GaugeCard value={stats.overallPct} goal={goal} />
            <MonthlyComboCard data={stats.months} />
          </div>
        </TabsContent>

        {/* === Mês Atual === */}
        <TabsContent value="mes" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiBox label="Abertos no Mês" value={stats.openedInMonth} tone="info" Icon={Layers} />
            <KpiBox label="Concluídos do Mês" value={stats.completedOfMonth} tone="success" Icon={CheckCircle2} />
            <KpiBox
              label="% Concluídos do Mês"
              value={`${stats.monthPct}%`}
              tone={stats.monthPct >= goal ? "success" : "warning"}
              Icon={TrendingUp}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Percentual calculado estritamente sobre os {stats.openedInMonth} chamados abertos no mês atual.
          </p>
        </TabsContent>
      </Tabs>
    </BIChartCard>
  );
}

/* ---------------- subcomponents ---------------- */

function KpiBox({
  label, value, tone, Icon,
}: { label: string; value: string | number; tone: "info" | "success" | "warning" | "destructive" | "neutral"; Icon: any }) {
  const map: Record<string, string> = {
    info: "bg-info/8 ring-info/20 text-info",
    success: "bg-success/8 ring-success/20 text-success",
    warning: "bg-warning/8 ring-warning/20 text-warning",
    destructive: "bg-destructive/8 ring-destructive/20 text-destructive",
    neutral: "bg-muted/40 ring-border text-muted-foreground",
  };
  return (
    <div className={cn("rounded-lg p-3 ring-1", map[tone])}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("mt-0.5 text-xl font-bold tabular-nums", map[tone].split(" ").pop())}>{value}</div>
    </div>
  );
}

function GaugeCard({ value, goal }: { value: number; goal: number }) {
  const v = Math.max(0, Math.min(100, value));
  const remaining = 100 - v;
  const data = [
    { name: "Concluído", value: v, fill: "hsl(var(--success))" },
    { name: "Restante", value: remaining, fill: "hsl(var(--muted))" },
  ];
  // Goal tick marker as a thin slice anchored at `goal` percent
  const goalSliceWidth = 1.2;
  const goalData = [
    { name: "before", value: Math.max(0, goal - goalSliceWidth / 2), fill: "transparent" },
    { name: "tick", value: goalSliceWidth, fill: "hsl(var(--foreground))" },
    { name: "after", value: Math.max(0, 100 - goal - goalSliceWidth / 2), fill: "transparent" },
  ];

  return (
    <div className="relative flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">% Encerrados (Geral)</div>
      <div className="relative h-[170px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="85%"
              startAngle={180}
              endAngle={0}
              innerRadius={72}
              outerRadius={110}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Pie
              data={goalData}
              cx="50%"
              cy="85%"
              startAngle={180}
              endAngle={0}
              innerRadius={66}
              outerRadius={116}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
            >
              {goalData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip
              contentStyle={BI_TOOLTIP_STYLE}
              formatter={(val: number, name: string) => {
                if (name === "tick") return [`${goal}%`, "Meta"];
                if (name === "Restante") return [`${remaining}%`, "Restante"];
                return [`${val}%`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center">
          <span className="text-3xl font-bold tabular-nums text-foreground">{v}%</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Meta {goal}%</span>
        </div>
      </div>
    </div>
  );
}

function MonthlyComboCard({ data }: { data: { name: string; abertos: number; concluidos: number }[] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Histórico mensal — Concluídos vs. Abertos
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={BI_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" />
            <Bar dataKey="concluidos" name="Concluídos" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} maxBarSize={36} />
            <Line
              type="monotone"
              dataKey="abertos"
              name="Chamados (abertos)"
              stroke="hsl(var(--info))"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "hsl(var(--info))", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
