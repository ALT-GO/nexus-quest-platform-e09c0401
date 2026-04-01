import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useMarketingStages,
  useCreateMarketingStage,
  useUpdateMarketingStage,
  useDeleteMarketingStage,
  MarketingStage,
} from "@/hooks/use-marketing";
import { Skeleton } from "@/components/ui/skeleton";

const metaStatusLabels: Record<string, string> = {
  unstarted: "Não iniciado",
  in_progress: "Em progresso",
  pending_approval: "Aprovação pendente",
  completed: "Concluído",
};

export function MarketingWorkflowTab() {
  const { data: stages, isLoading } = useMarketingStages();
  const createStage = useCreateMarketingStage();
  const updateStage = useUpdateMarketingStage();
  const deleteStage = useDeleteMarketingStage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<MarketingStage | null>(null);
  const [name, setName] = useState("");
  const [metaStatus, setMetaStatus] = useState("unstarted");

  const openNew = () => {
    setEditingStage(null);
    setName("");
    setMetaStatus("unstarted");
    setDialogOpen(true);
  };

  const openEdit = (s: MarketingStage) => {
    setEditingStage(s);
    setName(s.name);
    setMetaStatus(s.meta_status);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editingStage) {
      updateStage.mutate({ id: editingStage.id, name, meta_status: metaStatus });
    } else {
      const maxOrder = stages?.reduce((m, s) => Math.max(m, s.order_index), -1) ?? -1;
      createStage.mutate({ name, meta_status: metaStatus, order_index: maxOrder + 1 });
    }
    setDialogOpen(false);
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Etapas do Workflow de Marketing</CardTitle>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Etapa</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Meta-Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stages ?? []).map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{metaStatusLabels[s.meta_status] || s.meta_status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteStage.mutate(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!stages || stages.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma etapa configurada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Etapa</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Design" />
            </div>
            <div>
              <Label>Meta-Status</Label>
              <Select value={metaStatus} onValueChange={setMetaStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unstarted">Não iniciado</SelectItem>
                  <SelectItem value="in_progress">Em progresso</SelectItem>
                  <SelectItem value="pending_approval">Aprovação pendente</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
