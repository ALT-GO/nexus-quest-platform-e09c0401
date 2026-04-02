import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, LayoutGrid, List, Search, FilterX, Diamond, GanttChart as GanttChartIcon, Eye, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketingStages, useMarketingTasks, MarketingTask } from "@/hooks/use-marketing";
import { useMarketingTags } from "@/hooks/use-marketing-tags";
import { useMarketingSprints } from "@/hooks/use-sprints";
import { useMarketingTaskTypes } from "@/hooks/use-task-types";
import { DynamicLucideIcon } from "@/components/ui/dynamic-icon";
import { MarketingKanban } from "@/components/marketing/MarketingKanban";
import { MarketingListView } from "@/components/marketing/MarketingListView";
import { NewMarketingTaskDialog } from "@/components/marketing/NewMarketingTaskDialog";
import { MarketingTaskDetailSheet } from "@/components/marketing/MarketingTaskDetailSheet";
import { SprintSelector } from "@/components/marketing/SprintSelector";
import { GanttChart, GanttItem } from "@/components/shared/GanttChart";
import { useProfileAvatars } from "@/hooks/use-profile-avatars";
import { SprintDashboard } from "@/components/marketing/SprintDashboard";
import { supabase } from "@/integrations/supabase/client";

const VIEW_KEY = "marketing_view_preference";

export default function Solicitacoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: stages, isLoading: stagesLoading } = useMarketingStages();
  const { data: tasks, isLoading: tasksLoading } = useMarketingTasks();
  const { data: tags } = useMarketingTags();
  const { data: sprints } = useMarketingSprints();
  const { data: taskTypes } = useMarketingTaskTypes();
  const { data: avatars } = useProfileAvatars();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MarketingTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "gantt">(() => {
    return (localStorage.getItem(VIEW_KEY) as "kanban" | "list" | "gantt") || "kanban";
  });

  // Shared filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterProgress, setFilterProgress] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterMilestoneOnly, setFilterMilestoneOnly] = useState(false);
  const [filterTaskType, setFilterTaskType] = useState("all");
  const [hideCompleted, setHideCompleted] = useState(true);
  useEffect(() => {
    supabase.from("profiles").select("id, full_name").then(({ data }) => {
      if (data) setTeamMembers(data.map(p => ({ id: p.id, name: p.full_name })));
    });
  }, []);

  // Auto-open task from URL query param (e.g. from notification click)
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (taskId && tasks && tasks.length > 0 && !detailOpen) {
      const found = tasks.find(t => t.id === taskId);
      if (found) {
        setSelectedTask(found);
        setDetailOpen(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, tasks, detailOpen, setSearchParams]);

  const handleViewChange = (mode: "kanban" | "list" | "gantt") => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  useEffect(() => {
    if (selectedTask && tasks) {
      const fresh = tasks.find(t => t.id === selectedTask.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedTask)) {
        setSelectedTask(fresh);
      }
    }
  }, [tasks, selectedTask]);

  const handleTaskClick = (task: MarketingTask) => {
    const fresh = tasks?.find(t => t.id === task.id) || task;
    setSelectedTask(fresh);
    setDetailOpen(true);
  };

  const toggleTagFilter = (tagId: string) => {
    setFilterTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const hasActiveFilters = searchQuery || filterPriority !== "all" || filterAssignee !== "all" || filterProgress !== "all" || filterTagIds.length > 0 || filterMilestoneOnly || filterTaskType !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setFilterPriority("all");
    setFilterAssignee("all");
    setFilterProgress("all");
    setFilterStage("all");
    setFilterTagIds([]);
    setFilterMilestoneOnly(false);
    setFilterTaskType("all");
  };

  // Filter by sprint first, then by other filters
  const filteredTasks = useMemo(() => {
    let result = tasks ?? [];

    // Sprint filter
    if (selectedSprintId === "backlog") {
      result = result.filter((t) => !(t as any).sprint_id);
    } else if (selectedSprintId !== "all") {
      result = result.filter((t) => (t as any).sprint_id === selectedSprintId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (filterPriority !== "all") {
      result = result.filter((t) => t.priority === filterPriority);
    }
    if (filterAssignee !== "all") {
      result = result.filter((t) => t.assignee_id === filterAssignee);
    }
    if (filterProgress !== "all") {
      result = result.filter((t) => t.progress === filterProgress);
    }
    if (filterMilestoneOnly) {
      result = result.filter((t) => t.is_milestone);
    }
    if (filterTaskType !== "all") {
      result = result.filter((t) => t.task_type_id === filterTaskType);
    }
    // Hide completed tasks (stage meta_status === "completed" OR progress === "Concluído")
    if (hideCompleted) {
      const completedStageIds = (stages ?? []).filter(s => s.meta_status === "completed").map(s => s.id);
      result = result.filter(t => {
        const isCompletedByStage = t.stage_id && completedStageIds.includes(t.stage_id);
        const isCompletedByProgress = t.progress === "Concluído";
        const isCompletedByTimestamp = !!t.completed_at;
        return !isCompletedByStage && !isCompletedByProgress && !isCompletedByTimestamp;
      });
    }
    return result;
  }, [tasks, stages, selectedSprintId, searchQuery, filterPriority, filterAssignee, filterProgress, filterMilestoneOnly, filterTaskType, hideCompleted]);

  const activeSprint = sprints?.find((s) => s.id === selectedSprintId) || null;
  const loading = stagesLoading || tasksLoading;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title="Solicitações de Marketing"
          description="Kanban de tarefas e solicitações"
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border bg-muted p-0.5">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 gap-1.5 text-xs"
              onClick={() => handleViewChange("kanban")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 gap-1.5 text-xs"
              onClick={() => handleViewChange("list")}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </Button>
            <Button
              variant={viewMode === "gantt" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 gap-1.5 text-xs"
              onClick={() => handleViewChange("gantt")}
            >
              <GanttChartIcon className="h-3.5 w-3.5" />
              Gantt
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHideCompleted(!hideCompleted)}
            className="gap-1.5"
            title={hideCompleted ? "Mostrar tarefas concluídas" : "Ocultar tarefas concluídas"}
          >
            {hideCompleted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {hideCompleted ? "Concluídas ocultas" : "Concluídas visíveis"}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Sprint Selector */}
      <div className="flex items-center gap-3 mb-4">
        <SprintSelector
          selectedSprintId={selectedSprintId}
          onSprintChange={setSelectedSprintId}
        />
      </div>

      {/* Sprint Dashboard */}
      {activeSprint && tasks && (
        <SprintDashboard sprint={activeSprint} tasks={tasks} />
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por título..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-52 pl-8 text-xs"
          />
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Prioridade</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Responsável</SelectItem>
            {teamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterProgress} onValueChange={setFilterProgress}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Progresso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Progresso</SelectItem>
            <SelectItem value="Não iniciado">Não iniciado</SelectItem>
            <SelectItem value="Em andamento">Em andamento</SelectItem>
            <SelectItem value="Concluído">Concluído</SelectItem>
          </SelectContent>
        </Select>
        {taskTypes && taskTypes.length > 0 && (
          <Select value={filterTaskType} onValueChange={setFilterTaskType}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {taskTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-1.5">
                    <DynamicLucideIcon name={t.icon} className="h-3 w-3" style={{ color: `hsl(${t.color})` }} />
                    {t.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={filterMilestoneOnly ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setFilterMilestoneOnly(!filterMilestoneOnly)}
        >
          <Diamond className="h-3.5 w-3.5" />
          Milestones
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={clearAllFilters}>
            <FilterX className="h-3.5 w-3.5" />
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Tag Filters */}
      {tags && tags.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Tags:</span>
          {tags.map((tag) => {
            const isActive = filterTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.id)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all border ${
                  isActive ? "border-foreground shadow-sm" : "border-transparent opacity-70 hover:opacity-100"
                }`}
                style={{ backgroundColor: `hsl(${tag.color})`, color: "#fff" }}
              >
                {tag.name}
                {isActive && <X className="h-2.5 w-2.5" />}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-72" />)}
        </div>
      ) : viewMode === "kanban" ? (
        <MarketingKanban
          stages={stages ?? []}
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
          filterTagIds={filterTagIds.length > 0 ? filterTagIds : undefined}
        />
      ) : viewMode === "gantt" ? (
        <GanttChart
          items={filteredTasks.map((t): GanttItem => {
            const stage = (stages ?? []).find(s => s.id === t.stage_id);
            return {
              id: t.id,
              title: t.title,
              group: stage?.name || "Sem etapa",
              startDate: t.start_date,
              endDate: t.due_date,
              progress: t.progress,
              priority: t.priority,
              assigneeName: t.assignee_name || undefined,
              assigneeAvatarUrl: t.assignee_id ? avatars?.byId[t.assignee_id] || undefined : undefined,
            };
          })}
          onItemClick={(id) => {
            const task = filteredTasks.find(t => t.id === id);
            if (task) handleTaskClick(task);
          }}
        />
      ) : (
        <MarketingListView
          tasks={filteredTasks}
          stages={stages ?? []}
          teamMembers={teamMembers}
          onTaskClick={handleTaskClick}
          filterStage={filterStage}
          filterPriority="all"
          filterAssignee="all"
          filterProgress="all"
          onFilterStageChange={setFilterStage}
          onFilterPriorityChange={() => {}}
          onFilterAssigneeChange={() => {}}
          onFilterProgressChange={() => {}}
        />
      )}

      <NewMarketingTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stages={stages ?? []}
        teamMembers={teamMembers}
        sprints={sprints ?? []}
      />

      <MarketingTaskDetailSheet
        task={selectedTask}
        stages={stages ?? []}
        teamMembers={teamMembers}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </AppLayout>
  );
}
