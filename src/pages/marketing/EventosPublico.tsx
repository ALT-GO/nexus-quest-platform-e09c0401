import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarIcon, MapPin, DollarSign, Users, Flag,
  CheckCircle2, Clock, AlertTriangle, TrendingUp,
  BarChart3, Target, Loader2, Building2,
} from "lucide-react";
import { format, isSameDay, isWithinInterval, isPast, isToday, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, { label: string; color: string; dotColor: string }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground", dotColor: "bg-muted-foreground" },
  active: { label: "Ativo", color: "bg-primary/15 text-primary", dotColor: "bg-primary" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700", dotColor: "bg-green-500" },
  cancelled: { label: "Cancelado", color: "bg-destructive/15 text-destructive", dotColor: "bg-destructive" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "text-destructive" },
  medium: { label: "Média", color: "text-yellow-500" },
  low: { label: "Baixa", color: "text-muted-foreground" },
};

export default function EventosPublico() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState<"start_date" | "name">("start_date");

  const sortedEvents = useMemo(() => {
    const arr = [...events];
    if (sortBy === "name") {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));
    } else {
      arr.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    }
    return arr;
  }, [events, sortBy]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-public-events`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        if (!res.ok) throw new Error("Erro ao carregar");
        const result = await res.json();
        setEvents(result.events ?? []);
        setTasks(result.tasks ?? []);
        setStages(result.stages ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // KPIs
  const kpis = useMemo(() => {
    const total = events.length;
    const active = events.filter(e => e.status === "active").length;
    const completed = events.filter(e => e.status === "completed").length;
    const totalBudget = events.reduce((s, e) => s + (e.budget || 0), 0);
    const totalActual = events.reduce((s, e) => s + (e.actual_cost || 0), 0);
    const totalLeads = events.reduce((s, e) => s + (e.leads_gerados || 0), 0);
    const avgCostPerLead = totalLeads > 0 ? totalActual / totalLeads : 0;
    return { total, active, completed, totalBudget, totalActual, totalLeads, avgCostPerLead };
  }, [events]);

  // Calendar helpers
  const calendarEvents = useMemo(() => events.filter(e => e.event_type !== "campanha"), [events]);

  const eventDays = useMemo(() => {
    const days = new Set<string>();
    calendarEvents.forEach((e) => {
      const start = new Date(e.start_date);
      const end = new Date(e.end_date);
      const current = new Date(start);
      while (current <= end) {
        days.add(format(current, "yyyy-MM-dd"));
        current.setDate(current.getDate() + 1);
      }
    });
    return days;
  }, [calendarEvents]);

  const modifiers = useMemo(() => ({
    event: (date: Date) => eventDays.has(format(date, "yyyy-MM-dd")),
  }), [eventDays]);

  const modifiersStyles = {
    event: {
      backgroundColor: "hsl(var(--primary) / 0.15)",
      borderRadius: "50%",
      fontWeight: "bold" as const,
      color: "hsl(var(--primary))",
    },
  };

  const monthEvents = useMemo(() => {
    const ms = startOfMonth(selectedDate);
    const me = endOfMonth(selectedDate);
    return events
      .filter((e) => {
        const s = new Date(e.start_date);
        const en = new Date(e.end_date);
        return s <= me && en >= ms;
      })
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [events, selectedDate]);

  // Tasks for selected event
  const eventTasks = useMemo(() => {
    if (!selectedEvent) return [];
    return tasks.filter(t => t.event_id === selectedEvent.id);
  }, [selectedEvent, tasks]);

  const eventTaskStats = useMemo(() => {
    const total = eventTasks.length;
    const done = eventTasks.filter(t => t.progress === "Concluído" || !!t.completed_at).length;
    const overdue = eventTasks.filter(t => {
      if (t.progress === "Concluído" || t.completed_at) return false;
      return t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
    }).length;
    return { total, done, overdue, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [eventTasks]);

  // Status distribution for chart
  const statusDist = useMemo(() => {
    const dist: Record<string, number> = { planning: 0, active: 0, completed: 0, cancelled: 0 };
    events.forEach(e => { dist[e.status] = (dist[e.status] || 0) + 1; });
    return dist;
  }, [events]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary/5 border-b">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3 mb-1">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold">Painel de Eventos — Marketing</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Visão executiva dos eventos de marketing • Atualizado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <CalendarIcon className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{kpis.total}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Total Eventos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{kpis.active}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold">{kpis.completed}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Concluídos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
              <p className="text-lg font-bold">{fmt(kpis.totalBudget)}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Budget Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold">{kpis.totalLeads}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Leads Gerados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{kpis.avgCostPerLead > 0 ? fmt(kpis.avgCostPerLead) : "—"}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Custo/Lead</p>
            </CardContent>
          </Card>
        </div>

        {/* Status distribution bar */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Distribuição por Status
            </h3>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-muted">
              {Object.entries(statusDist).map(([key, count]) => {
                if (count === 0 || kpis.total === 0) return null;
                const pct = (count / kpis.total) * 100;
                const st = statusLabels[key] || statusLabels.planning;
                return (
                  <div
                    key={key}
                    className={cn("h-full transition-all", st.dotColor)}
                    style={{ width: `${pct}%` }}
                    title={`${st.label}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {Object.entries(statusDist).filter(([, c]) => c > 0).map(([key, count]) => {
                const st = statusLabels[key] || statusLabels.planning;
                return (
                  <div key={key} className="flex items-center gap-1.5 text-xs">
                    <div className={cn("h-2.5 w-2.5 rounded-full", st.dotColor)} />
                    <span className="text-muted-foreground">{st.label}: <span className="font-medium text-foreground">{count}</span></span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Budget Overview: planned vs actual per event */}
        {events.some(e => (e.budget || 0) > 0) && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Orçamento — Planejado vs. Real
              </h3>
              <div className="space-y-2">
                {events.filter(e => (e.budget || 0) > 0).map(e => {
                  const actual = e.actual_cost || 0;
                  const pct = Math.min((actual / e.budget) * 100, 100);
                  return (
                    <div key={e.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate max-w-[200px]">{e.name}</span>
                        <span className="text-muted-foreground shrink-0">
                          {fmt(actual)} / {fmt(e.budget)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pct > 90 ? "bg-destructive" : pct > 70 ? "bg-yellow-500" : "bg-green-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t">
                <span className="font-semibold">Total</span>
                <span className="text-muted-foreground">
                  {fmt(kpis.totalActual)} / {fmt(kpis.totalBudget)}
                  {kpis.totalBudget > 0 && (
                    <span className="ml-1">
                      ({Math.round((kpis.totalActual / kpis.totalBudget) * 100)}%)
                    </span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calendar + Event List */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              Calendário de Eventos
            </h3>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="shrink-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  month={selectedDate}
                  onMonthChange={setSelectedDate}
                  locale={ptBR}
                  className="p-3 pointer-events-auto rounded-md border"
                  modifiers={modifiers}
                  modifiersStyles={modifiersStyles}
                />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                  Eventos em {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
                </h4>
                {monthEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento neste mês</p>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {monthEvents.map((event) => {
                      const st = statusLabels[event.status] || statusLabels.planning;
                      const startD = new Date(event.start_date);
                      const endD = new Date(event.end_date);
                      const isActive = isSameDay(new Date(), startD) || isWithinInterval(new Date(), { start: startD, end: endD });
                      const isSelected = selectedEvent?.id === event.id;
                      const eventTaskCount = tasks.filter(t => t.event_id === event.id).length;

                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(isSelected ? null : event)}
                          className={cn(
                            "p-3 rounded-lg border space-y-1.5 transition-colors cursor-pointer hover:bg-accent/50",
                            isActive && "border-primary/50 bg-primary/5",
                            isSelected && "ring-2 ring-primary/30"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{event.name}</span>
                            <Badge variant="outline" className={cn("text-[10px] shrink-0", st.color)}>
                              {st.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(startD, "dd MMM", { locale: ptBR })} — {format(endD, "dd MMM", { locale: ptBR })}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[120px]">{event.location}</span>
                              </span>
                            )}
                            {eventTaskCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {eventTaskCount} tarefas
                              </span>
                            )}
                          </div>
                          {event.budget > 0 && (
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-muted-foreground">
                                Budget: {fmt(event.budget)}
                              </span>
                              {event.leads_gerados != null && event.leads_gerados > 0 && (
                                <span className="text-muted-foreground">
                                  {event.leads_gerados} leads
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected event detail */}
        {selectedEvent && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold">{selectedEvent.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    {selectedEvent.location && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedEvent.location}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {format(new Date(selectedEvent.start_date), "dd MMM", { locale: ptBR })} — {format(new Date(selectedEvent.end_date), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className={cn("text-xs", (statusLabels[selectedEvent.status] || statusLabels.planning).color)}>
                  {(statusLabels[selectedEvent.status] || statusLabels.planning).label}
                </Badge>
              </div>

              {/* Budget detail */}
              {selectedEvent.budget > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <span className="text-[10px] text-muted-foreground font-medium">Planejado</span>
                    <p className="font-semibold">{fmt(selectedEvent.budget)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <span className="text-[10px] text-muted-foreground font-medium">Valor Real</span>
                    <p className="font-semibold">{fmt(selectedEvent.actual_cost || 0)}</p>
                  </div>
                  {selectedEvent.leads_gerados != null && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <span className="text-[10px] text-muted-foreground font-medium">Leads</span>
                      <p className="font-semibold">{selectedEvent.leads_gerados}</p>
                    </div>
                  )}
                  {selectedEvent.leads_gerados > 0 && selectedEvent.budget > 0 && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <span className="text-[10px] text-muted-foreground font-medium">Custo/Lead</span>
                      <p className="font-semibold">{fmt((selectedEvent.actual_cost || selectedEvent.budget) / selectedEvent.leads_gerados)}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedEvent.notes && (
                <div>
                  <h4 className="text-xs font-semibold mb-1">Notas</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedEvent.notes}</p>
                </div>
              )}

              {/* Task progress */}
              {eventTaskStats.total > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Progresso das Tarefas</span>
                    <span className="text-muted-foreground">{eventTaskStats.done}/{eventTaskStats.total} ({eventTaskStats.percent}%)</span>
                  </div>
                  <Progress value={eventTaskStats.percent} className="h-2" />
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> {eventTaskStats.done} concluídas</span>
                    {eventTaskStats.overdue > 0 && (
                      <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> {eventTaskStats.overdue} atrasadas</span>
                    )}
                  </div>

                  <div className="space-y-1 mt-2">
                    {eventTasks.map(task => {
                      const stage = stages.find((s: any) => s.id === task.stage_id);
                      const isDone = task.progress === "Concluído" || !!task.completed_at;
                      const isOverdue = !isDone && task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border text-sm",
                            isOverdue && "border-destructive/30 bg-destructive/5",
                            isDone && "opacity-60"
                          )}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className={cn("flex-1 truncate", isDone && "line-through text-muted-foreground")}>{task.title}</span>
                          {stage && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5" style={{ borderColor: `hsl(${stage.color})`, color: `hsl(${stage.color})` }}>
                              {stage.name}
                            </Badge>
                          )}
                          {task.assignee_name && (
                            <span className="text-[10px] text-muted-foreground shrink-0">{task.assignee_name}</span>
                          )}
                          {task.due_date && (
                            <span className={cn("text-[10px] shrink-0", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                              {format(new Date(task.due_date), "dd/MM")}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* All events grid (not in current month) */}
        <div>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">Todos os Eventos</h3>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "start_date" | "name")}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="start_date">Data de início</SelectItem>
                <SelectItem value="name">Nome</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedEvents.map(event => {
              const st = statusLabels[event.status] || statusLabels.planning;
              const pri = priorityConfig[event.priority] || priorityConfig.medium;
              const eventTaskCount = tasks.filter(t => t.event_id === event.id).length;
              const budgetUsed = event.actual_cost || 0;
              const budgetPct = event.budget > 0 ? Math.min((budgetUsed / event.budget) * 100, 100) : 0;

              return (
                <Card
                  key={event.id}
                  className={cn(
                    "cursor-pointer hover:shadow-md transition-all",
                    selectedEvent?.id === event.id && "ring-2 ring-primary/30"
                  )}
                  onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                >
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-sm truncate">{event.name}</h4>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0 ml-2", st.color)}>
                        {st.label}
                      </Badge>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" />
                      {format(new Date(event.start_date), "dd MMM", { locale: ptBR })} — {format(new Date(event.end_date), "dd MMM yyyy", { locale: ptBR })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Flag className={cn("h-3 w-3", pri.color)} />
                      <span className={cn("text-[10px]", pri.color)}>Prioridade {pri.label}</span>
                    </div>

                    {event.budget > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Budget</span>
                          <span>{fmt(event.budget)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              budgetPct > 90 ? "bg-destructive" : budgetPct > 70 ? "bg-yellow-500" : "bg-green-500"
                            )}
                            style={{ width: `${budgetPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1.5 border-t">
                      {eventTaskCount > 0 && <span>{eventTaskCount} tarefas</span>}
                      {event.leads_gerados != null && event.leads_gerados > 0 && (
                        <span>{event.leads_gerados} leads</span>
                      )}
                      {event.leads_gerados > 0 && event.budget > 0 && (
                        <span className="ml-auto">{fmt(event.budget / event.leads_gerados)}/lead</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="text-center py-4 text-xs text-muted-foreground">
          Painel executivo de eventos — Marketing
        </div>
      </div>
    </div>
  );
}
