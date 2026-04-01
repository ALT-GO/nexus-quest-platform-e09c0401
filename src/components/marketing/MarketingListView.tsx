import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, X, Diamond } from "lucide-react";
import { format, isBefore, isToday, startOfDay } from "date-fns";
import { MarketingTask, MarketingStage, useUpdateMarketingTask } from "@/hooks/use-marketing";

type SortKey = "title" | "stage" | "priority" | "progress" | "assignee_name" | "due_date";
type SortDir = "asc" | "desc";

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
const priorityLabels: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };
const priorityColors: Record<string, string> = {
  high: "text-destructive",
  medium: "text-amber-600",
  low: "text-muted-foreground",
};

interface Props {
  tasks: MarketingTask[];
  stages: MarketingStage[];
  teamMembers: { id: string; name: string }[];
  onTaskClick: (task: MarketingTask) => void;
  filterStage: string;
  filterPriority: string;
  filterAssignee: string;
  filterProgress: string;
  onFilterStageChange: (v: string) => void;
  onFilterPriorityChange: (v: string) => void;
  onFilterAssigneeChange: (v: string) => void;
  onFilterProgressChange: (v: string) => void;
}

export function MarketingListView({
  tasks,
  stages,
  teamMembers,
  onTaskClick,
  filterStage,
  filterPriority,
  filterAssignee,
  filterProgress,
  onFilterStageChange,
  onFilterPriorityChange,
  onFilterAssigneeChange,
  onFilterProgressChange,
}: Props) {
  const updateTask = useUpdateMarketingTask();
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  const filtered = useMemo(() => {
    let result = [...tasks];
    if (filterStage && filterStage !== "all")
      result = result.filter((t) => t.stage_id === filterStage);
    if (filterPriority && filterPriority !== "all")
      result = result.filter((t) => t.priority === filterPriority);
    if (filterAssignee && filterAssignee !== "all")
      result = result.filter((t) => t.assignee_id === filterAssignee);
    if (filterProgress && filterProgress !== "all")
      result = result.filter((t) => t.progress === filterProgress);
    return result;
  }, [tasks, filterStage, filterPriority, filterAssignee, filterProgress]);

  const sorted = useMemo(() => {
    const stageMap: Record<string, number> = {};
    stages.forEach((s) => (stageMap[s.id] = s.order_index));

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "stage":
          cmp = (stageMap[a.stage_id || ""] ?? 999) - (stageMap[b.stage_id || ""] ?? 999);
          break;
        case "priority":
          cmp = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
          break;
        case "progress":
          cmp = a.progress.localeCompare(b.progress);
          break;
        case "assignee_name":
          cmp = (a.assignee_name || "").localeCompare(b.assignee_name || "");
          break;
        case "due_date":
          cmp = (a.due_date || "9999").localeCompare(b.due_date || "9999");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, stages]);

  const startEdit = (taskId: string, field: string, value: string) => {
    setEditingCell({ id: taskId, field });
    setEditValue(value);
  };

  const cancelEdit = () => setEditingCell(null);

  const saveEdit = (taskId: string, field: string) => {
    if (field === "title") {
      updateTask.mutate({ id: taskId, title: editValue });
    }
    setEditingCell(null);
  };

  const handleInlineSelect = (taskId: string, field: string, value: string) => {
    if (field === "stage_id") {
      updateTask.mutate({ id: taskId, stage_id: value });
    } else if (field === "priority") {
      updateTask.mutate({ id: taskId, priority: value });
    } else if (field === "progress") {
      updateTask.mutate({ id: taskId, progress: value });
    } else if (field === "assignee") {
      const member = teamMembers.find((m) => m.id === value);
      updateTask.mutate({ id: taskId, assignee_id: value, assignee_name: member?.name || "" });
    }
  };

  const getDueDateStyle = (dueDate: string | null) => {
    if (!dueDate) return "";
    const due = startOfDay(new Date(dueDate));
    const today = startOfDay(new Date());
    if (isBefore(due, today)) return "text-destructive font-medium";
    if (isToday(due)) return "text-amber-600 font-medium";
    return "";
  };

  return (
    <div>
      {/* Filters row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={filterStage} onValueChange={onFilterStageChange}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Etapas</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={onFilterPriorityChange}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={onFilterAssigneeChange}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {teamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterProgress} onValueChange={onFilterProgressChange}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Progresso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Não iniciado">Não iniciado</SelectItem>
            <SelectItem value="Em andamento">Em andamento</SelectItem>
            <SelectItem value="Concluído">Concluído</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("title")}>
                <span className="flex items-center">Título <SortIcon col="title" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none w-40" onClick={() => toggleSort("stage")}>
                <span className="flex items-center">Etapa <SortIcon col="stage" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none w-28" onClick={() => toggleSort("priority")}>
                <span className="flex items-center">Prioridade <SortIcon col="priority" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none w-36" onClick={() => toggleSort("progress")}>
                <span className="flex items-center">Progresso <SortIcon col="progress" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none w-40" onClick={() => toggleSort("assignee_name")}>
                <span className="flex items-center">Responsável <SortIcon col="assignee_name" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none w-28" onClick={() => toggleSort("due_date")}>
                <span className="flex items-center">Prazo <SortIcon col="due_date" /></span>
              </TableHead>
              <TableHead className="w-16">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma tarefa encontrada
                </TableCell>
              </TableRow>
            )}
            {sorted.map((task) => {
              const stage = stages.find((s) => s.id === task.stage_id);
              const isEditingTitle = editingCell?.id === task.id && editingCell.field === "title";

              return (
                <TableRow key={task.id} className="group">
                  {/* Title - editable */}
                  <TableCell>
                    {isEditingTitle ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(task.id, "title");
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="h-7 text-sm"
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(task.id, "title")}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={`cursor-pointer hover:underline text-sm flex items-center gap-1.5 ${task.is_milestone ? "font-bold" : "font-medium"}`}
                        onClick={() => startEdit(task.id, "title", task.title)}
                      >
                        {task.is_milestone && <Diamond className="h-3.5 w-3.5 text-amber-500 shrink-0 fill-amber-500" />}
                        {task.title}
                      </span>
                    )}
                  </TableCell>

                  {/* Stage - inline select */}
                  <TableCell>
                    <Select value={task.stage_id || ""} onValueChange={(v) => handleInlineSelect(task.id, "stage_id", v)}>
                      <SelectTrigger className="h-7 text-xs border-none shadow-none bg-transparent hover:bg-accent px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Priority - inline select */}
                  <TableCell>
                    <Select value={task.priority} onValueChange={(v) => handleInlineSelect(task.id, "priority", v)}>
                      <SelectTrigger className={`h-7 text-xs border-none shadow-none bg-transparent hover:bg-accent px-1 ${priorityColors[task.priority] || ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Progress - inline select */}
                  <TableCell>
                    <Select value={task.progress} onValueChange={(v) => handleInlineSelect(task.id, "progress", v)}>
                      <SelectTrigger className="h-7 text-xs border-none shadow-none bg-transparent hover:bg-accent px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Não iniciado">Não iniciado</SelectItem>
                        <SelectItem value="Em andamento">Em andamento</SelectItem>
                        <SelectItem value="Concluído">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Assignee - inline select */}
                  <TableCell>
                    <Select value={task.assignee_id || ""} onValueChange={(v) => handleInlineSelect(task.id, "assignee", v)}>
                      <SelectTrigger className="h-7 text-xs border-none shadow-none bg-transparent hover:bg-accent px-1">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Due Date */}
                  <TableCell className={`text-xs ${getDueDateStyle(task.due_date)}`}>
                    {task.due_date ? format(new Date(task.due_date), "dd/MM/yyyy") : "—"}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => onTaskClick(task)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {sorted.length} tarefa{sorted.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
