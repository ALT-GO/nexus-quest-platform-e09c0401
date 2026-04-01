import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import {
  MarketingGoal,
  useGoalTargets,
  useAddGoalTarget,
  useRemoveGoalTarget,
} from "@/hooks/use-goals";
import { useMarketingTasks, MarketingTask } from "@/hooks/use-marketing";

interface GoalDetailSheetProps {
  goal: MarketingGoal | null;
  onClose: () => void;
  progress: number;
}

export function GoalDetailSheet({ goal, onClose, progress }: GoalDetailSheetProps) {
  const { data: targets = [] } = useGoalTargets(goal?.id);
  const { data: allTasks = [] } = useMarketingTasks();
  const addTarget = useAddGoalTarget();
  const removeTarget = useRemoveGoalTarget();
  const [selectedTaskId, setSelectedTaskId] = useState("");

  if (!goal) return null;

  const linkedTaskIds = targets.filter((t) => t.task_id).map((t) => t.task_id);
  const linkedTasks = allTasks.filter((t) => linkedTaskIds.includes(t.id));
  const availableTasks = allTasks.filter((t) => !linkedTaskIds.includes(t.id));

  const handleLinkTask = () => {
    if (!selectedTaskId) return;
    addTarget.mutate({ goal_id: goal.id, task_id: selectedTaskId });
    setSelectedTaskId("");
  };

  return (
    <Sheet open={!!goal} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: `hsl(${goal.color})` }} />
            {goal.title}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Details */}
          {goal.description && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Descrição</p>
              <p className="text-sm">{goal.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Tipo</p>
              <p className="font-medium capitalize">{goal.target_type.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Prazo</p>
              <p className="font-medium">
                {goal.due_date ? new Date(goal.due_date).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Pasta</p>
              <p className="font-medium">{goal.folder || "Sem pasta"}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Valor</p>
              <p className="font-medium">{goal.current_value} / {goal.target_value}</p>
            </div>
          </div>

          {/* Linked Tasks */}
          {goal.target_type === "task_completion" && (
            <div>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Link className="h-4 w-4" /> Tarefas vinculadas ({linkedTasks.length})
              </p>

              <div className="space-y-2 mb-3">
                {linkedTasks.map((task) => {
                  const target = targets.find((t) => t.task_id === task.id);
                  const isCompleted = task.progress === "Concluído";
                  return (
                    <div key={task.id} className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={`flex-1 truncate ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => target && removeTarget.mutate(target.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {availableTasks.length > 0 && (
                <div className="flex gap-2">
                  <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                    <SelectTrigger className="flex-1 h-9 text-xs">
                      <SelectValue placeholder="Vincular tarefa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTasks.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-9" onClick={handleLinkTask} disabled={!selectedTaskId}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
