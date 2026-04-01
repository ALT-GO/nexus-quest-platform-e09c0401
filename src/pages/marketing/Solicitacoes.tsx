import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketingStages, useMarketingTasks, MarketingTask } from "@/hooks/use-marketing";
import { useMarketingTags } from "@/hooks/use-marketing-tags";
import { MarketingKanban } from "@/components/marketing/MarketingKanban";
import { NewMarketingTaskDialog } from "@/components/marketing/NewMarketingTaskDialog";
import { MarketingTaskDetailSheet } from "@/components/marketing/MarketingTaskDetailSheet";
import { supabase } from "@/integrations/supabase/client";

export default function Solicitacoes() {
  const { data: stages, isLoading: stagesLoading } = useMarketingStages();
  const { data: tasks, isLoading: tasksLoading } = useMarketingTasks();
  const { data: tags } = useMarketingTags();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MarketingTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name").then(({ data }) => {
      if (data) setTeamMembers(data.map(p => ({ id: p.id, name: p.full_name })));
    });
  }, []);

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

  const loading = stagesLoading || tasksLoading;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title="Solicitações de Marketing"
          description="Kanban de tarefas e solicitações"
        />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Tarefa
        </Button>
      </div>

      {/* Tag Filters */}
      {tags && tags.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Filtrar por tag:</span>
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
          {filterTagIds.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setFilterTagIds([])}>
              Limpar
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-72" />)}
        </div>
      ) : (
        <MarketingKanban
          stages={stages ?? []}
          tasks={tasks ?? []}
          onTaskClick={handleTaskClick}
          filterTagIds={filterTagIds.length > 0 ? filterTagIds : undefined}
        />
      )}

      <NewMarketingTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stages={stages ?? []}
        teamMembers={teamMembers}
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
