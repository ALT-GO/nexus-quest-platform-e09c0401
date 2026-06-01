import { useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCreateMarketingTask, MarketingStage } from "@/hooks/use-marketing";
import { MarketingSprint } from "@/hooks/use-sprints";
import { useAuth } from "@/hooks/use-auth";
import { useAddTaskLink } from "@/hooks/use-task-links";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RecurrenceSelector } from "@/components/marketing/RecurrenceSelector";
import { computeNextDate } from "@/lib/recurrence";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: MarketingStage[];
  teamMembers: { id: string; name: string; avatar_url?: string | null }[];
  sprints?: MarketingSprint[];
  eventId?: string;
}

export function NewMarketingTaskDialog({ open, onOpenChange, stages, teamMembers, sprints, eventId }: Props) {
  const { user } = useAuth();
  const { data: profileData } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });
  const createTask = useCreateMarketingTask();
  const addTaskLink = useAddTaskLink();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [progress, setProgress] = useState("Não iniciado");
  const [assigneeId, setAssigneeId] = useState(user?.id ?? "");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("weekly");
  const [sprintId, setSprintId] = useState("");
  const [storyPoints, setStoryPoints] = useState<number | undefined>();

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (!assigneeId) {
      // Enforce: every internal marketing task must have a responsible person
      return;
    }
    const assignee = teamMembers.find(m => m.id === assigneeId)
      ?? (user?.id === assigneeId ? { id: user.id, name: profileData?.full_name ?? "" } : undefined);

    let nextRecurrenceDate: string | null = null;
    if (isRecurring) {
      const base = dueDate || startDate || new Date();
      nextRecurrenceDate = computeNextDate(base, recurrenceRule).toISOString();
    }

    createTask.mutate({
      title,
      description,
      stage_id: stageId || (stages[0]?.id ?? null),
      priority,
      progress,
      requester_id: user?.id ?? null,
      requester_name: profileData?.full_name ?? "Desconhecido",
      assignee_id: assigneeId || null,
      assignee_name: assignee?.name ?? "",
      order_index: 0,
      start_date: startDate?.toISOString() ?? null,
      due_date: dueDate?.toISOString() ?? null,
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? recurrenceRule : null,
      next_recurrence_date: nextRecurrenceDate,
      sprint_id: sprintId && sprintId !== "none" ? sprintId : null,
      story_points: storyPoints ?? null,
      event_id: eventId ?? null,
    } as any, {
      onSuccess: (data: any) => {
        // Auto-link the event to the created task
        if (eventId && data?.id) {
          addTaskLink.mutate({
            task_id: data.id,
            linked_event_id: eventId,
            link_type: "related",
          });
        }
        setTitle(""); setDescription(""); setStageId(""); setPriority("medium"); setProgress("Não iniciado"); setAssigneeId(user?.id ?? "");
        setStartDate(undefined); setDueDate(undefined);
        setIsRecurring(false); setRecurrenceRule("weekly");
        setSprintId(""); setStoryPoints(undefined);
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Tarefa de Marketing</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da tarefa" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva a tarefa..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Progresso</Label>
              <Select value={progress} onValueChange={setProgress}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Não iniciado">Não iniciado</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável <span className="text-destructive">*</span></Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-1.5">
                        <UserAvatar name={m.name} avatarUrl={m.avatar_url || undefined} userId={m.id} className="h-5 w-5" fallbackClassName="text-[9px]" />
                        {m.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Prazo Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Sprint & Story Points */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sprint</Label>
              <Select value={sprintId} onValueChange={setSprintId}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {(sprints || []).filter(s => s.status !== "completed").map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Story Points</Label>
              <Input
                type="number"
                min={0}
                value={storyPoints ?? ""}
                onChange={(e) => setStoryPoints(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="0"
              />
            </div>
          </div>
          {/* Recurrence */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Tarefa Recorrente</Label>
              <p className="text-xs text-muted-foreground">Cria automaticamente novas instâncias</p>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
          {isRecurring && (
            <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !assigneeId || createTask.isPending}>
            {createTask.isPending ? "Criando..." : "Criar Tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}