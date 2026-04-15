import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  CalendarIcon, DollarSign, Plus, Flag,
  CheckCircle2, Clock, AlertTriangle, Trash2, ListTodo,
  Circle, ArrowUpRight, Package, Link2,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MarketingMaterial, useUpdateMaterial } from "@/hooks/use-materials";
import { MarketingEvent } from "@/hooks/use-events";
import { useMarketingTasks, useMarketingStages, MarketingTask } from "@/hooks/use-marketing";
import { MarketingTaskDetailSheet } from "@/components/marketing/MarketingTaskDetailSheet";
import { NewMarketingTaskDialog } from "@/components/marketing/NewMarketingTaskDialog";
import { useMarketingSprints } from "@/hooks/use-sprints";
import { supabase } from "@/integrations/supabase/client";
import { useProfileAvatars } from "@/hooks/use-profile-avatars";

interface Props {
  material: MarketingMaterial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: MarketingEvent[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground" },
  purchasing: { label: "Compra", color: "bg-primary/15 text-primary" },
  delivered: { label: "Entregue", color: "bg-success/15 text-success" },
  distributed: { label: "Distribuído", color: "bg-chart-2/15 text-chart-2" },
};

const priorityIcons: Record<string, { color: string; label: string }> = {
  high: { color: "text-destructive", label: "Alta" },
  medium: { color: "text-warning", label: "Média" },
  low: { color: "text-muted-foreground", label: "Baixa" },
};

export function MaterialDetailSheet({ material, open, onOpenChange, events }: Props) {
  const updateMaterial = useUpdateMaterial();
  const { data: allTasks } = useMarketingTasks();
  const { data: stages } = useMarketingStages();
  const { data: sprints } = useMarketingSprints();
  const { data: avatars } = useProfileAvatars();
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MarketingTask | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState("");

  const [localActualCost, setLocalActualCost] = useState<string>("");
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (material) {
      setLocalActualCost(material.actual_cost != null ? String(material.actual_cost) : "");
    }
  }, [material?.id, material?.actual_cost]);

  const debouncedUpdate = useCallback((field: string, value: any) => {
    if (!material) return;
    if (debounceRef.current[field]) clearTimeout(debounceRef.current[field]);
    debounceRef.current[field] = setTimeout(() => {
      updateMaterial.mutate({ id: material.id, [field]: value } as any);
    }, 600);
  }, [material, updateMaterial]);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name").then(({ data }) => {
      if (data) setTeamMembers(data.map(p => ({ id: p.id, name: p.full_name })));
    });
  }, []);

  // Linked event
  const linkedEvent = useMemo(() => {
    if (!material?.linked_event_id || !events) return null;
    return events.find(e => e.id === material.linked_event_id) ?? null;
  }, [material, events]);

  // Checklist
  const checklist = (material?.checklist ?? []) as Array<{ id: string; text: string; checked: boolean }>;

  const toggleCheckItem = (itemId: string) => {
    if (!material) return;
    const updated = checklist.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    updateMaterial.mutate({ id: material.id, checklist: updated });
  };

  const addCheckItem = () => {
    if (!material || !newCheckItem.trim()) return;
    const item = { id: `ci_${Date.now()}`, text: newCheckItem.trim(), checked: false };
    updateMaterial.mutate({ id: material.id, checklist: [...checklist, item] });
    setNewCheckItem("");
  };

  const removeCheckItem = (itemId: string) => {
    if (!material) return;
    updateMaterial.mutate({ id: material.id, checklist: checklist.filter(i => i.id !== itemId) });
  };

  const checklistProgress = checklist.length > 0
    ? Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100)
    : 0;

  // Budget tracking
  const invested = material?.actual_cost ?? 0;
  const budgetPercent = material && material.budget > 0 ? Math.min((invested / material.budget) * 100, 100) : 0;

  if (!material) return null;
  const st = statusLabels[material.status] || statusLabels.planning;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <SheetTitle className="text-xl">{material.name}</SheetTitle>
              <Badge variant="outline" className={cn("text-xs", st.color)}>{st.label}</Badge>
            </div>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {material.purchase_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  <span>Compra: {format(new Date(material.purchase_date), "dd MMM yyyy", { locale: ptBR })}</span>
                </div>
              )}
              {linkedEvent && (
                <div className="flex items-center gap-2 text-primary">
                  <Link2 className="h-4 w-4" />
                  <span className="truncate">{linkedEvent.name}</span>
                </div>
              )}
            </div>

            {material.description && (
              <p className="text-sm text-muted-foreground">{material.description}</p>
            )}

            {/* Budget & Actual Cost */}
            <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Orçamento
                  </div>
                  <span className="text-sm font-semibold">
                    {material.budget > 0
                      ? material.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "Não definido"}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Valor Real Gasto
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0,00"
                    value={localActualCost}
                    onChange={(e) => {
                      setLocalActualCost(e.target.value);
                      const val = e.target.value ? parseFloat(e.target.value) : null;
                      debouncedUpdate("actual_cost", val);
                    }}
                    className="h-7 w-full text-sm"
                  />
                </div>
              </div>
              {material.budget > 0 && (
                <>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        budgetPercent > 90 ? "bg-destructive" : budgetPercent > 70 ? "bg-warning" : "bg-success"
                      )}
                      style={{ width: `${budgetPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Investido: {(material.actual_cost ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    <span>Restante: {((material.budget ?? 0) - (material.actual_cost ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                </>
              )}
            </div>

            {/* Notes */}
            {material.notes && (
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Notas</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{material.notes}</p>
              </div>
            )}

            <Separator />

            {/* Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Checklist</h4>
                {checklist.length > 0 && (
                  <span className="text-xs text-muted-foreground">{checklistProgress}%</span>
                )}
              </div>
              {checklist.length > 0 && (
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${checklistProgress}%` }} />
                </div>
              )}
              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 group py-1">
                    <Checkbox checked={item.checked} onCheckedChange={() => toggleCheckItem(item.id)} />
                    <span className={cn("text-sm flex-1", item.checked && "line-through text-muted-foreground")}>
                      {item.text}
                    </span>
                    <button onClick={() => removeCheckItem(item.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  placeholder="Novo item..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && addCheckItem()}
                />
                <Button size="sm" variant="outline" className="h-8" onClick={addCheckItem} disabled={!newCheckItem.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
