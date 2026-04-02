import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, GripVertical } from "lucide-react";
import { useCustomStatuses, StatusType } from "@/hooks/use-custom-status";
import { Skeleton } from "@/components/ui/skeleton";

const presetColors = [
  "38 92% 50%", "199 89% 48%", "142 76% 36%", "280 67% 60%",
  "0 84% 60%", "221 83% 53%", "25 95% 53%", "173 80% 40%",
  "330 81% 60%", "262 83% 58%", "47 96% 53%", "16 85% 56%",
];

export function StatusManagerTab() {
  const { statuses, loading, addStatus, updateStatus, reorderStatuses } = useCustomStatuses();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(presetColors[0]);
  const [newType, setNewType] = useState<StatusType>("todo");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const sorted = [...statuses].sort((a, b) => a.ordem - b.ordem);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addStatus(newName.trim(), newColor, newType);
    setNewName("");
    setNewColor(presetColors[0]);
    setNewType("todo");
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const ids = sorted.map((s) => s.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...ids];
    reordered.splice(from, 1);
    reordered.splice(to, 0, draggedId);
    reorderStatuses(reordered);
  };

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status dos Chamados</CardTitle>
        <CardDescription>
          Configure os status disponíveis para os chamados do Service Desk. Arraste para reordenar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {sorted.map((status) => (
            <div
              key={status.id}
              draggable
              onDragStart={() => setDraggedId(status.id)}
              onDragOver={(e) => handleDragOver(e, status.id)}
              onDragEnd={() => setDraggedId(null)}
              className={`flex items-center gap-2 rounded-lg border p-3 transition-colors ${
                draggedId === status.id ? "opacity-50" : ""
              } ${!status.ativo ? "opacity-60" : ""}`}
            >
              <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground shrink-0" />
              <div
                className="h-5 w-5 rounded-full border shrink-0"
                style={{ backgroundColor: `hsl(${status.cor})` }}
              />
              <Input
                value={status.nome}
                onChange={(e) => updateStatus(status.id, { nome: e.target.value })}
                className="h-8 flex-1 min-w-0"
              />
              <Select
                value={status.statusType}
                onValueChange={(v: StatusType) => updateStatus(status.id, { statusType: v })}
              >
                <SelectTrigger className="h-8 w-[130px] text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Não Iniciado</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-1 shrink-0">
                {presetColors.slice(0, 6).map((color) => (
                  <button
                    key={color}
                    onClick={() => updateStatus(status.id, { cor: color })}
                    className={`h-4 w-4 rounded-full border transition-transform ${
                      status.cor === color ? "scale-125 ring-2 ring-ring ring-offset-1" : ""
                    }`}
                    style={{ backgroundColor: `hsl(${color})` }}
                  />
                ))}
              </div>
              <Switch
                checked={status.ativo}
                onCheckedChange={(checked) => updateStatus(status.id, { ativo: checked })}
              />
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-dashed p-4 space-y-3">
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
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          </div>
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
        </div>
      </CardContent>
    </Card>
  );
}
