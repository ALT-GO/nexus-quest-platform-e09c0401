import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, RadialBar, RadialBarChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Smile, Loader2, MessageSquare, Star, Download, Eye, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BIStatCard } from "./bi/BIStatCard";
import { BIChartCard } from "./bi/BIChartCard";
import { BI_SEMANTIC, BI_TOOLTIP_STYLE } from "./bi/bi-theme";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useAuth } from "@/hooks/use-auth";

// ---------- Chart configuration types & presets ----------
type CriterionKey = "overall" | "rating_response_time" | "rating_communication" | "rating_resolution" | "rating_ease_of_use";

const CRITERION_OPTIONS: { value: CriterionKey; label: string }[] = [
  { value: "overall", label: "Média geral (todos os critérios)" },
  { value: "rating_response_time", label: "Tempo de resposta" },
  { value: "rating_communication", label: "Comunicação" },
  { value: "rating_resolution", label: "Resolução" },
  { value: "rating_ease_of_use", label: "Facilidade" },
];

const COLOR_PRESETS: { value: string; label: string; color: string }[] = [
  { value: "auto", label: "Automático (semântico)", color: "hsl(142 71% 45%)" },
  { value: "green", label: "Verde", color: "hsl(142 71% 45%)" },
  { value: "blue", label: "Azul", color: "hsl(217 91% 60%)" },
  { value: "purple", label: "Roxo", color: "hsl(262 83% 58%)" },
  { value: "orange", label: "Laranja", color: "hsl(25 95% 53%)" },
  { value: "pink", label: "Rosa", color: "hsl(330 81% 60%)" },
  { value: "red", label: "Vermelho", color: "hsl(0 84% 60%)" },
  { value: "teal", label: "Turquesa", color: "hsl(174 72% 42%)" },
];

type GaugeType = "gauge" | "radial" | "progress";
type TrendType = "area" | "line" | "bar";

interface GaugeConfig {
  type: GaugeType;
  color: string;
  criterion: CriterionKey;
  goal: number;
}
interface TrendConfig {
  type: TrendType;
  color: string;
  criterion: CriterionKey;
  months: number;
}

const DEFAULT_GAUGE: GaugeConfig = { type: "gauge", color: "auto", criterion: "overall", goal: 90 };
const DEFAULT_TREND: TrendConfig = { type: "area", color: "auto", criterion: "overall", months: 6 };

function loadCfg<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

// ---------- Reusable edit popover ----------
interface EditPopoverProps<T> {
  cfg: T;
  onChange: (next: T) => void;
  onReset: () => void;
  chartTypes: { value: string; label: string }[];
  showMonths?: boolean;
  showGoal?: boolean;
}
function ChartEditPopover<T extends Record<string, any>>({
  cfg, onChange, onReset, chartTypes, showMonths, showGoal,
}: EditPopoverProps<T>) {
  const update = (patch: Partial<T>) => onChange({ ...cfg, ...patch });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar gráfico">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <p className="text-sm font-semibold">Editar gráfico</p>

        <div className="space-y-1.5">
          <Label className="text-xs">Tipo de gráfico</Label>
          <Select value={cfg.type} onValueChange={(v) => update({ type: v } as any)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {chartTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Paleta de cores</Label>
          <Select value={cfg.color} onValueChange={(v) => update({ color: v } as any)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COLOR_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border" style={{ background: p.color }} />
                    {p.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Filtro: critério</Label>
          <Select value={cfg.criterion} onValueChange={(v) => update({ criterion: v } as any)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CRITERION_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showMonths && (
          <div className="space-y-1.5">
            <Label className="text-xs">Janela: últimos {cfg.months} meses</Label>
            <Slider
              value={[cfg.months]}
              min={3} max={12} step={1}
              onValueChange={(v) => update({ months: v[0] } as any)}
            />
          </div>
        )}

        {showGoal && (
          <div className="space-y-1.5">
            <Label className="text-xs">Meta: {cfg.goal}%</Label>
            <Slider
              value={[cfg.goal]}
              min={0} max={100} step={1}
              onValueChange={(v) => update({ goal: v[0] } as any)}
            />
          </div>
        )}

        <Button variant="outline" size="sm" className="w-full" onClick={onReset}>
          Restaurar padrão
        </Button>
      </PopoverContent>
    </Popover>
  );
}


interface SurveyRow {
  id: string;
  ticket_number: string | null;
  user_name: string;
  user_email: string;
  rating_response_time: number;
  rating_communication: number;
  rating_resolution: number;
  rating_ease_of_use: number;
  comment: string | null;
  created_at: string;
}

interface Props {
  dateRange: { start: Date; end: Date };
  /** Compact mode for overview embedding. */
  compact?: boolean;
}

const CRITERIA = [
  { key: "rating_response_time" as const, label: "Tempo de Resposta", color: BI_SEMANTIC.created },
  { key: "rating_communication" as const, label: "Comunicação", color: BI_SEMANTIC.primary },
  { key: "rating_resolution" as const, label: "Resolução", color: BI_SEMANTIC.completed },
  { key: "rating_ease_of_use" as const, label: "Facilidade", color: BI_SEMANTIC.pending },
];

export function SatisfacaoTab({ dateRange, compact = false }: Props) {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [gaugeCfg, setGaugeCfg] = useState<GaugeConfig>(() => loadCfg("sat.gaugeCfg", DEFAULT_GAUGE));
  const [trendCfg, setTrendCfg] = useState<TrendConfig>(() => loadCfg("sat.trendCfg", DEFAULT_TREND));
  useEffect(() => { try { localStorage.setItem("sat.gaugeCfg", JSON.stringify(gaugeCfg)); } catch {} }, [gaugeCfg]);
  useEffect(() => { try { localStorage.setItem("sat.trendCfg", JSON.stringify(trendCfg)); } catch {} }, [trendCfg]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("satisfaction_surveys" as any)
        .select("*")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (error) console.warn("satisfaction_surveys fetch error", error);
        setRows(((data as any) || []) as SurveyRow[]);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel("satisfaction-surveys-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "satisfaction_surveys" },
        () => {
          supabase
            .from("satisfaction_surveys" as any)
            .select("*")
            .gte("created_at", dateRange.start.toISOString())
            .lte("created_at", dateRange.end.toISOString())
            .order("created_at", { ascending: false })
            .then(({ data }) => setRows(((data as any) || []) as SurveyRow[]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [dateRange.start, dateRange.end]);

  const averages = useMemo(() => {
    if (!rows.length) return CRITERIA.map((c) => ({ ...c, avg: 0 }));
    return CRITERIA.map((c) => ({
      ...c,
      avg: rows.reduce((s, r) => s + (r[c.key] || 0), 0) / rows.length,
    }));
  }, [rows]);

  const overallAvg = useMemo(() => {
    if (!averages.length) return 0;
    return averages.reduce((s, a) => s + a.avg, 0) / averages.length;
  }, [averages]);

  const handleExportExcel = () => {
    if (!rows.length) {
      toast.error("Nenhuma resposta para exportar");
      return;
    }
    const sheetData = rows.map((r) => ({
      Data: format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      Chamado: r.ticket_number || "—",
      Nome: r.user_name,
      "E-mail": r.user_email,
      "Tempo de Resposta": r.rating_response_time,
      Comunicação: r.rating_communication,
      Resolução: r.rating_resolution,
      Facilidade: r.rating_ease_of_use,
      "Média": (
        (r.rating_response_time + r.rating_communication + r.rating_resolution + r.rating_ease_of_use) /
        4
      ).toFixed(2),
      Comentário: r.comment || "",
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 28 },
      { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 50 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Satisfação");
    XLSX.writeFile(wb, `pesquisa-satisfacao-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Planilha exportada!");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("satisfaction_surveys" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir resposta");
      console.error(error);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Resposta excluída");
  };

  const fmtPct = (v: number) => (v ? `${(v * 10).toFixed(1)}%` : "—");
  const overallPct = overallAvg * 10;

  // Helper: convert a row → 0-100 percentage for the chosen criterion
  const rowPct = (r: SurveyRow, crit: CriterionKey): number => {
    if (crit === "overall") {
      return ((r.rating_response_time + r.rating_communication + r.rating_resolution + r.rating_ease_of_use) / 4) * 10;
    }
    return (r[crit] || 0) * 10;
  };

  // Gauge value driven by config
  const gaugeValue = useMemo(() => {
    if (!rows.length) return 0;
    const sum = rows.reduce((s, r) => s + rowPct(r, gaugeCfg.criterion), 0);
    return sum / rows.length;
  }, [rows, gaugeCfg.criterion]);

  // Monthly evolution driven by config
  const monthlySeries = useMemo(() => {
    const window = trendCfg.months;
    const months: { key: string; label: string; year: number; month: number }[] = [];
    const now = new Date();
    for (let i = window - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: format(d, "MMM", { locale: ptBR }).replace(".", ""),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return months.map((m) => {
      const monthRows = rows.filter((r) => {
        const d = new Date(r.created_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const avg = monthRows.length
        ? monthRows.reduce((s, r) => s + rowPct(r, trendCfg.criterion), 0) / monthRows.length
        : 0;
      return { month: m.label, pct: avg ? Number(avg.toFixed(2)) : 0, hasData: monthRows.length > 0 };
    });
  }, [rows, trendCfg.months, trendCfg.criterion]);

  // Resolve color from preset (auto = semantic based on value)
  const semanticColor = (v: number) =>
    v >= 90 ? "hsl(var(--success))" : v >= 70 ? "hsl(var(--warning))" : v ? "hsl(var(--destructive))" : "hsl(var(--muted))";
  const resolveColor = (preset: string, semanticValue: number) =>
    preset === "auto" ? semanticColor(semanticValue) : (COLOR_PRESETS.find((p) => p.value === preset)?.color || semanticColor(semanticValue));

  const gaugeColor = resolveColor(gaugeCfg.color, gaugeValue);
  const trendColor = resolveColor(trendCfg.color, gaugeValue);

  // Position of the goal-tick hit area on the semicircle (for hover tooltip)
  const goalAngleRad = (Math.PI * (100 - gaugeCfg.goal)) / 100; // 0..π from right→left
  const goalRadius = 85; // mid-radius (matches inner=70, outer=100)
  const goalX = Math.cos(goalAngleRad) * goalRadius;
  const goalY = -Math.sin(goalAngleRad) * goalRadius;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderGauge = () => {
    const v = Math.max(0, Math.min(100, gaugeValue));
    if (gaugeCfg.type === "progress") {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4">
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted/40">
            <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: gaugeColor }} />
            {/* Goal marker */}
            <UITooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 h-7 w-[3px] -translate-y-1/2 cursor-help rounded-sm bg-foreground"
                  style={{ left: `calc(${gaugeCfg.goal}% - 1.5px)` }}
                />
              </TooltipTrigger>
              <TooltipContent>Meta: {gaugeCfg.goal}%</TooltipContent>
            </UITooltip>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums" style={{ color: gaugeColor }}>
              {v ? `${v.toFixed(1)}%` : "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Média global</p>
          </div>
        </div>
      );
    }
    if (gaugeCfg.type === "radial") {
      return (
        <div className="relative h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="65%" outerRadius="95%"
              data={[{ name: "v", value: v, fill: gaugeColor }]}
              startAngle={90} endAngle={-270}
            >
              <RadialBar background={{ fill: "hsl(var(--muted))", fillOpacity: 0.3 } as any} dataKey="value" cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums" style={{ color: gaugeColor }}>
              {v ? `${v.toFixed(1)}%` : "—"}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Meta {gaugeCfg.goal}%</span>
          </div>
        </div>
      );
    }
    // default: semicircle gauge
    const gaugeData = [{ name: "filled", value: v }, { name: "rest", value: 100 - v }];
    return (
      <div className="relative h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData} cx="50%" cy="85%" startAngle={180} endAngle={0}
              innerRadius={70} outerRadius={100} paddingAngle={0} dataKey="value" stroke="none"
              isAnimationActive={false}
            >
              <Cell fill={gaugeColor} />
              <Cell fill="hsl(var(--muted))" fillOpacity={0.35} />
            </Pie>
            {/* Goal tick */}
            <Pie
              data={[
                { value: gaugeCfg.goal - 0.6 },
                { value: 1.2 },
                { value: Math.max(0, 100 - gaugeCfg.goal - 0.6) },
              ]}
              cx="50%" cy="85%" startAngle={180} endAngle={0}
              innerRadius={66} outerRadius={104} dataKey="value" stroke="none" isAnimationActive={false}
            >
              <Cell fill="transparent" />
              <Cell fill="hsl(var(--foreground))" />
              <Cell fill="transparent" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className="text-3xl font-bold tabular-nums tracking-tight" style={{ color: gaugeColor }}>
            {v ? `${v.toFixed(1)}%` : "—"}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Média global</span>
        </div>
        {/* Hover hit area on the goal tick */}
        <UITooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-help rounded-full"
              style={{ left: `calc(50% + ${goalX}px)`, top: `calc(85% + ${goalY}px)` }}
              aria-label={`Meta ${gaugeCfg.goal}%`}
            />
          </TooltipTrigger>
          <TooltipContent side="top">Meta: {gaugeCfg.goal}%</TooltipContent>
        </UITooltip>
      </div>
    );
  };

  const renderTrend = () => {
    const common = (
      <>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={BI_TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, "Satisfação"]} />
        <ReferenceLine
          y={gaugeCfg.goal}
          stroke="hsl(var(--foreground))"
          strokeDasharray="4 4"
          strokeOpacity={0.5}
          label={{ value: `Meta ${gaugeCfg.goal}%`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
        />
      </>
    );
    if (trendCfg.type === "bar") {
      return (
        <BarChart data={monthlySeries} margin={{ top: 18, right: 10, bottom: 4, left: -20 }}>
          {common}
          <Bar dataKey="pct" radius={[4, 4, 0, 0]} fill={trendColor} />
        </BarChart>
      );
    }
    if (trendCfg.type === "line") {
      return (
        <LineChart data={monthlySeries} margin={{ top: 18, right: 10, bottom: 4, left: -20 }}>
          {common}
          <Line type="monotone" dataKey="pct" stroke={trendColor} strokeWidth={2.5} dot={{ r: 3, fill: trendColor }} activeDot={{ r: 5 }} />
        </LineChart>
      );
    }
    return (
      <AreaChart data={monthlySeries} margin={{ top: 18, right: 10, bottom: 4, left: -20 }}>
        <defs>
          <linearGradient id="satFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trendColor} stopOpacity={0.4} />
            <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        {common}
        <Area type="monotone" dataKey="pct" stroke={trendColor} strokeWidth={2.5} fill="url(#satFill)" dot={{ r: 3, fill: trendColor }} activeDot={{ r: 5 }} />
      </AreaChart>
    );
  };

  return (
    <TooltipProvider delayDuration={100}>
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BIStatCard
          title="Respostas no período"
          value={rows.length}
          icon={MessageSquare}
          tone="info"
        />

        {/* Custom Nota Geral card with gauge + monthly trend */}
        <div className="lg:col-span-2 rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/40 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nota Geral</p>
              <p className="text-xs text-muted-foreground mt-0.5">Meta: {gaugeCfg.goal}%</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <Star className="h-5 w-5" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Gauge */}
            <div className="relative h-[190px] rounded-lg border border-border/40 bg-background/40 p-2">
              <div className="absolute right-1 top-1 z-10">
                <ChartEditPopover
                  cfg={gaugeCfg}
                  onChange={setGaugeCfg}
                  onReset={() => setGaugeCfg(DEFAULT_GAUGE)}
                  showGoal
                  chartTypes={[
                    { value: "gauge", label: "Gauge (semicírculo)" },
                    { value: "radial", label: "Radial (anel)" },
                    { value: "progress", label: "Barra de progresso" },
                  ]}
                />
              </div>
              {renderGauge()}
            </div>
            {/* Monthly evolution */}
            <div className="relative h-[190px] rounded-lg border border-border/40 bg-background/40 p-2">
              <div className="absolute right-1 top-1 z-10">
                <ChartEditPopover
                  cfg={trendCfg}
                  onChange={setTrendCfg}
                  onReset={() => setTrendCfg(DEFAULT_TREND)}
                  showMonths
                  chartTypes={[
                    { value: "area", label: "Área" },
                    { value: "line", label: "Linha" },
                    { value: "bar", label: "Barras" },
                  ]}
                />
              </div>
              <ResponsiveContainer width="100%" height="100%">
                {renderTrend()}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      </div>

      {/* Criteria KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {averages.map((a) => {
          const pct = a.avg * 10;
          return (
            <BIStatCard
              key={a.key}
              title={a.label}
              value={a.avg ? `${pct.toFixed(1)}%` : "—"}
              icon={Smile}
              tone={pct >= 80 ? "success" : pct >= 60 ? "warning" : a.avg ? "destructive" : "info"}
              description="Satisfação (0–100%)"
            />
          );
        })}
      </div>

      {/* Chart: average per criterion */}
      <BIChartCard title="Média por critério" icon={Smile} iconColor="text-primary">
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={averages.map((a) => ({ ...a, pct: Number((a.avg * 10).toFixed(2)) }))} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={BI_TOOLTIP_STYLE}
                formatter={(v: number) => [`${v.toFixed(1)}%`, "Satisfação"]}
              />
              <ReferenceLine y={90} stroke="hsl(var(--foreground))" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "Meta 90%", position: "insideTopRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Bar dataKey="pct" radius={[6, 6, 0, 0]} fill={BI_SEMANTIC.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </BIChartCard>

      {/* Responses table */}
      <BIChartCard
        title="Respostas recebidas"
        icon={MessageSquare}
        padded={false}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              disabled={!rows.length}
              className="gap-1.5"
              title="Pré-visualizar todas as respostas"
            >
              <Eye className="h-4 w-4" />
              Pré-visualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={!rows.length}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Nenhuma resposta de pesquisa de satisfação no período selecionado.
          </p>
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="text-center">Tempo Resp.</TableHead>
                  <TableHead className="text-center">Comunicação</TableHead>
                  <TableHead className="text-center">Resolução</TableHead>
                  <TableHead className="text-center">Facilidade</TableHead>
                  <TableHead>Comentário</TableHead>
                  {isAdmin && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(compact ? rows.slice(0, 10) : rows).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">{r.user_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.user_email}</TableCell>
                    <TableCell className="text-center font-medium tabular-nums">{r.rating_response_time}</TableCell>
                    <TableCell className="text-center font-medium tabular-nums">{r.rating_communication}</TableCell>
                    <TableCell className="text-center font-medium tabular-nums">{r.rating_resolution}</TableCell>
                    <TableCell className="text-center font-medium tabular-nums">{r.rating_ease_of_use}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={r.comment || ""}>
                      {r.comment || "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="w-10 text-right">
                        <ConfirmDeleteDialog
                          onConfirm={() => handleDelete(r.id)}
                          title="Excluir resposta"
                          description={`Tem certeza que deseja excluir esta resposta de ${r.user_name}? Esta ação não pode ser desfeita.`}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </BIChartCard>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Pré-visualização — Respostas de Satisfação ({rows.length})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-max min-w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-10 bg-background border-b">
                <tr>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground whitespace-nowrap">Data</th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground whitespace-nowrap">Chamado</th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground whitespace-nowrap">Nome</th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground whitespace-nowrap">E-mail</th>
                  <th className="h-11 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">Tempo Resp.</th>
                  <th className="h-11 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">Comunicação</th>
                  <th className="h-11 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">Resolução</th>
                  <th className="h-11 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">Facilidade</th>
                  <th className="h-11 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">Média</th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[400px]">Comentário / Observações</th>
                  {isAdmin && <th className="h-11 px-3 text-right font-medium text-muted-foreground whitespace-nowrap sticky right-0 bg-background">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const media = (
                    (r.rating_response_time + r.rating_communication + r.rating_resolution + r.rating_ease_of_use) / 4
                  ).toFixed(2);
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{r.ticket_number || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{r.user_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{r.user_email}</td>
                      <td className="px-3 py-2 text-center font-medium tabular-nums">{r.rating_response_time}</td>
                      <td className="px-3 py-2 text-center font-medium tabular-nums">{r.rating_communication}</td>
                      <td className="px-3 py-2 text-center font-medium tabular-nums">{r.rating_resolution}</td>
                      <td className="px-3 py-2 text-center font-medium tabular-nums">{r.rating_ease_of_use}</td>
                      <td className="px-3 py-2 text-center font-semibold tabular-nums">{media}</td>
                      <td className="px-3 py-2 text-sm min-w-[400px] whitespace-pre-wrap break-words">
                        {r.comment || <span className="text-muted-foreground italic">—</span>}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-right sticky right-0 bg-background">
                          <ConfirmDeleteDialog
                            onConfirm={() => handleDelete(r.id)}
                            title="Excluir resposta"
                            description={`Tem certeza que deseja excluir esta resposta de ${r.user_name}? Esta ação não pode ser desfeita.`}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 11 : 10} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      Nenhuma resposta no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
