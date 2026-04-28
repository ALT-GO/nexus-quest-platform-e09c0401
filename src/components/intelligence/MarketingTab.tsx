import { useMemo, useEffect, useState } from "react";
import { ActiveTimersCard } from "@/components/dashboard/ActiveTimersCard";
import { EventCalendarCard } from "@/components/dashboard/EventCalendarCard";
import { supabase } from "@/integrations/supabase/client";
import { fetchMarketingTimesheetTotals, fetchMarketingTimesheetByDateRange, formatDuration } from "@/hooks/use-timesheet";
import { useMarketingTasks, useMarketingStages } from "@/hooks/use-marketing";
import { useMarketingTaskTypes } from "@/hooks/use-task-types";
import { useMarketingEvents } from "@/hooks/use-events";
import { useMarketingMaterials, useMaterialAllocations } from "@/hooks/use-materials";
import { useMarketingSprints } from "@/hooks/use-sprints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useProfileAvatars } from "@/hooks/use-profile-avatars";
import {
  CheckCircle2, Clock, ListTodo, AlertTriangle, Target, TrendingUp,
  Timer, CalendarIcon, DollarSign, Zap, BarChart3, Package, Megaphone,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

import { TrendChart } from "./TrendChart";
import { BacklogChart } from "./BacklogChart";
import { TimeByCategoryChart } from "./TimeByCategoryChart";
import { EntityDrilldownDialog, type DrilldownEntity } from "./EntityDrilldownDialog";

import { BIModuleShell, type BISubTabKey } from "./bi/BIModuleShell";
import { BIStatCard } from "./bi/BIStatCard";
import { BIChartCard } from "./bi/BIChartCard";
import { BIInsightsBar, type BIInsight } from "./bi/BIInsightsBar";
import { BIPeopleRanking } from "./bi/BIPeopleRanking";
import { BIStatusDonut } from "./bi/BIStatusDonut";
import { BIBacklogAging } from "./bi/BIBacklogAging";
import { BIDemandHeatmap } from "./bi/BIDemandHeatmap";
import { BIWorkloadChart } from "./bi/BIWorkloadChart";
import { BI_TOOLTIP_STYLE, BI_GRADIENTS } from "./bi/bi-theme";
import { BIGradientDefs } from "./bi/BIGradientDefs";
import { comparePeriod, previousPeriod } from "./bi/period-compare";

interface MarketingTabProps {
  dateRange: { start: Date; end: Date };
}

export function MarketingTab({ dateRange }: MarketingTabProps) {
  const navigate = useNavigate();
  const { data: allTasks } = useMarketingTasks();
  const { data: stages } = useMarketingStages();
  const { data: events } = useMarketingEvents();
  const { data: materials } = useMarketingMaterials();
  const { data: allAllocations } = useMaterialAllocations();
  const { data: sprints } = useMarketingSprints();
  const { data: avatars } = useProfileAvatars();
  const { data: taskTypes } = useMarketingTaskTypes();

  const [mktTimesheetTotals, setMktTimesheetTotals] = useState<Record<string, number>>({});
  const [mktTimesheetLogsRange, setMktTimesheetLogsRange] = useState<{ marketing_task_id: string | null; start_time: string; end_time: string | null; duration_seconds: number }[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [categoryDrilldown, setCategoryDrilldown] = useState<{ open: boolean; title: string; items: DrilldownEntity[] }>({ open: false, title: "", items: [] });
  const [subTab, setSubTab] = useState<BISubTabKey>("overview");

  // Goals
  useEffect(() => {
    supabase.from("marketing_goals").select("*").then(({ data }) => {
      if (data) setGoals(data);
    });
  }, []);

  // Tasks filtered by date range
  const tasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t) => {
      const d = new Date(t.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [allTasks, dateRange]);

  // Timesheets
  useEffect(() => {
    const ids = (allTasks || []).map((t) => t.id);
    if (ids.length > 0) fetchMarketingTimesheetTotals(ids).then(setMktTimesheetTotals);
  }, [allTasks]);

  useEffect(() => {
    fetchMarketingTimesheetByDateRange(dateRange).then(setMktTimesheetLogsRange);
  }, [dateRange]);

  // Map task -> type
  const taskTypeMap = useMemo(() => {
    const typeNameById = new Map((taskTypes || []).map((tt: any) => [tt.id, tt.name]));
    const map: Record<string, string> = {};
    (allTasks || []).forEach((t: any) => {
      const typeName = t.task_type_id ? (typeNameById.get(t.task_type_id) as string | undefined) : undefined;
      map[t.id] = typeName || "Sem tipo";
    });
    return map;
  }, [allTasks, taskTypes]);

  // ── Period comparisons ──
  const createdCompare = useMemo(
    () => comparePeriod(allTasks || [], (t) => t.created_at ? new Date(t.created_at) : null, dateRange),
    [allTasks, dateRange]
  );
  const completedCompare = useMemo(
    () => comparePeriod(
      (allTasks || []).filter((t) => t.progress === "Concluído"),
      (t) => t.updated_at ? new Date(t.updated_at) : null,
      dateRange
    ),
    [allTasks, dateRange]
  );

  // ── Standard metrics ──
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.progress === "Concluído").length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ── On-time rate ──
  const onTimeRate = useMemo(() => {
    const completed = tasks.filter((t) => t.progress === "Concluído" && t.due_date);
    if (completed.length === 0) return 0;
    const onTime = completed.filter((t) => new Date(t.updated_at) <= new Date(t.due_date!)).length;
    return Math.round((onTime / completed.length) * 100);
  }, [tasks]);

  const prevOnTimeRate = useMemo(() => {
    const prev = previousPeriod(dateRange);
    const completed = (allTasks || []).filter((t) => {
      if (t.progress !== "Concluído" || !t.due_date) return false;
      const d = new Date(t.updated_at);
      return d >= prev.start && d <= prev.end;
    });
    if (completed.length === 0) return 0;
    const onTime = completed.filter((t) => new Date(t.updated_at) <= new Date(t.due_date!)).length;
    return Math.round((onTime / completed.length) * 100);
  }, [allTasks, dateRange]);

  const totalWorkedSeconds = useMemo(() =>
    Object.values(mktTimesheetTotals).reduce((sum, s) => sum + s, 0),
  [mktTimesheetTotals]);

  const avgCompletionDays = useMemo(() => {
    const completed = tasks.filter((t) => t.progress === "Concluído");
    if (completed.length === 0) return 0;
    const totalDays = completed.reduce((sum, t) =>
      sum + differenceInDays(new Date(t.updated_at), new Date(t.created_at)), 0);
    return Math.round((totalDays / completed.length) * 10) / 10;
  }, [tasks]);

  // ── Workload data ──
  const workloadData = useMemo(() => {
    const taskAssigneeMap = new Map<string, { name: string; userId?: string | null }>();
    (allTasks || []).forEach((t: any) => {
      taskAssigneeMap.set(t.id, { name: t.assignee_name || "Sem atribuição", userId: t.assignee_id });
    });

    const workedByPerson: Record<string, { secs: number; userId?: string | null }> = {};
    mktTimesheetLogsRange.forEach((log) => {
      if (!log.marketing_task_id) return;
      const meta = taskAssigneeMap.get(log.marketing_task_id);
      if (!meta) return;
      const secs = log.end_time ? log.duration_seconds : Math.floor((Date.now() - new Date(log.start_time).getTime()) / 1000);
      if (secs > 0) {
        if (!workedByPerson[meta.name]) workedByPerson[meta.name] = { secs: 0, userId: meta.userId };
        workedByPerson[meta.name].secs += secs;
      }
    });

    const activeByPerson: Record<string, number> = {};
    (allTasks || []).forEach((t: any) => {
      if (t.progress === "Concluído") return;
      const name = t.assignee_name || "Sem atribuição";
      activeByPerson[name] = (activeByPerson[name] || 0) + 1;
    });

    const completedByPerson: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.progress !== "Concluído") return;
      const name = t.assignee_name || "Sem atribuição";
      completedByPerson[name] = (completedByPerson[name] || 0) + 1;
    });

    const names = new Set<string>([
      ...Object.keys(workedByPerson),
      ...Object.keys(activeByPerson),
      ...Object.keys(completedByPerson),
    ]);
    return [...names].map((name) => {
      const sample = (allTasks || []).find((t: any) => (t.assignee_name || "Sem atribuição") === name);
      const userId = sample?.assignee_id || null;
      return {
        name, userId,
        avatarUrl: userId ? avatars?.byId[userId] : null,
        workedSeconds: workedByPerson[name]?.secs || 0,
        activeCount: activeByPerson[name] || 0,
        completedCount: completedByPerson[name] || 0,
      };
    });
  }, [allTasks, mktTimesheetLogsRange, tasks, avatars]);

  // ── Tasks by assignee for ranking ──
  const tasksByAssignee = useMemo(() => {
    const map: Record<string, { total: number; completed: number; userId?: string | null }> = {};
    tasks.forEach((t: any) => {
      const name = t.assignee_name || "Sem atribuição";
      if (!map[name]) map[name] = { total: 0, completed: 0, userId: t.assignee_id };
      map[name].total++;
      if (t.progress === "Concluído") map[name].completed++;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v }));
  }, [tasks]);

  // ── Tasks by stage ──
  const tasksByStageDonut = useMemo(() => {
    if (!stages) return [];
    return stages
      .map((s) => ({ name: s.name, value: tasks.filter((t) => t.stage_id === s.id).length }))
      .filter((s) => s.value > 0);
  }, [stages, tasks]);

  // ── Tasks by type ──
  const tasksByTypeDonut = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach((t) => {
      const name = taskTypeMap[t.id] || "Sem tipo";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [tasks, taskTypeMap]);

  // ── Open tasks ──
  const openTasks = useMemo(() =>
    (allTasks || []).filter((t) => t.progress !== "Concluído"),
  [allTasks]);

  const overdueCount = tasks.filter((t) => {
    if (t.progress === "Concluído" || !t.due_date) return false;
    return new Date(t.due_date) < new Date();
  }).length;

  // ── Estimates vs actual ──
  const estimateVsActualData = useMemo(() => {
    if (!allTasks) return [];
    return allTasks
      .filter((t) => t.time_estimate_minutes && t.time_estimate_minutes > 0)
      .map((t) => {
        const estH = Math.round((t.time_estimate_minutes! / 60) * 10) / 10;
        const actH = Math.round(((mktTimesheetTotals[t.id] || 0) / 3600) * 10) / 10;
        return {
          name: t.title.length > 20 ? t.title.substring(0, 20) + "…" : t.title,
          estimativa: estH, real: actH,
        };
      })
      .sort((a, b) => b.real - a.real).slice(0, 8);
  }, [allTasks, mktTimesheetTotals]);

  // ── Goals & Sprints ──
  const activeGoals = goals.filter((g) => g.status !== "completed" && g.status !== "cancelled");
  const avgGoalProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => sum + Math.min((g.current_value / g.target_value) * 100, 100), 0) / activeGoals.length)
    : 0;
  const goalsAtRisk = activeGoals.filter((g) => {
    if (!g.due_date) return false;
    const daysLeft = differenceInDays(new Date(g.due_date), new Date());
    const progress = (g.current_value / g.target_value) * 100;
    return daysLeft <= 14 && progress < 70;
  });

  const activeSprint = sprints?.find((s) => s.status === "active");
  const sprintTasks = useMemo(() => {
    if (!activeSprint || !allTasks) return [];
    return allTasks.filter((t) => t.sprint_id === activeSprint.id);
  }, [activeSprint, allTasks]);
  const sprintPointsDone = sprintTasks.filter((t) => t.progress === "Concluído").reduce((s, t) => s + (t.story_points || 0), 0);
  const sprintPointsTotal = sprintTasks.reduce((s, t) => s + (t.story_points || 0), 0);

  const velocityData = useMemo(() => {
    if (!sprints || !allTasks) return [];
    return sprints
      .filter((s) => s.status === "completed" || s.status === "active")
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      .slice(-5)
      .map((s) => {
        const sTasks = allTasks.filter((t) => t.sprint_id === s.id && t.progress === "Concluído");
        const pts = sTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
        return { name: s.name.length > 12 ? s.name.substring(0, 12) + "…" : s.name, pontos: pts };
      });
  }, [sprints, allTasks]);

  // ── Events ──
  const activeEvents = events?.filter((e) => e.status === "active" || e.status === "planning") ?? [];

  const allocatedCostByEvent = useMemo(() => {
    const map: Record<string, number> = {};
    (allAllocations ?? []).forEach((a) => {
      map[a.event_id] = (map[a.event_id] || 0) + (a.allocated_value || 0);
    });
    return map;
  }, [allAllocations]);

  const getEventTotalCost = (e: { id: string; actual_cost: number | null; budget?: number }) =>
    (e.actual_cost ?? 0) + (allocatedCostByEvent[e.id] || 0);

  const totalBudget = events?.reduce((sum, e) => sum + (e.budget || 0), 0) ?? 0;
  const totalActualCost = events?.reduce((sum, e) => sum + getEventTotalCost(e), 0) ?? 0;
  const budgetDifference = totalBudget - totalActualCost;
  const eventsWithActualCost = events?.filter((e) => e.actual_cost != null || (allocatedCostByEvent[e.id] || 0) > 0).length ?? 0;
  const totalLeads = useMemo(() => events?.reduce((sum, e) => sum + (e.leads_gerados || 0), 0) ?? 0, [events]);
  const costPerLeadReal = totalLeads > 0 && totalActualCost > 0 ? totalActualCost / totalLeads : 0;

  const budgetVsRealData = useMemo(() => {
    if (!events) return [];
    return events
      .filter((e) => e.budget > 0 || getEventTotalCost(e) > 0)
      .map((e) => ({
        name: e.name.length > 18 ? e.name.substring(0, 18) + "…" : e.name,
        planejado: e.budget || 0, real: getEventTotalCost(e),
      }))
      .sort((a, b) => b.planejado - a.planejado);
  }, [events, allocatedCostByEvent]);

  // ── Materials ──
  const totalMatActualCost = materials?.reduce((sum, m) => sum + (m.actual_cost || 0), 0) ?? 0;
  const totalAllocatedValue = allAllocations?.reduce((sum, a) => sum + (a.allocated_value || 0), 0) ?? 0;
  const unallocatedValue = totalMatActualCost - totalAllocatedValue;

  // ── Insights ──
  const insights = useMemo<BIInsight[]>(() => {
    const out: BIInsight[] = [];
    if (overdueCount > 0) {
      out.push({
        id: "overdue", tone: "danger",
        title: `${overdueCount} tarefa${overdueCount > 1 ? "s" : ""} atrasada${overdueCount > 1 ? "s" : ""}`,
        description: "Vencidas e ainda sem conclusão.",
        onClick: () => setSubTab("time"),
      });
    }
    if (totalTasks > 0 && onTimeRate < 70) {
      out.push({
        id: "ontime-low", tone: "warning",
        title: `Taxa no prazo em ${onTimeRate}%`,
        description: "Considere revisar capacidade ou prazos.",
      });
    } else if (totalTasks > 0 && onTimeRate >= 90) {
      out.push({ id: "ontime-good", tone: "positive", title: `Excelente: ${onTimeRate}% no prazo` });
    }
    if (createdCompare.previous > 0) {
      const delta = ((createdCompare.current - createdCompare.previous) / createdCompare.previous) * 100;
      if (delta >= 30) {
        out.push({
          id: "vol-up", tone: "info",
          title: `Volume ${Math.round(delta)}% maior vs período anterior`,
          description: `${createdCompare.current} novas vs ${createdCompare.previous}.`,
        });
      }
    }
    if (goalsAtRisk.length > 0) {
      out.push({
        id: "goals-risk", tone: "warning",
        title: `${goalsAtRisk.length} meta${goalsAtRisk.length > 1 ? "s" : ""} em risco`,
        description: "Vencimento próximo e progresso abaixo de 70%.",
        onClick: () => setSubTab("domain"),
      });
    }
    if (eventsWithActualCost > 0 && budgetDifference < 0) {
      out.push({
        id: "budget-over", tone: "danger",
        title: "Orçamento excedido em eventos",
        description: `R$ ${Math.abs(budgetDifference).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} acima do planejado.`,
        onClick: () => setSubTab("domain"),
      });
    }
    return out;
  }, [overdueCount, totalTasks, onTimeRate, createdCompare, goalsAtRisk, eventsWithActualCost, budgetDifference]);

  // ===================== TAB CONTENTS =====================

  const overviewNode = (
    <>
      <ActiveTimersCard />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BIStatCard
          title="Tarefas no período" value={totalTasks} icon={ListTodo} tone="info"
          current={createdCompare.current} previous={createdCompare.previous}
          higherIsBetter={false} description={`${completedTasks} concluídas`}
          onClick={() => navigate("/marketing/solicitacoes")}
        />
        <BIStatCard
          title="Taxa de Conclusão" value={`${completionRate}%`} icon={CheckCircle2} tone="success"
          description={`${completedTasks}/${totalTasks}`}
          onClick={() => navigate("/marketing/solicitacoes")}
        />
        <BIStatCard
          title="No Prazo" value={`${onTimeRate}%`} icon={Clock}
          tone={onTimeRate >= 90 ? "success" : onTimeRate >= 70 ? "warning" : "destructive"}
          current={onTimeRate} previous={prevOnTimeRate} higherIsBetter
        />
        <BIStatCard
          title="Tarefas Atrasadas" value={overdueCount} icon={AlertTriangle}
          tone={overdueCount > 5 ? "destructive" : overdueCount > 0 ? "warning" : "success"}
          description="vencidas sem conclusão"
          onClick={() => navigate("/marketing/solicitacoes")}
        />
      </div>

      <TrendChart
        title="Evolução de Tarefas ao Longo do Tempo"
        dateRange={dateRange}
        series={[
          { key: "criadas", label: "Criadas", gradient: "primary", type: "bar",
            getDate: (t) => t.created_at ? new Date(t.created_at) : null, items: tasks },
          { key: "concluidas", label: "Concluídas", gradient: "success", type: "line",
            getDate: (t) => t.updated_at && t.progress === "Concluído" ? new Date(t.updated_at) : null,
            items: tasks.filter((t) => t.progress === "Concluído") },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <BIStatusDonut
          title="Distribuição por Etapa"
          data={tasksByStageDonut}
          centerLabel="tarefas"
          hint={`${tasksByStageDonut.length} etapas`}
        />
        <BIStatusDonut
          title="Distribuição por Tipo"
          data={tasksByTypeDonut}
          centerLabel="tarefas"
          hint={`${tasksByTypeDonut.length} tipos`}
        />
      </div>
    </>
  );

  const productivityNode = (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BIStatCard
          title="Pessoas ativas" value={workloadData.filter((p) => p.workedSeconds > 0 || p.activeCount > 0).length}
          icon={CheckCircle2} tone="info"
        />
        <BIStatCard
          title="Concluídas no período" value={completedCompare.current} icon={CheckCircle2} tone="success"
          current={completedCompare.current} previous={completedCompare.previous} higherIsBetter
        />
        <BIStatCard
          title="Tempo total registrado" value={formatDuration(totalWorkedSeconds)} icon={Timer} tone="primary"
          description={`${avgCompletionDays}d média de conclusão`}
        />
        <BIStatCard
          title="Sprint Ativo" value={activeSprint ? `${sprintPointsDone}/${sprintPointsTotal} pts` : "—"}
          icon={Zap} tone="primary" description={activeSprint?.name ?? "Sem sprint"}
          onClick={() => navigate("/marketing/solicitacoes")}
        />
      </div>

      <BIWorkloadChart
        people={workloadData}
        dateRange={dateRange}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <BIPeopleRanking
          title="Ranking por Responsável"
          entityNoun="tarefa"
          people={tasksByAssignee.map((a) => ({
            name: a.name,
            userId: a.userId,
            avatarUrl: a.userId ? avatars?.byId[a.userId] : null,
            total: a.total, completed: a.completed,
          }))}
        />
        <BIDemandHeatmap
          title="Mapa de Calor de Criação de Tarefas"
          items={tasks}
          getDate={(t) => t.created_at ? new Date(t.created_at) : null}
          entityNoun="tarefa"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <BIChartCard title="Estimativa vs Tempo Real" icon={Target} iconColor="text-primary">
          {estimateVsActualData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem tarefas com estimativa</p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={estimateVsActualData} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                  <BIGradientDefs keys={["primary", "chart4"]} direction="horizontal" />
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} unit="h" axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={BI_TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v}h`, n === "estimativa" ? "Estimativa" : "Real"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" formatter={(v) => v === "estimativa" ? "Estimativa" : "Real"} />
                  <Bar dataKey="estimativa" name="estimativa" fill={`url(#${BI_GRADIENTS.primary.id})`} radius={[0, 6, 6, 0]} barSize={14} />
                  <Bar dataKey="real" name="real" fill={`url(#${BI_GRADIENTS.chart4.id})`} radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </BIChartCard>

        <BIChartCard title="Velocity por Sprint" icon={Zap} iconColor="text-primary">
          {velocityData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem sprints concluídos</p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                  <BIGradientDefs keys={["primary"]} />
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={BI_TOOLTIP_STYLE} formatter={(v: number) => [`${v} pts`, "Story Points"]} />
                  <Bar dataKey="pontos" fill={`url(#${BI_GRADIENTS.primary.id})`} stroke={BI_GRADIENTS.primary.color} radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </BIChartCard>
      </div>
    </>
  );

  const timeNode = (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BIStatCard
          title="Backlog atual" value={openTasks.length} icon={AlertTriangle}
          tone={openTasks.length > 30 ? "destructive" : "warning"}
          description="tarefas abertas"
        />
        <BIStatCard
          title="Saldo do período"
          value={(createdCompare.current - completedCompare.current > 0 ? "+" : "") + (createdCompare.current - completedCompare.current)}
          icon={TrendingUp}
          tone={createdCompare.current - completedCompare.current > 0 ? "destructive" : "success"}
          description="criadas − concluídas"
        />
        <BIStatCard
          title="Tempo médio" value={`${avgCompletionDays}d`} icon={Clock} tone="primary"
        />
        <BIStatCard
          title="No prazo" value={`${onTimeRate}%`} icon={CheckCircle2}
          tone={onTimeRate >= 90 ? "success" : onTimeRate >= 70 ? "warning" : "destructive"}
        />
      </div>

      <BacklogChart
        title="Backlog: Criadas vs Concluídas"
        dateRange={dateRange}
        createdItems={tasks}
        completedItems={tasks.filter((t) => t.progress === "Concluído")}
        getCreatedDate={(t) => t.created_at ? new Date(t.created_at) : null}
        getCompletedDate={(t) => t.progress === "Concluído" && t.updated_at ? new Date(t.updated_at) : null}
      />

      <BIBacklogAging
        title="Aging do Backlog"
        openItems={openTasks}
        getCreatedDate={(t) => t.created_at ? new Date(t.created_at) : null}
        entityNoun="tarefa"
      />

      <TimeByCategoryChart
        title="Tempo Gasto por Tipo de Tarefa"
        entityNoun="tarefa"
        entityCategoryMap={taskTypeMap}
        logs={mktTimesheetLogsRange.map((l) => ({
          entityId: l.marketing_task_id, start_time: l.start_time, end_time: l.end_time, duration_seconds: l.duration_seconds,
        }))}
        onCategoryClick={(catName) => {
          const now = Date.now();
          const totalsByTask: Record<string, number> = {};
          mktTimesheetLogsRange.forEach((l) => {
            if (!l.marketing_task_id) return;
            if (taskTypeMap[l.marketing_task_id] !== catName) return;
            const secs = l.end_time ? l.duration_seconds : Math.floor((now - new Date(l.start_time).getTime()) / 1000);
            if (secs > 0) totalsByTask[l.marketing_task_id] = (totalsByTask[l.marketing_task_id] || 0) + secs;
          });
          const list = Object.entries(totalsByTask).map(([id, secs]) => {
            const task = (allTasks || []).find((t) => t.id === id);
            if (!task) return null;
            return {
              id: task.id, title: task.title, assignee: task.assignee_name,
              status: task.progress, totalSeconds: secs,
              onOpen: () => navigate(`/marketing/solicitacoes?task=${task.id}`),
            };
          }).filter(Boolean) as DrilldownEntity[];
          setCategoryDrilldown({ open: true, title: `Tempo em "${catName}"`, items: list });
        }}
      />
    </>
  );

  const domainNode = (
    <>
      {/* ─── EVENTOS ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Eventos</h3>
        </div>

        <EventCalendarCard events={events ?? []} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <BIStatCard
            title="Eventos Ativos" value={activeEvents.length} icon={CalendarIcon} tone="info"
            description={`${events?.length ?? 0} no total`}
            onClick={() => navigate("/marketing/eventos")}
          />
          <BIStatCard
            title="Orçamento Total"
            value={totalBudget > 0 ? totalBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            icon={DollarSign} tone="primary"
            onClick={() => navigate("/marketing/eventos")}
          />
          <BIStatCard
            title="Valor Real Gasto"
            value={totalActualCost > 0 ? totalActualCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            icon={DollarSign}
            tone={budgetDifference < 0 ? "destructive" : "success"}
            description={`${eventsWithActualCost} com valor real`}
            onClick={() => navigate("/marketing/eventos")}
          />
          <BIStatCard
            title={budgetDifference >= 0 ? "Economia" : "Excedente"}
            value={eventsWithActualCost > 0
              ? Math.abs(budgetDifference).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"}
            icon={budgetDifference >= 0 ? TrendingUp : AlertTriangle}
            tone={budgetDifference >= 0 ? "success" : "destructive"}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <BIStatCard title="Total de Leads" value={totalLeads} icon={TrendingUp} tone="info"
            description={`${events?.filter((e) => e.leads_gerados != null).length ?? 0} eventos`}
          />
          <BIStatCard
            title="Custo/Lead Real"
            value={costPerLeadReal > 0 ? costPerLeadReal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            icon={DollarSign} tone="primary"
          />
          <BIStatCard
            title="Materiais"
            value={materials?.length ?? 0}
            icon={Package} tone="primary"
            description={totalMatActualCost > 0
              ? `${totalMatActualCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
              : "sem custo registrado"}
          />
        </div>

        {budgetVsRealData.length > 0 && (
          <BIChartCard title="Orçamento Planejado vs Valor Real" icon={BarChart3} iconColor="text-primary">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetVsRealData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                  <BIGradientDefs keys={["primary", "chart4"]} />
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={BI_TOOLTIP_STYLE}
                    formatter={(v: number, n: string) => [v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), n === "planejado" ? "Planejado" : "Real"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" formatter={(v) => v === "planejado" ? "Planejado" : "Real"} />
                  <Bar dataKey="planejado" fill={`url(#${BI_GRADIENTS.primary.id})`} stroke={BI_GRADIENTS.primary.color} radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="real" fill={`url(#${BI_GRADIENTS.chart4.id})`} stroke={BI_GRADIENTS.chart4.color} radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </BIChartCard>
        )}

        {activeEvents.length > 0 && (
          <BIChartCard title={`Eventos Ativos (${activeEvents.length})`} icon={CalendarIcon} iconColor="text-primary">
            <div className="space-y-3">
              {activeEvents.slice(0, 5).map((e) => {
                const eventTasks = (allTasks ?? []).filter((t: any) => t.event_id === e.id);
                const completedEvTasks = eventTasks.filter((t) => t.progress === "Concluído").length;
                const evTotalCost = getEventTotalCost(e);
                const variance = evTotalCost > 0 ? (e.budget || 0) - evTotalCost : null;
                return (
                  <div key={e.id} className="rounded-lg border border-border/60 p-3 space-y-2 cursor-pointer hover:border-primary/40 transition-all" onClick={() => navigate("/marketing/eventos")}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{e.name}</span>
                      <Badge variant="outline" className="text-[10px]">{e.status === "active" ? "Ativo" : "Planejamento"}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(new Date(e.start_date), "dd MMM", { locale: ptBR })} — {format(new Date(e.end_date), "dd MMM", { locale: ptBR })}</span>
                      <span>{completedEvTasks}/{eventTasks.length} tarefas</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      {e.budget > 0 && (
                        <span className="text-muted-foreground">Orç: {e.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      )}
                      {evTotalCost > 0 && (
                        <span className={cn(variance != null && variance < 0 ? "text-destructive" : "text-success")}>
                          Real: {evTotalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </BIChartCard>
        )}
      </div>

      {/* ─── METAS ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Metas (OKRs)</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <BIStatCard
            title="Progresso médio" value={`${avgGoalProgress}%`} icon={Target} tone="primary"
            description={`${activeGoals.length} metas ativas`}
            onClick={() => navigate("/marketing/metas")}
          />
          <BIStatCard
            title="Em risco" value={goalsAtRisk.length} icon={AlertTriangle}
            tone={goalsAtRisk.length > 0 ? "destructive" : "success"}
            description="vencimento próximo + baixo progresso"
          />
          <BIStatCard
            title="Concluídas" value={goals.filter((g) => g.status === "completed").length} icon={CheckCircle2} tone="success"
          />
        </div>

        {goalsAtRisk.length > 0 && (
          <BIChartCard title="Metas em Risco" icon={AlertTriangle} iconColor="text-destructive">
            <div className="space-y-3">
              {goalsAtRisk.slice(0, 5).map((g) => {
                const progress = Math.round(Math.min((g.current_value / g.target_value) * 100, 100));
                const daysLeft = differenceInDays(new Date(g.due_date), new Date());
                return (
                  <div key={g.id} className="rounded-lg border border-border/60 p-3 space-y-2 cursor-pointer hover:border-destructive/40 transition-all" onClick={() => navigate("/marketing/metas")}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{g.title}</span>
                      <Badge variant="outline" className="text-destructive text-[10px]">{daysLeft}d restantes</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground font-mono">{progress}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </BIChartCard>
        )}
      </div>
    </>
  );

  return (
    <>
      <BIModuleShell
        value={subTab}
        onChange={setSubTab}
        domainLabel="Eventos & Metas"
        insights={<BIInsightsBar insights={insights} />}
        overview={overviewNode}
        productivity={productivityNode}
        time={timeNode}
        domain={domainNode}
      />

      <EntityDrilldownDialog
        open={categoryDrilldown.open}
        onOpenChange={(o) => setCategoryDrilldown((s) => ({ ...s, open: o }))}
        title={categoryDrilldown.title}
        items={categoryDrilldown.items}
        entityNoun="tarefa"
      />
    </>
  );
}
