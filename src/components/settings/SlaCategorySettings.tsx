import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, Save } from "lucide-react";
import { useSlaCategoryConfig } from "@/hooks/use-sla-categories";
import { toast } from "sonner";

export function SlaCategorySettings() {
  const { configs, loading, updateSlaHours, addCategory, deleteCategory } = useSlaCategoryConfig();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");
  const [newHours, setNewHours] = useState("24");
  const [saving, setSaving] = useState<string | null>(null);

  const handleSave = async (id: string, currentHours: number) => {
    const val = editValues[id];
    const hours = val !== undefined ? parseInt(val, 10) : currentHours;
    if (isNaN(hours) || hours <= 0) {
      toast.error("Informe um número válido de horas");
      return;
    }
    setSaving(id);
    const ok = await updateSlaHours(id, hours);
    setSaving(null);
    if (ok) {
      toast.success("SLA atualizado!");
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      toast.error("Erro ao salvar");
    }
  };

  const handleAdd = async () => {
    if (!newCategory.trim()) {
      toast.error("Informe o nome da categoria");
      return;
    }
    const hours = parseInt(newHours, 10);
    if (isNaN(hours) || hours <= 0) {
      toast.error("Informe um número válido de horas");
      return;
    }
    setSaving("new");
    const ok = await addCategory(newCategory.trim(), hours);
    setSaving(null);
    if (ok) {
      toast.success("Categoria adicionada!");
      setNewCategory("");
      setNewHours("24");
    } else {
      toast.error("Erro ao adicionar. Verifique se a categoria já existe.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover a categoria "${name}" da configuração de SLA?`)) return;
    const ok = await deleteCategory(id);
    if (ok) toast.success("Categoria removida");
    else toast.error("Erro ao remover");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SLA por Categoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA por Categoria de Chamado</CardTitle>
        <CardDescription>
          Defina o prazo em horas para cada tipo de chamado. Esses valores são usados no cálculo do SLA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_80px] gap-2 text-xs font-semibold text-muted-foreground px-1">
          <span>Categoria</span>
          <span className="text-center">Horas</span>
          <span className="text-center">Ações</span>
        </div>

        {/* Rows */}
        {configs.map((cfg) => {
          const edited = editValues[cfg.id] !== undefined && parseInt(editValues[cfg.id], 10) !== cfg.sla_hours;
          return (
            <div key={cfg.id} className="grid grid-cols-[1fr_100px_80px] gap-2 items-center">
              <span className="text-sm truncate">{cfg.category}</span>
              <Input
                type="number"
                min={1}
                className="text-center h-9"
                value={editValues[cfg.id] ?? cfg.sla_hours}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, [cfg.id]: e.target.value }))
                }
              />
              <div className="flex justify-center gap-1">
                {edited && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary"
                    onClick={() => handleSave(cfg.id, cfg.sla_hours)}
                    disabled={saving === cfg.id}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleDelete(cfg.id, cfg.category)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Add new */}
        <div className="grid grid-cols-[1fr_100px_80px] gap-2 items-center pt-2 border-t">
          <Input
            placeholder="Nova categoria..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="h-9"
          />
          <Input
            type="number"
            min={1}
            className="text-center h-9"
            value={newHours}
            onChange={(e) => setNewHours(e.target.value)}
          />
          <div className="flex justify-center">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleAdd}
              disabled={saving === "new"}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
