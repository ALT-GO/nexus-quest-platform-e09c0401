import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useMarketingTaskTypes,
  useCreateTaskType,
  useUpdateTaskType,
  useDeleteTaskType,
  MarketingTaskType,
} from "@/hooks/use-task-types";
import { DynamicLucideIcon } from "@/components/ui/dynamic-icon";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

const ICON_OPTIONS = [
  "clipboard-list", "bug", "lightbulb", "megaphone", "file-text",
  "palette", "image", "video", "mail", "globe",
  "layout", "pen-tool", "bar-chart", "target", "zap",
  "heart", "star", "flag", "bookmark", "tag",
];

export function TaskTypesManagerTab() {
  const { data: types, isLoading } = useMarketingTaskTypes();
  const createType = useCreateTaskType();
  const updateType = useUpdateTaskType();
  const deleteType = useDeleteTaskType();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingTaskType | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("clipboard-list");
  const [color, setColor] = useState("262 83% 58%");
  const [checklistTemplate, setChecklistTemplate] = useState("");

  const openNew = () => {
    setEditing(null);
    setName("");
    setIcon("clipboard-list");
    setColor("262 83% 58%");
    setChecklistTemplate("");
    setDialogOpen(true);
  };

  const openEdit = (t: MarketingTaskType) => {
    setEditing(t);
    setName(t.name);
    setIcon(t.icon);
    setColor(t.color);
    setChecklistTemplate(
      t.checklist_template?.map((i: any) => i.text).join("\n") || ""
    );
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const template = checklistTemplate
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => ({ text: l.trim() }));

    if (editing) {
      updateType.mutate({
        id: editing.id,
        name,
        icon,
        color,
        checklist_template: template,
      } as any);
    } else {
      const maxOrder = types?.reduce((m, t) => Math.max(m, t.order_index), -1) ?? -1;
      createType.mutate({
        name,
        icon,
        color,
        checklist_template: template,
        order_index: maxOrder + 1,
      } as any);
    }
    setDialogOpen(false);
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Tipos de Tarefa</CardTitle>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo Tipo
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Ícone</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Template</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(types ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <DynamicLucideIcon
                      name={t.icon}
                      className="h-4 w-4"
                      style={{ color: `hsl(${t.color})` }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded-full border"
                        style={{ backgroundColor: `hsl(${t.color})` }}
                      />
                      <span className="text-xs text-muted-foreground">{t.color}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.checklist_template?.length ? (
                      <Badge variant="outline" className="text-xs">
                        {t.checklist_template.length} itens
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <ConfirmDeleteDialog
                      onConfirm={() => deleteType.mutate(t.id)}
                      title="Excluir Tipo de Tarefa"
                      description="As tarefas existentes deste tipo ficarão sem tipo. Deseja continuar?"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {(!types || types.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum tipo configurado
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
            <DialogTitle>{editing ? "Editar Tipo" : "Novo Tipo de Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Campanha" />
            </div>
            <div>
              <Label>Ícone</Label>
              <div className="grid grid-cols-10 gap-1.5 mt-1.5">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={`h-8 w-8 rounded-md flex items-center justify-center border transition-colors ${
                      icon === ic ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent"
                    }`}
                  >
                    <DynamicLucideIcon name={ic} className="h-4 w-4" style={{ color: `hsl(${color})` }} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Cor (HSL)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="262 83% 58%"
                  className="flex-1"
                />
                <span
                  className="inline-block h-8 w-8 rounded-md border shrink-0"
                  style={{ backgroundColor: `hsl(${color})` }}
                />
              </div>
            </div>
            <div>
              <Label>Template de Checklist (uma linha por item)</Label>
              <Textarea
                value={checklistTemplate}
                onChange={(e) => setChecklistTemplate(e.target.value)}
                placeholder={"Briefing aprovado\nDesign entregue\nRevisão final"}
                rows={4}
                className="mt-1"
              />
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
