import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

export type FilterDef = {
  id: string;
  label: string;
  type: "text" | "select";
  options?: string[];
};

const filtersByCategory: Record<string, FilterDef[]> = {
  notebooks: [
    { id: "marca", label: "Marca", type: "text" },
    { id: "model", label: "Modelo", type: "text" },
    { id: "cost_center", label: "Centro de custo", type: "text" },
    { id: "contrato", label: "Contrato", type: "text" },
    { id: "asset_type", label: "Tipo", type: "select", options: ["Administrativo", "Campo"] },
  ],
  celulares: [
    { id: "marca", label: "Marca", type: "text" },
    { id: "model", label: "Modelo", type: "text" },
    { id: "cost_center", label: "Centro de custo", type: "text" },
    { id: "contrato", label: "Contrato", type: "text" },
    { id: "asset_type", label: "Tipo", type: "text" },
  ],
  linhas: [
    { id: "operadora", label: "Operadora", type: "text" },
    { id: "gestor", label: "Gestor", type: "text" },
    { id: "cost_center_eng", label: "Centro de custo - Eng", type: "text" },
    { id: "cost_center_man", label: "Centro de custo - Man", type: "text" },
    { id: "contrato", label: "Contrato", type: "text" },
  ],
  tablets: [
    { id: "marca", label: "Marca", type: "text" },
    { id: "model", label: "Modelo", type: "text" },
    { id: "cost_center", label: "Centro de custo", type: "text" },
    { id: "contrato", label: "Contrato", type: "text" },
  ],
  perifericos: [
    { id: "marca", label: "Marca", type: "text" },
    { id: "model", label: "Modelo", type: "text" },
    { id: "asset_type", label: "Tipo", type: "select", options: ["Mouse", "Teclado", "Carregador", "Monitor", "Headset", "Docking Station", "Outro"] },
    { id: "cost_center", label: "Centro de custo", type: "text" },
    { id: "contrato", label: "Contrato", type: "text" },
  ],
  licencas: [
    { id: "cost_center_eng", label: "Centro de custo - Eng", type: "text" },
    { id: "cost_center_man", label: "Centro de custo - Man", type: "text" },
    { id: "contrato", label: "Contrato", type: "text" },
    { id: "gestor", label: "Gestor", type: "text" },
  ],
};

interface StockFiltersProps {
  category: string;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function getFiltersForCategory(category: string): FilterDef[] {
  return filtersByCategory[category] || [];
}

export function StockFilters({ category, values, onChange }: StockFiltersProps) {
  const filters = filtersByCategory[category] || [];
  const hasActive = Object.values(values).some((v) => v !== "");

  const update = (id: string, val: string) => {
    onChange({ ...values, [id]: val });
  };

  const clearAll = () => {
    const empty: Record<string, string> = {};
    filters.forEach((f) => { empty[f.id] = ""; });
    onChange(empty);
  };

  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
      {filters.map((f) =>
        f.type === "select" ? (
          <div key={f.id} className="space-y-1 min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <Select value={values[f.id] || ""} onValueChange={(v) => update(f.id, v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {f.options?.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div key={f.id} className="space-y-1 min-w-[140px] flex-1 max-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <Input
              value={values[f.id] || ""}
              onChange={(e) => update(f.id, e.target.value)}
              placeholder={`Filtrar ${f.label.toLowerCase()}...`}
              className="h-8 text-xs"
            />
          </div>
        )
      )}
      {hasActive && (
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={clearAll}>
          <X className="h-3 w-3" /> Limpar filtros
        </Button>
      )}
    </div>
  );
}
