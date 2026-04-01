import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Check, X, Plus, Trash2, CalendarIcon, MessageSquare, History, Send, Repeat, Diamond } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import {
  MarketingStage,
  MarketingTask,
  ChecklistItem,
  useUpdateMarketingTask,
} from "@/hooks/use-marketing";
import { MarketingTimerButton } from "./MarketingTimerButton";
import { useAuth } from "@/hooks/use-auth";
import { notifyTaskCreator } from "@/lib/marketing-notifications";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MarketingTagSelector } from "./MarketingTagSelector";
import {
  useMarketingComments,
  useAddMarketingComment,
  useMarketingHistory,
  useAddMarketingHistory,
} from "@/hooks/use-marketing-comments";
import { UserAvatar } from "@/components/ui/user-avatar";

interface Props {
  task: MarketingTask | null;
  stages: MarketingStage[];
  teamMembers: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const progressDot: Record<string, string> = {
  "Não iniciado": "bg-muted-foreground",
  "Em andamento": "bg-blue-500",
  "Concluído": "bg-green-500",
};

function TimeEstimateField({ taskId, currentMinutes, updateTask }: {
  taskId: string;
  currentMinutes: number | null;
  updateTask: ReturnType<typeof useUpdateMarketingTask>;
}) {
  const [hours, setHours] = useState(() => currentMinutes ? Math.floor(currentMinutes / 60) : 0);
  const [mins, setMins] = useState(() => currentMinutes ? currentMinutes % 60 : 0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHours(currentMinutes ? Math.floor(currentMinutes / 60) : 0);
    setMins(currentMinutes ? currentMinutes % 60 : 0);
  }, [currentMinutes]);

  const debouncedSave = useCallback((h: number, m: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const total = h * 60 + m;
      updateTask.mutate({ id: taskId, time_estimate_minutes: total || null } as any);
    }, 800);
  }, [taskId, updateTask]);

  return (
    <div>
      <Label className="text-xs text-muted-foreground">Estimativa de Tempo</Label>
      <div className="flex items-center gap-2 mt-1">
        <Input
          type="number"
          min={0}
          placeholder="Horas"
          value={hours || ""}
          onChange={(e) => {
            const h = parseInt(e.target.value) || 0;
            setHours(h);
            debouncedSave(h, mins);
          }}
          className="h-8 w-20 text-sm"
        />
        <span className="text-xs text-muted-foreground">h</span>
        <Input
          type="number"
          min={0}
          max={59}
          placeholder="Min"
          value={mins || ""}
          onChange={(e) => {
            const m = Math.min(59, parseInt(e.target.value) || 0);
            setMins(m);
            debouncedSave(hours, m);
          }}
          className="h-8 w-20 text-sm"
        />
        <span className="text-xs text-muted-foreground">min</span>
      </div>
    </div>
  );
}

export function MarketingTaskDetailSheet({
  task,
  stages,
  teamMembers,
  open,
  onOpenChange,
}: Props) {
  const updateTask = useUpdateMarketingTask();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [commentText, setCommentText] = useState("");
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  const { data: comments } = useMarketingComments(task?.id);
  const addComment = useAddMarketingComment();
  const { data: history } = useMarketingHistory(task?.id);
  const addHistory = useAddMarketingHistory();

  if (!task) return null;

  const currentStage = stages.find((s) => s.id === task.stage_id);
  const isPendingApproval = currentStage?.meta_status === "pending_approval";
  const canApprove = isPendingApproval && isAdmin;

  const checklist: ChecklistItem[] = Array.isArray(task.checklist) ? task.checklist : [];
  const completedCount = checklist.filter((i) => i.completed).length;
  const checklistProgress = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;

  const authorName = profile?.full_name || "Usuário";

  const logHistory = (action: string, details: string) => {
    addHistory.mutate({
      task_id: task.id,
      author_name: authorName,
      action,
      details,
    });
  };

  const saveChecklist = (items: ChecklistItem[]) => {
    updateTask.mutate({ id: task.id, checklist: items } as any);
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const item: ChecklistItem = {
      id: crypto.randomUUID(),
      text: newChecklistItem.trim(),
      completed: false,
    };
    saveChecklist([...checklist, item]);
    setNewChecklistItem("");
  };

  const toggleChecklistItem = (itemId: string) => {
    saveChecklist(
      checklist.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i))
    );
  };

  const removeChecklistItem = (itemId: string) => {
    saveChecklist(checklist.filter((i) => i.id !== itemId));
  };

  const handleStageChange = (val: string) => {
    const newStage = stages.find((s) => s.id === val);
    const oldStage = stages.find((s) => s.id === task.stage_id);
    updateTask.mutate({ id: task.id, stage_id: val });
    logHistory("Mudança de etapa", `${oldStage?.name || "—"} → ${newStage?.name || "—"}`);
  };

  const handlePriorityChange = (val: string) => {
    updateTask.mutate({ id: task.id, priority: val });
    logHistory("Mudança de prioridade", `${priorityLabels[task.priority] || task.priority} → ${priorityLabels[val] || val}`);
  };

  const handleAssigneeChange = (val: string) => {
    const member = teamMembers.find((m) => m.id === val);
    updateTask.mutate({
      id: task.id,
      assignee_id: val,
      assignee_name: member?.name || "",
    });
    logHistory("Mudança de responsável", `${task.assignee_name || "—"} → ${member?.name || "—"}`);
  };

  const handleProgressChange = (val: string) => {
    updateTask.mutate({ id: task.id, progress: val });
    logHistory("Mudança de progresso", `${task.progress} → ${val}`);
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !user) return;
    await addComment.mutateAsync({
      task_id: task.id,
      author_id: user.id,
      author_name: authorName,
      avatar_url: profile?.avatar_url || null,
      content: commentText.trim(),
    });

    // Notify assignee if different from commenter
    if (task.assignee_id && task.assignee_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: task.assignee_id,
        title: "Novo comentário",
        message: `${authorName} comentou na tarefa "${task.title}"`,
        type: "info",
        link: "/marketing/solicitacoes",
      } as any);
    }

    setCommentText("");
    toast.success("Comentário adicionado");
  };

  const handleApprove = async () => {
    const completedStage = stages.find((s) => s.meta_status === "completed");
    if (!completedStage) {
      toast.error("Nenhuma etapa de conclusão configurada");
      return;
    }

    await supabase
      .from("marketing_tasks")
      .update({
        stage_id: completedStage.id,
        progress: "Concluído",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", task.id);

    logHistory("Aprovação", `Tarefa aprovada por ${authorName}`);

    if (task.requester_id) {
      notifyTaskCreator({
        creatorId: task.requester_id,
        taskTitle: task.title,
        approved: true,
      });
    }

    qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
    toast.success("Tarefa aprovada e movida para Concluído");
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;

    const inProgressStage = stages.find((s) => s.meta_status === "in_progress");
    if (!inProgressStage) {
      toast.error("Nenhuma etapa de progresso configurada");
      return;
    }

    await supabase
      .from("marketing_tasks")
      .update({
        stage_id: inProgressStage.id,
        progress: "Em andamento",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", task.id);

    logHistory("Reprovação", `Tarefa reprovada por ${authorName}. Motivo: ${rejectReason}`);

    if (task.requester_id) {
      notifyTaskCreator({
        creatorId: task.requester_id,
        taskTitle: task.title,
        approved: false,
        reason: rejectReason,
      });
    }

    qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
    toast.success("Tarefa reprovada e devolvida para ajustes");
    setRejectDialogOpen(false);
    setRejectReason("");
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">{task.title}</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Criado em {format(new Date(task.created_at), "dd/MM/yyyy 'às' HH:mm")}
            </p>
          </SheetHeader>

          {/* Approval Banner */}
          {canApprove && (
            <div className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="font-semibold text-amber-800 dark:text-amber-300">
                  Aprovação Necessária
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleApprove}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4 mr-2" /> Aprovar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setRejectDialogOpen(true)}
                >
                  <X className="h-4 w-4 mr-2" /> Reprovar
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-5">
            {/* Timer */}
            <div>
              <Label className="text-xs text-muted-foreground">Timer</Label>
              <div className="mt-1">
                <MarketingTimerButton taskId={task.id} size="detail" />
              </div>
            </div>

            {/* Time Estimate */}
            <TimeEstimateField
              taskId={task.id}
              currentMinutes={task.time_estimate_minutes}
              updateTask={updateTask}
            />

            <div>
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <p className="mt-1 text-sm whitespace-pre-wrap">
                {task.description || "Sem descrição"}
              </p>
            </div>

            {/* Stage */}
            <div>
              <Label className="text-xs text-muted-foreground">Etapa</Label>
              <Select
                value={task.stage_id || ""}
                onValueChange={handleStageChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Progress */}
            <div>
              <Label className="text-xs text-muted-foreground">Progresso</Label>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-block h-3 w-3 rounded-full ${
                    progressDot[task.progress] || "bg-muted-foreground"
                  }`}
                />
                <Select
                  value={task.progress}
                  onValueChange={handleProgressChange}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não iniciado">Não iniciado</SelectItem>
                    <SelectItem value="Em andamento">Em andamento</SelectItem>
                    <SelectItem value="Concluído">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority */}
            <div>
              <Label className="text-xs text-muted-foreground">Prioridade</Label>
              <Select
                value={task.priority}
                onValueChange={handlePriorityChange}
              >
                <SelectTrigger className="mt-1 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div>
              <Label className="text-xs text-muted-foreground">Responsável</Label>
              <Select
                value={task.assignee_id || ""}
                onValueChange={handleAssigneeChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal text-sm", !task.start_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {task.start_date ? format(new Date(task.start_date), "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={task.start_date ? new Date(task.start_date) : undefined}
                      onSelect={(d) => updateTask.mutate({ id: task.id, start_date: d?.toISOString() ?? null } as any)}
                      locale={ptBR}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Prazo Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal text-sm", !task.due_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {task.due_date ? format(new Date(task.due_date), "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={task.due_date ? new Date(task.due_date) : undefined}
                      onSelect={(d) => updateTask.mutate({ id: task.id, due_date: d?.toISOString() ?? null } as any)}
                      locale={ptBR}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Milestone Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-amber-50/50 dark:bg-amber-950/10">
              <div className="flex items-center gap-2">
                <Diamond className="h-4 w-4 text-amber-500 fill-amber-500" />
                <div>
                  <Label className="text-sm font-medium">Milestone</Label>
                  <p className="text-[11px] text-muted-foreground">Marcar como entrega crítica</p>
                </div>
              </div>
              <Switch
                checked={task.is_milestone ?? false}
                onCheckedChange={(checked) => {
                  updateTask.mutate({ id: task.id, is_milestone: checked } as any);
                  logHistory("Milestone", checked ? "Marcada como milestone" : "Desmarcada como milestone");
                }}
              />
            </div>

            {/* Story Points */}
            <div>
              <Label className="text-xs text-muted-foreground">Story Points</Label>
              <Input
                type="number"
                min={0}
                value={(task as any).story_points || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || null;
                  updateTask.mutate({ id: task.id, story_points: val } as any);
                }}
                placeholder="0"
                className="h-8 w-24 mt-1 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <div className="mt-1">
                <MarketingTagSelector taskId={task.id} />
              </div>
            </div>

            {/* Checklist / Subtarefas */}
            <div>
              <Label className="text-xs text-muted-foreground">
                Subtarefas {checklist.length > 0 && `(${completedCount}/${checklist.length})`}
              </Label>
              {checklist.length > 0 && (
                <Progress value={checklistProgress} className="mt-1 h-2" />
              )}
              <div className="mt-2 space-y-1">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleChecklistItem(item.id)}
                    />
                    <span
                      className={`flex-1 text-sm ${
                        item.completed ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {item.text}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => removeChecklistItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Adicionar subtarefa..."
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="outline" onClick={addChecklistItem} disabled={!newChecklistItem.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Recurrence */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Tarefa Recorrente</Label>
                  <p className="text-xs text-muted-foreground">
                    {task.is_recurring && task.recurrence_rule
                      ? `${task.recurrence_rule === 'daily' ? 'Diária' : task.recurrence_rule === 'weekly' ? 'Semanal' : 'Mensal'}`
                      : 'Desativada'}
                  </p>
                </div>
              </div>
              <Switch
                checked={task.is_recurring}
                onCheckedChange={(checked) => {
                  const rule = task.recurrence_rule || 'weekly';
                  let nextDate: string | null = null;
                  if (checked) {
                    const base = task.due_date ? new Date(task.due_date) : new Date();
                    const next = new Date(base);
                    if (rule === 'daily') next.setDate(next.getDate() + 1);
                    else if (rule === 'weekly') next.setDate(next.getDate() + 7);
                    else next.setMonth(next.getMonth() + 1);
                    nextDate = next.toISOString();
                  }
                  updateTask.mutate({
                    id: task.id,
                    is_recurring: checked,
                    recurrence_rule: checked ? rule : null,
                    next_recurrence_date: nextDate,
                  } as any);
                  logHistory("Recorrência", checked ? "Ativada" : "Desativada");
                }}
              />
            </div>
            {task.is_recurring && (
              <div>
                <Label className="text-xs text-muted-foreground">Frequência</Label>
                <Select
                  value={task.recurrence_rule || "weekly"}
                  onValueChange={(val) => {
                    const base = task.due_date ? new Date(task.due_date) : new Date();
                    const next = new Date(base);
                    if (val === 'daily') next.setDate(next.getDate() + 1);
                    else if (val === 'weekly') next.setDate(next.getDate() + 7);
                    else next.setMonth(next.getMonth() + 1);
                    updateTask.mutate({
                      id: task.id,
                      recurrence_rule: val,
                      next_recurrence_date: next.toISOString(),
                    } as any);
                    logHistory("Frequência de recorrência", `Alterada para ${val === 'daily' ? 'Diária' : val === 'weekly' ? 'Semanal' : 'Mensal'}`);
                  }}
                >
                  <SelectTrigger className="mt-1 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diária</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Requester */}
            <div>
              <Label className="text-xs text-muted-foreground">Solicitante</Label>
              <p className="mt-1 text-sm">
                {task.requester_name || "Não informado"}
              </p>
            </div>

            {/* Comments & History Tabs */}
            <Tabs defaultValue="comments" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="comments" className="flex-1 gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comentários
                  {comments && comments.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {comments.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="comments" className="space-y-3 mt-3">
                {/* Comment input */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Escreva um comentário..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendComment();
                      }
                    }}
                    className="min-h-[60px] text-sm"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendComment}
                    disabled={!commentText.trim() || addComment.isPending}
                    className="shrink-0 self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {/* Comment list */}
                <div className="space-y-3">
                  {(!comments || comments.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum comentário ainda
                    </p>
                  )}
                  {(comments || []).map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <UserAvatar
                        name={c.author_name}
                        avatarUrl={c.avatar_url}
                        className="h-7 w-7 text-[10px] shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium truncate">{c.author_name}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-0.5">
                          {c.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-3">
                <div className="space-y-2">
                  {(!history || history.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma atividade registrada
                    </p>
                  )}
                  {(history || []).map((h) => (
                    <div key={h.id} className="flex gap-2.5 py-1.5 border-b border-border/50 last:border-0">
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{h.author_name}</span>
                          {" — "}
                          <span className="text-muted-foreground">{h.action}</span>
                        </p>
                        {h.details && (
                          <p className="text-xs text-muted-foreground mt-0.5">{h.details}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(h.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Tarefa</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Motivo da reprovação *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Descreva o que precisa ser ajustado..."
              className="mt-2"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
