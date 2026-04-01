import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GripVertical,
  Trash2,
  CheckSquare,
  CalendarIcon,
  Timer,
  Diamond,
  Lock,
  Plus,
  Flag,
  ChevronDown,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { DynamicLucideIcon } from "@/components/ui/dynamic-icon";
import { useMarketingTaskTypes } from "@/hooks/use-task-types";
import { UserAvatar } from "@/components/ui/user-avatar";
import { fetchMarketingTimesheetTotals, formatDuration } from "@/hooks/use-timesheet";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import {
  MarketingStage,
  MarketingTask,
  useUpdateMarketingTask,
  useDeleteMarketingTask,
  useCreateMarketingTask,
} from "@/hooks/use-marketing";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MarketingTimerButton } from "./MarketingTimerButton";
import { notifyAdminsForApproval } from "@/lib/marketing-notifications";
import { useAuth } from "@/hooks/use-auth";
import { useAllTaskTags } from "@/hooks/use-marketing-tags";
import { useTaskDependencies, isTaskBlocked } from "@/hooks/use-dependencies";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  stages: MarketingStage[];
  tasks: MarketingTask[];
  onTaskClick?: (task: MarketingTask) => void;
  filterTagIds?: string[];
}

// ClickUp-style meta status colors
const metaStatusDot: Record<string, string> = {
  unstarted: "bg-muted-foreground/50",
  in_progress: "bg-primary",
  pending_approval: "bg-warning",
  completed: "bg-success",
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "Urgente", color: "text-destructive" },
  medium: { label: "Média", color: "text-warning" },
  low: { label: "Baixa", color: "text-muted-foreground" },
};

export function MarketingKanban({ stages, tasks, onTaskClick, filterTagIds }: Props) {
  const updateTask = useUpdateMarketingTask();
  const deleteTask = useDeleteMarketingTask();
  const createTask = useCreateMarketingTask();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: allTaskTags } = useAllTaskTags();
  const [timesheetTotals, setTimesheetTotals] = useState<Record<string, number>>({});
  const { data: allDeps } = useTaskDependencies();
  const { data: taskTypes } = useMarketingTaskTypes();

  // Quick-add state per column
  const [quickAddStageId, setQuickAddStageId] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");

  // Expanded subtask cards
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());

  const progressMap = useMemo(() => {
    const map: Record<string, string> = {};
    tasks.forEach((t) => { map[t.id] = t.progress; });
    return map;
  }, [tasks]);

  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const ids = tasks.map((t) => t.id);
    if (ids.length > 0) fetchMarketingTimesheetTotals(ids).then(setTimesheetTotals);
    refreshRef.current = setInterval(() => {
      const taskIds = tasks.map((t) => t.id);
      if (taskIds.length > 0) fetchMarketingTimesheetTotals(taskIds).then(setTimesheetTotals);
    }, 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (!filterTagIds || filterTagIds.length === 0) return tasks;
    return tasks.filter((t) => {
      const tags = allTaskTags?.[t.id] || [];
      return filterTagIds.some((fid) => tags.some((tag) => tag.id === fid));
    });
  }, [tasks, filterTagIds, allTaskTags]);

  const tasksByStage = useMemo(() => {
    const map: Record<string, MarketingTask[]> = {};
    stages.forEach((s) => { map[s.id] = []; });
    filteredTasks.forEach((t) => {
      if (t.stage_id && map[t.stage_id]) map[t.stage_id].push(t);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.order_index - b.order_index));
    return map;
  }, [stages, filteredTasks]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      const sourceStageId = source.droppableId;
      const destStageId = destination.droppableId;
      const sourceItems = [...(tasksByStage[sourceStageId] ?? [])];
      const destItems = sourceStageId === destStageId ? sourceItems : [...(tasksByStage[destStageId] ?? [])];

      const [movedTask] = sourceItems.splice(source.index, 1);
      if (!movedTask) return;

      if (sourceStageId !== destStageId) {
        const destStage = stages.find((s) => s.id === destStageId);
        if (destStage?.meta_status === "completed" && allDeps && isTaskBlocked(movedTask.id, allDeps, progressMap)) {
          toast.error("Esta tarefa possui dependências não concluídas.");
          return;
        }
      }

      if (sourceStageId === destStageId) {
        sourceItems.splice(destination.index, 0, movedTask);
      } else {
        destItems.splice(destination.index, 0, movedTask);
      }

      const updatedTasks = tasks.map((t) => ({ ...t }));
      const updateOrderForList = (list: MarketingTask[], stageId: string) => {
        list.forEach((item, idx) => {
          const found = updatedTasks.find((t) => t.id === item.id);
          if (found) { found.order_index = idx; found.stage_id = stageId; }
        });
      };
      updateOrderForList(sourceItems, sourceStageId);
      if (sourceStageId !== destStageId) updateOrderForList(destItems, destStageId);
      qc.setQueryData(["marketing_tasks"], updatedTasks);

      const updates: { id: string; stage_id: string; order_index: number }[] = [];
      const addUpdates = (list: MarketingTask[], stageId: string) => {
        list.forEach((item, idx) => { updates.push({ id: item.id, stage_id: stageId, order_index: idx }); });
      };
      addUpdates(sourceItems, sourceStageId);
      if (sourceStageId !== destStageId) addUpdates(destItems, destStageId);

      await Promise.all(
        updates.map((u) =>
          supabase
            .from("marketing_tasks")
            .update({ stage_id: u.stage_id, order_index: u.order_index, updated_at: new Date().toISOString() } as any)
            .eq("id", u.id)
        )
      );
      qc.invalidateQueries({ queryKey: ["marketing_tasks"] });

      if (sourceStageId !== destStageId) {
        const destStage = stages.find((s) => s.id === destStageId);
        if (destStage?.meta_status === "pending_approval") {
          notifyAdminsForApproval({ taskTitle: movedTask.title, taskId: movedTask.id, excludeUserId: user?.id });
        }
      }
    },
    [tasksByStage, tasks, qc, stages, user, allDeps, progressMap]
  );

  const handleQuickAdd = async (stageId: string) => {
    if (!quickAddTitle.trim()) return;
    createTask.mutate({
      title: quickAddTitle.trim(),
      stage_id: stageId,
      priority: "medium",
      progress: "Não iniciado",
      requester_name: "",
      order_index: (tasksByStage[stageId]?.length || 0),
    } as any);
    setQuickAddTitle("");
    setQuickAddStageId(null);
  };

  // Count checklist items (supports grouped and flat)
  const getChecklistCount = (raw: any): { total: number; done: number } => {
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length === 0) return { total: 0, done: 0 };
    let total = 0, done = 0;
    const countFlat = (items: any[]) => {
      for (const i of items) {
        total++; if (i.completed) done++;
        if (Array.isArray(i.children)) countFlat(i.children);
      }
    };
    if (arr[0]?.items) {
      for (const g of arr) countFlat(Array.isArray(g.items) ? g.items : []);
    } else {
      countFlat(arr);
    }
    return { total, done };
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4 -mx-2 px-2 h-[calc(100vh-280px)]">
        <div className="flex gap-3 min-w-max h-full">
          {stages.map((stage) => {
            const columnTasks = tasksByStage[stage.id] ?? [];
            const isAdding = quickAddStageId === stage.id;

            return (
              <div key={stage.id} className="w-[280px] shrink-0 flex flex-col h-full">
                {/* Column Header — ClickUp style */}
                <div className="flex items-center gap-2 px-2 py-2.5 mb-1">
                  <div
                    className={cn("h-2.5 w-2.5 rounded-full shrink-0", metaStatusDot[stage.meta_status] || "bg-muted-foreground")}
                  />
                  <h3 className="text-sm font-semibold truncate">{stage.name}</h3>
                  <span className="text-xs text-muted-foreground font-medium tabular-nums">
                    {columnTasks.length}
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => { setQuickAddStageId(stage.id); setQuickAddTitle(""); }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Column Body */}
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 overflow-y-auto space-y-2 rounded-lg p-1.5 transition-colors min-h-[80px]",
                        snapshot.isDraggingOver ? "bg-accent/40" : ""
                      )}
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(dragProvided, dragSnapshot) => {
                            const blocked = allDeps ? isTaskBlocked(task.id, allDeps, progressMap) : false;
                            const blockingNames = blocked && allDeps
                              ? allDeps
                                  .filter((d) => d.task_id === task.id && d.dependency_type === "waiting_on" && progressMap[d.depends_on_task_id] !== "Concluído")
                                  .map((d) => tasks.find((t) => t.id === d.depends_on_task_id)?.title || "?")
                              : [];
                            const taskType = task.task_type_id && taskTypes ? taskTypes.find(t => t.id === task.task_type_id) : null;
                            const tags = allTaskTags?.[task.id] || [];
                            const { total: clTotal, done: clDone } = getChecklistCount(task.checklist);
                            const priority = priorityConfig[task.priority] || priorityConfig.medium;

                            return (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={cn(
                                  "group rounded-lg border bg-card shadow-sm transition-all hover:shadow-md cursor-pointer overflow-hidden",
                                  dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/20 rotate-[1deg]",
                                  task.is_milestone && "border-l-[3px] border-l-warning",
                                  blocked && "opacity-70 border-dashed"
                                )}
                                onClick={() => onTaskClick?.(task)}
                              >
                                {/* Card Content */}
                                <div className="p-3 space-y-2.5">
                                  {/* Title row */}
                                  <div className="flex items-start gap-1.5">
                                    <div
                                      {...dragProvided.dragHandleProps}
                                      className="mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(
                                        "text-sm leading-snug break-words line-clamp-2",
                                        task.is_milestone ? "font-bold" : "font-medium"
                                      )}>
                                        {task.is_milestone && <Diamond className="inline h-3 w-3 text-warning fill-warning mr-1 -mt-0.5" />}
                                        {blocked && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Lock className="inline h-3 w-3 text-warning mr-1 -mt-0.5" />
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="max-w-[200px]">
                                                <p className="text-xs font-medium">Bloqueada por:</p>
                                                {blockingNames.map((n, i) => <p key={i} className="text-xs">• {n}</p>)}
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                        {task.title}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Tags */}
                                  {tags.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {tags.map((tag) => (
                                        <span
                                          key={tag.id}
                                          className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white leading-none"
                                          style={{ backgroundColor: `hsl(${tag.color})` }}
                                        >
                                          {tag.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Bottom row — ClickUp style icon bar */}
                                  <div className="flex items-center gap-2 flex-wrap text-muted-foreground">
                                    {/* Task type icon */}
                                    {taskType && (
                                      <DynamicLucideIcon
                                        name={taskType.icon}
                                        className="h-3.5 w-3.5 shrink-0"
                                        style={{ color: `hsl(${taskType.color})` }}
                                      />
                                    )}

                                    {/* Status badge */}
                                    <span className={cn(
                                      "text-[10px] font-medium rounded px-1.5 py-0.5 leading-none",
                                      task.progress === "Concluído"
                                        ? "bg-success/15 text-success"
                                        : task.progress === "Em andamento"
                                        ? "bg-primary/15 text-primary"
                                        : "bg-muted text-muted-foreground"
                                    )}>
                                      {task.progress}
                                    </span>

                                    {/* Assignee avatars */}
                                    {task.assignee_name && (
                                      <UserAvatar
                                        name={task.assignee_name}
                                        className="h-5 w-5"
                                        fallbackClassName="text-[9px]"
                                      />
                                    )}

                                    {/* Due date */}
                                    {task.due_date && (() => {
                                      const due = new Date(task.due_date);
                                      const overdue = task.progress !== "Concluído" && isBefore(due, startOfDay(new Date()));
                                      const dueToday = task.progress !== "Concluído" && isToday(due);
                                      return (
                                        <span className={cn(
                                          "flex items-center gap-0.5 text-[11px]",
                                          overdue ? "text-destructive font-medium" : dueToday ? "text-warning font-medium" : ""
                                        )}>
                                          <CalendarIcon className="h-3 w-3" />
                                          {format(due, "dd/MM")}
                                        </span>
                                      );
                                    })()}

                                    {/* Priority flag */}
                                    <Flag className={cn("h-3 w-3", priority.color)} />

                                    {/* Story points */}
                                    {(task as any).story_points > 0 && (
                                      <span className="text-[10px] font-medium bg-secondary rounded px-1 py-0.5">
                                        {(task as any).story_points}pt
                                      </span>
                                    )}

                                    {/* Timer */}
                                    {task.time_estimate_minutes && task.time_estimate_minutes > 0 && (() => {
                                      const estimateSec = task.time_estimate_minutes * 60;
                                      const actualSec = timesheetTotals[task.id] || 0;
                                      const overBudget = actualSec > estimateSec;
                                      const fmtMin = (sec: number) => {
                                        const h = Math.floor(sec / 3600);
                                        const m = Math.floor((sec % 3600) / 60);
                                        return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
                                      };
                                      return (
                                        <span className={cn("flex items-center gap-0.5 text-[11px]", overBudget && "text-destructive font-medium")}>
                                          <Timer className="h-3 w-3" />
                                          {fmtMin(actualSec)}/{fmtMin(estimateSec)}
                                        </span>
                                      );
                                    })()}
                                  </div>

                                  {/* Subtasks count — ClickUp expandable style */}
                                  {clTotal > 0 && (
                                    <button
                                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedSubtasks((prev) => {
                                          const next = new Set(prev);
                                          next.has(task.id) ? next.delete(task.id) : next.add(task.id);
                                          return next;
                                        });
                                      }}
                                    >
                                      <CheckSquare className="h-3 w-3" />
                                      <span className={cn(clDone === clTotal && "text-success font-medium")}>
                                        {clDone}/{clTotal} subtarefas
                                      </span>
                                      {expandedSubtasks.has(task.id) ? (
                                        <ChevronDown className="h-3 w-3" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3" />
                                      )}
                                    </button>
                                  )}
                                </div>

                                {/* Card actions — visible on hover */}
                                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 flex gap-0.5">
                                  <MarketingTimerButton taskId={task.id} size="card" />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive bg-card/80 backdrop-blur-sm"
                                    onClick={(e) => { e.stopPropagation(); deleteTask.mutate(task.id); }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          }}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Quick Add Task — ClickUp style */}
                      {isAdding ? (
                        <div className="rounded-lg border bg-card p-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            autoFocus
                            placeholder="Nome da tarefa..."
                            value={quickAddTitle}
                            onChange={(e) => setQuickAddTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleQuickAdd(stage.id);
                              if (e.key === "Escape") setQuickAddStageId(null);
                            }}
                            className="h-8 text-sm"
                          />
                          <div className="flex gap-1.5">
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleQuickAdd(stage.id)} disabled={!quickAddTitle.trim()}>
                              Criar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setQuickAddStageId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors flex items-center gap-1.5"
                          onClick={() => { setQuickAddStageId(stage.id); setQuickAddTitle(""); }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Adicionar tarefa
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}
