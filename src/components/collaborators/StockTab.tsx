import { useState, useCallback, useRef, useEffect } from "react";
import { useAvailableStock, CollaboratorAsset } from "@/hooks/use-collaborators";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Package, UserPlus, Laptop, Smartphone, Phone, FileText, GripVertical, Tablet, Mouse, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { StockDetailDialog } from "./StockDetailDialog";
import { format } from "date-fns";
import { InlineStockCell } from "./InlineStockCell";
import { StatusSelectCell } from "./StatusSelectCell";
import { StockFilters, getFiltersForCategory } from "./StockFilters";
import { AddStockItemDialog } from "./AddStockItemDialog";
import { SortDropdown, usePersistentSort, applySorting, SortOption } from "@/components/ui/sort-dropdown";
import { cn } from "@/lib/utils";

/* ── Condition labels ───────────────────────────────────────── */
const conditionOptions = [
  { value: "ready", label: "Pronto para uso", color: "bg-success/15 text-success" },
  { value: "maintenance", label: "Em manutenção", color: "bg-warning/15 text-warning" },
  { value: "blocked", label: "Bloqueado", color: "bg-destructive/15 text-destructive" },
  { value: "scrap", label: "Sucata", color: "bg-muted text-muted-foreground" },
];

export function getConditionLabel(value: string) {
  return conditionOptions.find((o) => o.value === value) || conditionOptions[0];
}

/* ── Condition Select Cell ─────────────────────────────────── */
function ConditionSelectCell({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const current = getConditionLabel(value);

  const handleChange = async (v: string) => {
    if (v === value) return;
    setSaving(true);
    try {
      await onSave(v);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Select value={value || "ready"} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="h-7 text-xs border-0 shadow-none px-1.5 w-[140px]">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", current.color)}>
            {current.label}
          </span>
        </SelectTrigger>
        <SelectContent>
          {conditionOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", opt.color)}>
                {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
}

/* ── Assign dialog ─────────────────────────────────────────── */
function AssignDialog({ asset, onAssigned }: { asset: CollaboratorAsset; onAssigned: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allCollaborators, setAllCollaborators] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("inventory")
        .select("collaborator")
        .neq("collaborator", "")
        .not("collaborator", "is", null);
      if (data) {
        const unique = [...new Set(data.map((d: any) => d.collaborator as string).filter(Boolean))].sort();
        setAllCollaborators(unique);
      }
    };
    fetch();
  }, [open]);

  useEffect(() => {
    if (!name.trim() || name.length < 2) {
      setSuggestions([]);
      return;
    }
    const q = name.toLowerCase();
    setSuggestions(allCollaborators.filter((c) => c.toLowerCase().includes(q)).slice(0, 8));
  }, [name, allCollaborators]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAssign = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("inventory").update({
      collaborator: name.trim(),
      status: asset.category === "licencas" ? "Ativo" : "Em uso",
      updated_at: new Date().toISOString(),
    }).eq("id", asset.id);
    toast.success(`Ativo ${asset.asset_code} vinculado a ${name.trim()}`);
    setSaving(false);
    setName("");
    setOpen(false);
    onAssigned();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
          <UserPlus className="h-3 w-3" /> Vincular
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Vincular ativo a colaborador</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{asset.asset_code} — {asset.model || asset.licenca || asset.numero || "Sem nome"}</p>
        <div className="space-y-3 pt-2">
          <div className="relative" ref={dropdownRef}>
            <Input
              placeholder="Nome do colaborador"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAssign()}
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => { setName(s); setSuggestions([]); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={saving || !name.trim()}>
              {saving ? "Salvando..." : "Vincular"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Column definitions per category ───────────────────────── */
interface ColDef {
  id: string;
  header: string;
  field: keyof CollaboratorAsset | null; // null = computed
  accessor: (item: CollaboratorAsset) => string;
}

const notebookCols: ColDef[] = [
  { id: "condition", header: "Condição", field: "condition", accessor: (i) => i.condition || "ready" },
  { id: "service_tag", header: "Service tag", field: "service_tag", accessor: (i) => i.service_tag || "" },
  { id: "marca", header: "Marca", field: "marca", accessor: (i) => i.marca || "" },
  { id: "model", header: "Modelo", field: "model", accessor: (i) => i.model || "" },
  { id: "cost_center", header: "Centro de custo", field: "cost_center", accessor: (i) => i.cost_center || "" },
  { id: "contrato", header: "Contrato", field: "contrato", accessor: (i) => i.contrato || "" },
  { id: "asset_type", header: "Tipo", field: "asset_type", accessor: (i) => i.asset_type || "" },
  { id: "notes", header: "Notas", field: "notes", accessor: (i) => i.notes || "" },
  { id: "service_tag_2", header: "Service tag 2", field: "service_tag_2", accessor: (i) => i.service_tag_2 || "" },
];

const celularCols: ColDef[] = [
  { id: "condition", header: "Condição", field: "condition", accessor: (i) => i.condition || "ready" },
  { id: "service_tag", header: "Service tag", field: "service_tag", accessor: (i) => i.service_tag || "" },
  { id: "marca", header: "Marca", field: "marca", accessor: (i) => i.marca || "" },
  { id: "model", header: "Modelo", field: "model", accessor: (i) => i.model || "" },
  { id: "cost_center", header: "Centro de custo", field: "cost_center", accessor: (i) => i.cost_center || "" },
  { id: "contrato", header: "Contrato", field: "contrato", accessor: (i) => i.contrato || "" },
  { id: "asset_type", header: "Tipo", field: "asset_type", accessor: (i) => i.asset_type || "" },
  { id: "notes", header: "Notas", field: "notes", accessor: (i) => i.notes || "" },
  { id: "imei1", header: "Imei 1", field: "imei1", accessor: (i) => i.imei1 || "" },
  { id: "imei2", header: "Imei 2", field: "imei2", accessor: (i) => i.imei2 || "" },
];

const linhaCols: ColDef[] = [
  { id: "numero", header: "Número", field: "numero", accessor: (i) => i.numero || "" },
  { id: "asset_type", header: "Tipo", field: "asset_type", accessor: (i) => i.asset_type || "" },
  { id: "gestor", header: "Gestor", field: "gestor", accessor: (i) => i.gestor || "" },
  { id: "operadora", header: "Operadora", field: "operadora", accessor: (i) => i.operadora || "" },
  { id: "contrato", header: "Contrato", field: "contrato", accessor: (i) => i.contrato || "" },
  { id: "cost_center_eng", header: "Centro de custo - Eng", field: "cost_center_eng", accessor: (i) => i.cost_center_eng || "" },
  { id: "cost_center_man", header: "Centro de custo - Man", field: "cost_center_man", accessor: (i) => i.cost_center_man || "" },
  { id: "notes", header: "Notas", field: "notes", accessor: (i) => i.notes || "" },
];

const licencaCols: ColDef[] = [
  { id: "status", header: "Status", field: "status", accessor: (i) => i.status || "" },
  { id: "collaborator", header: "Colaborador", field: "collaborator", accessor: (i) => i.collaborator || "" },
  { id: "cargo", header: "Cargo", field: "cargo", accessor: (i) => i.cargo || "" },
  { id: "email_address", header: "E-mail", field: "email_address", accessor: (i) => i.email_address || "" },
  { id: "created_at", header: "Data criação", field: null, accessor: (i) => i.created_at ? format(new Date(i.created_at), "dd/MM/yyyy") : "" },
  { id: "data_bloqueio", header: "Data de Bloqueio", field: "data_bloqueio" as any, accessor: (i) => (i as any).data_bloqueio ? format(new Date((i as any).data_bloqueio), "dd/MM/yyyy") : "" },
  { id: "licenca", header: "Licença", field: "licenca", accessor: (i) => i.licenca || "" },
  { id: "gestor", header: "Gestor", field: "gestor", accessor: (i) => i.gestor || "" },
  { id: "contrato", header: "Contrato", field: "contrato", accessor: (i) => i.contrato || "" },
  { id: "cost_center_eng", header: "Centro de custo - Eng", field: "cost_center_eng", accessor: (i) => i.cost_center_eng || "" },
  { id: "cost_center_man", header: "Centro de custo - Man", field: "cost_center_man", accessor: (i) => i.cost_center_man || "" },
];

const tabletCols: ColDef[] = [
  { id: "condition", header: "Condição", field: "condition", accessor: (i) => i.condition || "ready" },
  { id: "service_tag", header: "Service tag", field: "service_tag", accessor: (i) => i.service_tag || "" },
  { id: "marca", header: "Marca", field: "marca", accessor: (i) => i.marca || "" },
  { id: "model", header: "Modelo", field: "model", accessor: (i) => i.model || "" },
  { id: "imei1", header: "IMEI / S/N", field: "imei1", accessor: (i) => i.imei1 || "" },
  { id: "cost_center", header: "Centro de custo", field: "cost_center", accessor: (i) => i.cost_center || "" },
  { id: "contrato", header: "Contrato", field: "contrato", accessor: (i) => i.contrato || "" },
  { id: "notes", header: "Notas", field: "notes", accessor: (i) => i.notes || "" },
];

const perifericoCols: ColDef[] = [
  { id: "condition", header: "Condição", field: "condition", accessor: (i) => i.condition || "ready" },
  { id: "service_tag", header: "Service tag / P/N", field: "service_tag", accessor: (i) => i.service_tag || "" },
  { id: "marca", header: "Marca", field: "marca", accessor: (i) => i.marca || "" },
  { id: "model", header: "Modelo", field: "model", accessor: (i) => i.model || "" },
  { id: "asset_type", header: "Tipo", field: "asset_type", accessor: (i) => i.asset_type || "" },
  { id: "cost_center", header: "Centro de custo", field: "cost_center", accessor: (i) => i.cost_center || "" },
  { id: "contrato", header: "Contrato", field: "contrato", accessor: (i) => i.contrato || "" },
  { id: "notes", header: "Notas", field: "notes", accessor: (i) => i.notes || "" },
];

const defaultColsByCat: Record<string, ColDef[]> = {
  notebooks: notebookCols,
  celulares: celularCols,
  tablets: tabletCols,
  perifericos: perifericoCols,
  linhas: linhaCols,
  licencas: licencaCols,
};

const tabConfig = [
  { key: "notebooks", label: "Notebooks", icon: Laptop },
  { key: "celulares", label: "Celulares", icon: Smartphone },
  { key: "tablets", label: "Tablets", icon: Tablet },
  { key: "perifericos", label: "Periféricos", icon: Mouse },
  { key: "linhas", label: "Linhas", icon: Phone },
  { key: "licencas", label: "Licenças", icon: FileText },
];

const commonSortOpts: SortOption[] = [
  { value: "created_at", label: "Data criação" },
  { value: "cost_center", label: "Centro de custo" },
];

const sortOptionsByCategory: Record<string, SortOption[]> = {
  notebooks: [...commonSortOpts, { value: "marca", label: "Marca" }, { value: "model", label: "Modelo" }],
  celulares: [...commonSortOpts, { value: "marca", label: "Marca" }, { value: "model", label: "Modelo" }],
  tablets: [...commonSortOpts, { value: "marca", label: "Marca" }, { value: "model", label: "Modelo" }],
  perifericos: [...commonSortOpts, { value: "marca", label: "Marca" }, { value: "model", label: "Modelo" }, { value: "asset_type", label: "Tipo" }],
  linhas: [
    { value: "created_at", label: "Data criação" },
    { value: "operadora", label: "Operadora" },
    { value: "gestor", label: "Gestor" },
  ],
  licencas: [
    { value: "collaborator", label: "Colaborador" },
    { value: "created_at", label: "Data criação" },
    { value: "status", label: "Status" },
    { value: "licenca", label: "Tipo de licença" },
  ],
};

/* ── Helper: is item "unowned" ─────────────────────────────── */
function isUnowned(collaborator: string | null | undefined): boolean {
  if (!collaborator) return true;
  const trimmed = collaborator.trim();
  return trimmed === "" || trimmed === "-" || trimmed === "—";
}

/* ── Column order hook with localStorage ───────────────────── */
function useColumnOrder(category: string, defaultCols: ColDef[]): [ColDef[], (fromIdx: number, toIdx: number) => void] {
  const storageKey = `stock-col-order-${category}`;
  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return defaultCols.map((c) => c.id);
  });

  const reorder = useCallback((fromIdx: number, toIdx: number) => {
    setOrderedIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  // Map ordered IDs to actual ColDef objects
  const colMap = new Map(defaultCols.map((c) => [c.id, c]));
  const ordered = orderedIds
    .map((id) => colMap.get(id))
    .filter(Boolean) as ColDef[];
  // Append any new cols not in saved order
  for (const col of defaultCols) {
    if (!ordered.find((c) => c.id === col.id)) ordered.push(col);
  }

  return [ordered, reorder];
}

/* ── Sortable Draggable Header ──────────────────────────────── */
function DraggableHeader({
  col,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  sortKey,
  sortDir,
  onSort,
}: {
  col: ColDef;
  index: number;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (idx: number) => void;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  onSort: (colId: string) => void;
}) {
  const isSorted = sortKey === col.id;
  return (
    <TableHead
      className="whitespace-nowrap select-none cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
    >
      <span
        className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
        onClick={(e) => { e.stopPropagation(); onSort(col.id); }}
      >
        <GripVertical className="h-3 w-3 opacity-30" />
        {col.header}
        {isSorted ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-20" />
        )}
      </span>
    </TableHead>
  );
}

/* ── Category Table ────────────────────────────────────────── */
function CategoryStockTable({
  items,
  category,
  search,
  onAssigned,
  onCellSave,
  onDelete,
  advancedFilters,
  stockSortKey,
  stockSortDir,
}: {
  items: CollaboratorAsset[];
  category: string;
  search: string;
  onAssigned: () => void;
  onCellSave: (id: string, field: string, value: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  advancedFilters: Record<string, string>;
  stockSortKey: string;
  stockSortDir: "asc" | "desc";
}) {
  const [columns, reorderColumns] = useColumnOrder(category, defaultColsByCat[category]);
  const dragIdx = useRef<number | null>(null);

  const [colSortKey, setColSortKey] = useState<string | null>(null);
  const [colSortDir, setColSortDir] = useState<"asc" | "desc">("asc");

  const handleColSort = (colId: string) => {
    if (colSortKey === colId) {
      setColSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setColSortKey(colId);
      setColSortDir("asc");
    }
  };

  // Find accessor for the column being sorted
  const sortedCol = colSortKey ? columns.find((c) => c.id === colSortKey) : null;

  const filtered = items.filter((i) => {
    if (search) {
      const q = search.toLowerCase();
      if (!columns.some((col) => col.accessor(i).toLowerCase().includes(q))) return false;
    }
    for (const [field, val] of Object.entries(advancedFilters)) {
      if (!val) continue;
      const itemVal = ((i as any)[field] ?? "").toString().toLowerCase();
      if (!itemVal.includes(val.toLowerCase())) return false;
    }
    return true;
  });

  // Apply column header sort first, then fall back to dropdown sort
  const sorted = sortedCol
    ? [...filtered].sort((a, b) => {
        const aVal = sortedCol.accessor(a).toLowerCase();
        const bVal = sortedCol.accessor(b).toLowerCase();
        const cmp = aVal.localeCompare(bVal, "pt-BR");
        return colSortDir === "asc" ? cmp : -cmp;
      })
    : applySorting(filtered, stockSortKey, stockSortDir);

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, _idx: number) => { e.preventDefault(); };
  const handleDrop = (toIdx: number) => {
    if (dragIdx.current !== null && dragIdx.current !== toIdx) {
      reorderColumns(dragIdx.current, toIdx);
    }
    dragIdx.current = null;
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col, idx) => (
                  <DraggableHeader
                    key={col.id}
                    col={col}
                    index={idx}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    sortKey={colSortKey}
                    sortDir={colSortDir}
                    onSort={handleColSort}
                  />
                ))}
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item) => (
                <TableRow key={item.id}>
                  {columns.map((col) => (
                    <TableCell key={col.id} className="whitespace-nowrap p-1.5">
                      {col.id === "condition" ? (
                        <ConditionSelectCell
                          value={col.accessor(item)}
                          onSave={(v) => onCellSave(item.id, "condition", v)}
                        />
                      ) : col.id === "status" && category === "licencas" ? (
                        <StatusSelectCell
                          value={col.accessor(item)}
                          onSave={(v) => onCellSave(item.id, "status", v)}
                        />
                      ) : col.field ? (
                        <InlineStockCell
                          value={col.accessor(item)}
                          onSave={(v) => onCellSave(item.id, col.field!, v)}
                        />
                      ) : (
                        <span className="text-sm px-1">{col.accessor(item) || <span className="text-muted-foreground italic">—</span>}</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StockDetailDialog asset={item} onUpdated={onAssigned} />
                      <AssignDialog asset={item} onAssigned={onAssigned} />
                      <ConfirmDeleteDialog
                        onConfirm={() => onDelete(item.id)}
                        title="Excluir item do estoque"
                        description={`Tem certeza que deseja excluir "${item.model || item.licenca || item.numero || item.asset_code}" permanentemente?`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8" />
                    Nenhum item disponível nesta categoria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main StockTab ─────────────────────────────────────────── */
interface StockTabProps {
  onAssigned: () => void;
}

export function StockTab({ onAssigned }: StockTabProps) {
  const { items, loading, refetch } = useAvailableStock();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("notebooks");
  const [filtersByTab, setFiltersByTab] = useState<Record<string, Record<string, string>>>({
    notebooks: {}, celulares: {}, tablets: {}, perifericos: {}, linhas: {}, licencas: {},
  });
  const [licenseStatusFilter, setLicenseStatusFilter] = useState<"all" | "Ativo" | "Inativo">("all");

  // Per-tab sorting with persistence
  const nbSort = usePersistentSort("stock-sort-notebooks", "created_at", "desc");
  const celSort = usePersistentSort("stock-sort-celulares", "created_at", "desc");
  const tabSort2 = usePersistentSort("stock-sort-tablets", "created_at", "desc");
  const perSort = usePersistentSort("stock-sort-perifericos", "created_at", "desc");
  const linSort = usePersistentSort("stock-sort-linhas", "created_at", "desc");
  const licSort = usePersistentSort("stock-sort-licencas", "created_at", "desc");
  const sortByTab: Record<string, typeof nbSort> = {
    notebooks: nbSort, celulares: celSort, tablets: tabSort2, perifericos: perSort, linhas: linSort, licencas: licSort,
  };

  const unowned = items.filter((i) => isUnowned(i.collaborator));

  // For licenses, fetch ALL items (not just unowned)
  const [allLicenses, setAllLicenses] = useState<CollaboratorAsset[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(true);

  const fetchAllLicenses = useCallback(async () => {
    setLicensesLoading(true);
    const { data } = await supabase
      .from("inventory")
      .select("*")
      .in("category", ["licencas", "licenses"])
      .order("created_at", { ascending: false });
    setAllLicenses((data as unknown as CollaboratorAsset[]) || []);
    setLicensesLoading(false);
  }, []);

  // Fetch licenses on mount and subscribe to realtime
  useEffect(() => {
    fetchAllLicenses();
    const channel = supabase
      .channel("licenses-stock-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => fetchAllLicenses())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAllLicenses]);

  const handleAssigned = () => {
    refetch();
    fetchAllLicenses();
    onAssigned();
  };

  const handleCellSave = async (id: string, field: string, value: string) => {
    const updates: Record<string, any> = { [field]: value, updated_at: new Date().toISOString() };

    // Auto-fill data_bloqueio when marking license as Inativo
    if (field === "status" && value === "Inativo") {
      updates.data_bloqueio = new Date().toISOString().split("T")[0];
    }
    // Clear data_bloqueio when reactivating
    if (field === "status" && value === "Ativo") {
      updates.data_bloqueio = null;
    }

    const { error } = await supabase
      .from("inventory")
      .update(updates as any)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar alteração");
    } else {
      refetch();
      fetchAllLicenses();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir item");
    } else {
      toast.success("Item excluído do estoque");
      refetch();
      fetchAllLicenses();
    }
  };

  if (loading || licensesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // License items with status quick filter
  const filteredLicenses = allLicenses.filter((i) => {
    if (licenseStatusFilter === "all") return true;
    return (i.status || "").toLowerCase() === licenseStatusFilter.toLowerCase();
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar no estoque..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {tabConfig.map((tab) => {
            const count = tab.key === "licencas"
              ? allLicenses.length
              : unowned.filter((i) => i.category === tab.key).length;
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                <tab.icon className="h-4 w-4" />
                {tab.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabConfig.map((tab) => {
          const tabSort = sortByTab[tab.key];
          const tabSortOptions = sortOptionsByCategory[tab.key] || commonSortOpts;
          return (
            <TabsContent key={tab.key} value={tab.key} className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {tab.key === "licencas" && (
                    <>
                      <span className="text-xs font-medium text-muted-foreground">Exibir:</span>
                      {(["all", "Ativo", "Inativo"] as const).map((opt) => (
                        <Button
                          key={opt}
                          variant={licenseStatusFilter === opt ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setLicenseStatusFilter(opt)}
                        >
                          {opt === "all" ? "Todas" : opt === "Ativo" ? "Somente ativas" : "Somente inativas"}
                        </Button>
                      ))}
                    </>
                  )}
                  <SortDropdown
                    options={tabSortOptions}
                    sortKey={tabSort.sortKey}
                    sortDir={tabSort.sortDir as "asc" | "desc"}
                    onSort={(k, d) => tabSort.setSort(k, d)}
                  />
                </div>
                <AddStockItemDialog category={tab.key} onCreated={handleAssigned} />
              </div>
              <StockFilters
                category={tab.key}
                values={filtersByTab[tab.key] || {}}
                onChange={(v) => setFiltersByTab((prev) => ({ ...prev, [tab.key]: v }))}
              />
              <CategoryStockTable
                items={tab.key === "licencas"
                  ? filteredLicenses
                  : unowned.filter((i) => i.category === tab.key)}
                category={tab.key}
                search={search}
                onAssigned={handleAssigned}
                onCellSave={handleCellSave}
                onDelete={handleDelete}
                advancedFilters={filtersByTab[tab.key] || {}}
                stockSortKey={tabSort.sortKey}
                stockSortDir={tabSort.sortDir as "asc" | "desc"}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
