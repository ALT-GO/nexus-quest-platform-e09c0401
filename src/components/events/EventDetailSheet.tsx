import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  CalendarIcon, MapPin, DollarSign, Users, Plus, Flag,
  CheckCircle2, Clock, AlertTriangle, Trash2, ListTodo,
  Circle, ArrowUpRight,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MarketingEvent, useUpdateEvent } from "@/hooks/use-events";
import { useMarketingTasks, useCreateMarketingTask, MarketingTask, useMarketingStages } from "@/hooks/use-marketing";
import { MarketingTaskDetailSheet } from "@/components/marketing/MarketingTaskDetailSheet";
import { NewMarketingTaskDialog } from "@/components/marketing/NewMarketingTaskDialog";
import { useMarketingSprints } from "@/hooks/use-sprints";
import { supabase } from "@/integrations/supabase/client";
import { useProfileAvatars } from "@/hooks/use-profile-avatars";
import { toast } from "sonner";

interface Props {
  event: MarketingEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground" },
  active: { label: "Ativo", color: "bg-primary/15 text-primary" },
  completed: { label: "Concluído", color: "bg-success/15 text-success" },
  cancelled: { label: "Cancelado", color: "bg-destructive/15 text-destructive" },
};

const priorityIcons: Record<string, { color: string; label: string }> = {
  high: { color: "text-destructive", label: "Alta" },
  medium: { color: "text-warning", label: "Média" },
  low: { color: "text-muted-foreground", label: "Baixa" },
};

export function EventDetailSheet({ event, open, onOpenChange }: Props) {
  const updateEvent = useUpdateEvent();
  const { data: allTasks } = useMarketingTasks();
  const { data: stages } = useMarketingStages();
  const { data: sprints } = useMarketingSprints();
  const { data: avatars } = useProfileAvatars();
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MarketingTask | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("id, full_name").then(({ data }) => {
      if (data) setTeamMembers(data.map(p => ({ id: p.id, name: p.full_name })));
    });
  }, []);

  // Tasks linked to this event
  const eventTasks = useMemo(() => {
    if (!allTasks || !event) return [];
    return allTasks.filter((t: any) => t.event_id === event.id);
  }, [allTasks, event]);

  // Task progress stats
  const taskStats = useMemo(() => {
    const total = eventTasks.length;
    const completed = eventTasks.filter((t: any) => t.progress === "Concluído" || !!t.completed_at).length;
    const inProgress = eventTasks.filter((t: any) => t.progress === "Em andamento" && !t.completed_at).length;
    const overdue = eventTasks.filter((t: any) => {
      if (t.progress === "Concluído" || t.completed_at) return false;
      if (!t.due_date) return false;
      return isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
    }).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, overdue, percent };
  }, [eventTasks]);

  // Budget tracking
  const invested = event?.actual_cost ?? 0;
  const budgetPercent = event && event.budget > 0 ? Math.min((invested / event.budget) * 100, 100) : 0;

  // Checklist
  const checklist = (event?.checklist ?? []) as Array<{ id: string; text: string; checked: boolean }>;

  const toggleCheckItem = (itemId: string) => {
    if (!event) return;
    const updated = checklist.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    updateEvent.mutate({ id: event.id, checklist: updated });
  };

  const addCheckItem = () => {
    if (!event || !newCheckItem.trim()) return;
    const item = { id: `ci_${Date.now()}`, text: newCheckItem.trim(), checked: false };
    updateEvent.mutate({ id: event.id, checklist: [...checklist, item] });
    setNewCheckItem("");
  };

  const removeCheckItem = (itemId: string) => {
    if (!event) return;
    updateEvent.mutate({ id: event.id, checklist: checklist.filter(i => i.id !== itemId) });
  };

  const checklistProgress = checklist.length > 0
    ? Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100)
    : 0;

  if (!event) return null;
  const st = statusLabels[event.status] || statusLabels.planning;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <SheetTitle className="text-xl">{event.name}</SheetTitle>
              <Badge variant="outline" className={cn("text-xs", st.color)}>{st.label}</Badge>
            </div>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {event.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{event.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span>
                  {format(new Date(event.start_date), "dd MMM", { locale: ptBR })} — {format(new Date(event.end_date), "dd MMM yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>

            {/* Budget & Actual Cost */}
            <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Orçamento
                  </div>
                  <span className="text-sm font-semibold">
                    {event.budget > 0
                      ? event.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "Não definido"}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Valor Real Gasto
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0,00"
                    value={event.actual_cost ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? parseFloat(e.target.value) : null;
                      updateEvent.mutate({ id: event.id, actual_cost: val } as any);
                    }}
                    className="h-7 w-full text-sm"
                  />
                </div>
              </div>
              {event.budget > 0 && (
                <>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        budgetPercent > 90 ? "bg-destructive" : budgetPercent > 70 ? "bg-warning" : "bg-success"
                      )}
                      style={{ width: `${budgetPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Investido: {(event.actual_cost ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    <span>Restante: {((event.budget ?? 0) - (event.actual_cost ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                </>
              )}
            </div>

            {/* Leads Gerados */}
            <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Leads Gerados
              </div>
              <Input
                type="number"
                min={0}
                placeholder="Quantidade de leads"
                value={event.leads_gerados ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  updateEvent.mutate({ id: event.id, leads_gerados: val } as any);
                }}
                className="h-8 w-full text-sm"
              />
              {event.leads_gerados != null && event.leads_gerados > 0 && event.budget > 0 && (
                <div className="text-xs text-muted-foreground">
                  Custo por Lead: {(event.budget / event.leads_gerados).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              )}
            </div>

            {/* Notes */}
            {event.notes && (
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Notas</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.notes}</p>
              </div>
            )}

            <Separator />

            {/* Participants (free text) */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participantes
              </h4>
              <Textarea
                placeholder="Digite os nomes dos participantes (ex: João Silva, Maria Souza, Carlos Lima)"
                value={event.notes_participants ?? ""}
                onChange={(e) => {
                  updateEvent.mutate({ id: event.id, notes_participants: e.target.value } as any);
                }}
                className="text-sm min-h-[60px]"
              />
            </div>

            <Separator />

            {/* Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Checklist</h4>
                {checklist.length > 0 && (
                  <span className="text-xs text-muted-foreground">{checklistProgress}%</span>
                )}
              </div>
              {checklist.length > 0 && (
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${checklistProgress}%` }} />
                </div>
              )}
              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 group py-1">
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={() => toggleCheckItem(item.id)}
                    />
                    <span className={cn("text-sm flex-1", item.checked && "line-through text-muted-foreground")}>
                      {item.text}
                    </span>
                    <button
                      onClick={() => removeCheckItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  placeholder="Novo item..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && addCheckItem()}
                />
                <Button size="sm" variant="outline" className="h-8" onClick={addCheckItem} disabled={!newCheckItem.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* ===== SUBTASKS / ETAPAS DO EVENTO ===== */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Etapas / Subtarefas ({taskStats.total})</h4>
                </div>
                <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => setNewTaskDialogOpen(true)}>
                  <Plus className="h-3 w-3" /> Nova Etapa
                </Button>
              </div>

              {/* Progress summary */}
              {taskStats.total > 0 && (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Progresso geral</span>
                    <span className="text-muted-foreground">{taskStats.completed}/{taskStats.total} concluídas ({taskStats.percent}%)</span>
                  </div>
                  <Progress value={taskStats.percent} className="h-2" />
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-success" /> {taskStats.completed} concluídas
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-primary" /> {taskStats.inProgress} em andamento
                    </span>
                    {taskStats.overdue > 0 && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-destructive" /> {taskStats.overdue} atrasadas
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Task list */}
              {eventTasks.length === 0 ? (
                <div className="text-center py-6 border rounded-lg border-dashed">
                  <ListTodo className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Nenhuma etapa criada</p>
                  <p className="text-[11px] text-muted-foreground/60">Crie subtarefas para organizar as etapas do evento</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {eventTasks.map((task: any) => {
                    const stage = (stages ?? []).find((s: any) => s.id === task.stage_id);
                    const pri = priorityIcons[task.priority] || priorityIcons.medium;
                    const isCompleted = task.progress === "Concluído" || !!task.completed_at;
                    const isOverdue = !isCompleted && task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-center gap-2.5 p-2.5 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors group",
                          isOverdue && "border-destructive/30 bg-destructive/5",
                          isCompleted && "opacity-60"
                        )}
                        onClick={() => { setSelectedTask(task); setTaskDetailOpen(true); }}
                      >
                        {/* Status icon */}
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "text-sm font-medium truncate",
                              isCompleted && "line-through text-muted-foreground"
                            )}>
                              {task.title}
                            </span>
                            <Flag className={cn("h-3 w-3 shrink-0", pri.color)} />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {stage && (
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 px-1.5"
                                style={stage.color ? { borderColor: `hsl(${stage.color})`, color: `hsl(${stage.color})` } : undefined}
                              >
                                {stage.name}
                              </Badge>
                            )}
                            {task.due_date && (
                              <span className={cn(
                                "text-[10px] flex items-center gap-0.5",
                                isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                              )}>
                                <CalendarIcon className="h-2.5 w-2.5" />
                                {format(new Date(task.due_date), "dd/MM/yy")}
                                {isOverdue && " (atrasada)"}
                              </span>
                            )}
                            {!isCompleted && task.progress === "Em andamento" && (
                              <span className="text-[10px] text-primary flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" /> Em andamento
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Assignee */}
                        {task.assignee_name && (
                          <div className="flex items-center gap-1 shrink-0">
                            <UserAvatar
                              name={task.assignee_name}
                              avatarUrl={task.assignee_id ? avatars?.byId[task.assignee_id] : null}
                              className="h-5 w-5"
                              fallbackClassName="text-[8px]"
                            />
                            <span className="text-[10px] text-muted-foreground hidden sm:inline max-w-[60px] truncate">
                              {task.assignee_name.split(" ")[0]}
                            </span>
                          </div>
                        )}

                        {/* Open indicator */}
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* New Task Dialog - pre-linked to event */}
      <NewMarketingTaskDialog
        open={newTaskDialogOpen}
        onOpenChange={setNewTaskDialogOpen}
        stages={stages ?? []}
        teamMembers={teamMembers}
        sprints={sprints ?? []}
        eventId={event?.id}
      />

      {/* Task detail */}
      <MarketingTaskDetailSheet
        task={selectedTask}
        stages={stages ?? []}
        teamMembers={teamMembers}
        open={taskDetailOpen}
        onOpenChange={setTaskDetailOpen}
      />
    </>
  );
}
