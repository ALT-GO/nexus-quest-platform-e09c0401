import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  CalendarIcon, MapPin, DollarSign, Users, Plus, Flag,
  CheckCircle2, Clock, AlertTriangle, Trash2, GripVertical,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MarketingEvent, useUpdateEvent, useEventParticipants, useManageEventParticipants } from "@/hooks/use-events";
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

export function EventDetailSheet({ event, open, onOpenChange }: Props) {
  const updateEvent = useUpdateEvent();
  const { data: allTasks } = useMarketingTasks();
  const { data: stages } = useMarketingStages();
  const { data: sprints } = useMarketingSprints();
  const { data: participants } = useEventParticipants(event?.id ?? null);
  const participantsMgr = useManageEventParticipants();
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

  // Budget tracking
  const invested = 0; // Future: sum from task costs
  const budgetRemaining = (event?.budget ?? 0) - invested;
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

  // Participant profiles
  const participantProfiles = useMemo(() => {
    if (!participants) return [];
    return participants.map(p => {
      const member = teamMembers.find(m => m.id === p.profile_id);
      return { ...p, name: member?.name ?? "Desconhecido", avatarUrl: avatars?.byId[p.profile_id] ?? null };
    });
  }, [participants, teamMembers, avatars]);

  const nonParticipantMembers = useMemo(() => {
    const participantIds = new Set(participants?.map(p => p.profile_id) ?? []);
    return teamMembers.filter(m => !participantIds.has(m.id));
  }, [teamMembers, participants]);

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

            {/* Budget */}
            {event.budget > 0 && (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Budget
                  </div>
                  <span className="font-semibold">
                    {event.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
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
                  <span>Investido: R$ {invested.toFixed(2)}</span>
                  <span>Restante: {budgetRemaining.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
              </div>
            )}

            {/* Leads Gerados */}
            <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Leads Gerados
                </div>
                {event.leads_gerados != null ? (
                  <span className="font-semibold">{event.leads_gerados}</span>
                ) : (
                  <Badge variant="outline" className="text-xs text-warning">Não preenchido</Badge>
                )}
              </div>
              {event.leads_gerados != null && event.budget > 0 && (
                <div className="text-xs text-muted-foreground">
                  Custo por Lead: {event.leads_gerados > 0
                    ? (event.budget / event.leads_gerados).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
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

            {/* Participants */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participantes ({participantProfiles.length})
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {participantProfiles.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs group">
                    <UserAvatar name={p.name} avatarUrl={p.avatarUrl} className="h-5 w-5" fallbackClassName="text-[8px]" />
                    <span>{p.name}</span>
                    <button
                      onClick={() => participantsMgr.remove(event.id, p.profile_id)}
                      className="opacity-0 group-hover:opacity-100 text-destructive ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {nonParticipantMembers.length > 0 && (
                  <select
                    className="text-xs border rounded px-2 py-1 bg-background"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) participantsMgr.add(event.id, e.target.value);
                    }}
                  >
                    <option value="">+ Adicionar</option>
                    {nonParticipantMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
              </div>
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

            {/* Tasks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Tarefas do Evento ({eventTasks.length})</h4>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setNewTaskDialogOpen(true)}>
                  <Plus className="h-3 w-3" /> Nova Tarefa
                </Button>
              </div>
              {eventTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa vinculada a este evento</p>
              ) : (
                <div className="space-y-1.5">
                  {eventTasks.map((task: any) => {
                    const stage = (stages ?? []).find((s: any) => s.id === task.stage_id);
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => { setSelectedTask(task); setTaskDetailOpen(true); }}
                      >
                        <CheckCircle2 className={cn(
                          "h-4 w-4 shrink-0",
                          task.progress === "Concluído" ? "text-success" : "text-muted-foreground"
                        )} />
                        <span className={cn(
                          "text-sm flex-1 truncate",
                          task.progress === "Concluído" && "line-through text-muted-foreground"
                        )}>
                          {task.title}
                        </span>
                        {stage && (
                          <Badge variant="outline" className="text-[10px]">{stage.name}</Badge>
                        )}
                        {task.assignee_name && (
                          <UserAvatar
                            name={task.assignee_name}
                            avatarUrl={task.assignee_id ? avatars?.byId[task.assignee_id] : null}
                            className="h-5 w-5"
                            fallbackClassName="text-[8px]"
                          />
                        )}
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
