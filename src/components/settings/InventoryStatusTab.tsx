import { useState } from "react";
import { useInventoryStatuses, InventoryStatus } from "@/hooks/use-inventory-statuses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const presetColors = [
  "152 69% 31%",   // green
  "217 91% 60%",   // blue
  "38 92% 50%",    // amber
  "0 84% 60%",     // red
  "262 83% 58%",   // purple
  "220 9% 46%",    // gray
  "330 81% 60%",   // pink
  "180 70% 40%",   // teal
];

function ColorDot({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-6 w-6 rounded-full border-2 transition-transform",
        selected ? "border-foreground scale-110" : "border-transparent hover:scale-105"
      )}
      style={{ backgroundColor: `hsl(${color})` }}
    />
  );
}

function StatusRow({ status, onUpdate, onDelete }: {
  status: InventoryStatus;
  onUpdate: (id: string, updates: Partial<Pick<InventoryStatus, "name" | "color" | "isActive">>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(status.name);
  const [editColor, setEditColor] = useState(status.color);

  const handleSave = async () => {
    if (!editName.trim()) return;
    await onUpdate(status.id, { name: editName.trim(), color: editColor });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditName(status.name);
    setEditColor(status.color);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <div
        className="h-4 w-4 rounded-full shrink-0"
        style={{ backgroundColor: `hsl(${editing ? editColor : status.color})` }}
      />
      {editing ? (
        <div className="flex-1 space-y-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-8"
            autoFocus
          />
          <div className="flex gap-1.5 flex-wrap">
            {presetColors.map((c) => (
              <ColorDot key={c} color={c} selected={editColor === c} onClick={() => setEditColor(c)} />
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" className="h-7" onClick={handleSave}>
              <Check className="h-3.5 w-3.5 mr-1" /> Salvar
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={handleCancel}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium">{status.name}</span>
          <Switch
            checked={status.isActive}
            onCheckedChange={(v) => onUpdate(status.id, { isActive: v })}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(status.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}

export function InventoryStatusTab() {
  const { statuses, addStatus, updateStatus, deleteStatus } = useInventoryStatuses();
  const [tab, setTab] = useState("hardware");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(presetColors[0]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = statuses
    .filter((s) => s.categoryGroup === tab)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addStatus(tab, newName.trim(), newColor);
    setNewName("");
    setNewColor(presetColors[0]);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteStatus(deleteTarget);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Status de Ativos</h2>
        <p className="text-sm text-muted-foreground">
          Personalize os status disponíveis para cada tipo de ativo no inventário.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="hardware">Hardware (Notebooks, Celulares, Tablets, Periféricos)</TabsTrigger>
          <TabsTrigger value="software">Software (Licenças)</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Status cadastrados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum status cadastrado</p>
              ) : (
                filtered.map((s) => (
                  <StatusRow
                    key={s.id}
                    status={s}
                    onUpdate={updateStatus}
                    onDelete={(id) => setDeleteTarget(id)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Adicionar novo status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Em reparo"
                  className="mt-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div>
                <Label className="text-xs">Cor</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {presetColors.map((c) => (
                    <ColorDot key={c} color={c} selected={newColor === c} onClick={() => setNewColor(c)} />
                  ))}
                </div>
              </div>
              <Button onClick={handleAdd} disabled={!newName.trim()} size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Adicionar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover status?</AlertDialogTitle>
            <AlertDialogDescription>
              Ativos que já utilizam este status não serão alterados, mas ele não estará mais disponível para seleção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
