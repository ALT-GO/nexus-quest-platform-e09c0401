import { useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { GripVertical, Trash2, Play, Pause } from "lucide-react";
import {
  MarketingStage,
  MarketingTask,
  useUpdateMarketingTask,
  useDeleteMarketingTask,
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

interface Props {
  stages: MarketingStage[];
  tasks: MarketingTask[];
  onTaskClick?: (task: MarketingTask) => void;
}

const metaStatusColors: Record<string, string> = {
  unstarted: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  pending_approval: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  completed: "bg-green-500/10 text-green-700 dark:text-green-400",
};

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

export function MarketingKanban({ stages, tasks, onTaskClick }: Props) {
  const updateTask = useUpdateMarketingTask();
  const deleteTask = useDeleteMarketingTask();
  const qc = useQueryClient();
  const { user } = useAuth();

  const tasksByStage = useMemo(() => {
    const map: Record<string, MarketingTask[]> = {};
    stages.forEach((s) => { map[s.id] = []; });
    tasks.forEach((t) => {
      if (t.stage_id && map[t.stage_id]) map[t.stage_id].push(t);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.order_index - b.order_index)
    );
    return map;
  }, [stages, tasks]);

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

      if (sourceStageId === destStageId) {
        sourceItems.splice(destination.index, 0, movedTask);
      } else {
        destItems.splice(destination.index, 0, movedTask);
      }

      // Optimistic update
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
    },
    [tasksByStage, tasks, qc]
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.id} className="min-w-[280px] max-w-[320px] flex-shrink-0">
            <div className={`rounded-t-lg px-3 py-2 flex items-center justify-between ${metaStatusColors[stage.meta_status] || "bg-muted"}`}>
              <span className="font-semibold text-sm">{stage.name}</span>
              <Badge variant="secondary" className="text-xs">{tasksByStage[stage.id]?.length ?? 0}</Badge>
            </div>
            <Droppable droppableId={stage.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-2 rounded-b-lg border border-t-0 p-2 min-h-[200px] transition-colors ${snapshot.isDraggingOver ? "bg-accent/40" : "bg-muted/30"}`}
                >
                  {(tasksByStage[stage.id] ?? []).map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <Card
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`transition-shadow ${dragSnapshot.isDragging ? "shadow-lg ring-2 ring-primary/30" : "hover:shadow-md"}`}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div {...dragProvided.dragHandleProps} className="mt-0.5 cursor-grab active:cursor-grabbing">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <p className="text-sm font-medium flex-1 cursor-pointer hover:text-primary" onClick={() => onTaskClick?.(task)}>
                                {task.title}
                              </p>
                              <MarketingTimerButton taskId={task.id} size="card" />
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteTask.mutate(task.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusBadge variant={task.priority as any}>
                                {priorityLabels[task.priority] || task.priority}
                              </StatusBadge>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className={`inline-block h-2.5 w-2.5 rounded-full ${progressDot[task.progress] || "bg-muted-foreground"}`} />
                                {task.progress}
                              </div>
                            </div>
                            {task.assignee_name && (
                              <p className="text-xs text-muted-foreground">👤 {task.assignee_name}</p>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
