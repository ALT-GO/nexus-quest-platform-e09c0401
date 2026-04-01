import { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: MarketingStage[];
  teamMembers: { id: string; name: string }[];
  sprints?: MarketingSprint[];
}

export function NewMarketingTaskDialog({ open, onOpenChange, stages, teamMembers, sprints }: Props) {
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [progress, setProgress] = useState("Não iniciado");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("weekly");

  const handleSubmit = () => {
    if (!title.trim()) return;
    const assignee = teamMembers.find(m => m.id === assigneeId);

    // Calculate next_recurrence_date based on rule
    let nextRecurrenceDate: string | null = null;
    if (isRecurring) {
      const base = dueDate || startDate || new Date();
      const next = new Date(base);
      if (recurrenceRule === 'daily') next.setDate(next.getDate() + 1);
      else if (recurrenceRule === 'weekly') next.setDate(next.getDate() + 7);
      else if (recurrenceRule === 'monthly') next.setMonth(next.getMonth() + 1);
      nextRecurrenceDate = next.toISOString();
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
    } as any, {
      onSuccess: () => {
        setTitle(""); setDescription(""); setStageId(""); setPriority("medium"); setProgress("Não iniciado"); setAssigneeId("");
        setStartDate(undefined); setDueDate(undefined);
        setIsRecurring(false); setRecurrenceRule("weekly");
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
              <Label>Responsável</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
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
          {/* Recurrence */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Tarefa Recorrente</Label>
              <p className="text-xs text-muted-foreground">Cria automaticamente novas instâncias</p>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
          {isRecurring && (
            <div>
              <Label>Frequência</Label>
              <Select value={recurrenceRule} onValueChange={setRecurrenceRule}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || createTask.isPending}>
            {createTask.isPending ? "Criando..." : "Criar Tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}