import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Target,
  Folder,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit,
  Link,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
} from "lucide-react";
import {
  useMarketingGoals,
  useDeleteGoal,
  useGoalTargets,
  useUpdateGoal,
  MarketingGoal,
} from "@/hooks/use-goals";
import { useMarketingTasks } from "@/hooks/use-marketing";
import { GoalDialog } from "@/components/marketing/GoalDialog";
import { GoalDetailSheet } from "@/components/marketing/GoalDetailSheet";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  on_track: { label: "No ritmo", icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  at_risk: { label: "Em risco", icon: AlertTriangle, className: "text-amber-600 bg-amber-50 border-amber-200" },
  off_track: { label: "Atrasado", icon: XCircle, className: "text-red-600 bg-red-50 border-red-200" },
  completed: { label: "Concluído", icon: CheckCircle2, className: "text-primary bg-primary/10 border-primary/20" },
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  number: "Número",
  percentage: "Porcentagem",
  currency: "Monetário",
  true_false: "Sim/Não",
  task_completion: "Conclusão de tarefas",
};

function formatValue(value: number, type: string) {
  if (type === "currency") return `R$ ${value.toLocaleString("pt-BR")}`;
  if (type === "percentage") return `${value}%`;
  if (type === "true_false") return value >= 1 ? "Sim" : "Não";
  return value.toString();
}

function GoalCard({
  goal,
  progress,
  onEdit,
  onDelete,
  onDetail,
}: {
  goal: MarketingGoal;
  progress: number;
  onEdit: () => void;
  onDelete: () => void;
  onDetail: () => void;
}) {
  const statusCfg = STATUS_CONFIG[goal.status] || STATUS_CONFIG.on_track;
  const StatusIcon = statusCfg.icon;
  const isOverdue = goal.due_date && new Date(goal.due_date) < new Date() && goal.status !== "completed";

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md border-l-4"
      style={{ borderLeftColor: `hsl(${goal.color})` }}
      onClick={onDetail}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{goal.title}</h3>
            {goal.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{goal.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {formatValue(goal.current_value, goal.target_type)} / {formatValue(goal.target_value, goal.target_type)}
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex items-center justify-between">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${statusCfg.className}`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusCfg.label}
          </Badge>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{TARGET_TYPE_LABELS[goal.target_type]}</span>
            {goal.due_date && (
              <span className={isOverdue ? "text-destructive font-medium" : ""}>
                {new Date(goal.due_date).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Metas() {
  const { data: goals = [] } = useMarketingGoals();
  const { data: allTargets = [] } = useGoalTargets();
  const { data: tasks = [] } = useMarketingTasks();
  const deleteGoal = useDeleteGoal();
  const updateGoal = useUpdateGoal();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<MarketingGoal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailGoal, setDetailGoal] = useState<MarketingGoal | null>(null);
  const [search, setSearch] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<string[]>([]);

  // Calculate progress for each goal
  const goalProgress = useMemo(() => {
    const map: Record<string, number> = {};
    goals.forEach((g) => {
      if (g.target_type === "task_completion") {
        const linkedTargets = allTargets.filter((t) => t.goal_id === g.id && t.task_id);
        const linkedTasks = linkedTargets
          .map((t) => tasks.find((tk) => tk.id === t.task_id))
          .filter(Boolean);
        const completedCount = linkedTasks.filter((t) => t?.progress === "Concluído").length;
        const total = linkedTasks.length || 1;
        map[g.id] = Math.round((completedCount / total) * 100);
      } else if (g.target_type === "true_false") {
        map[g.id] = g.current_value >= 1 ? 100 : 0;
      } else {
        map[g.id] = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
      }
    });
    return map;
  }, [goals, allTargets, tasks]);

  // Auto-update current_value for task_completion goals
  useMemo(() => {
    goals.forEach((g) => {
      if (g.target_type === "task_completion") {
        const linkedTargets = allTargets.filter((t) => t.goal_id === g.id && t.task_id);
        const linkedTasks = linkedTargets.map((t) => tasks.find((tk) => tk.id === t.task_id)).filter(Boolean);
        const completedCount = linkedTasks.filter((t) => t?.progress === "Concluído").length;
        const total = linkedTasks.length;
        if (total > 0 && (g.current_value !== completedCount || g.target_value !== total)) {
          updateGoal.mutate({ id: g.id, current_value: completedCount, target_value: total });
        }
      }
    });
  }, [allTargets, tasks]);

  const filteredGoals = goals.filter((g) =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.folder.toLowerCase().includes(search.toLowerCase())
  );

  // Group by folder
  const grouped = useMemo(() => {
    const map: Record<string, MarketingGoal[]> = {};
    filteredGoals.forEach((g) => {
      const folder = g.folder || "Sem pasta";
      if (!map[folder]) map[folder] = [];
      map[folder].push(g);
    });
    return map;
  }, [filteredGoals]);

  const toggleFolder = (f: string) =>
    setCollapsedFolders((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  return (
    <AppLayout>
      <PageHeader title="Metas" description="Acompanhe OKRs e objetivos do time de marketing">
        <Button onClick={() => { setEditingGoal(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova Meta
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4 mb-6">
        {[
          { label: "Total", value: goals.length, color: "text-foreground" },
          { label: "No ritmo", value: goals.filter((g) => g.status === "on_track").length, color: "text-emerald-600" },
          { label: "Em risco", value: goals.filter((g) => g.status === "at_risk").length, color: "text-amber-600" },
          { label: "Concluídas", value: goals.filter((g) => g.status === "completed").length, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar metas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Folders */}
      {Object.entries(grouped).map(([folder, folderGoals]) => (
        <div key={folder} className="mb-6">
          <button
            onClick={() => toggleFolder(folder)}
            className="flex items-center gap-2 mb-3 text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            {collapsedFolders.includes(folder) ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Folder className="h-4 w-4 text-muted-foreground" />
            {folder}
            <Badge variant="secondary" className="text-[10px] ml-1">{folderGoals.length}</Badge>
          </button>

          {!collapsedFolders.includes(folder) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {folderGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  progress={goalProgress[goal.id] || 0}
                  onEdit={() => { setEditingGoal(goal); setDialogOpen(true); }}
                  onDelete={() => setDeleteId(goal.id)}
                  onDetail={() => setDetailGoal(goal)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {filteredGoals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Target className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Nenhuma meta encontrada</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setEditingGoal(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Criar primeira meta
          </Button>
        </div>
      )}

      <GoalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingGoal={editingGoal}
        existingFolders={[...new Set(goals.map((g) => g.folder).filter(Boolean))]}
      />

      <GoalDetailSheet
        goal={detailGoal}
        onClose={() => setDetailGoal(null)}
        progress={detailGoal ? goalProgress[detailGoal.id] || 0 : 0}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteGoal.mutate(deleteId); setDeleteId(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
