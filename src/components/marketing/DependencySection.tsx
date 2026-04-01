import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2, Lock, ArrowRight } from "lucide-react";
import { MarketingTask } from "@/hooks/use-marketing";
import {
  TaskDependency,
  useAddDependency,
  useRemoveDependency,
  getBlockingTasks,
  getBlockedByThisTask,
} from "@/hooks/use-dependencies";

interface Props {
  task: MarketingTask;
  allTasks: MarketingTask[];
  dependencies: TaskDependency[];
}

export function DependencySection({ task, allTasks, dependencies }: Props) {
  const addDep = useAddDependency();
  const removeDep = useRemoveDependency();
  const [openWaiting, setOpenWaiting] = useState(false);
  const [openBlocking, setOpenBlocking] = useState(false);

  // Tasks this task is waiting on
  const waitingOnDeps = useMemo(() => getBlockingTasks(task.id, dependencies), [task.id, dependencies]);
  // Tasks this task is blocking
  const blockingDeps = useMemo(() => getBlockedByThisTask(task.id, dependencies), [task.id, dependencies]);

  const waitingOnTasks = useMemo(
    () => waitingOnDeps.map((d) => ({ dep: d, task: allTasks.find((t) => t.id === d.depends_on_task_id) })),
    [waitingOnDeps, allTasks]
  );
  const blockingTasks = useMemo(
    () => blockingDeps.map((d) => ({ dep: d, task: allTasks.find((t) => t.id === d.task_id) })),
    [blockingDeps, allTasks]
  );

  // Exclude self and already-linked tasks
  const alreadyLinkedIds = useMemo(() => {
    const ids = new Set<string>([task.id]);
    waitingOnDeps.forEach((d) => ids.add(d.depends_on_task_id));
    blockingDeps.forEach((d) => ids.add(d.task_id));
    return ids;
  }, [task.id, waitingOnDeps, blockingDeps]);

  const availableTasks = useMemo(
    () => allTasks.filter((t) => !alreadyLinkedIds.has(t.id)),
    [allTasks, alreadyLinkedIds]
  );

  const handleAddWaitingOn = (targetId: string) => {
    addDep.mutate({ task_id: task.id, depends_on_task_id: targetId, dependency_type: "waiting_on" });
    setOpenWaiting(false);
  };

  const handleAddBlocking = (targetId: string) => {
    addDep.mutate({ task_id: targetId, depends_on_task_id: task.id, dependency_type: "waiting_on" });
    setOpenBlocking(false);
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground">Dependências</Label>

      {/* Waiting On */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-amber-500" /> Esperando por
          </span>
          <Popover open={openWaiting} onOpenChange={setOpenWaiting}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar tarefa..." />
                <CommandList>
                  <CommandEmpty>Nenhuma tarefa encontrada</CommandEmpty>
                  <CommandGroup>
                    {availableTasks.map((t) => (
                      <CommandItem key={t.id} onSelect={() => handleAddWaitingOn(t.id)}>
                        <span className="text-sm truncate">{t.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {waitingOnTasks.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">Nenhuma dependência</p>
        )}
        {waitingOnTasks.map(({ dep, task: t }) => (
          <div key={dep.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 group">
            <Lock className="h-3 w-3 text-amber-500 shrink-0" />
            <span className={`text-xs flex-1 truncate ${t?.progress === "Concluído" ? "line-through text-muted-foreground" : ""}`}>
              {t?.title || "Tarefa removida"}
            </span>
            {t?.progress === "Concluído" ? (
              <Badge variant="outline" className="text-[9px] h-4 bg-green-50 text-green-700 border-green-200">✓</Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] h-4 bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100"
              onClick={() => removeDep.mutate(dep.id)}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Blocking */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <ArrowRight className="h-3 w-3 text-red-500" /> Bloqueando
          </span>
          <Popover open={openBlocking} onOpenChange={setOpenBlocking}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar tarefa..." />
                <CommandList>
                  <CommandEmpty>Nenhuma tarefa encontrada</CommandEmpty>
                  <CommandGroup>
                    {availableTasks.map((t) => (
                      <CommandItem key={t.id} onSelect={() => handleAddBlocking(t.id)}>
                        <span className="text-sm truncate">{t.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {blockingTasks.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">Não bloqueia nenhuma tarefa</p>
        )}
        {blockingTasks.map(({ dep, task: t }) => (
          <div key={dep.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 group">
            <ArrowRight className="h-3 w-3 text-red-500 shrink-0" />
            <span className="text-xs flex-1 truncate">{t?.title || "Tarefa removida"}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100"
              onClick={() => removeDep.mutate(dep.id)}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
