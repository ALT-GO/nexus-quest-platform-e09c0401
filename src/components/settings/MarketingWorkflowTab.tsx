import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, GripVertical } from "lucide-react";
import {
  useMarketingStages,
  useCreateMarketingStage,
  useUpdateMarketingStage,
  useDeleteMarketingStage,
  MarketingStage,
} from "@/hooks/use-marketing";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const presetColors = [
  "38 92% 50%", "199 89% 48%", "142 76% 36%", "280 67% 60%",
  "0 84% 60%", "221 83% 53%", "25 95% 53%", "173 80% 40%",
  "330 81% 60%", "262 83% 58%", "47 96% 53%", "16 85% 56%",
];

type MetaStatus = "unstarted" | "in_progress" | "pending_approval" | "completed";

const metaStatusLabels: Record<MetaStatus, string> = {
  unstarted: "Não Iniciado",
  in_progress: "Em Progresso",
  pending_approval: "Aprovação",
  completed: "Concluído",
};

export function MarketingWorkflowTab() {
  const { data: stages, isLoading } = useMarketingStages();
  const createStage = useCreateMarketingStage();
  const updateStage = useUpdateMarketingStage();
  const deleteStage = useDeleteMarketingStage();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(presetColors[0]);
  const [newMetaStatus, setNewMetaStatus] = useState<MetaStatus>("unstarted");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const sorted = [...(stages ?? [])].sort((a, b) => a.order_index - b.order_index);
  
  // Use local order during drag, otherwise use sorted from DB
  const displayStages = localOrder
    ? localOrder.map(id => sorted.find(s => s.id === id)).filter(Boolean) as MarketingStage[]
    : sorted;

  const handleAdd = () => {
    if (!newName.trim()) return;
    const maxOrder = sorted.reduce((m, s) => Math.max(m, s.order_index), -1);
    createStage.mutate({
      name: newName.trim(),
      meta_status: newMetaStatus,
      color: newColor,
      order_index: maxOrder + 1,
    });
    setNewName("");
    setNewColor(presetColors[0]);
    setNewMetaStatus("unstarted");
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
    setLocalOrder(sorted.map(s => s.id));
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId || !localOrder) return;
    
    const from = localOrder.indexOf(draggedId);
    const to = localOrder.indexOf(targetId);
    if (from === -1 || to === -1) return;
    
    const reordered = [...localOrder];
    reordered.splice(from, 1);
    reordered.splice(to, 0, draggedId);
    setLocalOrder(reordered);
  };

  const handleDragEnd = async () => {
    if (!localOrder) {
      setDraggedId(null);
      return;
    }

    // Persist all order changes in parallel
    const promises = localOrder.map((id, index) =>
      supabase
        .from("marketing_stages")
        .update({ order_index: index } as any)
        .eq("id", id as any)
    );

    try {
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["marketing_stages"] });
    } catch {
      toast.error("Erro ao reordenar etapas");
    }

    setDraggedId(null);
    setLocalOrder(null);
  };

  // Debounce name updates
  const nameTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const handleNameChange = useCallback((id: string, value: string) => {
    // Optimistic update in cache
    queryClient.setQueryData<MarketingStage[]>(["marketing_stages"], (old) =>
      old?.map(s => s.id === id ? { ...s, name: value } : s)
    );
    
    if (nameTimerRef.current[id]) clearTimeout(nameTimerRef.current[id]);
    nameTimerRef.current[id] = setTimeout(() => {
      updateStage.mutate({ id, name: value });
    }, 500);
  }, [updateStage, queryClient]);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapas do Workflow de Marketing</CardTitle>
        <CardDescription>
          Configure as etapas disponíveis para o workflow de Marketing. Arraste para reordenar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {displayStages.map((stage) => (
            <div
              key={stage.id}
              draggable
              onDragStart={() => handleDragStart(stage.id)}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 rounded-lg border p-3 transition-colors ${
                draggedId === stage.id ? "opacity-50" : ""
              }`}
            >
              <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground shrink-0" />
              <div
                className="h-5 w-5 rounded-full border shrink-0"
                style={{ backgroundColor: `hsl(${stage.color || "280 67% 60%"})` }}
              />
              <Input
                value={stage.name}
                onChange={(e) => handleNameChange(stage.id, e.target.value)}
                className="h-8 flex-1 min-w-0"
              />
              <Select
                value={stage.meta_status}
                onValueChange={(v: MetaStatus) => updateStage.mutate({ id: stage.id, meta_status: v })}
              >
                <SelectTrigger className="h-8 w-[130px] text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(metaStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1 shrink-0">
                {presetColors.slice(0, 6).map((color) => (
                  <button
                    key={color}
                    onClick={() => updateStage.mutate({ id: stage.id, color })}
                    className={`h-4 w-4 rounded-full border transition-transform ${
                      stage.color === color ? "scale-125 ring-2 ring-ring ring-offset-1" : ""
                    }`}
                    style={{ backgroundColor: `hsl(${color})` }}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive shrink-0"
                onClick={() => deleteStage.mutate(stage.id)}
              >
                <span className="sr-only">Excluir</span>
                ×
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-dashed p-4 space-y-3">
          <Label className="text-sm font-medium">Adicionar Nova Etapa</Label>
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da etapa"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Select value={newMetaStatus} onValueChange={(v: MetaStatus) => setNewMetaStatus(v)}>
              <SelectTrigger className="w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(metaStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
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
