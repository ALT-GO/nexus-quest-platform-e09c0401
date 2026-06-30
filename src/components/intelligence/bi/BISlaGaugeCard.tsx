import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from "recharts";
import { Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { BI_TOOLTIP_STYLE } from "./bi-theme";

type GaugeType = "semicircle" | "radial" | "progress";
type Palette = "auto" | "success" | "info" | "primary" | "warning" | "destructive";

interface SlaGaugeCfg {
  type: GaugeType;
  palette: Palette;
  goal: number;
}

const LS_KEY = "biTI.slaGauge.v1";
const PALETTE_COLORS: Record<Exclude<Palette, "auto">, string> = {
  success: "hsl(var(--success))",
  info: "hsl(217 91% 60%)",
  primary: "hsl(var(--primary))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
};

function loadCfg(): SlaGaugeCfg {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { type: "semicircle", palette: "auto", goal: 90, ...JSON.parse(raw) };
  } catch {}
  return { type: "semicircle", palette: "auto", goal: 90 };
}

export function BISlaGaugeCard({ value, previous }: { value: number; previous?: number }) {
  const [cfg, setCfg] = useState<SlaGaugeCfg>(loadCfg);
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch {} }, [cfg]);

  const v = Math.max(0, Math.min(100, value));
  const remaining = 100 - v;
  const autoColor = v >= cfg.goal ? "hsl(var(--success))" : v >= cfg.goal * 0.78 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const color = cfg.palette === "auto" ? autoColor : PALETTE_COLORS[cfg.palette];
  const delta = typeof previous === "number" ? value - previous : null;

  return (
    <div className="relative flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SLA</div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-1 text-muted-foreground">
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de gráfico</Label>
              <Select value={cfg.type} onValueChange={(t) => setCfg({ ...cfg, type: t as GaugeType })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semicircle">Gauge semicircular</SelectItem>
                  <SelectItem value="radial">Anel radial</SelectItem>
                  <SelectItem value="progress">Barra de progresso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Paleta de cores</Label>
              <Select value={cfg.palette} onValueChange={(p) => setCfg({ ...cfg, palette: p as Palette })}>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Meta: {cfg.goal}%</Label>
              <Slider min={0} max={100} step={1} value={[cfg.goal]} onValueChange={([g]) => setCfg({ ...cfg, goal: g })} />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="relative mt-1 h-[150px] w-full">
        {cfg.type === "semicircle" && <Semicircle v={v} goal={cfg.goal} color={color} remaining={remaining} />}
        {cfg.type === "radial" && <Radial v={v} color={color} />}
        {cfg.type === "progress" && <Progress v={v} goal={cfg.goal} color={color} />}
        {cfg.type !== "progress" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
            <span className="text-2xl font-bold tabular-nums text-foreground">{v}%</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Meta {cfg.goal}%</span>
          </div>
        )}
      </div>

      {delta !== null && (
        <div className={`text-xs ${delta >= 0 ? "text-success" : "text-destructive"}`}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(0)}% vs. período anterior
        </div>
      )}
    </div>
  );
}

function Semicircle({ v, goal, color, remaining }: { v: number; goal: number; color: string; remaining: number }) {
  const data = [
    { name: "SLA", value: v, fill: color },
    { name: "Restante", value: remaining, fill: "hsl(var(--muted))" },
  ];
  const w = 1.2;
  const goalData = [
    { name: "before", value: Math.max(0, goal - w / 2), fill: "transparent" },
    { name: "tick", value: w, fill: "hsl(var(--foreground))" },
    { name: "after", value: Math.max(0, 100 - goal - w / 2), fill: "transparent" },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="85%" startAngle={180} endAngle={0} innerRadius={60} outerRadius={95} dataKey="value" stroke="none" isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Pie>
        <Pie data={goalData} cx="50%" cy="85%" startAngle={180} endAngle={0} innerRadius={54} outerRadius={101} dataKey="value" stroke="none" isAnimationActive={false}>
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

function Radial({ v, color }: { v: number; color: string }) {
  const data = [{ name: "v", value: v, fill: color }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
        <RadialBar background dataKey="value" cornerRadius={8} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

function Progress({ v, goal, color }: { v: number; goal: number; color: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
      <span className="text-2xl font-bold tabular-nums text-foreground">{v}%</span>
      <div className="relative h-5 w-full overflow-hidden rounded-full bg-muted" title={`Meta ${goal}%`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
        <div className="absolute inset-y-0" style={{ left: `${goal}%`, width: 2, background: "hsl(var(--foreground))" }} />
      </div>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Meta {goal}%</span>
    </div>
  );
}
