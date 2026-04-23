import { useMemo, useEffect, useState } from "react";
import { ActiveTimersCard } from "@/components/dashboard/ActiveTimersCard";
import { EventCalendarCard } from "@/components/dashboard/EventCalendarCard";
import { supabase } from "@/integrations/supabase/client";
import { fetchMarketingTimesheetTotals, formatDuration } from "@/hooks/use-timesheet";
import { useMarketingTasks, MarketingTask, useMarketingStages } from "@/hooks/use-marketing";
import { useMarketingEvents } from "@/hooks/use-events";
import { useMarketingMaterials, useMaterialAllocations } from "@/hooks/use-materials";
import { useMarketingSprints } from "@/hooks/use-sprints";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useProfileAvatars } from "@/hooks/use-profile-avatars";
import {
  CheckCircle2, Clock, ListTodo, AlertTriangle, Target, TrendingUp,
  Timer, Users, CalendarIcon, DollarSign, Flag, Zap, BarChart3, Milestone, Package,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { format, differenceInDays, isSameDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { TrendChart } from "./TrendChart";

interface MarketingTabProps {
  dateRange: { start: Date; end: Date };
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--destructive))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
];

export function MarketingTab({ dateRange }: MarketingTabProps) {
  const navigate = useNavigate();
  const { data: allTasks } = useMarketingTasks();
  const { data: stages } = useMarketingStages();
  const { data: events } = useMarketingEvents();
  const { data: materials } = useMarketingMaterials();
  const { data: allAllocations } = useMaterialAllocations();
  const { data: sprints } = useMarketingSprints();
  const { data: avatars } = useProfileAvatars();
  const [mktTimesheetTotals, setMktTimesheetTotals] = useState<Record<string, number>>({});
  const [goals, setGoals] = useState<any[]>([]);

  // Fetch goals
  useEffect(() => {
    supabase.from("marketing_goals").select("*").then(({ data }) => {
      if (data) setGoals(data);
    });
  }, []);

  // Filter tasks by dateRange
  const tasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t) => {
      const d = new Date(t.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [allTasks, dateRange]);

  // Fetch timesheet
  useEffect(() => {
    const ids = (allTasks || []).map((t) => t.id);
    if (ids.length > 0) {
      fetchMarketingTimesheetTotals(ids).then(setMktTimesheetTotals);
    }
  }, [allTasks]);

  // ── 1. Total de Tarefas ──
  const totalTasks = tasks.length;

  // ── 2. Concluídas vs Pendentes ──
  const completedTasks = tasks.filter((t) => t.progress === "Concluído").length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const completionPieData = [
    { name: "Concluídas", value: completedTasks },
    { name: "Pendentes", value: pendingTasks },
  ];

  // ── 3. Tarefas por Etapa ──
  const tasksByStage = useMemo(() => {
    if (!stages) return [];
    return stages.map((s) => ({
      name: s.name,
      count: tasks.filter((t) => t.stage_id === s.id).length,
    })).filter((s) => s.count > 0);
  }, [stages, tasks]);

  // ── 4. Taxa de Conclusão no Prazo ──
  const onTimeRate = useMemo(() => {
    const completed = tasks.filter((t) => t.progress === "Concluído" && t.due_date);
    if (completed.length === 0) return 0;
    const onTime = completed.filter((t) => {
      const completedDate = new Date(t.updated_at);
      const dueDate = new Date(t.due_date!);
      return completedDate <= dueDate;
    }).length;
    return Math.round((onTime / completed.length) * 100);
  }, [tasks]);

  // ── 5. Tempo Total Trabalhado ──
  const totalWorkedSeconds = useMemo(() => {
    return Object.values(mktTimesheetTotals).reduce((sum, s) => sum + s, 0);
  }, [mktTimesheetTotals]);

  // ── 6. Estimativa vs Tempo Real ──
  const estimateVsActualData = useMemo(() => {
    if (!allTasks) return [];
    return allTasks
      .filter((t) => t.time_estimate_minutes && t.time_estimate_minutes > 0)
      .map((t) => {
        const estH = Math.round((t.time_estimate_minutes! / 60) * 10) / 10;
        const actS = mktTimesheetTotals[t.id] || 0;
        const actH = Math.round((actS / 3600) * 10) / 10;
        return {
          name: t.title.length > 20 ? t.title.substring(0, 20) + "…" : t.title,
          estimativa: estH,
          real: actH,
        };
      })
      .sort((a, b) => b.real - a.real)
      .slice(0, 8);
  }, [allTasks, mktTimesheetTotals]);

  // ── 7. Tempo Médio de Conclusão ──
  const avgCompletionDays = useMemo(() => {
    const completed = tasks.filter((t) => t.progress === "Concluído");
    if (completed.length === 0) return 0;
    const totalDays = completed.reduce((sum, t) => {
      return sum + differenceInDays(new Date(t.updated_at), new Date(t.created_at));
    }, 0);
    return Math.round((totalDays / completed.length) * 10) / 10;
  }, [tasks]);

  // ── 8. Tarefas por Responsável ──
  const tasksByAssignee = useMemo(() => {
    const map: Record<string, { total: number; completed: number; id: string | null }> = {};
    tasks.forEach((t) => {
      const name = t.assignee_name || "Sem atribuição";
      if (!map[name]) map[name] = { total: 0, completed: 0, id: t.assignee_id };
      map[name].total++;
      if (t.progress === "Concluído") map[name].completed++;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [tasks]);

  // ── 9. Progresso Geral das Metas ──
  const activeGoals = goals.filter((g) => g.status !== "completed" && g.status !== "cancelled");
  const avgGoalProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => sum + Math.min((g.current_value / g.target_value) * 100, 100), 0) / activeGoals.length)
    : 0;

  // ── 10. Metas em Risco ──
  const goalsAtRisk = activeGoals.filter((g) => {
    if (!g.due_date) return false;
    const daysLeft = differenceInDays(new Date(g.due_date), new Date());
    const progress = (g.current_value / g.target_value) * 100;
    return daysLeft <= 14 && progress < 70;
  });

  // ── 11. Sprint Ativo ──
  const activeSprint = sprints?.find((s) => s.status === "active");
  const sprintTasks = useMemo(() => {
    if (!activeSprint || !allTasks) return [];
    return allTasks.filter((t) => t.sprint_id === activeSprint.id);
  }, [activeSprint, allTasks]);
  const sprintPointsDone = sprintTasks
    .filter((t) => t.progress === "Concluído")
    .reduce((sum, t) => sum + (t.story_points || 0), 0);
  const sprintPointsTotal = sprintTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);

  // ── 12. Velocity (últimos sprints) ──
  const velocityData = useMemo(() => {
    if (!sprints || !allTasks) return [];
    const done = sprints
      .filter((s) => s.status === "completed" || s.status === "active")
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      .slice(-5)
      .map((s) => {
        const sTasks = allTasks.filter((t) => t.sprint_id === s.id && t.progress === "Concluído");
        const pts = sTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
        return { name: s.name.length > 12 ? s.name.substring(0, 12) + "…" : s.name, pontos: pts };
      });
    return done;
  }, [sprints, allTasks]);

  // ── 13. Eventos Ativos / Próximos ──
  const activeEvents = events?.filter((e) => e.status === "active" || e.status === "planning") ?? [];

  // ── Helper: allocated material cost per event ──
  const allocatedCostByEvent = useMemo(() => {
    const map: Record<string, number> = {};
    (allAllocations ?? []).forEach(a => {
      map[a.event_id] = (map[a.event_id] || 0) + (a.allocated_value || 0);
    });
    return map;
  }, [allAllocations]);

  const getEventTotalCost = (e: { id: string; actual_cost: number | null; budget?: number }) =>
    (e.actual_cost ?? 0) + (allocatedCostByEvent[e.id] || 0);

  // ── 14. Budget Total vs Real ──
  const totalBudget = events?.reduce((sum, e) => sum + (e.budget || 0), 0) ?? 0;
  const totalActualCost = events?.reduce((sum, e) => sum + getEventTotalCost(e), 0) ?? 0;
  const budgetDifference = totalBudget - totalActualCost;
  const eventsWithActualCost = events?.filter((e) => e.actual_cost != null || (allocatedCostByEvent[e.id] || 0) > 0).length ?? 0;

  // ── 15. Tarefas por Evento ──
  const tasksByEvent = useMemo(() => {
    if (!events || !allTasks) return [];
    return activeEvents.map((e) => ({
      name: e.name.length > 20 ? e.name.substring(0, 20) + "…" : e.name,
      tasks: allTasks.filter((t: any) => t.event_id === e.id).length,
      budget: e.budget || 0,
    })).filter((e) => e.tasks > 0 || e.budget > 0);
  }, [events, allTasks, activeEvents]);

  // ── 16. Total de Leads Gerados ──
  const totalLeads = useMemo(() => {
    if (!events) return 0;
    return events.reduce((sum, e) => sum + (e.leads_gerados || 0), 0);
  }, [events]);

  // ── 17. Custo por Lead Total (budget) ──
  const costPerLeadTotal = totalLeads > 0 ? totalBudget / totalLeads : 0;

  // ── 17b. Custo por Lead Real (actual_cost) ──
  const costPerLeadReal = totalLeads > 0 && totalActualCost > 0 ? totalActualCost / totalLeads : 0;

  // ── 18. Leads e Custo por Evento (chart data) ──
  const leadsPerEvent = useMemo(() => {
    if (!events) return [];
    return events
      .filter((e) => e.leads_gerados != null && e.leads_gerados > 0)
      .map((e) => ({
        name: e.name.length > 18 ? e.name.substring(0, 18) + "…" : e.name,
        leads: e.leads_gerados || 0,
        custoLead: e.leads_gerados! > 0 && e.budget > 0
          ? Math.round((e.budget / e.leads_gerados!) * 100) / 100
          : 0,
        custoLeadReal: e.leads_gerados! > 0
          ? Math.round((getEventTotalCost(e) / e.leads_gerados!) * 100) / 100
          : 0,
        budget: e.budget || 0,
      }))
      .sort((a, b) => b.leads - a.leads);
  }, [events, allocatedCostByEvent]);

  // ── 19. Budget Planejado vs Real por Evento ──
  const budgetVsRealData = useMemo(() => {
    if (!events) return [];
    return events
      .filter((e) => e.budget > 0 || getEventTotalCost(e) > 0)
      .map((e) => ({
        name: e.name.length > 18 ? e.name.substring(0, 18) + "…" : e.name,
        planejado: e.budget || 0,
        real: getEventTotalCost(e),
        diff: (e.budget || 0) - getEventTotalCost(e),
      }))
      .sort((a, b) => b.planejado - a.planejado);
  }, [events, allocatedCostByEvent]);

  // ── Priority distribution ──
  const byPriority = useMemo(() => {
    const map: Record<string, number> = { high: 0, medium: 0, low: 0 };
    tasks.forEach((t) => { map[t.priority] = (map[t.priority] || 0) + 1; });
    return [
      { name: "Alta", value: map.high, fill: "hsl(var(--destructive))" },
      { name: "Média", value: map.medium, fill: "hsl(var(--warning))" },
      { name: "Baixa", value: map.low, fill: "hsl(var(--chart-2))" },
    ].filter((p) => p.value > 0);
  }, [tasks]);

  const overdueCount = tasks.filter((t) => {
    if (t.progress === "Concluído" || !t.due_date) return false;
    return new Date(t.due_date) < new Date();
  }).length;

  // ── Materials Stats ──
  const totalMatBudget = materials?.reduce((sum, m) => sum + (m.budget || 0), 0) ?? 0;
  const totalMatActualCost = materials?.reduce((sum, m) => sum + (m.actual_cost || 0), 0) ?? 0;
  const matBudgetDiff = totalMatBudget - totalMatActualCost;
  const matWithCost = materials?.filter((m) => m.actual_cost != null).length ?? 0;

  // ── Allocation stats per event ──
  const allocByEvent = useMemo(() => {
    if (!allAllocations || !events) return [];
    const map: Record<string, number> = {};
    allAllocations.forEach(a => {
      map[a.event_id] = (map[a.event_id] || 0) + (a.allocated_value || 0);
    });
    return events.map(e => ({
      name: e.name.length > 18 ? e.name.substring(0, 18) + "…" : e.name,
      eventCost: e.actual_cost ?? e.budget ?? 0,
      materialCost: map[e.id] || 0,
      total: (e.actual_cost ?? e.budget ?? 0) + (map[e.id] || 0),
    })).filter(e => e.materialCost > 0).sort((a, b) => b.materialCost - a.materialCost);
  }, [allAllocations, events]);

  const totalAllocatedValue = allAllocations?.reduce((sum, a) => sum + (a.allocated_value || 0), 0) ?? 0;
  const unallocatedValue = totalMatActualCost - totalAllocatedValue;
  return (
    <div className="space-y-8">
      <ActiveTimersCard />

      {/* ═══════════ SEÇÃO: EVENTOS ═══════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Eventos</h2>
        </div>
        <Separator />

        {/* Calendário de Eventos */}
        <EventCalendarCard events={events ?? []} />

        {/* Stat cards de eventos */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Eventos Ativos"
            value={activeEvents.length}
            icon={CalendarIcon}
            description={`${events?.length ?? 0} eventos no total`}
            onClick={() => navigate("/marketing/eventos")}
          />
          <StatCard
            title="Orçamento Total"
            value={totalBudget > 0 ? totalBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            icon={DollarSign}
            description="planejado para todos os eventos"
            onClick={() => navigate("/marketing/eventos")}
          />
          <StatCard
            title="Valor Real Gasto"
            value={totalActualCost > 0 ? totalActualCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            icon={DollarSign}
            description={`${eventsWithActualCost} evento(s) com valor real`}
            onClick={() => navigate("/marketing/eventos")}
          />
          <StatCard
            title={budgetDifference >= 0 ? "Economia" : "Excedente"}
            value={eventsWithActualCost > 0
              ? Math.abs(budgetDifference).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"}
            icon={TrendingUp}
            description={
              eventsWithActualCost > 0
                ? budgetDifference >= 0
                  ? "abaixo do orçamento ✓"
                  : "acima do orçamento ⚠"
                : "sem dados de custo real"
            }
            onClick={() => navigate("/marketing/eventos")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total de Leads"
            value={totalLeads}
            icon={TrendingUp}
            description={`${events?.filter((e) => e.leads_gerados != null).length ?? 0} eventos com dados`}
            onClick={() => navigate("/marketing/eventos")}
          />
          <StatCard
            title="Custo/Lead (Orçamento)"
            value={costPerLeadTotal > 0 ? costPerLeadTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            icon={DollarSign}
            description="baseado no orçamento planejado"
            onClick={() => navigate("/marketing/eventos")}
          />
          <StatCard
            title="Custo/Lead (Real)"
            value={costPerLeadReal > 0 ? costPerLeadReal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            icon={DollarSign}
            description="baseado no valor real gasto"
            onClick={() => navigate("/marketing/eventos")}
          />
        </div>

        {/* Planejado vs Real por Evento */}
        {budgetVsRealData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Orçamento Planejado vs Valor Real por Evento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetVsRealData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number, name: string) => [
                        v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                        name === "planejado" ? "Planejado" : "Real",
                      ]}
                    />
                    <Legend formatter={(v) => (v === "planejado" ? "Planejado" : "Real")} />
                    <Bar dataKey="planejado" name="planejado" fill="hsl(var(--primary))" opacity={0.4} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="real" name="real" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Eventos ativos + Tarefas por evento */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                Eventos ({activeEvents.length} ativos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento ativo</p>
              ) : (
                <div className="space-y-3">
                  {activeEvents.slice(0, 5).map((e) => {
                    const eventTasks = (allTasks ?? []).filter((t: any) => t.event_id === e.id);
                    const completedEvTasks = eventTasks.filter((t) => t.progress === "Concluído").length;
                    const evTotalCost = getEventTotalCost(e);
                    const variance = evTotalCost > 0 ? (e.budget || 0) - evTotalCost : null;
                    return (
                      <div key={e.id} className="p-3 rounded-lg border space-y-2 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => navigate("/marketing/eventos")}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate">{e.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {e.status === "active" ? "Ativo" : "Planejamento"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {format(new Date(e.start_date), "dd MMM", { locale: ptBR })} — {format(new Date(e.end_date), "dd MMM", { locale: ptBR })}
                          </span>
                          <span>{completedEvTasks}/{eventTasks.length} tarefas</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          {e.budget > 0 && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              <span>Orç: {e.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                            </div>
                          )}
                          {evTotalCost > 0 && (
                            <div className={cn("flex items-center gap-1", variance != null && variance < 0 ? "text-destructive" : "text-success")}>
                              <DollarSign className="h-3 w-3" />
                              <span>Real: {evTotalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {tasksByEvent.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Milestone className="h-4 w-4 text-muted-foreground" />
                  Tarefas por Evento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tasksByEvent}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="tasks" name="Tarefas" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Leads charts */}
        {leadsPerEvent.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Leads por Evento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadsPerEvent}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="leads" name="Leads" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  Custo por Lead: Planejado vs Real
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadsPerEvent.filter((e) => e.custoLead > 0 || e.custoLeadReal > 0)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number, name: string) => [
                          `R$ ${v.toFixed(2)}`,
                          name === "custoLead" ? "Custo/Lead (Orçamento)" : "Custo/Lead (Real)",
                        ]}
                      />
                      <Legend formatter={(v) => (v === "custoLead" ? "Orçamento" : "Real")} />
                      <Bar dataKey="custoLead" name="custoLead" fill="hsl(var(--primary))" opacity={0.4} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="custoLeadReal" name="custoLeadReal" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ═══════════ SEÇÃO: BRINDES & MATERIAIS ═══════════ */}
      {(materials?.length ?? 0) > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Brindes & Materiais</h2>
          </div>
          <Separator />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total de Materiais"
              value={materials?.length ?? 0}
              icon={Package}
              description={`${materials?.filter(m => m.status === "delivered" || m.status === "distributed").length ?? 0} entregue(s)`}
              onClick={() => navigate("/marketing/eventos")}
            />
            <StatCard
              title="Valor Real Total"
              value={totalMatActualCost > 0 ? totalMatActualCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
              icon={DollarSign}
              description={`${matWithCost} material(is) com valor real`}
              onClick={() => navigate("/marketing/eventos")}
            />
            <StatCard
              title="Rateado em Eventos"
              value={totalAllocatedValue > 0 ? totalAllocatedValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
              icon={BarChart3}
              description={`${allAllocations?.length ?? 0} alocação(ões)`}
              onClick={() => navigate("/marketing/eventos")}
            />
            <StatCard
              title="Saldo Não Alocado"
              value={totalMatActualCost > 0 ? unallocatedValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
              icon={TrendingUp}
              description={unallocatedValue > 0 ? "a ratear entre eventos" : unallocatedValue === 0 ? "100% alocado ✓" : "sobre-alocado ⚠"}
              onClick={() => navigate("/marketing/eventos")}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Material allocation by event chart */}
            {allocByEvent.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Custo de Materiais por Evento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={allocByEvent}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: number) => [v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Materiais"]}
                        />
                        <Bar dataKey="materialCost" name="Materiais" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Materiais ({materials?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {materials?.slice(0, 6).map((m) => {
                    const matAllocs = (allAllocations ?? []).filter(a => a.material_id === m.id);
                    const allocated = matAllocs.reduce((sum, a) => sum + (a.allocated_value || 0), 0);
                    const total = m.actual_cost ?? m.budget ?? 0;
                    const allocPercent = total > 0 ? Math.round((allocated / total) * 100) : 0;
                    return (
                      <div key={m.id} className="p-3 rounded-lg border space-y-1.5 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => navigate("/marketing/eventos")}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate">{m.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {m.status === "planning" ? "Planejamento" : m.status === "purchasing" ? "Compra" : m.status === "delivered" ? "Entregue" : "Distribuído"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          {total > 0 && (
                            <span className="text-muted-foreground">
                              Custo: {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          )}
                          {matAllocs.length > 0 && (
                            <span className="text-primary">
                              {allocPercent}% rateado ({matAllocs.length} evento{matAllocs.length > 1 ? "s" : ""})
                            </span>
                          )}
                        </div>
                        {total > 0 && (
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(allocPercent, 100)}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════════ SEÇÃO: TAREFAS ═══════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Tarefas</h2>
        </div>
        <Separator />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total de Tarefas"
            value={totalTasks}
            icon={ListTodo}
            description={`${completedTasks} concluídas`}
            onClick={() => navigate("/marketing/solicitacoes")}
          />
          <StatCard
            title="Taxa de Conclusão"
            value={`${completionRate}%`}
            icon={CheckCircle2}
            description={`${completedTasks}/${totalTasks}`}
            onClick={() => navigate("/marketing/solicitacoes")}
          />
          <StatCard
            title="No Prazo"
            value={`${onTimeRate}%`}
            icon={Clock}
            description="concluídas antes do prazo"
          />
          <StatCard
            title="Tarefas Atrasadas"
            value={overdueCount}
            icon={AlertTriangle}
            description="vencidas sem conclusão"
            onClick={() => navigate("/marketing/solicitacoes")}
          />
        </div>

        {/* Trend Chart - Evolução temporal */}
        <TrendChart
          title="Evolução de Tarefas ao Longo do Tempo"
          dateRange={dateRange}
          series={[
            {
              key: "criadas",
              label: "Criadas",
              color: "hsl(var(--primary))",
              type: "bar",
              getDate: (t) => t.created_at ? new Date(t.created_at) : null,
              items: tasks,
            },
            {
              key: "concluidas",
              label: "Concluídas",
              color: "hsl(var(--success))",
              type: "line",
              getDate: (t) => t.completed_at ? new Date(t.completed_at) : null,
              items: tasks.filter((t) => t.completed_at),
            },
          ]}
        />

        {/* Concluídas vs Pendentes + Tarefas por Etapa */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                Concluídas vs Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={completionPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      <Cell fill="hsl(var(--success))" />
                      <Cell fill="hsl(var(--muted))" />
                    </Pie>
                    <Legend />
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Tarefas por Etapa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksByStage.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma tarefa no período</p>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tasksByStage}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Tarefas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Prioridade + Responsável */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Flag className="h-4 w-4 text-muted-foreground" />
                Distribuição por Prioridade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {byPriority.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byPriority}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {byPriority.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Users className="h-4 w-4 text-muted-foreground" />
                Tarefas por Responsável
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksByAssignee.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {tasksByAssignee.map((a) => (
                    <div key={a.name} className="flex items-center gap-3">
                      <UserAvatar
                        name={a.name}
                        avatarUrl={a.id ? avatars?.byId[a.id] : null}
                        userId={a.id}
                        className="h-7 w-7 shrink-0"
                        fallbackClassName="text-[10px]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate font-medium">{a.name}</span>
                          <span className="text-muted-foreground text-xs ml-2">{a.completed}/{a.total}</span>
                        </div>
                        <Progress value={a.total > 0 ? (a.completed / a.total) * 100 : 0} className="h-1.5 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════ SEÇÃO: PRODUTIVIDADE & TEMPO ═══════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Produtividade & Tempo</h2>
        </div>
        <Separator />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Tempo Trabalhado"
            value={formatDuration(totalWorkedSeconds)}
            icon={Timer}
            description={`média ${avgCompletionDays}d por tarefa`}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Target className="h-4 w-4 text-muted-foreground" />
                Estimativa vs Tempo Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              {estimateVsActualData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem tarefas com estimativa</p>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={estimateVsActualData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} unit="h" />
                      <YAxis dataKey="name" type="category" width={140} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v}h`, n === "estimativa" ? "Estimativa" : "Real"]} />
                      <Bar dataKey="estimativa" name="Estimativa" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} opacity={0.4} />
                      <Bar dataKey="real" name="Real" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Velocity por Sprint
              </CardTitle>
            </CardHeader>
            <CardContent>
              {velocityData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem sprints concluídos</p>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={velocityData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} pts`, "Story Points"]} />
                      <Bar dataKey="pontos" name="Story Points" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════ SEÇÃO: METAS (OKRs) ═══════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Metas (OKRs)</h2>
        </div>
        <Separator />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Progresso das Metas"
            value={`${avgGoalProgress}%`}
            icon={Target}
            description={`${activeGoals.length} metas ativas`}
            onClick={() => navigate("/marketing/metas")}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Metas em Risco ({goalsAtRisk.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goalsAtRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma meta em risco 🎉</p>
            ) : (
              <div className="space-y-3">
                {goalsAtRisk.slice(0, 5).map((g) => {
                  const progress = Math.round(Math.min((g.current_value / g.target_value) * 100, 100));
                  const daysLeft = differenceInDays(new Date(g.due_date), new Date());
                  return (
                    <div key={g.id} className="p-3 rounded-lg border space-y-2 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => navigate("/marketing/metas")}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{g.title}</span>
                        <Badge variant="outline" className="text-destructive text-[10px]">
                          {daysLeft}d restantes
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground font-mono">{progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ SEÇÃO: SPRINTS ═══════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Sprints</h2>
        </div>
        <Separator />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Sprint Ativo"
            value={activeSprint ? `${sprintPointsDone}/${sprintPointsTotal} pts` : "—"}
            icon={Zap}
            description={activeSprint?.name ?? "Nenhum sprint ativo"}
            onClick={() => navigate("/marketing/solicitacoes")}
          />
        </div>
      </div>
    </div>
  );
}
