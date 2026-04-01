import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { GripVertical, Trash2 } from "lucide-react";
import { MarketingStage, MarketingTask, useUpdateMarketingTask, useDeleteMarketingTask } from "@/hooks/use-marketing";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const priorityLabels: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };

export function MarketingKanban({ stages, tasks, onTaskClick }: Props) {
  const updateTask = useUpdateMarketingTask();
  const deleteTask = useDeleteMarketingTask();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const tasksByStage = useMemo(() => {
    const map: Record<string, MarketingTask[]> = {};
    stages.forEach(s => { map[s.id] = []; });
    tasks.forEach(t => {
      if (t.stage_id && map[t.stage_id]) map[t.stage_id].push(t);
    });
    return map;
  }, [stages, tasks]);

  const handleDrop = (stageId: string) => {
    if (draggedTaskId) {
      updateTask.mutate({ id: draggedTaskId, stage_id: stageId });
      setDraggedTaskId(null);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map(stage => (
        <div
          key={stage.id}
          className="min-w-[280px] max-w-[320px] flex-shrink-0"
          onDragOver={e => e.preventDefault()}
          onDrop={() => handleDrop(stage.id)}
        >
          <div className={`rounded-t-lg px-3 py-2 flex items-center justify-between ${metaStatusColors[stage.meta_status] || "bg-muted"}`}>
            <span className="font-semibold text-sm">{stage.name}</span>
            <Badge variant="secondary" className="text-xs">{tasksByStage[stage.id]?.length ?? 0}</Badge>
          </div>
          <div className="space-y-2 rounded-b-lg border border-t-0 bg-muted/30 p-2 min-h-[200px]">
            {(tasksByStage[stage.id] ?? []).map(task => (
              <Card
                key={task.id}
                draggable
                onDragStart={() => setDraggedTaskId(task.id)}
                className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p
                      className="text-sm font-medium flex-1 cursor-pointer hover:text-primary"
                      onClick={() => onTaskClick?.(task)}
                    >
                      {task.title}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTask.mutate(task.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge variant={task.priority as any}>
                      {priorityLabels[task.priority] || task.priority}
                    </StatusBadge>
                    <Select
                      value={task.progress}
                      onValueChange={val => updateTask.mutate({ id: task.id, progress: val })}
                    >
                      <SelectTrigger className="h-6 text-xs w-auto border-0 bg-transparent px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Não iniciado">Não iniciado</SelectItem>
                        <SelectItem value="Em andamento">Em andamento</SelectItem>
                        <SelectItem value="Concluído">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {task.assignee_name && (
                    <p className="text-xs text-muted-foreground">👤 {task.assignee_name}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
