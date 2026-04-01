import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketingStages, useMarketingTasks, MarketingTask } from "@/hooks/use-marketing";
import { MarketingKanban } from "@/components/marketing/MarketingKanban";
import { NewMarketingTaskDialog } from "@/components/marketing/NewMarketingTaskDialog";
import { MarketingTaskDetailSheet } from "@/components/marketing/MarketingTaskDetailSheet";
import { supabase } from "@/integrations/supabase/client";

export default function Solicitacoes() {
  const { data: stages, isLoading: stagesLoading } = useMarketingStages();
  const { data: tasks, isLoading: tasksLoading } = useMarketingTasks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MarketingTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name").then(({ data }) => {
      if (data) setTeamMembers(data.map(p => ({ id: p.id, name: p.full_name })));
    });
  }, []);

  const handleTaskClick = (task: MarketingTask) => {
    // Get fresh version from tasks list
    const fresh = tasks?.find(t => t.id === task.id) || task;
    setSelectedTask(fresh);
    setDetailOpen(true);
  };

  const loading = stagesLoading || tasksLoading;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Solicitações de Marketing"
          description="Kanban de tarefas e solicitações"
        />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Tarefa
        </Button>
      </div>

      {loading ? (
        <div className="flex gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-72" />)}
        </div>
      ) : (
        <MarketingKanban
          stages={stages ?? []}
          tasks={tasks ?? []}
          onTaskClick={handleTaskClick}
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
