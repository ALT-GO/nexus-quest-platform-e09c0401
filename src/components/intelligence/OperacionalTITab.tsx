import { useState, useEffect, useMemo, useCallback } from "react";
import { ActiveTimersCard } from "@/components/dashboard/ActiveTimersCard";
import { supabase } from "@/integrations/supabase/client";
import { fetchTimesheetByDateRange, formatDuration } from "@/hooks/use-timesheet";
import { calcDepreciation, formatBRL } from "@/lib/depreciation";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Clock, CheckCircle2, AlertTriangle, Monitor, Wrench, Users, BarChart3, Ticket, Loader2,
  Laptop, Smartphone, Phone, KeyRound, Timer, CalendarDays, DollarSign, TrendingDown, Wifi, Wallet,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useTickets } from "@/hooks/use-tickets";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { TicketDrilldownDialog } from "./TicketDrilldownDialog";

import type { CostCenterFilter } from "@/pages/CentralInteligencia";

interface OperacionalTITabProps {
  dateRange: { start: Date; end: Date };
  costCenter: CostCenterFilter;
}

const chartColors = [
  "hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))",
  "hsl(var(--info))", "hsl(var(--chart-4))", "hsl(var(--destructive))",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

interface InventoryItem {
  id: string;
  category: string;
  status: string;
  cost_center_eng: string | null;
  cost_center_man: string | null;
  operadora: string | null;
  valor_mensal: number | null;
  valor_pago: number | null;
  data_aquisicao: string | null;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  notebooks: "Notebooks",
  celulares: "Celulares",
  tablets: "Tablets",
  perifericos: "Periféricos",
  linhas: "Linhas",
  licencas: "Licenças",
};

const categoryIcons: Record<string, React.ElementType> = {
  notebooks: Laptop,
  celulares: Smartphone,
  tablets: Monitor,
  perifericos: Wrench,
  linhas: Phone,
  licencas: KeyRound,
};

const categoryColorClasses: Record<string, string> = {
  notebooks: "text-primary",
  celulares: "text-info",
  tablets: "text-success",
  perifericos: "text-warning",
  linhas: "text-chart-4",
  licencas: "text-destructive",
};

const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function OperacionalTITab({ dateRange, costCenter }: OperacionalTITabProps) {
  const navigate = useNavigate();
  const { tickets: allTickets, loading } = useTickets();
  const [techFilter, setTechFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Drilldown dialog state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownTickets, setDrilldownTickets] = useState<any[]>([]);
  
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [allTimesheetData, setAllTimesheetData] = useState<{ ticket_id: string; start_time: string; end_time: string | null; duration_seconds: number }[]>([]);

  // Fetch inventory from Supabase
  useEffect(() => {
    const fields = "id, category, status, cost_center_eng, cost_center_man, operadora, valor_mensal, valor_pago, data_aquisicao, created_at";
    supabase.from("inventory").select(fields).then(({ data }) => {
      if (data) setInventoryItems(data as InventoryItem[]);
    });
    const channel = supabase
      .channel("operacional-inventory-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => {
        supabase.from("inventory").select(fields).then(({ data }) => {
          if (data) setInventoryItems(data as InventoryItem[]);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch timesheet data filtered by date range
  useEffect(() => {
    fetchTimesheetByDateRange(dateRange).then(setAllTimesheetData);
  }, [dateRange]);

  // Exclude subtasks from all dashboard calculations
  const mainTickets = useMemo(() => allTickets.filter((t) => !t.parent_ticket_id), [allTickets]);

  const filtered = useMemo(() => {
    return mainTickets.filter((t) => {
      const created = new Date(t.created_at);
      if (created < dateRange.start || created > dateRange.end) return false;
      if (techFilter !== "all" && t.assignee !== techFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [mainTickets, dateRange, techFilter, categoryFilter]);

  const completedTickets = filtered.filter((t) => t.completed_at);

  // All currently open tickets (regardless of date range) for "Chamados Abertos"
  const allOpenTickets = useMemo(() => {
    return mainTickets.filter((t) => {
      if (t.completed_at) return false;
      if (techFilter !== "all" && t.assignee !== techFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [mainTickets, techFilter, categoryFilter]);

  const avgResolutionHours = useMemo(() => {
    if (completedTickets.length === 0) return 0;
    const totalSeconds = completedTickets.reduce((sum, t) => {
      // Check date-range-filtered timesheet data first
      const ticketLogs = allTimesheetData.filter((l) => l.ticket_id === t.id && l.end_time);
      const timesheetSecs = ticketLogs.reduce((s, l) => s + l.duration_seconds, 0);
      if (timesheetSecs > 0) return sum + timesheetSecs;
      // Fallback to wall-clock time
      return sum + (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / 1000;
    }, 0);
    return Math.round((totalSeconds / completedTickets.length / 3600) * 10) / 10;
  }, [completedTickets, allTimesheetData]);

  const slaCumprido = useMemo(() => {
    if (completedTickets.length === 0) return 100;
    const withinSla = completedTickets.filter((t) => new Date(t.completed_at!).getTime() <= new Date(t.sla_deadline).getTime());
    return Math.round((withinSla.length / completedTickets.length) * 100);
  }, [completedTickets]);

  const technicians = useMemo(() => {
    const set = new Set<string>();
    mainTickets.forEach((t) => { if (t.assignee) set.add(t.assignee); });
    return [...set];
  }, [mainTickets]);

  const ticketsByTech = useMemo(() => {
    const map: Record<string, { total: number; completed: number }> = {};
    filtered.forEach((t) => {
      const name = t.assignee || "Sem atribuição";
      if (!map[name]) map[name] = { total: 0, completed: 0 };
      map[name].total++;
      if (t.completed_at) map[name].completed++;
    });
    return Object.entries(map).map(([name, data]) => ({
      name, total: data.total, completed: data.completed, pending: data.total - data.completed,
    }));
  }, [filtered]);

  const ticketsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { map[t.category] = (map[t.category] || 0) + 1; });
    return Object.entries(map)
      .map(([name, value], i) => ({
        name: name.length > 25 ? name.slice(0, 22) + "…" : name,
        fullName: name, value, color: chartColors[i % chartColors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // ---- Top 5 Tarefas Demoradas (using date-range-filtered timesheet) ----
  const top5SlowTasks = useMemo(() => {
    // Build set of existing ticket IDs to exclude orphaned timesheet logs
    const existingTicketIds = new Set(mainTickets.map((t) => t.id));

    // Aggregate timesheet seconds per ticket from date-range data
    const timesheetByTicket: Record<string, number> = {};
    allTimesheetData.forEach((log) => {
      if (!existingTicketIds.has(log.ticket_id)) return; // skip deleted tickets
      const secs = log.end_time ? log.duration_seconds : Math.floor((Date.now() - new Date(log.start_time).getTime()) / 1000);
      if (secs > 0) timesheetByTicket[log.ticket_id] = (timesheetByTicket[log.ticket_id] || 0) + secs;
    });

    return filtered
      .filter((t) => timesheetByTicket[t.id] && timesheetByTicket[t.id] > 0)
      .map((t) => ({
        id: t.id,
        ticketNumber: t.ticket_number,
        title: t.title,
        assignee: t.assignee || "—",
        totalSeconds: timesheetByTicket[t.id],
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 5);
  }, [filtered, allTimesheetData, mainTickets]);

  // ---- Horas Trabalhadas por Colaborador (date-range filtered) ----
  const hoursByAssignee = useMemo(() => {
    // Build a map of ticket_id -> assignee from tickets
    const ticketAssigneeMap = new Map<string, string>();
    mainTickets.forEach((t) => {
      ticketAssigneeMap.set(t.id, t.assignee || "Sem atribuição");
    });

    const map: Record<string, number> = {};
    allTimesheetData.forEach((log) => {
      const assignee = ticketAssigneeMap.get(log.ticket_id) || "Sem atribuição";
      let secs = 0;
      if (log.end_time) {
        secs = log.duration_seconds;
      } else {
        // Running timer — calculate elapsed live
        secs = Math.floor((Date.now() - new Date(log.start_time).getTime()) / 1000);
      }
      if (secs > 0) {
        map[assignee] = (map[assignee] || 0) + secs;
      }
    });

    return Object.entries(map)
      .map(([name, seconds]) => ({ name, hours: Math.round((seconds / 3600) * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours);
  }, [allTimesheetData, allTickets]);

  // ---- NEW: Volume de Chamados por Dia da Semana ----
  const ticketsByDayOfWeek = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    filtered.forEach((t) => {
      const day = new Date(t.created_at).getDay();
      counts[day]++;
    });
    return dayLabels.map((label, i) => ({ name: label, chamados: counts[i] }));
  }, [filtered]);

  // Filter inventory by cost center only (inventory = current state, not period-bound)
  const filteredInv = useMemo(() => {
    let items = inventoryItems;
    if (costCenter === "eng") items = items.filter((i) => i.cost_center_eng && i.cost_center_eng.trim() !== "");
    else if (costCenter === "man") items = items.filter((i) => i.cost_center_man && i.cost_center_man.trim() !== "");
    return items;
  }, [inventoryItems, costCenter]);

  const assetsEmUso = filteredInv.filter((a) => a.status === "Em uso").length;
  const assetsAtivo = filteredInv.filter((a) => a.status === "Ativo").length;
  const assetsInativo = filteredInv.filter((a) => a.status === "Inativo").length;
  const inventoryByCategory = useMemo(() => {
    const cats = ["notebooks", "celulares", "tablets", "perifericos", "linhas", "licencas"];
    return cats.map((cat) => ({
      category: cat,
      emUso: filteredInv.filter((i) => i.category === cat && i.status === "Em uso").length,
      ativo: filteredInv.filter((i) => i.category === cat && i.status === "Ativo").length,
      total: filteredInv.filter((i) => i.category === cat).length,
    }));
  }, [filteredInv]);

  // ---- Financial: Custo por Operadora ----
  const costByOperadora = useMemo(() => {
    const linhas = filteredInv.filter((a) => a.category === "linhas" && a.operadora && a.operadora.trim() !== "");
    const map: Record<string, number> = {};
    linhas.forEach((a) => {
      const op = a.operadora!.trim();
      let normalized = op;
      const lower = op.toLowerCase();
      if (lower.includes("vivo")) normalized = "Vivo";
      else if (lower.includes("claro")) normalized = "Claro";
      else if (lower.includes("salvy") || lower.includes("salvi")) normalized = "Salvy";
      else if (lower.includes("tim")) normalized = "TIM";
      else if (lower.includes("oi")) normalized = "Oi";
      const value = a.valor_mensal || 0;
      if (value > 0) {
        map[normalized] = (map[normalized] || 0) + value;
      }
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value: Math.round(value * 100) / 100, color: chartColors[i % chartColors.length] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredInv]);

  // ---- Financial: Depreciação Acumulada ----
  const depreciationTotal = useMemo(() => {
    const hardwareAssets = filteredInv.filter(
      (a) => (a.category === "notebooks" || a.category === "celulares") && a.valor_pago && a.valor_pago > 0 && a.data_aquisicao
    );
    let totalDepreciation = 0;
    let totalOriginal = 0;
    hardwareAssets.forEach((a) => {
      const result = calcDepreciation(a.valor_pago, a.data_aquisicao);
      if (result) {
        totalDepreciation += result.depreciacaoAcumulada;
        totalOriginal += result.valorAquisicao;
      }
    });
    return { totalDepreciation, totalOriginal, assetCount: hardwareAssets.length };
  }, [filteredInv]);

  // ---- Financial: Total valor mensal linhas ----
  const totalValorMensal = useMemo(() => {
    return filteredInv
      .filter((a) => a.category === "linhas" && a.valor_mensal && a.valor_mensal > 0)
      .reduce((sum, a) => sum + (a.valor_mensal || 0), 0);
  }, [filteredInv]);

  const categories = useMemo(() => [...new Set(mainTickets.map((t) => t.category))], [mainTickets]);

  const openDrilldown = useCallback((title: string, ticketList: any[]) => {
    setDrilldownTitle(title);
    setDrilldownTickets(ticketList);
    setDrilldownOpen(true);
  }, []);

  const handleTechBarClick = useCallback((data: any) => {
    if (!data?.name) return;
    const name = data.name;
    const techTickets = filtered.filter((t) =>
      name === "Sem atribuição" ? !t.assignee : t.assignee === name
    );
    openDrilldown(`Chamados — ${name}`, techTickets);
  }, [filtered, openDrilldown]);

  const handleCategoryClick = useCallback((data: any) => {
    if (!data?.fullName) return;
    const catTickets = filtered.filter((t) => t.category === data.fullName);
    openDrilldown(`Chamados — ${data.fullName}`, catTickets);
  }, [filtered, openDrilldown]);

  const handleHoursBarClick = useCallback((data: any) => {
    if (!data?.name) return;
    const name = data.name;
    const techTickets = filtered.filter((t) =>
      name === "Sem atribuição" ? !t.assignee : t.assignee === name
    );
    openDrilldown(`Horas — ${name}`, techTickets);
  }, [filtered, openDrilldown]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ActiveTimersCard />
      {/* Sub-filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Técnico</span>
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {technicians.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Categoria</span>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Chamados no período" value={filtered.length} icon={Ticket} description={`${completedTickets.length} concluídos`} onClick={() => navigate("/ti/service-desk")} />
        <StatCard title="Tempo Médio Resolução" value={`${avgResolutionHours}h`} icon={Clock} description="Média em horas" />
        <StatCard
          title="SLA Cumprido" value={`${slaCumprido}%`} icon={CheckCircle2} description="No período"
          trend={slaCumprido >= 90 ? { value: slaCumprido - 90, isPositive: true } : { value: 90 - slaCumprido, isPositive: false }}
          onClick={() => navigate("/ti/service-desk")}
        />
        <StatCard title="Chamados Abertos" value={allOpenTickets.length} icon={AlertTriangle} description="Atualmente sem conclusão" onClick={() => navigate("/ti/service-desk")} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />Chamados por Técnico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ticketsByTech} layout="vertical" className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="completed" name="Concluídos" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} stackId="a" onClick={(_: any, idx: number) => handleTechBarClick(ticketsByTech[idx])} />
                  <Bar dataKey="pending" name="Pendentes" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} stackId="a" onClick={(_: any, idx: number) => handleTechBarClick(ticketsByTech[idx])} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />Chamados por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-[300px] items-center justify-center gap-6">
              <div className="h-[220px] w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ticketsByCategory} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {ticketsByCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, _: string, props: any) => [value, props.payload.fullName]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-2">
                {ticketsByCategory.map((item) => (
                  <div
                    key={item.fullName}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1.5 py-1 transition-colors"
                    onClick={() => handleCategoryClick(item)}
                  >
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground truncate max-w-[140px]" title={item.fullName}>{item.name}</span>
                    <span className="ml-auto font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Volume por Dia da Semana + Horas por Colaborador */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />Volume de Chamados por Dia da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ticketsByDayOfWeek}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="chamados" name="Chamados" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Timer className="h-4 w-4 text-muted-foreground" />Horas Trabalhadas por Colaborador
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hoursByAssignee.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Nenhum registro de timesheet no período
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursByAssignee} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} unit="h" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value}h`} />
                    <Bar dataKey="hours" name="Horas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} className="cursor-pointer" onClick={(_: any, idx: number) => handleHoursBarClick(hoursByAssignee[idx])} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* NEW: Top 5 Tarefas Demoradas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" />Top 5 Tarefas Mais Demoradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {top5SlowTasks.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Nenhum registro de timesheet encontrado no período
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Chamado</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Responsável</TableHead>
                   <TableHead className="text-right">Tempo Total</TableHead>
                   <TableHead className="w-[50px]" />
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {top5SlowTasks.map((task, i) => (
                   <TableRow key={task.id}>
                     <TableCell className="font-mono text-xs text-muted-foreground">{task.ticketNumber}</TableCell>
                     <TableCell className="font-medium max-w-[250px] truncate">{task.title}</TableCell>
                     <TableCell>{task.assignee}</TableCell>
                     <TableCell className="text-right font-mono font-semibold">{formatDuration(task.totalSeconds)}</TableCell>
                     <TableCell className="text-right">
                       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/ti/service-desk?ticket=${task.id}`)}>
                         <ExternalLink className="h-3.5 w-3.5" />
                       </Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* SLA Gauge + Resumo de Ativos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />Taxa de SLA Cumprido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-4 py-4">
              <div className="relative flex h-40 w-40 items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none"
                    stroke={slaCumprido >= 90 ? "hsl(var(--success))" : slaCumprido >= 70 ? "hsl(var(--warning))" : "hsl(var(--destructive))"}
                    strokeWidth="8" strokeDasharray={`${(slaCumprido / 100) * 264} 264`} strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-3xl font-bold">{slaCumprido}%</span>
              </div>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <span>Dentro do SLA: <strong className="text-foreground">{completedTickets.filter((t) => new Date(t.completed_at!).getTime() <= new Date(t.sla_deadline).getTime()).length}</strong></span>
                <span>Fora do SLA: <strong className="text-foreground">{completedTickets.filter((t) => new Date(t.completed_at!).getTime() > new Date(t.sla_deadline).getTime()).length}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Monitor className="h-4 w-4 text-muted-foreground" />Resumo de Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 py-4 mb-4">
              <div className="flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all active:scale-[0.98]" onClick={() => navigate("/ti/gestao-ativos")}>
                <Monitor className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold">{assetsEmUso}</span>
                <span className="text-sm text-muted-foreground">Em uso</span>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all active:scale-[0.98]" onClick={() => navigate("/ti/gestao-ativos")}>
                <CheckCircle2 className="h-8 w-8 text-success" />
                <span className="text-2xl font-bold">{assetsAtivo}</span>
                <span className="text-sm text-muted-foreground">Ativos</span>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all active:scale-[0.98]" onClick={() => navigate("/ti/gestao-ativos")}>
                <AlertTriangle className="h-8 w-8 text-warning" />
                <span className="text-2xl font-bold">{assetsInativo}</span>
                <span className="text-sm text-muted-foreground">Inativos</span>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {inventoryByCategory.map((item) => {
                const Icon = categoryIcons[item.category] || Monitor;
                return (
                  <div key={item.category} className="flex flex-col items-center gap-1 rounded-lg border p-3 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all active:scale-[0.98]" onClick={() => navigate("/ti/gestao-ativos")}>
                    <Icon className={`h-6 w-6 ${categoryColorClasses[item.category] || "text-muted-foreground"}`} />
                    <span className="text-lg font-bold">{item.emUso + item.ativo}</span>
                    <span className="text-xs text-muted-foreground">{categoryLabels[item.category]} ativos</span>
                    <span className="text-[10px] text-muted-foreground/60">{item.total} total</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ======== Seção: Ativos & Custos ======== */}
      <Separator className="my-2" />
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Wallet className="h-5 w-5 text-muted-foreground" />
        Ativos & Custos
      </h2>

      {/* Financial Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Custo Mensal Telecom"
          value={`R$ ${totalValorMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={Phone}
          description={`${filteredInv.filter((a) => a.category === "linhas" && a.valor_mensal && a.valor_mensal > 0).length} linhas ativas`}
          className="border-l-4 border-l-primary"
          onClick={() => navigate("/ti/gestao-faturas")}
        />
        <StatCard
          title="Depreciação Acumulada"
          value={formatBRL(depreciationTotal.totalDepreciation)}
          icon={TrendingDown}
          description={`${depreciationTotal.assetCount} ativos · Original: ${formatBRL(depreciationTotal.totalOriginal)}`}
          className="border-l-4 border-l-destructive"
          onClick={() => navigate("/ti/gestao-ativos")}
        />
        <StatCard
          title="Total de Ativos"
          value={filteredInv.length}
          icon={Monitor}
          description={`${assetsEmUso + assetsAtivo} ativos · ${assetsInativo} inativos`}
          className="border-l-4 border-l-success"
          onClick={() => navigate("/ti/gestao-ativos")}
        />
      </div>

      {/* Custo por Operadora Donut */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Wifi className="h-4 w-4 text-muted-foreground" />Custo Mensal por Operadora
          </CardTitle>
        </CardHeader>
        <CardContent>
          {costByOperadora.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Nenhuma linha com operadora e valor mensal cadastrados
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center gap-8">
              <div className="h-[220px] w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={costByOperadora} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                      {costByOperadora.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {costByOperadora.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="ml-auto font-medium">R$ {item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <TicketDrilldownDialog
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        title={drilldownTitle}
        tickets={drilldownTickets}
      />
    </div>
  );
}