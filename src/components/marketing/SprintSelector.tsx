import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings2, Zap, Pencil, Trash2, MoreVertical } from "lucide-react";
import {
  MarketingSprint,
  useMarketingSprints,
  useDeleteSprint,
  useSprintRollover,
} from "@/hooks/use-sprints";
import { SprintDialog } from "./SprintDialog";
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

interface Props {
  selectedSprintId: string;
  onSprintChange: (id: string) => void;
}

const statusLabels: Record<string, string> = {
  planning: "Planejamento",
  active: "Ativa",
  completed: "Concluída",
};

const statusColors: Record<string, string> = {
  planning: "bg-muted text-muted-foreground",
  active: "bg-green-500/10 text-green-700 dark:text-green-400",
  completed: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

export function SprintSelector({ selectedSprintId, onSprintChange }: Props) {
  const { data: sprints } = useMarketingSprints();
  const deleteSprint = useDeleteSprint();
  const rollover = useSprintRollover();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<MarketingSprint | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [rolloverFrom, setRolloverFrom] = useState<string | null>(null);

  const activeSprints = sprints?.filter((s) => s.status !== "completed") || [];
  const completedSprints = sprints?.filter((s) => s.status === "completed") || [];
  const selectedSprint = sprints?.find((s) => s.id === selectedSprintId);

  const handleRollover = () => {
    if (!rolloverFrom) return;
    // Find the next planning/active sprint
    const target = sprints?.find((s) => s.id !== rolloverFrom && s.status !== "completed");
    if (!target) {
      return;
    }
    rollover.mutate({ fromSprintId: rolloverFrom, toSprintId: target.id });
    setRolloverFrom(null);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedSprintId} onValueChange={onSprintChange}>
        <SelectTrigger className="w-56 h-8 text-xs">
          <SelectValue placeholder="Todas as tarefas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as tarefas</SelectItem>
          <SelectItem value="backlog">Backlog (sem sprint)</SelectItem>
          {activeSprints.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="flex items-center gap-2">
                {s.name}
                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${statusColors[s.status]}`}>
                  {statusLabels[s.status]}
                </Badge>
              </span>
            </SelectItem>
          ))}
          {completedSprints.length > 0 && completedSprints.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="flex items-center gap-2 opacity-60">
                {s.name}
                <Badge variant="outline" className="text-[10px] px-1 py-0">Concluída</Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedSprint && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditingSprint(selectedSprint); setDialogOpen(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar Sprint
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRolloverFrom(selectedSprint.id)}>
              <Zap className="h-3.5 w-3.5 mr-2" /> Rollover de Tarefas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirmId(selectedSprint.id)}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir Sprint
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setEditingSprint(null); setDialogOpen(true); }}>
        <Plus className="h-3.5 w-3.5" /> Sprint
      </Button>

      <SprintDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sprint={editingSprint}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Sprint?</AlertDialogTitle>
            <AlertDialogDescription>
              As tarefas vinculadas ficarão sem sprint. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirmId) { deleteSprint.mutate(deleteConfirmId); onSprintChange("all"); } setDeleteConfirmId(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rollover confirm */}
      <AlertDialog open={!!rolloverFrom} onOpenChange={() => setRolloverFrom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollover de Tarefas</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as tarefas não concluídas desta sprint serão movidas para a próxima sprint disponível (planejamento ou ativa). Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollover}>Mover Tarefas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
