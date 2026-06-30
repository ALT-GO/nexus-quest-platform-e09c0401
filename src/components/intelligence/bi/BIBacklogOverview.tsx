import { useEffect, useMemo, useState } from "react";
import { Layers, Target, TrendingUp, CheckCircle2, Settings2 } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, AreaChart, Area, LineChart, BarChart,
} from "recharts";
import {
  startOfMonth, endOfMonth, isWithinInterval, subMonths, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type GaugeType = "semicircle" | "radial" | "progress";
type TrendType = "combo" | "bar" | "line" | "area";
type Palette = "auto" | "success" | "info" | "primary" | "warning" | "destructive";

const PALETTE_COLORS: Record<Palette, string> = {
  auto: "hsl(var(--success))",
  success: "hsl(var(--success))",
  info: "hsl(var(--info))",
  primary: "hsl(var(--primary))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
};

interface GaugeCfg {
  type: GaugeType;
  palette: Palette;
  goal: number;
  scope: "all" | "month";
}
interface TrendCfg {
  type: TrendType;
  palette: Palette;
  months: number;
  show: "both" | "completed" | "opened";
}

const LS_GAUGE = "biBacklog.gauge.v1";
const LS_TREND = "biBacklog.trend.v1";

function loadCfg<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function BIBacklogOverview({
  title = "Visão de Backlog & Conclusão",
  createdItems,
  getCreatedDate,
  getCompletedDate,
  goal = GOAL_DEFAULT,
  monthsWindow = 6,
}: Props) {
  const [tab, setTab] = useState<"visao" | "mes">("visao");

  const [gaugeCfg, setGaugeCfg] = useState<GaugeCfg>(() =>
    loadCfg<GaugeCfg>(LS_GAUGE, { type: "semicircle", palette: "auto", goal, scope: "all" }),
  );
  const [trendCfg, setTrendCfg] = useState<TrendCfg>(() =>
    loadCfg<TrendCfg>(LS_TREND, { type: "combo", palette: "auto", months: monthsWindow, show: "both" }),
  );

  useEffect(() => { localStorage.setItem(LS_GAUGE, JSON.stringify(gaugeCfg)); }, [gaugeCfg]);
  useEffect(() => { localStorage.setItem(LS_TREND, JSON.stringify(trendCfg)); }, [trendCfg]);

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

    const months: { name: string; abertos: number; concluidos: number }[] = [];
    const win = Math.max(3, Math.min(12, trendCfg.months));
    for (let i = win - 1; i >= 0; i--) {
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
  }, [createdItems, getCreatedDate, getCompletedDate, trendCfg.months]);

  const gaugeValue = gaugeCfg.scope === "month" ? stats.monthPct : stats.overallPct;
  const autoColor = gaugeValue >= gaugeCfg.goal ? "hsl(var(--success))" : "hsl(var(--warning))";
  const gaugeColor = gaugeCfg.palette === "auto" ? autoColor : PALETTE_COLORS[gaugeCfg.palette];

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

        <TabsContent value="visao" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiBox label="Abertos (Total)" value={stats.totalOpened} tone="info" Icon={Layers} />
            <KpiBox label="Concluídos (Total)" value={stats.totalCompleted} tone="success" Icon={CheckCircle2} />
            <KpiBox label="% Encerrados Geral" value={`${stats.overallPct}%`} tone={stats.overallPct >= goal ? "success" : "warning"} Icon={TrendingUp} />
            <KpiBox label="Meta" value={`${goal}%`} tone="neutral" Icon={Target} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <GaugeCard cfg={gaugeCfg} value={gaugeValue} color={gaugeColor} onChange={setGaugeCfg} />
            <TrendCard cfg={trendCfg} data={stats.months} onChange={setTrendCfg} />
          </div>
        </TabsContent>

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

function EditButton({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label="Editar gráfico">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function PaletteSelect({ value, onChange }: { value: Palette; onChange: (v: Palette) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Paleta de cores</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Palette)}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Automático (meta)</SelectItem>
          <SelectItem value="success">Verde</SelectItem>
          <SelectItem value="info">Azul</SelectItem>
          <SelectItem value="primary">Roxo</SelectItem>
          <SelectItem value="warning">Laranja</SelectItem>
          <SelectItem value="destructive">Vermelho</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function GaugeCard({
  cfg, value, color, onChange,
}: { cfg: GaugeCfg; value: number; color: string; onChange: (c: GaugeCfg) => void }) {
  const v = Math.max(0, Math.min(100, value));
  const remaining = 100 - v;

  return (
    <div className="relative flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex w-full items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          % Encerrados ({cfg.scope === "month" ? "Mês" : "Geral"})
        </div>
        <EditButton>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de gráfico</Label>
            <Select value={cfg.type} onValueChange={(t) => onChange({ ...cfg, type: t as GaugeType })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semicircle">Gauge semicircular</SelectItem>
                <SelectItem value="radial">Anel radial</SelectItem>
                <SelectItem value="progress">Barra de progresso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PaletteSelect value={cfg.palette} onChange={(p) => onChange({ ...cfg, palette: p })} />
          <div className="space-y-1.5">
            <Label className="text-xs">Filtro de dados</Label>
            <Select value={cfg.scope} onValueChange={(s) => onChange({ ...cfg, scope: s as "all" | "month" })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Geral (todos chamados)</SelectItem>
                <SelectItem value="month">Mês atual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Meta: {cfg.goal}%</Label>
            <Slider min={0} max={100} step={1} value={[cfg.goal]} onValueChange={([g]) => onChange({ ...cfg, goal: g })} />
          </div>
        </EditButton>
      </div>

      <div className="relative h-[170px] w-full">
        {cfg.type === "semicircle" && <SemicircleGauge v={v} goal={cfg.goal} color={color} remaining={remaining} />}
        {cfg.type === "radial" && <RadialGauge v={v} color={color} />}
        {cfg.type === "progress" && <ProgressGauge v={v} goal={cfg.goal} color={color} />}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center">
          <span className="text-3xl font-bold tabular-nums text-foreground">{v}%</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Meta {cfg.goal}%</span>
        </div>
      </div>
    </div>
  );
}

function SemicircleGauge({ v, goal, color, remaining }: { v: number; goal: number; color: string; remaining: number }) {
  const data = [
    { name: "Concluído", value: v, fill: color },
    { name: "Restante", value: remaining, fill: "hsl(var(--muted))" },
  ];
  const goalSliceWidth = 1.2;
  const goalData = [
    { name: "before", value: Math.max(0, goal - goalSliceWidth / 2), fill: "transparent" },
    { name: "tick", value: goalSliceWidth, fill: "hsl(var(--foreground))" },
    { name: "after", value: Math.max(0, 100 - goal - goalSliceWidth / 2), fill: "transparent" },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="85%" startAngle={180} endAngle={0} innerRadius={72} outerRadius={110} dataKey="value" stroke="none" isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Pie>
        <Pie data={goalData} cx="50%" cy="85%" startAngle={180} endAngle={0} innerRadius={66} outerRadius={116} dataKey="value" stroke="none" isAnimationActive={false}>
          {goalData.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Pie>
        <Tooltip
          contentStyle={BI_TOOLTIP_STYLE}
          formatter={(val: number, name: string) => {
            if (name === "tick") return [`${goal}%`, "Meta"];
            return [`${val}%`, name];
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RadialGauge({ v, color }: { v: number; color: string }) {
  const data = [{ name: "v", value: v, fill: color }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
        <RadialBar background dataKey="value" cornerRadius={8} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

function ProgressGauge({ v, goal, color }: { v: number; goal: number; color: string }) {
  return (
    <div className="flex h-full w-full items-center px-2">
      <div className="relative h-6 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
        <div className="absolute inset-y-0" style={{ left: `${goal}%`, width: 2, background: "hsl(var(--foreground))" }} title={`Meta ${goal}%`} />
      </div>
    </div>
  );
}

function TrendCard({
  cfg, data, onChange,
}: { cfg: TrendCfg; data: { name: string; abertos: number; concluidos: number }[]; onChange: (c: TrendCfg) => void }) {
  const completedColor = cfg.palette === "auto" ? "hsl(var(--success))" : PALETTE_COLORS[cfg.palette];
  const openedColor = cfg.palette === "auto" ? "hsl(var(--info))" : PALETTE_COLORS[cfg.palette];
  const showCompleted = cfg.show !== "opened";
  const showOpened = cfg.show !== "completed";

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico mensal — Concluídos vs. Abertos
        </div>
        <EditButton>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de gráfico</Label>
            <Select value={cfg.type} onValueChange={(t) => onChange({ ...cfg, type: t as TrendType })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="combo">Barras + Linha</SelectItem>
                <SelectItem value="bar">Apenas barras</SelectItem>
                <SelectItem value="line">Apenas linha</SelectItem>
                <SelectItem value="area">Área</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PaletteSelect value={cfg.palette} onChange={(p) => onChange({ ...cfg, palette: p })} />
          <div className="space-y-1.5">
            <Label className="text-xs">Séries exibidas</Label>
            <Select value={cfg.show} onValueChange={(s) => onChange({ ...cfg, show: s as TrendCfg["show"] })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Ambas</SelectItem>
                <SelectItem value="completed">Apenas concluídos</SelectItem>
                <SelectItem value="opened">Apenas abertos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Janela: {cfg.months} meses</Label>
            <Slider min={3} max={12} step={1} value={[cfg.months]} onValueChange={([m]) => onChange({ ...cfg, months: m })} />
          </div>
        </EditButton>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          {cfg.type === "combo" ? (
            <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={BI_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" />
              {showCompleted && <Bar dataKey="concluidos" name="Concluídos" fill={completedColor} radius={[6, 6, 0, 0]} maxBarSize={36} />}
              {showOpened && <Line type="monotone" dataKey="abertos" name="Abertos" stroke={openedColor} strokeWidth={2.5} dot={{ r: 3, fill: openedColor, strokeWidth: 0 }} activeDot={{ r: 5 }} />}
            </ComposedChart>
          ) : cfg.type === "bar" ? (
            <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={BI_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" />
              {showCompleted && <Bar dataKey="concluidos" name="Concluídos" fill={completedColor} radius={[6, 6, 0, 0]} maxBarSize={28} />}
              {showOpened && <Bar dataKey="abertos" name="Abertos" fill={openedColor} radius={[6, 6, 0, 0]} maxBarSize={28} />}
            </BarChart>
          ) : cfg.type === "line" ? (
            <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={BI_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" />
              {showCompleted && <Line type="monotone" dataKey="concluidos" name="Concluídos" stroke={completedColor} strokeWidth={2.5} dot={{ r: 3 }} />}
              {showOpened && <Line type="monotone" dataKey="abertos" name="Abertos" stroke={openedColor} strokeWidth={2.5} dot={{ r: 3 }} />}
            </LineChart>
          ) : (
            <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={BI_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" />
              {showCompleted && <Area type="monotone" dataKey="concluidos" name="Concluídos" stroke={completedColor} fill={completedColor} fillOpacity={0.25} />}
              {showOpened && <Area type="monotone" dataKey="abertos" name="Abertos" stroke={openedColor} fill={openedColor} fillOpacity={0.15} />}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
