import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarIcon, MapPin, DollarSign, Users, Flag,
  CheckCircle2, Clock, AlertTriangle, ListTodo, Circle, Loader2,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground" },
  active: { label: "Ativo", color: "bg-primary/15 text-primary" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", color: "bg-destructive/15 text-destructive" },
};

const priorityIcons: Record<string, { color: string; label: string }> = {
  high: { color: "text-destructive", label: "Alta" },
  medium: { color: "text-yellow-500", label: "Média" },
  low: { color: "text-muted-foreground", label: "Baixa" },
};

export default function EventoPublico() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [event, setEvent] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);

  useEffect(() => {
    if (!eventId) { setError("Link inválido"); setLoading(false); return; }

    const fetchData = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-public-event?id=${eventId}`;
        const res = await fetch(url, {
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });

        if (!res.ok) throw new Error("Evento não encontrado");
        const result = await res.json();
        setEvent(result.event);
        setTasks(result.tasks);
        setStages(result.stages);
      } catch (e: any) {
        setError(e.message || "Erro ao carregar evento");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.progress === "Concluído" || !!t.completed_at).length;
    const inProgress = tasks.filter(t => t.progress === "Em andamento" && !t.completed_at).length;
    const overdue = tasks.filter(t => {
      if (t.progress === "Concluído" || t.completed_at) return false;
      if (!t.due_date) return false;
      return isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
    }).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, overdue, percent };
  }, [tasks]);

  const checklist = (event?.checklist ?? []) as Array<{ id: string; text: string; checked: boolean }>;
  const checklistProgress = checklist.length > 0
    ? Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">Evento não encontrado</h2>
          <p className="text-sm text-muted-foreground">{error || "O link pode estar inválido ou expirado."}</p>
        </div>
      </div>
    );
  }

  const st = statusLabels[event.status] || statusLabels.planning;
  const invested = event.actual_cost ?? 0;
  const budgetPercent = event.budget > 0 ? Math.min((invested / event.budget) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary/5 border-b">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className={cn("text-xs", st.color)}>{st.label}</Badge>
            {event.priority && (
              <Badge variant="outline" className="text-xs gap-1">
                <Flag className={cn("h-3 w-3", (priorityIcons[event.priority] || priorityIcons.medium).color)} />
                {(priorityIcons[event.priority] || priorityIcons.medium).label}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {event.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              {format(new Date(event.start_date), "dd MMM yyyy", { locale: ptBR })} — {format(new Date(event.end_date), "dd MMM yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Budget */}
        {event.budget > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Orçamento
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Planejado</span>
                <p className="font-semibold">{event.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Valor Real</span>
                <p className="font-semibold">{(event.actual_cost ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  budgetPercent > 90 ? "bg-destructive" : budgetPercent > 70 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Investido: {invested.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              <span>Restante: {((event.budget ?? 0) - invested).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </div>
          </div>
        )}

        {/* Leads */}
        {event.leads_gerados != null && event.leads_gerados > 0 && (
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Leads Gerados
            </h3>
            <p className="text-2xl font-bold">{event.leads_gerados}</p>
            {event.budget > 0 && (
              <p className="text-xs text-muted-foreground">
                Custo por Lead: {(event.budget / event.leads_gerados).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Notas</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.notes}</p>
          </div>
        )}

        {/* Participants */}
        {event.notes_participants && (
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Participantes
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.notes_participants}</p>
          </div>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Checklist</h3>
              <span className="text-xs text-muted-foreground">{checklistProgress}%</span>
            </div>
            <Progress value={checklistProgress} className="h-2" />
            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-1">
                  <Checkbox checked={item.checked} disabled />
                  <span className={cn("text-sm", item.checked && "line-through text-muted-foreground")}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subtasks / Stages */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Etapas / Subtarefas ({taskStats.total})</h3>
          </div>

          {taskStats.total > 0 && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Progresso geral</span>
                <span className="text-muted-foreground">{taskStats.completed}/{taskStats.total} concluídas ({taskStats.percent}%)</span>
              </div>
              <Progress value={taskStats.percent} className="h-2" />
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> {taskStats.completed} concluídas</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-primary" /> {taskStats.inProgress} em andamento</span>
                {taskStats.overdue > 0 && (
                  <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> {taskStats.overdue} atrasadas</span>
                )}
              </div>
            </div>
          )}

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma etapa criada ainda.</p>
          ) : (
            <div className="space-y-1.5">
              {tasks.map((task) => {
                const stage = stages.find((s: any) => s.id === task.stage_id);
                const pri = priorityIcons[task.priority] || priorityIcons.medium;
                const isCompleted = task.progress === "Concluído" || !!task.completed_at;
                const isOverdue = !isCompleted && task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));

                // Subtask checklist
                const taskChecklist = (task.checklist ?? []) as Array<{ text: string; checked: boolean }>;
                const taskCheckDone = taskChecklist.filter(c => c.checked).length;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-lg border transition-colors",
                      isOverdue && "border-destructive/30 bg-destructive/5",
                      isCompleted && "opacity-60"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-sm font-medium truncate", isCompleted && "line-through text-muted-foreground")}>
                          {task.title}
                        </span>
                        <Flag className={cn("h-3 w-3 shrink-0", pri.color)} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {stage && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5" style={{ borderColor: `hsl(${stage.color})`, color: `hsl(${stage.color})` }}>
                            {stage.name}
                          </Badge>
                        )}
                        {task.assignee_name && (
                          <span className="text-[10px] text-muted-foreground">{task.assignee_name}</span>
                        )}
                        {task.due_date && (
                          <span className={cn("text-[10px]", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                            {format(new Date(task.due_date), "dd/MM")}
                          </span>
                        )}
                        {taskChecklist.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            ✓ {taskCheckDone}/{taskChecklist.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-4 text-xs text-muted-foreground">
          Atualizado em {format(new Date(event.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </div>
    </div>
  );
}
