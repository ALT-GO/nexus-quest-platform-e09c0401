import { useState, useEffect, useRef, useCallback } from "react";
import { DevolutionChecklistDialog } from "@/components/servicedesk/DevolutionChecklistDialog";
import { AttachmentManager } from "@/components/shared/AttachmentManager";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { SlaIndicator } from "@/components/sla/SlaIndicator";
import { AssetLinker } from "@/components/servicedesk/AssetLinker";
import { supabase } from "@/integrations/supabase/client";
import { useTimesheet, formatDuration } from "@/hooks/use-timesheet";
import { TimerReminderBanner } from "@/components/shared/TimerReminderBanner";
import { useTicketComments } from "@/hooks/use-ticket-comments";
import { CommentInput } from "@/components/shared/CommentInput";
import { MentionText } from "@/components/shared/MentionText";
import { useTicketHistory } from "@/hooks/use-ticket-history";
import { StatusCustom } from "@/hooks/use-custom-status";
import { HardwareAsset } from "@/hooks/use-assets";
import { SlaInfo } from "@/hooks/use-sla";
import { Ticket, ChecklistItem } from "@/hooks/use-tickets";
import {
  CheckCircle2,
  Send,
  Clock,
  User,
  Tag,
  MessageSquare,
  History,
  AlertTriangle,
  CalendarDays,
  Loader2,
  Play,
  Pause,
  Timer,
  ListChecks,
  Square,
  CheckSquare,
  Circle,
  Trash2,
  FileText,
  Target,
  Flag,
  Eye,
  EyeOff,
  Hash,
  Mail,
  Building,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

/* ─── Checklist Section (unchanged logic) ─── */
function ChecklistSection({
  items, checkedCount, progressPercent, isCompleted,
  onToggle, onDelete, onEdit, onAdd,
}: {
  items: ChecklistItem[]; checkedCount: number; progressPercent: number; isCompleted: boolean;
  onToggle: (idx: number) => void; onDelete: (idx: number) => void;
  onEdit: (idx: number, text: string) => void; onAdd: (text: string) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const startEdit = (idx: number, text: string) => { setEditingIdx(idx); setEditText(text); };
  const commitEdit = () => { if (editingIdx !== null) { onEdit(editingIdx, editText); setEditingIdx(null); } };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <ListChecks className="h-3 w-3" />
          Lista de verificação {items.length > 0 ? `${checkedCount} / ${items.length}` : ""}
        </label>
      </div>
      {items.length > 0 && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      )}
      <div className="space-y-0.5">
        {items.map((item, idx) => (
          <div key={idx} className="group flex items-center gap-2.5 w-full px-1 py-1.5 text-sm hover:bg-muted/50 rounded transition-colors">
            <button onClick={() => onToggle(idx)} className="flex-shrink-0">
              {item.checked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground/50" />}
            </button>
            {editingIdx === idx ? (
              <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={commitEdit}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingIdx(null); }}
                autoFocus className="flex-1 bg-transparent text-sm outline-none border-b border-primary" />
            ) : (
              <span className={cn("flex-1 cursor-default", item.checked && "line-through text-muted-foreground")}
                onDoubleClick={() => !isCompleted && startEdit(idx, item.text)}>{item.text}</span>
            )}
            {!isCompleted && editingIdx !== idx && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
                className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {!isCompleted && (
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <Circle className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
            <input type="text" placeholder="Adicionar um item"
              className="flex-1 bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                  onAdd((e.target as HTMLInputElement).value.trim());
                  (e.target as HTMLInputElement).value = "";
                }
              }} />
          </div>
        )}
      </div>
    </div>
  );
}

const categories = [
  "Acesso e permissões", "Problemas com Computador/Notebook", "Problemas com Celular/Tablet",
  "Rede e Internet", "E-mail e Comunicação", "Serviços de Impressão", "Sistemas Corporativos",
  "Solicitação de novo Computador/Notebook", "Solicitação de novo Celular", "Solicitação de Tablet",
  "Solicitação de nova Linha", "Gerais/Outros",
];

/* ─── Property Row ─── */
function PropRow({ icon: Icon, label, children }: {
  icon: React.ElementType; label: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center py-2 min-h-[36px]">
      <div className="flex items-center gap-2 w-[160px] shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

interface TicketDetailSheetProps {
  ticket: Ticket | null;
  subtasks?: Ticket[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: StatusCustom[];
  isFinalStatus: (statusId: string) => boolean;
  getSlaInfo: (createdAt: string, category: string, isCompleted: boolean) => SlaInfo;
  getAvailableForCategory: (category: string) => HardwareAsset[];
  getAsset: (id: string) => HardwareAsset | undefined;
  onLinkAsset: (ticketId: string, assetId: string) => void;
  onStatusChange: (ticketId: string, newStatusId: string) => void;
  onUpdateTicket: (id: string, updates: Partial<Pick<Ticket, "title" | "description" | "assignee" | "priority" | "category" | "sla_deadline">>) => Promise<boolean>;
}

const progressConfig = [
  { value: "not_started", label: "Não Iniciado", color: "bg-muted-foreground", icon: Circle },
  { value: "in_progress", label: "Em Andamento", color: "bg-primary", icon: Loader2 },
  { value: "completed", label: "Concluído", color: "bg-green-500", icon: CheckCircle2 },
];

export function TicketDetailSheet({
  ticket, subtasks = [], open, onOpenChange, statuses, isFinalStatus,
  getSlaInfo, getAvailableForCategory, getAsset, onLinkAsset, onStatusChange, onUpdateTicket,
}: TicketDetailSheetProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDevolutionChecklist, setShowDevolutionChecklist] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [activityTab, setActivityTab] = useState<"activity" | "comments">("comments");
  const [mobileView, setMobileView] = useState<"details" | "activity">("details");
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [technicians, setTechnicians] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [currentUserName, setCurrentUserName] = useState("Admin");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  const { comments, loading: commentsLoading, addComment } = useTicketComments(ticket?.id ?? null);
  const { history, loading: historyLoading, logHistory } = useTicketHistory(ticket?.id ?? null);
  const { running: timerRunning, totalSeconds, start: startTimer, pause: pauseTimer, stop: stopTimer } = useTimesheet(ticket?.id ?? null);

  useEffect(() => {
    const fetchTechnicians = async () => {
      // Fetch TI + admin members using the role-filtered function
      const [{ data: ti }, { data: adm }] = await Promise.all([
        supabase.rpc("get_profiles_by_role", { _role: "ti" }),
        supabase.rpc("get_profiles_by_role", { _role: "admin" }),
      ]);
      const all = [...(ti || []), ...(adm || [])];
      const unique = Array.from(new Map(all.map(p => [p.id, p])).values());
      setTechnicians(unique.filter(p => p.full_name).map(p => ({ id: p.id, name: p.full_name, avatar_url: p.avatar_url })).sort((a, b) => a.name.localeCompare(b.name)));
    };
    fetchTechnicians();
    // Fetch current user profile
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single().then(({ data }) => {
          if (data) {
            setCurrentUserName(data.full_name || "Admin");
            setCurrentUserAvatar(data.avatar_url);
          }
        });
      }
    });
  }, []);

  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title);
      setDescription(ticket.description);
      setEditingTitle(false);
      setEditingDesc(false);
      setNewComment("");
    }
  }, [ticket]);

  useEffect(() => {
    if (commentsEndRef.current) commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const parseDesligamentoAssetIds = useCallback((): string[] => {
    if (!ticket || ticket.category !== "Desligamento") return [];
    const match = ticket.description.match(/\[ASSET_IDS_DEVOLUCAO:([^\]]+)\]/);
    if (!match) return [];
    return match[1].split(",").filter(Boolean);
  }, [ticket]);

  if (!ticket) return null;

  const isCompleted = !!ticket.completed_at;
  const sla = getSlaInfo(ticket.created_at, ticket.category, isCompleted);
  const currentStatus = statuses.find((s) => s.id === ticket.status_id);
  const linkedAsset = ticket.asset_id ? getAsset(ticket.asset_id) : undefined;
  const availableAssets = getAvailableForCategory(ticket.category);
  const currentProgress = progressConfig.find(p => p.value === ticket.progress) || progressConfig[0];

  const handleTimerToggle = async () => {
    if (isCompleted) return;
    if (timerRunning) {
      await pauseTimer();
      await logHistory("timesheet", "Cronômetro pausado", "Admin");
    } else {
      await startTimer();
      if (ticket.progress === "not_started") {
        await supabase.from("tickets").update({ progress: "in_progress", updated_at: new Date().toISOString() } as any).eq("id", ticket.id as any);
      }
      await logHistory("timesheet", "Cronômetro iniciado", "Admin");
    }
  };

  const handleComplete = async () => {
    if (isCompleted) {
      const todoStatus = statuses.find((s) => s.statusType === "todo" && s.ativo);
      const ok = await onUpdateTicket(ticket.id, { completed_at: null, status_id: todoStatus?.id || "pending", progress: "not_started" } as any);
      if (ok) toast.info(`${ticket.ticket_number}: marcado como não concluído`);
      return;
    }
    await stopTimer();
    const assetIds = parseDesligamentoAssetIds();
    if (ticket.category === "Desligamento") {
      if (assetIds.length > 0) {
        for (const assetId of assetIds) {
          const { data: assetRow } = await supabase.from("inventory").select("category").eq("id", assetId as any).single();
          if (assetRow && assetRow.category === "licencas") {
            await supabase.from("inventory").update({ status: "Desligado", updated_at: new Date().toISOString() } as any).eq("id", assetId as any);
          } else {
            await supabase.from("inventory").update({ status: "Disponível", collaborator: "", reserved_by_ticket_id: null, updated_at: new Date().toISOString() } as any).eq("id", assetId as any);
          }
        }
        await logHistory("asset_release", `${assetIds.length} ativo(s) processado(s) no desligamento`, "Admin");
        toast.success(`${assetIds.length} ativo(s) processado(s)`);
      }
      const { data: allRequesterAssets } = await supabase.from("inventory").select("id, category").eq("collaborator", ticket.requester);
      if (allRequesterAssets) {
        const explicitIds = new Set(assetIds);
        const remaining = allRequesterAssets.filter((a: any) => !explicitIds.has(a.id));
        for (const asset of remaining) {
          if (asset.category === "licencas") {
            await supabase.from("inventory").update({ status: "Desligado", updated_at: new Date().toISOString() } as any).eq("id", asset.id);
          } else {
            await supabase.from("inventory").update({ status: "Disponível", collaborator: "", reserved_by_ticket_id: null, updated_at: new Date().toISOString() } as any).eq("id", asset.id);
          }
        }
        if (remaining.length > 0) await logHistory("asset_release", `${remaining.length} ativo(s) adicional(is) do colaborador processado(s)`, "Admin");
      }
    }
    if (ticket.category === "Contratação" && subtasks.length > 0) {
      let deliveredCount = 0;
      for (const sub of subtasks) {
        if (sub.asset_id) {
          await supabase.from("inventory").update({ status: "Em uso", collaborator: ticket.requester, delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any).eq("id", sub.asset_id as any);
          deliveredCount++;
        }
        if (!sub.completed_at) {
          await supabase.from("tickets").update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any).eq("id", sub.id as any);
        }
      }
      if (deliveredCount > 0) {
        await logHistory("asset_delivery", `${deliveredCount} ativo(s) entregue(s) para ${ticket.requester}`, "Admin");
        toast.success(`${deliveredCount} ativo(s) entregue(s) para ${ticket.requester}`);
      }
    }
    const finalStatus = statuses.find((s) => s.isFinal && s.id !== "cancelled");
    const doneStatusId = finalStatus?.id || "done";
    const ok = await onUpdateTicket(ticket.id, { completed_at: new Date().toISOString(), status_id: doneStatusId, progress: "completed" } as any);
    if (ok) {
      await logHistory("completed", "Chamado marcado como concluído", "Admin");
      await logHistory("timesheet", `Cronômetro finalizado. Tempo total: ${formatDuration(totalSeconds)}`, "Admin");
      toast.success(`Chamado ${ticket.ticket_number} concluído!`);
    } else {
      toast.error("Erro ao concluir chamado");
    }
    onOpenChange(false);
  };

  const handleSaveTitle = async () => {
    if (title.trim() && title !== ticket.title) {
      await onUpdateTicket(ticket.id, { title: title.trim() });
      await logHistory("field_change", `Título alterado para "${title.trim()}"`, "Admin");
    }
    setEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    if (description !== ticket.description) {
      await onUpdateTicket(ticket.id, { description });
      await logHistory("field_change", "Descrição atualizada", "Admin");
    }
    setEditingDesc(false);
  };

  const handleFieldChange = async (field: string, value: string, label: string) => {
    const previousValue = (ticket as any)[field];
    await onUpdateTicket(ticket.id, { [field]: value } as any);
    await logHistory("field_change", `${label} alterado para "${value}"`, "Admin");
    if (field === "assignee" && value && value !== previousValue) {
      const { sendNotification } = await import("@/lib/notifications");
      sendNotification({ recipientName: value, title: "Nova Tarefa Atribuída", message: `Você foi atribuído ao chamado "${ticket.title}" (${ticket.ticket_number})`, type: "task_assigned", link: "/ti/servicedesk" });
    }
  };

  const handleStatusChange = async (newStatusId: string) => {
    const newStatus = statuses.find((s) => s.id === newStatusId);
    onStatusChange(ticket.ticket_number, newStatusId);
    await logHistory("status_change", `Status alterado para ${newStatus?.nome ?? newStatusId}`, currentUserName);
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    const content = newComment.trim();
    const success = await addComment(currentUserName, content, currentUserAvatar);
    if (success) {
      setNewComment("");
      await logHistory("comment", "Comentário adicionado", currentUserName);
      // Notify mentioned users
      const { extractMentionedIds, notifyMentions } = await import("@/lib/mentions");
      const mentionedIds = extractMentionedIds(content, technicians);
      if (mentionedIds.length > 0 && ticket) {
        await notifyMentions({
          userIds: mentionedIds,
          authorName: currentUserName,
          contextTitle: ticket.title,
          contextType: "ticket",
          link: "/ti/service-desk",
        });
      }
    }
    setSubmitting(false);
  };

  // Merged activity feed
  const activityFeed = [
    ...comments.map(c => ({
      type: "comment" as const, id: c.id, author: c.author, avatar: c.avatar_url,
      content: c.content, date: new Date(c.created_at),
    })),
    ...history.map(h => ({
      type: "history" as const, id: h.id, author: h.author, avatar: null as string | null,
      content: `${h.action}: ${h.details}`, date: new Date(h.created_at),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[900px] p-0 flex flex-col sm:flex-row gap-0 overflow-hidden">
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
              entityId={ticket.id}
              type="ticket"
              onStartTimer={() => {
                startTimer();
                // Also set progress to in_progress
                supabase.from("tickets").update({ progress: "in_progress" }).eq("id", ticket.id);
              }}
            />
            {/* Top bar */}
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={handleComplete}
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted
                    ? "border-success bg-success text-white"
                    : "border-muted-foreground/40 text-muted-foreground hover:border-success hover:text-success"
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{ticket.ticket_number}</span>

              <div className="flex-1" />

              {/* Timer */}
              {!isCompleted && (
                <button
                  onClick={handleTimerToggle}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-all",
                    timerRunning
                      ? "bg-warning/15 text-warning border border-warning/30"
                      : "bg-success/15 text-success border border-success/30"
                  )}
                >
                  {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span className="font-mono tabular-nums">
                    {timerRunning || totalSeconds > 0 ? formatDuration(totalSeconds) : "Iniciar"}
                  </span>
                </button>
              )}
              {isCompleted && totalSeconds > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  <Timer className="h-3.5 w-3.5" />
                  <span className="font-mono">{formatDuration(totalSeconds)}</span>
                </span>
              )}

              <span className="text-xs text-muted-foreground">
                Criado em {format(new Date(ticket.created_at), "d MMM", { locale: ptBR })}
              </span>
            </div>

            {/* Title */}
            {editingTitle ? (
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveTitle} onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                autoFocus className="text-2xl font-bold border-none shadow-none p-0 h-auto focus-visible:ring-0" />
            ) : (
              <h1 className={cn("text-2xl font-bold cursor-pointer hover:text-primary/80 transition-colors", isCompleted && "line-through text-muted-foreground")}
                onClick={() => !isCompleted && setEditingTitle(true)}>
                {ticket.title}
              </h1>
            )}

            {/* SLA */}
            {!isCompleted && sla.slaVencido && (
              <div className="mt-2">
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" /> SLA Vencido
                </Badge>
              </div>
            )}
            {!isCompleted && <div className="mt-2"><SlaIndicator sla={sla} /></div>}

            {/* ─── Properties Grid ─── */}
            <div className="mt-4 space-y-0 divide-y divide-border/50">
              {/* Status */}
              <PropRow icon={Target} label="Status">
                <Select value={ticket.status_id} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-auto h-7 border-none shadow-none gap-1 px-0">
                    {currentStatus && (
                      <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white"
                        style={{ backgroundColor: `hsl(${currentStatus.cor})` }}>
                        {currentStatus.nome}
                      </span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${s.cor})` }} />
                          {s.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropRow>

              {/* Progress */}
              <PropRow icon={Hash} label="Progresso">
                <Select value={ticket.progress || "not_started"} onValueChange={async (v) => {
                  await supabase.from("tickets").update({ progress: v, updated_at: new Date().toISOString() } as any).eq("id", ticket.id as any);
                }}>
                  <SelectTrigger className="w-auto h-7 border-none shadow-none px-0 text-sm">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold tracking-wide text-white", currentProgress.color)}>
                      {currentProgress.label}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {progressConfig.map(p => (
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

              {/* Assignee */}
              <PropRow icon={User} label="Responsável">
                <Select value={ticket.assignee || "unassigned"}
                  onValueChange={(v) => handleFieldChange("assignee", v === "unassigned" ? "" : v, "Responsável")}
                 >
                  <SelectTrigger className="w-auto h-7 border-none shadow-none px-0 text-sm">
                    {ticket.assignee ? (
                      <span className="flex items-center gap-1.5">
                        <UserAvatar name={ticket.assignee} avatarUrl={technicians.find(t => t.name === ticket.assignee)?.avatar_url || undefined} className="h-5 w-5" fallbackClassName="text-[9px]" />
                        {ticket.assignee}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Vazio</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sem responsável</SelectItem>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        <span className="flex items-center gap-1.5">
                          <UserAvatar name={t.name} avatarUrl={t.avatar_url || undefined} className="h-5 w-5" fallbackClassName="text-[9px]" />
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropRow>

              {/* Priority */}
              <PropRow icon={Flag} label="Prioridade">
                <Select value={ticket.priority} onValueChange={(v) => handleFieldChange("priority", v, "Prioridade")}>
                  <SelectTrigger className="w-auto h-7 border-none shadow-none px-0 text-sm">
                    <span className={cn("flex items-center gap-1.5",
                      ticket.priority === "high" ? "text-destructive" : ticket.priority === "medium" ? "text-warning" : "text-muted-foreground"
                    )}>
                      <Flag className="h-3.5 w-3.5" />
                      {ticket.priority === "high" ? "Alta" : ticket.priority === "medium" ? "Média" : "Baixa"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </PropRow>

              {/* Category */}
              <PropRow icon={Tag} label="Categoria">
                <Select value={ticket.category} onValueChange={(v) => handleFieldChange("category", v, "Categoria")}>
                  <SelectTrigger className="w-auto h-7 border-none shadow-none px-0 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </PropRow>

              {/* Dates */}
              <PropRow icon={CalendarDays} label="Aberto em">
                <span className="text-sm">{format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </PropRow>

              <PropRow icon={Clock} label="Vencimento SLA">
                <input
                  type="datetime-local"
                  className="text-sm bg-transparent border-none outline-none cursor-pointer hover:bg-muted rounded px-1 py-0.5 transition-colors w-auto"
                  value={format(new Date(ticket.sla_deadline), "yyyy-MM-dd'T'HH:mm")}
                  onChange={async (e) => {
                    if (!e.target.value) return;
                    const newDeadline = new Date(e.target.value).toISOString();
                    await onUpdateTicket(ticket.id, { sla_deadline: newDeadline } as any);
                    await logHistory("field_change", `Vencimento SLA alterado para ${format(new Date(e.target.value), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, "Sistema");
                    toast.success("Vencimento SLA atualizado");
                  }}
                />
              </PropRow>

              {/* Requester */}
              <PropRow icon={User} label="Solicitante">
                <div>
                  <span className="text-sm">{ticket.requester}</span>
                  <span className="text-xs text-muted-foreground ml-2">{ticket.email}</span>
                </div>
              </PropRow>

              {/* Department */}
              {(!hideEmpty || ticket.department) && (
                <PropRow icon={Building} label="Departamento">
                  <span className="text-sm">{ticket.department || <span className="text-muted-foreground">Vazio</span>}</span>
                </PropRow>
              )}

              {/* Time tracked */}
              <PropRow icon={Timer} label="Tempo rastreado">
                <span className={cn("text-sm font-mono tabular-nums", timerRunning && "text-warning animate-pulse")}>
                  {formatDuration(totalSeconds)}
                </span>
              </PropRow>
            </div>

            {/* Hide empty */}
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
              onClick={() => setHideEmpty(!hideEmpty)}>
              {hideEmpty ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {hideEmpty ? "Mostrar propriedades vazias" : "Ocultar propriedades vazias"}
            </button>

            {/* ─── Description ─── */}
            <div className="mt-6">
              {editingDesc ? (
                <div className="space-y-2">
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} autoFocus rows={4} className="text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveDescription}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDescription(ticket.description); setEditingDesc(false); }}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground hover:bg-muted/30 rounded-md p-2 cursor-pointer transition-colors min-h-[40px]"
                  onClick={() => !isCompleted && setEditingDesc(true)}>
                  {ticket.description ? <p className="text-foreground whitespace-pre-wrap">{ticket.description}</p> : <p>Adicionar descrição</p>}
                </div>
              )}
            </div>

            {/* ─── Checklist ─── */}
            <div className="mt-6">
              {(() => {
                let items: ChecklistItem[] = [];
                try {
                  if (ticket.checklist) items = typeof ticket.checklist === "string" ? JSON.parse(ticket.checklist) : ticket.checklist;
                } catch { items = []; }
                if (!Array.isArray(items)) items = [];
                const checkedCount = items.filter(i => i.checked).length;
                const progressPercent = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;
                const updateChecklist = async (updated: ChecklistItem[]) => { await onUpdateTicket(ticket.id, { checklist: updated } as any); };
                return (
                  <ChecklistSection items={items} checkedCount={checkedCount} progressPercent={progressPercent} isCompleted={isCompleted}
                    onToggle={(idx) => updateChecklist(items.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item))}
                    onDelete={(idx) => updateChecklist(items.filter((_, i) => i !== idx))}
                    onEdit={(idx, text) => { if (!text.trim()) return updateChecklist(items.filter((_, i) => i !== idx)); updateChecklist(items.map((item, i) => i === idx ? { ...item, text: text.trim() } : item)); }}
                    onAdd={(text) => updateChecklist([...items, { text, checked: false }])} />
                );
              })()}
            </div>

            {/* Bucket / External Notes */}
            {(ticket.bucket_name || ticket.external_notes) && (
              <div className="mt-6 space-y-2">
                {ticket.bucket_name && <div><label className="text-xs font-medium text-muted-foreground">Bucket Original</label><p className="text-sm mt-0.5">{ticket.bucket_name}</p></div>}
                {ticket.external_notes && <div><label className="text-xs font-medium text-muted-foreground">Anotações do Planner</label><div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap mt-0.5">{ticket.external_notes}</div></div>}
              </div>
            )}

            {/* Asset Section */}
            <div className="mt-6">
              <AssetLinker
                ticketId={ticket.ticket_number} ticketCategory={ticket.category}
                linkedAssetId={ticket.asset_id ?? undefined} linkedAsset={linkedAsset}
                availableAssets={availableAssets} onLink={(assetId) => onLinkAsset(ticket.ticket_number, assetId)}
                requesterName={ticket.requester} />
            </div>

            {/* Attachments */}
            <div className="mt-6">
              <AttachmentManager entityType="ticket" entityId={ticket.id} addedBy={currentUserName} />
            </div>

            {/* Devolution Term */}
            {ticket.category === "Desligamento" && (
              <div className="mt-4">
                <Button variant="outline" className="w-full gap-2" onClick={() => setShowDevolutionChecklist(true)}>
                  <FileText className="h-4 w-4" /> Gerar Termo de Devolução
                </Button>
                <DevolutionChecklistDialog open={showDevolutionChecklist} onOpenChange={setShowDevolutionChecklist} collaboratorName={ticket.requester} />
              </div>
            )}

            {/* Subtask Assets (Contratação) */}
            {ticket.category === "Contratação" && subtasks.length > 0 && (
              <div className="mt-6 space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Subtarefas de Ativos</label>
                {subtasks.map((sub) => {
                  const subAsset = sub.asset_id ? getAsset(sub.asset_id) : undefined;
                  const subAvailable = getAvailableForCategory(sub.category);
                  return (
                    <div key={sub.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div><p className="text-sm font-medium">{sub.title}</p><p className="text-xs text-muted-foreground font-mono">{sub.ticket_number}</p></div>
                        {isFinalStatus(sub.status_id) && <CheckCircle2 className="h-4 w-4 text-success" />}
                      </div>
                      <AssetLinker ticketId={sub.ticket_number} ticketCategory={sub.category}
                        linkedAssetId={sub.asset_id ?? undefined} linkedAsset={subAsset}
                        availableAssets={subAvailable} onLink={(assetId) => onLinkAsset(sub.id, assetId)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ─── RIGHT: Activity Sidebar ─── */}
        <div className={cn("w-full sm:w-[320px] shrink-0 sm:border-l flex flex-col bg-muted/20 overflow-hidden", mobileView !== "activity" && "hidden sm:flex")}>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Atividade</h3>
            <div className="flex items-center gap-1">
              <button className={cn("text-xs px-2 py-1 rounded transition-colors", activityTab === "activity" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setActivityTab("activity")}>Tudo</button>
              <button className={cn("text-xs px-2 py-1 rounded transition-colors", activityTab === "comments" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setActivityTab("comments")}>Comentários</button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {activityFeed.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atividade ainda</p>}
              {activityFeed
                .filter(item => activityTab === "activity" || item.type === "comment")
                .map((item) => (
                  <div key={item.id} className="flex gap-2.5">
                    <UserAvatar name={item.author} avatarUrl={item.avatar} className="h-6 w-6 shrink-0 mt-0.5" fallbackClassName="text-[9px]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-medium truncate">{item.author}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(item.date, { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className={cn("text-xs mt-0.5 whitespace-pre-wrap", item.type === "comment" ? "text-foreground" : "text-muted-foreground")}>
                        {item.type === "comment" ? (
                          <MentionText text={item.content} memberNames={technicians.map((t) => t.name)} />
                        ) : (
                          item.content
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              <div ref={commentsEndRef} />
            </div>
          </ScrollArea>

          {/* Comment input */}
          <div className="border-t p-3">
            <CommentInput
              value={newComment}
              onChange={setNewComment}
              onSend={handleSendComment}
              disabled={!newComment.trim() || submitting}
              teamMembers={technicians.map(t => ({ id: t.id, name: t.name, avatar_url: t.avatar_url }))}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
