import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarIcon, DollarSign, Plus, Trash2,
  Package, Link2, BarChart3, Archive,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  MarketingMaterial, useUpdateMaterial,
  useMaterialAllocations, useUpsertAllocation, useDeleteAllocation,
  MaterialAllocation,
} from "@/hooks/use-materials";
import { MarketingEvent } from "@/hooks/use-events";

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

export function MaterialDetailSheet({ material, open, onOpenChange, events }: Props) {
  const updateMaterial = useUpdateMaterial();
  const { data: allAllocations } = useMaterialAllocations();
  const upsertAlloc = useUpsertAllocation();
  const deleteAlloc = useDeleteAllocation();

  const [localActualCost, setLocalActualCost] = useState("");
  const [localUnitCost, setLocalUnitCost] = useState("");
  const [localTotalQty, setLocalTotalQty] = useState("");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [addingAllocation, setAddingAllocation] = useState(false);
  const [newAllocEventId, setNewAllocEventId] = useState("");
  const [newAllocType, setNewAllocType] = useState<"value" | "quantity">("value");
  const [newAllocValue, setNewAllocValue] = useState("");
  const [newAllocQty, setNewAllocQty] = useState("");
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (material) {
      setLocalActualCost(material.actual_cost != null ? String(material.actual_cost) : "");
      setLocalUnitCost(material.unit_cost != null ? String(material.unit_cost) : "");
      setLocalTotalQty(material.total_quantity != null ? String(material.total_quantity) : "");
    }
  }, [material?.id, material?.actual_cost, material?.unit_cost, material?.total_quantity]);

  const debouncedUpdate = useCallback((field: string, value: any) => {
    if (!material) return;
    if (debounceRef.current[field]) clearTimeout(debounceRef.current[field]);
    debounceRef.current[field] = setTimeout(() => {
      updateMaterial.mutate({ id: material.id, [field]: value } as any);
    }, 600);
  }, [material, updateMaterial]);

  // Allocations for this material
  const allocations = useMemo(() => {
    if (!material || !allAllocations) return [];
    return allAllocations.filter(a => a.material_id === material.id);
  }, [material, allAllocations]);

  // Saldo calculations
  const totalAllocatedValue = allocations.reduce((sum, a) => sum + (a.allocated_value || 0), 0);
  const totalAllocatedQty = allocations.reduce((sum, a) => sum + (a.quantity_used || 0), 0);
  const remainingValue = (material?.actual_cost ?? material?.budget ?? 0) - totalAllocatedValue;
  const remainingQty = (material?.total_quantity ?? 0) - totalAllocatedQty;

  // Events already allocated
  const allocatedEventIds = new Set(allocations.map(a => a.event_id));
  const availableEvents = events.filter(e => !allocatedEventIds.has(e.id));

  // Checklist
  const checklist = (material?.checklist ?? []) as Array<{ id: string; text: string; checked: boolean }>;
  const checklistProgress = checklist.length > 0
    ? Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100)
    : 0;

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

  const handleAddAllocation = () => {
    if (!material || !newAllocEventId) return;
    const allocValue = newAllocType === "quantity"
      ? (parseFloat(newAllocQty) || 0) * (material.unit_cost || 0)
      : (parseFloat(newAllocValue) || 0);
    const qty = newAllocType === "quantity" ? parseInt(newAllocQty) || 0 : 0;

    upsertAlloc.mutate({
      material_id: material.id,
      event_id: newAllocEventId,
      allocation_type: newAllocType,
      quantity_used: qty,
      allocated_value: allocValue,
      notes: "",
    });
    setAddingAllocation(false);
    setNewAllocEventId("");
    setNewAllocValue("");
    setNewAllocQty("");
  };

  const invested = material?.actual_cost ?? 0;
  const budgetPercent = material && material.budget > 0 ? Math.min((invested / material.budget) * 100, 100) : 0;

  if (!material) return null;
  const st = statusLabels[material.status] || statusLabels.planning;

  return (
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
          </div>

          {material.description && (
            <p className="text-sm text-muted-foreground">{material.description}</p>
          )}

          {/* Budget & Cost */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" /> Orçamento
                </div>
                <span className="text-sm font-semibold">
                  {material.budget > 0
                    ? material.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "Não definido"}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" /> Valor Real Gasto
                </div>
                <Input
                  type="number" min={0} step="0.01" placeholder="0,00"
                  value={localActualCost}
                  onChange={(e) => {
                    setLocalActualCost(e.target.value);
                    debouncedUpdate("actual_cost", e.target.value ? parseFloat(e.target.value) : null);
                  }}
                  className="h-7 w-full text-sm"
                />
              </div>
            </div>
            {material.budget > 0 && (
              <>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", budgetPercent > 90 ? "bg-destructive" : budgetPercent > 70 ? "bg-warning" : "bg-success")}
                    style={{ width: `${budgetPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Investido: {invested.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  <span>Restante: {((material.budget ?? 0) - invested).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
              </>
            )}

            {/* Unit cost & quantity */}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Custo Unitário</span>
                <Input
                  type="number" min={0} step="0.01" placeholder="0,00"
                  value={localUnitCost}
                  onChange={(e) => {
                    setLocalUnitCost(e.target.value);
                    debouncedUpdate("unit_cost", e.target.value ? parseFloat(e.target.value) : null);
                  }}
                  className="h-7 text-sm"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Quantidade Total</span>
                <Input
                  type="number" min={0} step="1" placeholder="0"
                  value={localTotalQty}
                  onChange={(e) => {
                    setLocalTotalQty(e.target.value);
                    debouncedUpdate("total_quantity", e.target.value ? parseInt(e.target.value) : null);
                  }}
                  className="h-7 text-sm"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ===== RATEIO / ALLOCATIONS ===== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Rateio por Evento ({allocations.length})
              </h4>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddingAllocation(true)} disabled={availableEvents.length === 0}>
                <Plus className="h-3 w-3" /> Alocar
              </Button>
            </div>

            {/* Saldo summary */}
            <div className="p-2.5 rounded-lg border bg-muted/30 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1"><Archive className="h-3 w-3" /> Saldo Financeiro</span>
                <span className={cn("font-semibold", remainingValue < 0 ? "text-destructive" : "text-success")}>
                  {remainingValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
              {material.total_quantity != null && material.total_quantity > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Saldo Quantidade</span>
                  <span className={cn("font-semibold", remainingQty < 0 ? "text-destructive" : "text-success")}>
                    {remainingQty} / {material.total_quantity} un
                  </span>
                </div>
              )}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", totalAllocatedValue > (material.actual_cost ?? material.budget ?? 0) ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${Math.min(((material.actual_cost ?? material.budget ?? 0) > 0 ? (totalAllocatedValue / (material.actual_cost ?? material.budget ?? 1)) * 100 : 0), 100)}%` }}
                />
              </div>
            </div>

            {/* New allocation form */}
            {addingAllocation && (
              <div className="p-3 rounded-lg border space-y-3 bg-muted/10">
                <Select value={newAllocEventId} onValueChange={setNewAllocEventId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecionar evento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEvents.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Select value={newAllocType} onValueChange={(v) => setNewAllocType(v as any)}>
                    <SelectTrigger className="h-8 text-sm w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="value">Por Valor</SelectItem>
                      <SelectItem value="quantity">Por Quantidade</SelectItem>
                    </SelectContent>
                  </Select>

                  {newAllocType === "value" ? (
                    <Input
                      type="number" min={0} step="0.01" placeholder="Valor R$"
                      value={newAllocValue}
                      onChange={(e) => setNewAllocValue(e.target.value)}
                      className="h-8 text-sm flex-1"
                    />
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="number" min={0} step="1" placeholder="Qtd"
                        value={newAllocQty}
                        onChange={(e) => setNewAllocQty(e.target.value)}
                        className="h-8 text-sm"
                      />
                      {material.unit_cost && newAllocQty && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          = {((parseInt(newAllocQty) || 0) * material.unit_cost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingAllocation(false)}>Cancelar</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleAddAllocation} disabled={!newAllocEventId}>Salvar</Button>
                </div>
              </div>
            )}

            {/* Existing allocations */}
            {allocations.length > 0 && (
              <div className="space-y-1.5">
                {allocations.map((alloc) => {
                  const ev = events.find(e => e.id === alloc.event_id);
                  return (
                    <div key={alloc.id} className="flex items-center gap-3 p-2.5 rounded-lg border text-sm group">
                      <Link2 className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{ev?.name || "Evento"}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{alloc.allocated_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          {alloc.allocation_type === "quantity" && alloc.quantity_used > 0 && (
                            <span>{alloc.quantity_used} un</span>
                          )}
                          <Badge variant="outline" className="text-[9px] h-4">
                            {alloc.allocation_type === "quantity" ? "Qtd" : "Valor"}
                          </Badge>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteAlloc.mutate(alloc.id)}
                        className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {allocations.length === 0 && !addingAllocation && (
              <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg border-dashed">
                Nenhuma alocação. Clique em "Alocar" para distribuir este material entre eventos.
              </p>
            )}
          </div>

          <Separator />

          {/* Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Checklist</h4>
              {checklist.length > 0 && <span className="text-xs text-muted-foreground">{checklistProgress}%</span>}
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
                  <span className={cn("text-sm flex-1", item.checked && "line-through text-muted-foreground")}>{item.text}</span>
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

          {/* Notes */}
          {material.notes && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Notas</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{material.notes}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
