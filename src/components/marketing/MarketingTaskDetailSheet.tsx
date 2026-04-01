import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Check, X } from "lucide-react";
import {
  MarketingStage,
  MarketingTask,
  useUpdateMarketingTask,
} from "@/hooks/use-marketing";
import { MarketingTimerButton } from "./MarketingTimerButton";
import { useAuth } from "@/hooks/use-auth";
import { notifyTaskCreator } from "@/lib/marketing-notifications";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  task: MarketingTask | null;
  stages: MarketingStage[];
  teamMembers: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function MarketingTaskDetailSheet({
  task,
  stages,
  teamMembers,
  open,
  onOpenChange,
}: Props) {
  const updateTask = useUpdateMarketingTask();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!task) return null;

  const currentStage = stages.find((s) => s.id === task.stage_id);
  const isPendingApproval = currentStage?.meta_status === "pending_approval";
  const canApprove = isPendingApproval && isAdmin;

  const handleApprove = async () => {
    // Find the next stage with meta_status 'completed'
    const completedStage = stages.find((s) => s.meta_status === "completed");
    if (!completedStage) {
      toast.error("Nenhuma etapa de conclusão configurada");
      return;
    }

    await supabase
      .from("marketing_tasks")
      .update({
        stage_id: completedStage.id,
        progress: "Concluído",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", task.id);

    if (task.requester_id) {
      notifyTaskCreator({
        creatorId: task.requester_id,
        taskTitle: task.title,
        approved: true,
      });
    }

    qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
    toast.success("Tarefa aprovada e movida para Concluído");
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;

    // Find a stage with meta_status 'in_progress' to send back
    const inProgressStage = stages.find((s) => s.meta_status === "in_progress");
    if (!inProgressStage) {
      toast.error("Nenhuma etapa de progresso configurada");
      return;
    }

    await supabase
      .from("marketing_tasks")
      .update({
        stage_id: inProgressStage.id,
        progress: "Em andamento",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", task.id);

    if (task.requester_id) {
      notifyTaskCreator({
        creatorId: task.requester_id,
        taskTitle: task.title,
        approved: false,
        reason: rejectReason,
      });
    }

    qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
    toast.success("Tarefa reprovada e devolvida para ajustes");
    setRejectDialogOpen(false);
    setRejectReason("");
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">{task.title}</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Criado em {format(new Date(task.created_at), "dd/MM/yyyy 'às' HH:mm")}
            </p>
          </SheetHeader>

          {/* Approval Banner */}
          {canApprove && (
            <div className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="font-semibold text-amber-800 dark:text-amber-300">
                  Aprovação Necessária
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleApprove}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4 mr-2" /> Aprovar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setRejectDialogOpen(true)}
                >
                  <X className="h-4 w-4 mr-2" /> Reprovar
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-5">
            {/* Timer */}
            <div>
              <Label className="text-xs text-muted-foreground">Timer</Label>
              <div className="mt-1">
                <MarketingTimerButton taskId={task.id} size="detail" />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <p className="mt-1 text-sm whitespace-pre-wrap">
                {task.description || "Sem descrição"}
              </p>
            </div>

            {/* Stage */}
            <div>
              <Label className="text-xs text-muted-foreground">Etapa</Label>
              <Select
                value={task.stage_id || ""}
                onValueChange={(val) =>
                  updateTask.mutate({ id: task.id, stage_id: val })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Progress */}
            <div>
              <Label className="text-xs text-muted-foreground">Progresso</Label>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-block h-3 w-3 rounded-full ${
                    progressDot[task.progress] || "bg-muted-foreground"
                  }`}
                />
                <Select
                  value={task.progress}
                  onValueChange={(val) =>
                    updateTask.mutate({ id: task.id, progress: val })
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não iniciado">Não iniciado</SelectItem>
                    <SelectItem value="Em andamento">Em andamento</SelectItem>
                    <SelectItem value="Concluído">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority */}
            <div>
              <Label className="text-xs text-muted-foreground">Prioridade</Label>
              <Select
                value={task.priority}
                onValueChange={(val) =>
                  updateTask.mutate({ id: task.id, priority: val })
                }
              >
                <SelectTrigger className="mt-1 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div>
              <Label className="text-xs text-muted-foreground">Responsável</Label>
              <Select
                value={task.assignee_id || ""}
                onValueChange={(val) => {
                  const member = teamMembers.find((m) => m.id === val);
                  updateTask.mutate({
                    id: task.id,
                    assignee_id: val,
                    assignee_name: member?.name || "",
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Requester */}
            <div>
              <Label className="text-xs text-muted-foreground">Solicitante</Label>
              <p className="mt-1 text-sm">
                {task.requester_name || "Não informado"}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Tarefa</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Motivo da reprovação *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Descreva o que precisa ser ajustado..."
              className="mt-2"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
