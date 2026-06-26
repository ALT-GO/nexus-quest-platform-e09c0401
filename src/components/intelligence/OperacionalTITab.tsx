import { useState, useEffect, useMemo, useCallback } from "react";
import { ActiveTimersCard } from "@/components/dashboard/ActiveTimersCard";
import { supabase } from "@/integrations/supabase/client";
import { fetchTimesheetByDateRange, formatDuration } from "@/hooks/use-timesheet";
import { calcDepreciation, formatBRL } from "@/lib/depreciation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Clock, CheckCircle2, AlertTriangle, Monitor, Wrench, Ticket, Loader2,
  Laptop, Smartphone, Phone, KeyRound, DollarSign, TrendingDown, Wifi,
  PieChart as PieIcon, ExternalLink,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { useTickets } from "@/hooks/use-tickets";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TicketDrilldownDialog } from "./TicketDrilldownDialog";
import { EntityDrilldownDialog, type DrilldownEntity } from "./EntityDrilldownDialog";
import { TrendChart } from "./TrendChart";
import { BacklogChart } from "./BacklogChart";
import { TimeByCategoryChart } from "./TimeByCategoryChart";
import { useProfileAvatars } from "@/hooks/use-profile-avatars";

import { BIModuleShell, type BISubTabKey } from "./bi/BIModuleShell";
import { BIStatCard } from "./bi/BIStatCard";
import { BIChartCard } from "./bi/BIChartCard";
import { BIInsightsBar, type BIInsight } from "./bi/BIInsightsBar";
import { BIPeopleRanking } from "./bi/BIPeopleRanking";
import { BIStatusDonut } from "./bi/BIStatusDonut";
import { BIBacklogAging } from "./bi/BIBacklogAging";
import { BIDemandHeatmap } from "./bi/BIDemandHeatmap";
import { BIDimensionHeatmap } from "./bi/BIDimensionHeatmap";
import { BIWorkloadChart } from "./bi/BIWorkloadChart";
import { BI_TOOLTIP_STYLE, BI_COLORS } from "./bi/bi-theme";
import { comparePeriod, previousPeriod } from "./bi/period-compare";
import { SatisfacaoTab } from "./SatisfacaoTab";

import type { CostCenterFilter } from "@/pages/CentralInteligencia";

interface OperacionalTITabProps {
  dateRange: { start: Date; end: Date };
  costCenter: CostCenterFilter;
}

interface InventoryItem {
  id: string;
  category: string;
  status: string;
  condition: string | null;
  collaborator: string | null;
  cost_center_eng: string | null;
  cost_center_man: string | null;
  operadora: string | null;
  valor_mensal: number | null;
  valor_pago: number | null;
  data_aquisicao: string | null;
  created_at: string;
}

const HARDWARE_CATS = new Set(["notebooks", "celulares", "tablets", "perifericos"]);
const HARDWARE_PROBLEM_CONDITIONS = new Set([
  "Defeito",
  "Em manutenção",
  "Bloqueado",
  "Sucata",
  "Reservado",
]);

/**
 * Returns the effective status used in the "Resumo de Ativos por Status" table.
 * For hardware categories the breakdown comes from `condition`:
 *  - problem conditions (Defeito, Em manutenção, Bloqueado, Sucata, Reservado) win
 *  - otherwise "Em uso" if it has a collaborator, "Disponível" if not
 * For linhas/licencas it keeps the original `status` value.
 */
function effectiveAssetStatus(item: InventoryItem): string {
  if (HARDWARE_CATS.has(item.category)) {
    const cond = (item.condition || "").trim();
    if (HARDWARE_PROBLEM_CONDITIONS.has(cond)) return cond;
    const owned = !!(item.collaborator && item.collaborator.trim() !== "");
    return owned ? "Em uso" : "Disponível";
  }
  return item.status;
}

const categoryLabels: Record<string, string> = {
  notebooks: "Notebooks", celulares: "Celulares", tablets: "Tablets",
  perifericos: "Periféricos", linhas: "Linhas", licencas: "Licenças",
};

const categoryIcons: Record<string, React.ElementType> = {
  notebooks: Laptop, celulares: Smartphone, tablets: Monitor,
  perifericos: Wrench, linhas: Phone, licencas: KeyRound,
};

const categoryColorClasses: Record<string, string> = {
  notebooks: "text-primary", celulares: "text-info", tablets: "text-success",
  perifericos: "text-warning", linhas: "text-chart-4", licencas: "text-destructive",
};

export function OperacionalTITab({ dateRange, costCenter }: OperacionalTITabProps) {
  const navigate = useNavigate();
  const { tickets: allTickets, loading } = useTickets();
  const { data: avatars } = useProfileAvatars();
  const [techFilter, setTechFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subTab, setSubTab] = useState<BISubTabKey>("overview");

  // Drilldown state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownTickets, setDrilldownTickets] = useState<any[]>([]);
  const [categoryDrilldown, setCategoryDrilldown] = useState<{ open: boolean; title: string; items: DrilldownEntity[] }>({ open: false, title: "", items: [] });

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [allTimesheetData, setAllTimesheetData] = useState<{ ticket_id: string | null; start_time: string; end_time: string | null; duration_seconds: number }[]>([]);

  // Inventory fetch
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

  useEffect(() => {
    fetchTimesheetByDateRange(dateRange).then(setAllTimesheetData);
  }, [dateRange]);

  // Exclude subtasks
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

  const allOpenTickets = useMemo(() => {
    return mainTickets.filter((t) => {
      if (t.completed_at) return false;
      if (techFilter !== "all" && t.assignee !== techFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [mainTickets, techFilter, categoryFilter]);

  // Period comparisons
  const createdCompare = useMemo(
    () => comparePeriod(mainTickets, (t) => t.created_at ? new Date(t.created_at) : null, dateRange),
    [mainTickets, dateRange]
  );
  const completedCompare = useMemo(
    () => comparePeriod(mainTickets, (t) => t.completed_at ? new Date(t.completed_at) : null, dateRange),
    [mainTickets, dateRange]
  );

  const avgResolutionHours = useMemo(() => {
    if (completedTickets.length === 0) return 0;
    const totalSeconds = completedTickets.reduce((sum, t) => {
      const ticketLogs = allTimesheetData.filter((l) => l.ticket_id === t.id && l.end_time);
      const timesheetSecs = ticketLogs.reduce((s, l) => s + l.duration_seconds, 0);
      if (timesheetSecs > 0) return sum + timesheetSecs;
      return sum + (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / 1000;
    }, 0);
    return Math.round((totalSeconds / completedTickets.length / 3600) * 10) / 10;
  }, [completedTickets, allTimesheetData]);

  const slaCumprido = useMemo(() => {
    if (completedTickets.length === 0) return 100;
    const withinSla = completedTickets.filter((t) => new Date(t.completed_at!).getTime() <= new Date(t.sla_deadline).getTime());
    return Math.round((withinSla.length / completedTickets.length) * 100);
  }, [completedTickets]);

  // SLA previous period
  const prevSlaCumprido = useMemo(() => {
    const prev = previousPeriod(dateRange);
    const prevCompleted = mainTickets.filter((t) => {
      if (!t.completed_at) return false;
      const d = new Date(t.completed_at);
      return d >= prev.start && d <= prev.end;
    });
    if (prevCompleted.length === 0) return 100;
    const within = prevCompleted.filter((t) => new Date(t.completed_at!).getTime() <= new Date(t.sla_deadline).getTime());
    return Math.round((within.length / prevCompleted.length) * 100);
  }, [mainTickets, dateRange]);

  const technicians = useMemo(() => {
    const set = new Set<string>();
    mainTickets.forEach((t) => { if (t.assignee) set.add(t.assignee); });
    return [...set];
  }, [mainTickets]);

  const ticketsByTech = useMemo(() => {
    const map: Record<string, { total: number; completed: number; userId?: string }> = {};
    filtered.forEach((t) => {
      const name = t.assignee || "Sem atribuição";
      if (!map[name]) map[name] = { total: 0, completed: 0, userId: (t as any).assignee_id };
      map[name].total++;
      if (t.completed_at) map[name].completed++;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v }));
  }, [filtered]);

  const ticketsByCategoryDonut = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { map[t.category] = (map[t.category] || 0) + 1; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const statusDonutData = useMemo(() => {
    const open = filtered.filter((t) => !t.completed_at).length;
    const done = filtered.filter((t) => t.completed_at).length;
    return [
      { name: "Concluídos", value: done, color: "hsl(var(--success))" },
      { name: "Abertos", value: open, color: "hsl(var(--warning))" },
    ].filter((s) => s.value > 0);
  }, [filtered]);

  // Top 5 slowest
  const top5SlowTasks = useMemo(() => {
    const existingTicketIds = new Set(mainTickets.map((t) => t.id));
    const timesheetByTicket: Record<string, number> = {};
    allTimesheetData.forEach((log) => {
      if (!existingTicketIds.has(log.ticket_id)) return;
      const secs = log.end_time ? log.duration_seconds : Math.floor((Date.now() - new Date(log.start_time).getTime()) / 1000);
      if (secs > 0) timesheetByTicket[log.ticket_id] = (timesheetByTicket[log.ticket_id] || 0) + secs;
    });
    return filtered
      .filter((t) => timesheetByTicket[t.id] && timesheetByTicket[t.id] > 0)
      .map((t) => ({
        id: t.id, ticketNumber: t.ticket_number, title: t.title,
        assignee: t.assignee || "—", totalSeconds: timesheetByTicket[t.id],
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, 5);
  }, [filtered, allTimesheetData, mainTickets]);

  // Workload data: per-person worked seconds + active + completed
  const workloadData = useMemo(() => {
    const ticketAssigneeMap = new Map<string, { name: string; userId?: string }>();
    mainTickets.forEach((t) => {
      ticketAssigneeMap.set(t.id, { name: t.assignee || "Sem atribuição", userId: (t as any).assignee_id });
    });

    const workedByPerson: Record<string, number> = {};
    allTimesheetData.forEach((log) => {
      if (!log.ticket_id) return;
      const meta = ticketAssigneeMap.get(log.ticket_id);
      if (!meta) return;
      const secs = log.end_time ? log.duration_seconds : Math.floor((Date.now() - new Date(log.start_time).getTime()) / 1000);
      if (secs > 0) workedByPerson[meta.name] = (workedByPerson[meta.name] || 0) + secs;
    });

    const activeByPerson: Record<string, number> = {};
    allOpenTickets.forEach((t) => {
      const name = t.assignee || "Sem atribuição";
      activeByPerson[name] = (activeByPerson[name] || 0) + 1;
    });

    const completedByPerson: Record<string, number> = {};
    completedTickets.forEach((t) => {
      const name = t.assignee || "Sem atribuição";
      completedByPerson[name] = (completedByPerson[name] || 0) + 1;
    });

    const names = new Set<string>([
      ...Object.keys(workedByPerson),
      ...Object.keys(activeByPerson),
      ...Object.keys(completedByPerson),
    ]);
    return [...names].map((name) => {
      // find a userId from a matching ticket
      const sample = mainTickets.find((t) => (t.assignee || "Sem atribuição") === name);
      const userId = (sample as any)?.assignee_id || null;
      return {
        name,
        userId,
        avatarUrl: userId ? avatars?.byId[userId] : null,
        workedSeconds: workedByPerson[name] || 0,
        activeCount: activeByPerson[name] || 0,
        completedCount: completedByPerson[name] || 0,
      };
    });
  }, [mainTickets, allTimesheetData, allOpenTickets, completedTickets, avatars]);

  // Inventory
  const filteredInv = useMemo(() => {
    let items = inventoryItems;
    if (costCenter === "eng") items = items.filter((i) => i.cost_center_eng && i.cost_center_eng.trim() !== "");
    else if (costCenter === "man") items = items.filter((i) => i.cost_center_man && i.cost_center_man.trim() !== "");
    return items;
  }, [inventoryItems, costCenter]);

  const allStatuses = useMemo(() => {
    const set = new Set<string>();
    filteredInv.forEach((i) => set.add(i.status));
    const ordered = ["Em uso"];
    const rest = [...set].filter((s) => s !== "Em uso").sort();
    return [...ordered.filter((s) => set.has(s)), ...rest];
  }, [filteredInv]);

  const inventoryByCategory = useMemo(() => {
    const cats = ["notebooks", "celulares", "tablets", "perifericos", "linhas", "licencas"];
    return cats.map((cat) => {
      const catItems = filteredInv.filter((i) => i.category === cat);
      const byStatus: Record<string, number> = {};
      allStatuses.forEach((s) => { byStatus[s] = 0; });
      catItems.forEach((i) => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
      return { category: cat, total: catItems.length, byStatus };
    });
  }, [filteredInv, allStatuses]);

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
      if (value > 0) map[normalized] = (map[normalized] || 0) + value;
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value: Math.round(value * 100) / 100, color: BI_COLORS[i % BI_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredInv]);

  const depreciationTotal = useMemo(() => {
    const hardware = filteredInv.filter((a) =>
      (a.category === "notebooks" || a.category === "celulares") && a.valor_pago && a.valor_pago > 0 && a.data_aquisicao
    );
    let totalDepreciation = 0; let totalOriginal = 0;
    hardware.forEach((a) => {
      const r = calcDepreciation(a.valor_pago, a.data_aquisicao);
      if (r) { totalDepreciation += r.depreciacaoAcumulada; totalOriginal += r.valorAquisicao; }
    });
    return { totalDepreciation, totalOriginal, assetCount: hardware.length };
  }, [filteredInv]);

  const totalValorMensal = useMemo(() => {
    return filteredInv
      .filter((a) => a.category === "linhas" && a.valor_mensal && a.valor_mensal > 0)
      .reduce((sum, a) => sum + (a.valor_mensal || 0), 0);
  }, [filteredInv]);

  const categories = useMemo(() => [...new Set(mainTickets.map((t) => t.category))], [mainTickets]);

  const openDrilldown = useCallback((title: string, ticketList: any[]) => {
    setDrilldownTitle(title); setDrilldownTickets(ticketList); setDrilldownOpen(true);
  }, []);

  // Insights — automated alerts
  const insights = useMemo<BIInsight[]>(() => {
    const out: BIInsight[] = [];

    // SLA breach
    if (completedTickets.length > 0 && slaCumprido < 80) {
      out.push({
        id: "sla-low",
        tone: "danger",
        title: `SLA em ${slaCumprido}% — abaixo do esperado`,
        description: `${completedTickets.filter((t) => new Date(t.completed_at!).getTime() > new Date(t.sla_deadline).getTime()).length} chamados fora do SLA no período.`,
      });
    } else if (completedTickets.length > 0 && slaCumprido >= 95) {
      out.push({ id: "sla-high", tone: "positive", title: `SLA excelente: ${slaCumprido}%`, description: "Equipe entregando dentro do prazo." });
    }

    // Backlog growing
    if (createdCompare.current > completedCompare.current && createdCompare.current > 5) {
      out.push({
        id: "backlog-grow",
        tone: "warning",
        title: "Backlog aumentando",
        description: `Foram criados ${createdCompare.current} chamados e concluídos ${completedCompare.current} no período.`,
        onClick: () => setSubTab("time"),
      });
    }

    // Stale items > 7 days
    const stale = allOpenTickets.filter((t) => {
      const ageDays = (Date.now() - new Date(t.created_at).getTime()) / 86400000;
      return ageDays >= 7;
    });
    if (stale.length > 0) {
      out.push({
        id: "stale",
        tone: "warning",
        title: `${stale.length} chamados abertos há mais de 7 dias`,
        description: "Considere repriorizar para evitar acúmulo.",
        onClick: () => setSubTab("time"),
      });
    }

    // Overload
    const overloaded = workloadData.filter((p) => {
      const businessDays = Math.max(1, Math.round(((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) * (5/7)));
      const expected = businessDays * 6 * 3600;
      return expected > 0 && p.workedSeconds / expected > 1.1;
    });
    if (overloaded.length > 0) {
      out.push({
        id: "overload",
        tone: "warning",
        title: `${overloaded.length} pessoa${overloaded.length > 1 ? "s" : ""} em sobrecarga`,
        description: overloaded.map((o) => o.name).slice(0, 3).join(", "),
        onClick: () => setSubTab("productivity"),
      });
    }

    // Period comparison — created spike
    if (createdCompare.previous > 0) {
      const delta = ((createdCompare.current - createdCompare.previous) / createdCompare.previous) * 100;
      if (delta >= 30) {
        out.push({
          id: "spike",
          tone: "info",
          title: `Volume ${Math.round(delta)}% maior que o período anterior`,
          description: `${createdCompare.current} criados vs ${createdCompare.previous} no período passado.`,
        });
      }
    }

    return out;
  }, [completedTickets, slaCumprido, createdCompare, completedCompare, allOpenTickets, workloadData, dateRange]);

  // ----------------- UI -----------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtersNode = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Técnico</span>
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {technicians.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Categoria</span>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // ===================== TAB CONTENTS =====================

  const overviewNode = (
    <>
      <ActiveTimersCard />

      {/* KPIs — standardized */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BIStatCard
          title="Chamados no período" value={filtered.length} icon={Ticket} tone="info"
          current={createdCompare.current} previous={createdCompare.previous}
          higherIsBetter={false}
          description={`${completedTickets.length} concluídos`}
          onClick={() => navigate("/ti/service-desk")}
        />
        <BIStatCard
          title="Tempo Médio Resolução" value={`${avgResolutionHours}h`} icon={Clock} tone="primary"
          description="Horas até concluir"
        />
        <BIStatCard
          title="SLA Cumprido" value={`${slaCumprido}%`} icon={CheckCircle2}
          tone={slaCumprido >= 90 ? "success" : slaCumprido >= 70 ? "warning" : "destructive"}
          current={slaCumprido} previous={prevSlaCumprido}
          higherIsBetter={true}
          onClick={() => navigate("/ti/service-desk")}
        />
        <BIStatCard
          title="Chamados Abertos" value={allOpenTickets.length} icon={AlertTriangle}
          tone={allOpenTickets.length > 20 ? "destructive" : "warning"}
          description="Sem conclusão"
          onClick={() => navigate("/ti/service-desk")}
        />
      </div>

      {/* Trend */}
      <TrendChart
        title="Evolução de Chamados ao Longo do Tempo"
        dateRange={dateRange}
        series={[
          { key: "criados", label: "Criados", gradient: "info", type: "bar",
            getDate: (t) => t.created_at ? new Date(t.created_at) : null, items: filtered },
          { key: "concluidos", label: "Concluídos", gradient: "success", type: "line",
            getDate: (t) => t.completed_at ? new Date(t.completed_at) : null, items: completedTickets },
        ]}
      />

      {/* Status donut + Category donut */}
      <div className="grid gap-5 lg:grid-cols-2">
        <BIStatusDonut
          title="Distribuição por Status"
          data={statusDonutData}
          centerLabel="chamados"
          hint={`${filtered.length} no período`}
          onSliceClick={(s) => {
            const list = s.name === "Concluídos" ? completedTickets : filtered.filter((t) => !t.completed_at);
            openDrilldown(s.name, list);
          }}
        />
        <BIStatusDonut
          title="Distribuição por Categoria"
          data={ticketsByCategoryDonut}
          centerLabel="categorias"
          hint={`${ticketsByCategoryDonut.length} categorias`}
          onSliceClick={(s) => {
            openDrilldown(`Chamados — ${s.name}`, filtered.filter((t) => t.category === s.name));
          }}
        />
      </div>

      {/* Satisfação — resumo no Visão Geral */}
      <SatisfacaoTab dateRange={dateRange} compact />
    </>
  );

  const productivityNode = (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BIStatCard
          title="Pessoas ativas" value={workloadData.filter((p) => p.workedSeconds > 0 || p.activeCount > 0).length}
          icon={CheckCircle2} tone="info" description="com chamados no período"
        />
        <BIStatCard
          title="Concluídos no período" value={completedCompare.current} icon={CheckCircle2} tone="success"
          current={completedCompare.current} previous={completedCompare.previous} higherIsBetter={true}
        />
        <BIStatCard
          title="Média por pessoa"
          value={
            workloadData.length > 0
              ? Math.round(filtered.length / workloadData.length)
              : 0
          }
          icon={Ticket} tone="primary" description="chamados / pessoa"
        />
        <BIStatCard
          title="Tempo total registrado"
          value={formatDuration(workloadData.reduce((s, p) => s + p.workedSeconds, 0))}
          icon={Clock} tone="primary"
        />
      </div>

      <BIWorkloadChart
        people={workloadData}
        dateRange={dateRange}
        onPersonClick={(name) => {
          openDrilldown(`Chamados — ${name}`, filtered.filter((t) => (t.assignee || "Sem atribuição") === name));
        }}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <BIPeopleRanking
          title="Ranking por Técnico"
          entityNoun="chamado"
          people={ticketsByTech.map((t) => ({
            name: t.name,
            userId: t.userId,
            avatarUrl: t.userId ? avatars?.byId[t.userId] : null,
            total: t.total,
            completed: t.completed,
          }))}
          onPersonClick={(name) => openDrilldown(`Chamados — ${name}`,
            filtered.filter((t) => (t.assignee || "Sem atribuição") === name))}
        />

        <div className="grid gap-5">
          <BIDimensionHeatmap
            title="Mapa de Calor por Dia da Semana"
            items={filtered}
            getDate={(t) => t.created_at ? new Date(t.created_at) : null}
            entityNoun="chamado"
            mode="weekday"
          />
          <BIDimensionHeatmap
            title="Mapa de Calor por Horário"
            items={filtered}
            getDate={(t) => t.created_at ? new Date(t.created_at) : null}
            entityNoun="chamado"
            mode="hour"
          />
        </div>
      </div>
    </>
  );

  const timeNode = (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BIStatCard
          title="Backlog atual" value={allOpenTickets.length} icon={AlertTriangle}
          tone={allOpenTickets.length > 20 ? "destructive" : "warning"}
          description="chamados em aberto"
        />
        <BIStatCard
          title="Saldo do período"
          value={(createdCompare.current - completedCompare.current > 0 ? "+" : "") + (createdCompare.current - completedCompare.current)}
          icon={TrendingDown}
          tone={createdCompare.current - completedCompare.current > 0 ? "destructive" : "success"}
          description="criados − concluídos"
        />
        <BIStatCard
          title="Tempo médio"
          value={`${avgResolutionHours}h`}
          icon={Clock} tone="primary"
        />
        <BIStatCard
          title="SLA"
          value={`${slaCumprido}%`}
          icon={CheckCircle2}
          tone={slaCumprido >= 90 ? "success" : slaCumprido >= 70 ? "warning" : "destructive"}
          current={slaCumprido} previous={prevSlaCumprido} higherIsBetter
        />
      </div>

      <BacklogChart
        title="Backlog: Criados vs Concluídos"
        dateRange={dateRange}
        createdItems={filtered}
        completedItems={completedTickets}
        getCreatedDate={(t) => (t.created_at ? new Date(t.created_at) : null)}
        getCompletedDate={(t) => (t.completed_at ? new Date(t.completed_at) : null)}
      />

      <BIBacklogAging
        title="Aging do Backlog"
        openItems={allOpenTickets}
        getCreatedDate={(t) => t.created_at ? new Date(t.created_at) : null}
        entityNoun="chamado"
        onBucketClick={(label, items) => openDrilldown(`Backlog · ${label}`, items)}
      />

      <TimeByCategoryChart
        title="Tempo Gasto por Categoria de Chamado"
        entityNoun="chamado"
        entityCategoryMap={Object.fromEntries(mainTickets.map((t) => [t.id, t.category || "Sem categoria"]))}
        logs={allTimesheetData
          .filter((l) => l.ticket_id)
          .map((l) => ({ entityId: l.ticket_id, start_time: l.start_time, end_time: l.end_time, duration_seconds: l.duration_seconds }))}
        onCategoryClick={(catName) => {
          const now = Date.now();
          const totalsByTicket: Record<string, number> = {};
          allTimesheetData.forEach((l) => {
            if (!l.ticket_id) return;
            const t = mainTickets.find((m) => m.id === l.ticket_id);
            if (!t || (t.category || "Sem categoria") !== catName) return;
            const secs = l.end_time ? l.duration_seconds : Math.floor((now - new Date(l.start_time).getTime()) / 1000);
            if (secs > 0) totalsByTicket[l.ticket_id] = (totalsByTicket[l.ticket_id] || 0) + secs;
          });
          const list = Object.entries(totalsByTicket).map(([id, secs]) => {
            const t = mainTickets.find((m) => m.id === id)!;
            return {
              id: t.id, reference: t.ticket_number, title: t.title, assignee: t.assignee,
              status: t.completed_at ? "Concluído" : "Aberto", totalSeconds: secs,
              onOpen: () => navigate(`/ti/service-desk?ticket=${t.id}`),
            };
          });
          setCategoryDrilldown({ open: true, title: `Tempo em "${catName}"`, items: list });
        }}
      />

      <BIChartCard title="Top 5 Chamados Mais Demorados" icon={Clock} iconColor="text-warning" padded={false}>
        {top5SlowTasks.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum registro de timesheet encontrado no período
          </p>
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
              {top5SlowTasks.map((task) => (
                <TableRow key={task.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/ti/service-desk?ticket=${task.id}`)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{task.ticketNumber}</TableCell>
                  <TableCell className="font-medium max-w-[280px] truncate">{task.title}</TableCell>
                  <TableCell>{task.assignee}</TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums">{formatDuration(task.totalSeconds)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </BIChartCard>
    </>
  );

  const domainNode = (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <BIStatCard
          title="Total de Ativos" value={filteredInv.length} icon={Monitor} tone="info"
          description={`${filteredInv.filter((a) => a.status === "Em uso" || a.status === "Ativo").length} em uso`}
          onClick={() => navigate("/ti/gestao-ativos")}
        />
        <BIStatCard
          title="Custo Mensal Telecom"
          value={`R$ ${totalValorMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={Phone} tone="primary"
          description={`${filteredInv.filter((a) => a.category === "linhas" && a.valor_mensal && a.valor_mensal > 0).length} linhas ativas`}
          onClick={() => navigate("/ti/gestao-faturas")}
        />
        <BIStatCard
          title="Depreciação Acumulada"
          value={formatBRL(depreciationTotal.totalDepreciation)}
          icon={TrendingDown} tone="destructive"
          description={`${depreciationTotal.assetCount} ativos · Original: ${formatBRL(depreciationTotal.totalOriginal)}`}
          onClick={() => navigate("/ti/gestao-ativos")}
        />
      </div>

      <BIChartCard title="Resumo de Ativos por Status" icon={Monitor} iconColor="text-primary" padded={false}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10">Categoria</TableHead>
                {allStatuses.map((s) => (
                  <TableHead key={s} className="text-center text-xs whitespace-nowrap">{s}</TableHead>
                ))}
                <TableHead className="text-center text-xs font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryByCategory.map((item) => {
                const Icon = categoryIcons[item.category] || Monitor;
                return (
                  <TableRow key={item.category} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate("/ti/gestao-ativos")}>
                    <TableCell className="sticky left-0 bg-card z-10 font-medium">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${categoryColorClasses[item.category] || "text-muted-foreground"}`} />
                        {categoryLabels[item.category] || item.category}
                      </div>
                    </TableCell>
                    {allStatuses.map((s) => (
                      <TableCell key={s} className="text-center tabular-nums">{item.byStatus[s] || 0}</TableCell>
                    ))}
                    <TableCell className="text-center font-bold tabular-nums">{item.total}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell className="sticky left-0 bg-muted/30 z-10">Total</TableCell>
                {allStatuses.map((s) => (
                  <TableCell key={s} className="text-center tabular-nums">
                    {inventoryByCategory.reduce((sum, item) => sum + (item.byStatus[s] || 0), 0)}
                  </TableCell>
                ))}
                <TableCell className="text-center font-bold tabular-nums">
                  {inventoryByCategory.reduce((sum, item) => sum + item.total, 0)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </BIChartCard>

      <BIChartCard title="Custo Mensal por Operadora" icon={Wifi} iconColor="text-info">
        {costByOperadora.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma linha com operadora e valor mensal cadastrados
          </p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[200px_1fr]">
            <div className="relative mx-auto h-[200px] w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={costByOperadora} cx="50%" cy="50%" innerRadius={60} outerRadius={88} paddingAngle={3} dataKey="value">
                    {costByOperadora.map((entry, i) => <Cell key={i} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip contentStyle={BI_TOOLTIP_STYLE} formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold tabular-nums">
                  R$ {costByOperadora.reduce((s, c) => s + c.value, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">/mês</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {costByOperadora.map((item) => (
                <div key={item.name} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-muted-foreground">{item.name}</span>
                  <span className="ml-auto font-medium tabular-nums">
                    R$ {item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </BIChartCard>
    </>
  );

  return (
    <>
      <BIModuleShell
        value={subTab}
        onChange={setSubTab}
        domainLabel="Ativos & Custos"
        insights={<BIInsightsBar insights={insights} />}
        filters={filtersNode}
        overview={overviewNode}
        productivity={productivityNode}
        time={timeNode}
        domain={domainNode}
        satisfaction={<SatisfacaoTab dateRange={dateRange} />}
      />

      <TicketDrilldownDialog open={drilldownOpen} onOpenChange={setDrilldownOpen} title={drilldownTitle} tickets={drilldownTickets} />
      <EntityDrilldownDialog
        open={categoryDrilldown.open}
        onOpenChange={(o) => setCategoryDrilldown((s) => ({ ...s, open: o }))}
        title={categoryDrilldown.title}
        items={categoryDrilldown.items}
        entityNoun="chamado"
      />
    </>
  );
}
