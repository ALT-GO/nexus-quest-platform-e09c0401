import { useState } from "react";
import { StatusCustom, StatusType } from "@/hooks/use-custom-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Plus, GripVertical } from "lucide-react";

interface StatusManagerDialogProps {
  statuses: StatusCustom[];
  onAdd: (nome: string, cor: string, statusType?: StatusType) => Promise<any>;
  onUpdate: (id: string, updates: Partial<Pick<StatusCustom, "nome" | "cor" | "ativo" | "statusType">>) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
}

const presetColors = [
  "38 92% 50%",
  "199 89% 48%",
  "142 76% 36%",
  "280 67% 60%",
  "0 84% 60%",
  "221 83% 53%",
  "25 95% 53%",
  "173 80% 40%",
  "330 81% 60%",
  "262 83% 58%",
  "47 96% 53%",
  "16 85% 56%",
  "187 72% 45%",
  "349 89% 60%",
  "152 69% 31%",
  "210 40% 52%",
];

const statusTypeLabels: Record<StatusType, string> = {
  todo: "Não Iniciado",
  in_progress: "Em Andamento",
  done: "Concluído",
};

const statusTypeColors: Record<StatusType, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-600",
  done: "bg-emerald-500/15 text-emerald-600",
};

export function StatusManagerDialog({
  statuses,
  onAdd,
  onUpdate,
  onReorder,
}: StatusManagerDialogProps) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(presetColors[0]);
  const [newType, setNewType] = useState<StatusType>("todo");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const sortedStatuses = [...statuses].sort((a, b) => a.ordem - b.ordem);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await onAdd(newName.trim(), newColor, newType);
    setNewName("");
    setNewColor(presetColors[0]);
    setNewType("todo");
  };

  const handleDragStart = (id: string) => setDraggedId(id);

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const ids = sortedStatuses.map((s) => s.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = [...ids];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, draggedId);
    onReorder(reordered);
  };

  const handleDragEnd = () => setDraggedId(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Gerenciar Status
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status Existentes</Label>
            <p className="text-xs text-muted-foreground">Arraste para reordenar. Todas as alterações são salvas automaticamente no banco de dados.</p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {sortedStatuses.map((status) => (
                <div
                  key={status.id}
                  draggable
                  onDragStart={() => handleDragStart(status.id)}
                  onDragOver={(e) => handleDragOver(e, status.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 rounded-lg border p-3 transition-colors ${
                    draggedId === status.id ? "opacity-50" : ""
                  } ${!status.ativo ? "opacity-60" : ""}`}
                >
                  <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground flex-shrink-0" />

                  <div
                    className="h-5 w-5 rounded-full border flex-shrink-0"
                    style={{ backgroundColor: `hsl(${status.cor})` }}
                  />

                  <Input
                    value={status.nome}
                    onChange={(e) => onUpdate(status.id, { nome: e.target.value })}
                    className="h-8 flex-1 min-w-0"
                  />

                  {/* Status Type selector */}
                  <Select
                    value={status.statusType}
                    onValueChange={(v: StatusType) => onUpdate(status.id, { statusType: v })}
                  >
                    <SelectTrigger className="h-8 w-[130px] text-xs flex-shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">Não Iniciado</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="done">Concluído</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Color picker */}
                  <div className="flex gap-1 flex-shrink-0">
                    {presetColors.slice(0, 4).map((color) => (
                      <button
                        key={color}
                        onClick={() => onUpdate(status.id, { cor: color })}
                        className={`h-5 w-5 rounded-full border transition-transform ${
                          status.cor === color ? "scale-125 ring-2 ring-ring ring-offset-1" : ""
                        }`}
                        style={{ backgroundColor: `hsl(${color})` }}
                      />
                    ))}
                  </div>

                  <Switch
                    checked={status.ativo}
                    onCheckedChange={(checked) => onUpdate(status.id, { ativo: checked })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Add new status */}
          <div className="space-y-3 rounded-lg border border-dashed p-4">
            <Label className="text-sm font-medium">Adicionar Novo Status</Label>
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do status"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Select value={newType} onValueChange={(v: StatusType) => setNewType(v)}>
                <SelectTrigger className="w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Não Iniciado</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`h-5 w-5 rounded-full border transition-transform ${
                      newColor === color ? "scale-125 ring-2 ring-ring ring-offset-1" : ""
                    }`}
                    style={{ backgroundColor: `hsl(${color})` }}
                  />
                ))}
              </div>
              <Button size="sm" onClick={handleAdd} disabled={!newName.trim()} className="ml-auto">
                <Plus className="mr-1 h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
