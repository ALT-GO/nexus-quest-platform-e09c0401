import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Check,
  X,
  CalendarIcon,
  MessageSquare,
  History,
  Send,
  Repeat,
  Diamond,
  Clock,
  User,
  Flag,
  Tag,
  Timer,
  ChevronDown,
  ChevronRight,
  Link2,
  Target,
  Hash,
  Eye,
  EyeOff,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ChecklistEditor } from "./ChecklistEditor";
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
import { TimerReminderBanner } from "@/components/shared/TimerReminderBanner";
import { useMarketingTimesheet } from "@/hooks/use-timesheet";
import { useAuth } from "@/hooks/use-auth";
import { notifyTaskCreator, notifyAdminsForApproval } from "@/lib/marketing-notifications";
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
import { CommentInput } from "@/components/shared/CommentInput";
import { useTaskDependencies, isTaskBlocked } from "@/hooks/use-dependencies";
import { useMarketingTasks } from "@/hooks/use-marketing";
import { DependencySection } from "./DependencySection";
import { useMarketingTaskTypes } from "@/hooks/use-task-types";
import { DynamicLucideIcon } from "@/components/ui/dynamic-icon";
import { useTaskLinks, useAddTaskLink, useRemoveTaskLink } from "@/hooks/use-task-links";
import { useMarketingEvents } from "@/hooks/use-events";
import { CalendarIcon as CalendarEventIcon } from "lucide-react";

interface Props {
  task: MarketingTask | null;
  stages: MarketingStage[];
  teamMembers: { id: string; name: string; avatar_url?: string | null }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const priorityColors: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-warning",
  high: "text-destructive",
};

const progressOptions = [
  { value: "Não iniciado", label: "NÃO INICIADO", color: "bg-muted-foreground" },
  { value: "Em andamento", label: "EM PROGRESSO", color: "bg-primary" },
  { value: "Concluído", label: "CONCLUÍDO", color: "bg-success" },
];

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

  const display = (currentMinutes && currentMinutes > 0)
    ? `${Math.floor(currentMinutes / 60)}h ${currentMinutes % 60}m`
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-sm hover:text-foreground transition-colors text-left">
          {display || <span className="text-muted-foreground">Vazio</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="h"
            value={hours || ""}
            onChange={(e) => { const h = parseInt(e.target.value) || 0; setHours(h); debouncedSave(h, mins); }}
            className="h-8 w-16 text-sm"
          />
          <span className="text-xs text-muted-foreground">h</span>
          <Input
            type="number"
            min={0}
            max={59}
            placeholder="m"
            value={mins || ""}
            onChange={(e) => { const m = Math.min(59, parseInt(e.target.value) || 0); setMins(m); debouncedSave(hours, m); }}
            className="h-8 w-16 text-sm"
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Property Row ─── */
function PropRow({ icon: Icon, label, children, isEmpty, tooltip }: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  tooltip?: string;
}) {
  const labelContent = (
    <div className="flex items-center gap-2 w-[160px] shrink-0">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
    </div>
  );

  return (
    <div className="flex items-center py-2 min-h-[36px] group">
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{labelContent}</div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[220px] text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : (
        labelContent
      )}
      <div className="flex-1 min-w-0">{children}</div>
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
  const [commentText, setCommentText] = useState("");
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null } | null>(null);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [activityTab, setActivityTab] = useState<"activity" | "comments">("comments");
  const [mobileView, setMobileView] = useState<"details" | "activity">("details");

  useEffect(() => {
    if (task) {
      setTitleValue(task.title);
      setDescValue(task.description || "");
      setEditingTitle(false);
      setEditingDesc(false);
    }
  }, [task]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  const { data: comments } = useMarketingComments(task?.id);
  const addComment = useAddMarketingComment();
  const { data: history } = useMarketingHistory(task?.id);
  const addHistory = useAddMarketingHistory();
  const { data: allDeps } = useTaskDependencies();
  const { data: allTasks } = useMarketingTasks();
  const { data: taskTypes } = useMarketingTaskTypes();
  const { data: taskLinks } = useTaskLinks(task?.id ?? null);
  const addTaskLink = useAddTaskLink();
  const removeTaskLink = useRemoveTaskLink();
  const { data: allEvents } = useMarketingEvents();
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  if (!task) return null;

  const currentStage = stages.find((s) => s.id === task.stage_id);
  const isPendingApproval = currentStage?.meta_status === "pending_approval";
  const canApprove = isPendingApproval && isAdmin;
  const authorName = profile?.full_name || "Usuário";
  const currentTaskType = task.task_type_id && taskTypes ? taskTypes.find(t => t.id === task.task_type_id) : null;
  const currentProgress = progressOptions.find(p => p.value === task.progress) || progressOptions[0];

  const logHistory = (action: string, details: string) => {
    addHistory.mutate({ task_id: task.id, author_name: authorName, action, details });
  };

  const handleStageChange = (val: string) => {
    const newStage = stages.find((s) => s.id === val);
    const oldStage = stages.find((s) => s.id === task.stage_id);
    updateTask.mutate({ id: task.id, stage_id: val });
    logHistory("Mudança de etapa", `${oldStage?.name || "—"} → ${newStage?.name || "—"}`);
    if (newStage?.meta_status === "pending_approval") {
      notifyAdminsForApproval({ taskTitle: task.title, taskId: task.id, excludeUserId: user?.id });
    }
  };

  const handlePriorityChange = (val: string) => {
    updateTask.mutate({ id: task.id, priority: val });
    logHistory("Mudança de prioridade", `${priorityLabels[task.priority] || task.priority} → ${priorityLabels[val] || val}`);
  };

  const handleAssigneeChange = (val: string) => {
    const member = teamMembers.find((m) => m.id === val);
    updateTask.mutate({ id: task.id, assignee_id: val, assignee_name: member?.name || "" });
    logHistory("Mudança de responsável", `${task.assignee_name || "—"} → ${member?.name || "—"}`);
  };

  const handleProgressChange = (val: string) => {
    if (val === "Concluído" && allDeps && allTasks) {
      const progressMap: Record<string, string> = {};
      allTasks.forEach((t) => { progressMap[t.id] = t.progress; });
      if (isTaskBlocked(task.id, allDeps, progressMap)) {
        toast.error("Esta tarefa possui dependências não concluídas. Resolva-as antes de concluir.");
        return;
      }
    }
    const completionData = val === "Concluído"
      ? { completed_at: new Date().toISOString(), completed_by: authorName }
      : { completed_at: null, completed_by: null };
    updateTask.mutate({ id: task.id, progress: val, ...completionData } as any);
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
    if (task.assignee_id && task.assignee_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: task.assignee_id,
        title: "Novo comentário",
        message: `${authorName} comentou na tarefa "${task.title}"`,
        type: "info",
        link: "/marketing/solicitacoes",
        scope: "marketing",
      } as any);
    }
    setCommentText("");
    toast.success("Comentário adicionado");
  };

  const handleApprove = async () => {
    // Find the next stage after the current approval stage (by order_index)
    const currentIdx = currentStage?.order_index ?? 0;
    const nextStage = stages
      .filter((s) => s.order_index > currentIdx)
      .sort((a, b) => a.order_index - b.order_index)[0];

    const targetStageId = nextStage?.id || task.stage_id;

    await supabase.from("marketing_tasks")
      .update({ stage_id: targetStageId, updated_at: new Date().toISOString() } as any)
      .eq("id", task.id);
    logHistory("Aprovação", `Tarefa aprovada por ${authorName}${nextStage ? ` e movida para "${nextStage.name}"` : ""}`);
    if (task.requester_id) notifyTaskCreator({ creatorId: task.requester_id, taskTitle: task.title, taskId: task.id, approved: true });
    qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
    toast.success(nextStage ? `Tarefa aprovada e movida para "${nextStage.name}"` : "Tarefa aprovada");
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    const currentStage = stages.find((s) => s.id === task.stage_id);
    const previousStage = stages
      .filter((s) => s.order_index < (currentStage?.order_index ?? 0))
      .sort((a, b) => b.order_index - a.order_index)[0];
    if (!previousStage) { toast.error("Não há etapa anterior para devolver"); return; }
    await supabase.from("marketing_tasks")
      .update({ stage_id: previousStage.id, progress: "Em andamento", updated_at: new Date().toISOString() } as any)
      .eq("id", task.id);
    logHistory("Reprovação", `Tarefa reprovada por ${authorName}. Motivo: ${rejectReason}`);
    // Add rejection reason as a comment
    if (user) {
      await addComment.mutateAsync({
        task_id: task.id,
        author_id: user.id,
        author_name: authorName,
        avatar_url: profile?.avatar_url || null,
        content: `❌ **Reprovação:** ${rejectReason.trim()}`,
      });
    }
    if (task.requester_id) notifyTaskCreator({ creatorId: task.requester_id, taskTitle: task.title, taskId: task.id, approved: false, reason: rejectReason });
    qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
    toast.success("Tarefa reprovada e devolvida para ajustes");
    setRejectDialogOpen(false);
    setRejectReason("");
    onOpenChange(false);
  };

  const handleSaveTitle = () => {
    if (titleValue.trim() && titleValue !== task.title) {
      updateTask.mutate({ id: task.id, title: titleValue.trim() });
      logHistory("Título alterado", `"${task.title}" → "${titleValue.trim()}"`);
    }
    setEditingTitle(false);
  };

  const handleSaveDesc = () => {
    if (descValue !== task.description) {
      updateTask.mutate({ id: task.id, description: descValue });
      logHistory("Descrição atualizada", "Descrição alterada");
    }
    setEditingDesc(false);
  };

  // Render @mentions with highlight
  const renderMentionText = (text: string) => {
    const parts = text.split(/(@\S+)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-primary font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // Merged activity feed (comments + history)
  const activityFeed = [
    ...(comments || []).map(c => ({
      type: "comment" as const,
      id: c.id,
      author: c.author_name,
      avatar: c.avatar_url,
      content: c.content,
      date: new Date(c.created_at),
    })),
    ...(history || []).map(h => ({
      type: "history" as const,
      id: h.id,
      author: h.author_name,
      avatar: null as string | null,
      content: `${h.action}: ${h.details}`,
      date: new Date(h.created_at),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const hasAssignee = !!task.assignee_name;
  const hasDates = !!task.start_date || !!task.due_date;
  const hasTimeEstimate = !!task.time_estimate_minutes;
  const hasTags = true; // always show
  const hasRecurrence = task.is_recurring;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[1100px] p-0 flex flex-col sm:flex-row gap-0 overflow-hidden" side="right">
         <TooltipProvider delayDuration={300}>
          {/* ─── Mobile Tab Bar ─── */}
          <div className="flex sm:hidden border-b bg-muted/30 shrink-0">
            <button
              className={cn("flex-1 py-2.5 text-sm font-medium transition-colors", mobileView === "details" ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}
              onClick={() => setMobileView("details")}
            >
              Detalhes
            </button>
            <button
              className={cn("flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5", mobileView === "activity" ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}
              onClick={() => setMobileView("activity")}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Atividade
            </button>
          </div>

          {/* ─── LEFT: Main Content ─── */}
          <ScrollArea className={cn("flex-1 min-w-0", mobileView !== "details" && "hidden sm:block")}>
            <div className="p-4 sm:p-6 space-y-1">
              {/* Timer reminder banner */}
              <TimerReminderBanner
                entityId={task.id}
                type="marketing"
                onStartTimer={async () => {
                  const { autoStartTimer } = await import("@/hooks/use-timesheet");
                  autoStartTimer(task.id, "marketing");
                  // Also set progress to Em andamento
                  updateTask.mutate({ id: task.id, progress: "Em andamento" });
                }}
              />
              {/* Top bar: Task type + ID */}
              <div className="flex items-center gap-2 mb-2">
                {/* Task type selector */}
                {taskTypes && taskTypes.length > 0 && (
                  <Select
                    value={task.task_type_id || ""}
                    onValueChange={(val) => {
                      updateTask.mutate({ id: task.id, task_type_id: val || null } as any);
                      const typeName = taskTypes.find(t => t.id === val)?.name || "—";
                      logHistory("Tipo alterado", `Tipo → ${typeName}`);
                    }}
                  >
                    <SelectTrigger className="w-auto h-7 text-xs gap-1 border-none shadow-none bg-muted/50 px-2">
                      {currentTaskType ? (
                        <span className="flex items-center gap-1.5">
                          <DynamicLucideIcon name={currentTaskType.icon} className="h-3.5 w-3.5" style={{ color: `hsl(${currentTaskType.color})` }} />
                          {currentTaskType.name}
                        </span>
                      ) : (
                        <SelectValue placeholder="Tarefa" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {taskTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <DynamicLucideIcon name={t.icon} className="h-3.5 w-3.5" style={{ color: `hsl(${t.color})` }} />
                            {t.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <span className="text-xs text-muted-foreground font-mono">{task.id.slice(0, 8)}</span>

                <div className="flex-1" />

                <span className="text-xs text-muted-foreground">
                  Criada em {format(new Date(task.created_at), "d MMM", { locale: ptBR })}
                </span>
              </div>

              {/* Title — large, editable */}
              {editingTitle ? (
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                  autoFocus
                  className="text-2xl font-bold border-none shadow-none p-0 h-auto focus-visible:ring-0"
                />
              ) : (
                <h1
                  className="text-2xl font-bold cursor-pointer hover:text-primary/80 transition-colors"
                  onClick={() => setEditingTitle(true)}
                >
                  {task.is_milestone && <Diamond className="inline h-5 w-5 text-warning fill-warning mr-1.5 -mt-1" />}
                  {task.title}
                </h1>
              )}

              {/* Approval Banner */}
              {canApprove && (
                <div className="rounded-lg border-2 border-warning bg-warning/10 p-4 mt-3">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <span className="font-semibold">Aprovação Necessária</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleApprove} className="flex-1 bg-success hover:bg-success/90 text-white">
                      <Check className="h-4 w-4 mr-2" /> Aprovar
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => setRejectDialogOpen(true)}>
                      <X className="h-4 w-4 mr-2" /> Reprovar
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── Properties Grid ─── */}
              <div className="mt-4 space-y-0 divide-y divide-border/50">
                {/* Status */}
                <PropRow icon={Target} label="Status" tooltip="Estado atual da tarefa: não iniciado, em progresso ou concluído">
                  <Select value={task.progress} onValueChange={handleProgressChange}>
                    <SelectTrigger className="w-auto h-7 border-none shadow-none gap-1.5 px-0">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white",
                        currentProgress.color
                      )}>
                        {currentProgress.label}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {progressOptions.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          <span className="flex items-center gap-2">
                            <span className={cn("h-2.5 w-2.5 rounded-full", p.color)} />
                            {p.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropRow>

                {/* Stage */}
                <PropRow icon={Hash} label="Etapa" tooltip="Coluna do Kanban onde a tarefa se encontra no fluxo de trabalho">
                  <Select value={task.stage_id || ""} onValueChange={handleStageChange}>
                    <SelectTrigger className="w-auto h-7 border-none shadow-none px-0 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </PropRow>

                {/* Assignee */}
                {(!hideEmpty || hasAssignee) && (
                  <PropRow icon={User} label="Responsáveis" isEmpty={!hasAssignee} tooltip="Membro da equipe responsável por executar esta tarefa">
                    <Select value={task.assignee_id || ""} onValueChange={handleAssigneeChange}>
                      <SelectTrigger className="w-auto h-7 border-none shadow-none px-0 text-sm">
                        {task.assignee_name ? (
                          <span className="flex items-center gap-1.5">
                            <UserAvatar name={task.assignee_name} avatarUrl={teamMembers.find(m => m.id === task.assignee_id)?.avatar_url || undefined} className="h-5 w-5" fallbackClassName="text-[9px]" />
                            {task.assignee_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Vazio</span>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="flex items-center gap-1.5">
                              <UserAvatar name={m.name} avatarUrl={m.avatar_url || undefined} className="h-5 w-5" fallbackClassName="text-[9px]" />
                              {m.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </PropRow>
                )}

                {/* Dates */}
                {(!hideEmpty || hasDates) && (
                  <PropRow icon={CalendarIcon} label="Datas" isEmpty={!hasDates} tooltip="Data de início e data de vencimento da tarefa">
                    <div className="flex items-center gap-2 text-sm">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="hover:text-foreground transition-colors">
                            {task.start_date ? (
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {format(new Date(task.start_date), "dd/MM/yy")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" /> Início
                              </span>
                            )}
                          </button>
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
                      <span className="text-muted-foreground">→</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="hover:text-foreground transition-colors">
                            {task.due_date ? (
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {format(new Date(task.due_date), "dd/MM/yy")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" /> Vencimento
                              </span>
                            )}
                          </button>
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
                  </PropRow>
                )}

                {/* Priority */}
                <PropRow icon={Flag} label="Prioridade" tooltip="Nível de urgência: baixa, média ou alta">
                  <Select value={task.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="w-auto h-7 border-none shadow-none px-0 text-sm">
                      <span className={cn("flex items-center gap-1.5", priorityColors[task.priority])}>
                        <Flag className="h-3.5 w-3.5" />
                        {priorityLabels[task.priority]}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </PropRow>

                {/* Time estimate */}
                {(!hideEmpty || hasTimeEstimate) && (
                  <PropRow icon={Clock} label="Tempo estimado" isEmpty={!hasTimeEstimate} tooltip="Tempo previsto para conclusão da tarefa">
                    <TimeEstimateField taskId={task.id} currentMinutes={task.time_estimate_minutes} updateTask={updateTask} />
                  </PropRow>
                )}

                {/* Timer / Time tracked */}
                <PropRow icon={Timer} label="Tempo rastreado" tooltip="Tempo real registrado via cronômetro enquanto trabalha na tarefa">
                  <MarketingTimerButton taskId={task.id} size="detail" />
                </PropRow>

                {/* Tags */}
                <PropRow icon={Tag} label="Etiquetas" tooltip="Tags de categorização para filtrar e organizar tarefas">
                  <MarketingTagSelector taskId={task.id} />
                </PropRow>

                {/* Dependencies / Relationships */}
                {allDeps && allTasks && (
                  <PropRow icon={Link2} label="Relacionamentos" tooltip="Dependências entre tarefas: bloquear ou aguardar outra tarefa">
                    <DependencySection task={task} allTasks={allTasks} dependencies={allDeps} />
                  </PropRow>
                )}

                {/* Links (tasks + events) */}
                <PropRow icon={Link2} label="Links" tooltip="Vincule esta tarefa a outras tarefas ou eventos relacionados">
                  <div className="space-y-1.5">
                    {(taskLinks || []).map((link) => {
                      const isOutgoing = link.task_id === task.id;
                      if (link.linked_event_id) {
                        const evt = allEvents?.find(e => e.id === link.linked_event_id);
                        return (
                          <div key={link.id} className="flex items-center gap-2 group">
                            <Badge variant="outline" className="text-xs gap-1">
                              <CalendarEventIcon className="h-3 w-3" />
                              {evt?.name || "Evento"}
                            </Badge>
                            <button onClick={() => removeTaskLink.mutate(link.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      }
                      const linkedId = isOutgoing ? link.linked_task_id : link.task_id;
                      const linkedTask = allTasks?.find(t => t.id === linkedId);
                      return (
                        <div key={link.id} className="flex items-center gap-2 group">
                          <Badge variant="outline" className="text-xs gap-1">
                            <Hash className="h-3 w-3" />
                            {linkedTask?.title || "Tarefa"}
                          </Badge>
                          <button onClick={() => removeTaskLink.mutate(link.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                    <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                          <Link2 className="h-3 w-3" /> Adicionar link
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" align="start">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground px-1 py-1">Tarefas</p>
                          <div className="max-h-32 overflow-y-auto space-y-0.5">
                            {(allTasks || []).filter(t => t.id !== task.id && !(taskLinks || []).some(l => l.linked_task_id === t.id || (l.task_id === t.id && l.linked_task_id === task.id))).slice(0, 20).map(t => (
                              <button key={t.id} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate"
                                onClick={() => { addTaskLink.mutate({ task_id: task.id, linked_task_id: t.id }); setLinkPopoverOpen(false); }}>
                                {t.title}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs font-medium text-muted-foreground px-1 py-1 border-t mt-1 pt-1">Eventos</p>
                          <div className="max-h-32 overflow-y-auto space-y-0.5">
                            {(allEvents || []).filter(e => !(taskLinks || []).some(l => l.linked_event_id === e.id)).map(e => (
                              <button key={e.id} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate"
                                onClick={() => { addTaskLink.mutate({ task_id: task.id, linked_event_id: e.id }); setLinkPopoverOpen(false); }}>
                                <CalendarEventIcon className="h-3 w-3 inline mr-1" />{e.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </PropRow>

                {/* Story Points */}
                <PropRow icon={Target} label="Story Points" tooltip="Pontos de esforço estimado para planejamento de sprints (método ágil)">
                  <Input
                    type="number"
                    min={0}
                    value={(task as any).story_points || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || null;
                      updateTask.mutate({ id: task.id, story_points: val } as any);
                    }}
                    placeholder="0"
                    className="h-7 w-20 text-sm border-none shadow-none px-0"
                  />
                </PropRow>

                {/* Milestone */}
                <PropRow icon={Diamond} label="Milestone" tooltip="Marque como marco importante para destacar entregas-chave do projeto">
                  <Switch
                    checked={task.is_milestone ?? false}
                    onCheckedChange={(checked) => {
                      updateTask.mutate({ id: task.id, is_milestone: checked } as any);
                      logHistory("Milestone", checked ? "Marcada como milestone" : "Desmarcada como milestone");
                    }}
                  />
                </PropRow>

                {/* Recurrence */}
                <PropRow icon={Repeat} label="Recorrência" tooltip="Ative para que esta tarefa se repita automaticamente (diária, semanal ou mensal)">
                  <div className="flex items-center gap-2">
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
                        updateTask.mutate({ id: task.id, is_recurring: checked, recurrence_rule: checked ? rule : null, next_recurrence_date: nextDate } as any);
                        logHistory("Recorrência", checked ? "Ativada" : "Desativada");
                      }}
                    />
                    {task.is_recurring && (
                      <Select
                        value={task.recurrence_rule || "weekly"}
                        onValueChange={(val) => {
                          const base = task.due_date ? new Date(task.due_date) : new Date();
                          const next = new Date(base);
                          if (val === 'daily') next.setDate(next.getDate() + 1);
                          else if (val === 'weekly') next.setDate(next.getDate() + 7);
                          else next.setMonth(next.getMonth() + 1);
                          updateTask.mutate({ id: task.id, recurrence_rule: val, next_recurrence_date: next.toISOString() } as any);
                          logHistory("Frequência", `→ ${val === 'daily' ? 'Diária' : val === 'weekly' ? 'Semanal' : 'Mensal'}`);
                        }}
                      >
                        <SelectTrigger className="w-auto h-7 border-none shadow-none px-0 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Diária</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </PropRow>

                {/* Completed info */}
                {task.progress === "Concluído" && (task as any).completed_at && (
                  <PropRow icon={Check} label="Concluído em" tooltip="Data e hora em que esta tarefa foi marcada como concluída">
                    <span className="text-sm text-success font-medium">
                      {format(new Date((task as any).completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {(task as any).completed_by && (
                        <span className="text-muted-foreground font-normal ml-2">por {(task as any).completed_by}</span>
                      )}
                    </span>
                  </PropRow>
                )}
              </div>

              {/* Hide empty toggle */}
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                onClick={() => setHideEmpty(!hideEmpty)}
              >
                {hideEmpty ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {hideEmpty ? "Mostrar propriedades vazias" : "Ocultar propriedades vazias"}
              </button>

              {/* ─── Description ─── */}
              <div className="mt-6">
                {editingDesc ? (
                  <div className="space-y-2">
                    <Textarea
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      autoFocus
                      rows={4}
                      className="text-sm"
                      placeholder="Adicionar descrição..."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveDesc}>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setDescValue(task.description || ""); setEditingDesc(false); }}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-sm text-muted-foreground hover:bg-muted/30 rounded-md p-2 cursor-pointer transition-colors min-h-[40px]"
                    onClick={() => setEditingDesc(true)}
                  >
                    {task.description ? (
                      <p className="text-foreground whitespace-pre-wrap">{task.description}</p>
                    ) : (
                      <p>Adicionar descrição</p>
                    )}
                  </div>
                )}
              </div>

              {/* ─── Checklist ─── */}
              <div className="mt-6">
                <ChecklistEditor
                  value={task.checklist}
                  onChange={(groups) => updateTask.mutate({ id: task.id, checklist: groups } as any)}
                  teamMembers={teamMembers}
                />
              </div>

              {/* Requester */}
              <div className="mt-6 text-xs text-muted-foreground">
                Solicitante: {task.requester_name || "Não informado"}
              </div>
            </div>
          </ScrollArea>

          {/* ─── RIGHT: Activity Sidebar ─── */}
          <div className={cn("w-full sm:w-[360px] shrink-0 sm:border-l flex flex-col bg-muted/20 overflow-hidden", mobileView !== "activity" && "hidden sm:flex")}>
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Atividade</h3>
              <div className="flex items-center gap-1">
                <button
                  className={cn(
                    "text-xs px-2 py-1 rounded transition-colors",
                    activityTab === "activity" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActivityTab("activity")}
                >
                  Tudo
                </button>
                <button
                  className={cn(
                    "text-xs px-2 py-1 rounded transition-colors",
                    activityTab === "comments" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActivityTab("comments")}
                >
                  Comentários
                </button>
              </div>
            </div>

            {/* Activity feed */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {activityFeed.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atividade ainda</p>
                )}
                {activityFeed
                  .filter(item => activityTab === "activity" || item.type === "comment")
                  .map((item) => (
                    <div key={item.id} className="flex gap-2.5">
                      <UserAvatar
                        name={item.author}
                        avatarUrl={item.avatar}
                        className="h-6 w-6 shrink-0 mt-0.5"
                        fallbackClassName="text-[9px]"
                      />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-medium truncate">{item.author}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(item.date, { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className={cn(
                          "text-xs mt-0.5 whitespace-pre-wrap break-all overflow-hidden [overflow-wrap:anywhere]",
                          item.type === "comment" ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {item.type === "comment"
                            ? renderMentionText(item.content)
                            : item.content}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>

            {/* Comment input — always visible at bottom */}
            <div className="border-t p-3">
              <CommentInput
                value={commentText}
                onChange={setCommentText}
                onSend={handleSendComment}
                disabled={!commentText.trim() || addComment.isPending}
                teamMembers={teamMembers.map(m => ({ id: m.id, name: m.name }))}
              />
            </div>
          </div>
         </TooltipProvider>
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
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
