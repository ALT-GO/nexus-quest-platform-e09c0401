import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown, Filter, X, Users, Laptop, Smartphone, Phone,
  FileText, Tablet, Mouse, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

/* ── types ─────────────────────────────────────────── */

export interface CollaboratorFilters {
  cargo: string;
  sector: string;
  cost_center: string;
  hasCategory: string; // filter collaborators that have assets in this category
  // Per-category asset filters
  asset_marca: string;
  asset_model: string;
  asset_contrato: string;
  asset_type: string;
  asset_operadora: string;
  asset_gestor: string;
  asset_status: string;
}

export const emptyFilters: CollaboratorFilters = {
  cargo: "",
  sector: "",
  cost_center: "",
  hasCategory: "",
  asset_marca: "",
  asset_model: "",
  asset_contrato: "",
  asset_type: "",
  asset_operadora: "",
  asset_gestor: "",
  asset_status: "",
};

interface DynamicOptions {
  cargos: string[];
  sectors: string[];
  costCenters: string[];
  categories: string[];
}

interface Props {
  filters: CollaboratorFilters;
  onChange: (f: CollaboratorFilters) => void;
}

const catIcons: Record<string, React.ElementType> = {
  notebooks: Laptop,
  celulares: Smartphone,
  linhas: Phone,
  licencas: FileText,
  tablets: Tablet,
  perifericos: Mouse,
};

const catLabels: Record<string, string> = {
  notebooks: "Notebooks",
  celulares: "Celulares",
  linhas: "Linhas Telefônicas",
  licencas: "Licenças",
  tablets: "Tablets",
  perifericos: "Periféricos",
};

export function CollaboratorAdvancedFilters({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<DynamicOptions>({
    cargos: [], sectors: [], costCenters: [], categories: [],
  });

  // Fetch dynamic options from inventory
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("inventory")
        .select("cargo, sector, cost_center, category")
        .not("collaborator", "is", null)
        .neq("collaborator", "");

      if (!data) return;

      const cargos = new Set<string>();
      const sectors = new Set<string>();
      const costCenters = new Set<string>();
      const categories = new Set<string>();

      for (const row of data) {
        if (row.cargo) cargos.add(row.cargo);
        if (row.sector) sectors.add(row.sector);
        if (row.cost_center) costCenters.add(row.cost_center);
        if (row.category) categories.add(row.category);
      }

      setOptions({
        cargos: Array.from(cargos).sort(),
        sectors: Array.from(sectors).sort(),
        costCenters: Array.from(costCenters).sort(),
        categories: Array.from(categories).sort(),
      });
    })();
  }, []);

  const activeCount = useMemo(() =>
    Object.values(filters).filter((v) => v !== "").length,
  [filters]);

  const update = (key: keyof CollaboratorFilters, val: string) => {
    const next = { ...filters, [key]: val === "__all__" ? "" : val };
    // When changing category, clear asset-level filters
    if (key === "hasCategory") {
      next.asset_marca = "";
      next.asset_model = "";
      next.asset_contrato = "";
      next.asset_type = "";
      next.asset_operadora = "";
      next.asset_gestor = "";
      next.asset_status = "";
    }
    onChange(next);
  };

  const clearAll = () => onChange({ ...emptyFilters });

  const selectedCat = filters.hasCategory;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <Filter className="h-3.5 w-3.5" />
            Filtros avançados
            {activeCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                {activeCount}
              </Badge>
            )}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={clearAll}>
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-3 space-y-3">
        {/* ─── Collaborator Filters ─── */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Users className="h-3.5 w-3.5" />
            Colaborador
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect
              label="Cargo"
              value={filters.cargo}
              options={options.cargos}
              onChange={(v) => update("cargo", v)}
            />
            <FilterSelect
              label="Departamento"
              value={filters.sector}
              options={options.sectors}
              onChange={(v) => update("sector", v)}
            />
            <FilterSelect
              label="Centro de custo"
              value={filters.cost_center}
              options={options.costCenters}
              onChange={(v) => update("cost_center", v)}
            />
          </div>
        </div>

        {/* ─── Category selector ─── */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Package className="h-3.5 w-3.5" />
            Filtrar por tipo de ativo
          </div>
          <div className="flex flex-wrap gap-2">
            {options.categories.map((cat) => {
              const Icon = catIcons[cat] || Package;
              const active = selectedCat === cat;
              return (
                <Button
                  key={cat}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => update("hasCategory", active ? "" : cat)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {catLabels[cat] || cat}
                </Button>
              );
            })}
          </div>

          {/* ─── Category-specific asset filters ─── */}
          {selectedCat && (
            <CategoryAssetFilters
              category={selectedCat}
              filters={filters}
              onChange={update}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Select helper ─────────────────────────────────── */

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1 min-w-[160px]">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value || ""} onValueChange={(v) => onChange(v === "__all__" ? "" : v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ── Per-category filters ──────────────────────────── */

function CategoryAssetFilters({
  category, filters, onChange,
}: {
  category: string;
  filters: CollaboratorFilters;
  onChange: (key: keyof CollaboratorFilters, val: string) => void;
}) {
  const [dynOptions, setDynOptions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    (async () => {
      const fields = getFieldsForCategory(category);
      const selectFields = fields.map((f) => f.dbField).join(", ");
      const { data } = await supabase
        .from("inventory")
        .select(selectFields)
        .eq("category", category)
        .not("collaborator", "is", null)
        .neq("collaborator", "");

      if (!data) return;

      const opts: Record<string, Set<string>> = {};
      fields.forEach((f) => { opts[f.filterKey] = new Set(); });

      for (const row of data as any[]) {
        fields.forEach((f) => {
          const val = row[f.dbField];
          if (val && String(val).trim()) opts[f.filterKey].add(String(val).trim());
        });
      }

      const result: Record<string, string[]> = {};
      Object.entries(opts).forEach(([k, s]) => { result[k] = Array.from(s).sort(); });
      setDynOptions(result);
    })();
  }, [category]);

  const fields = getFieldsForCategory(category);

  return (
    <div className="flex flex-wrap items-end gap-3 mt-2 pt-2 border-t border-border/50">
      {fields.map((f) => {
        const options = dynOptions[f.filterKey] || [];
        if (options.length === 0) return null;

        if (f.type === "select") {
          return (
            <FilterSelect
              key={f.filterKey}
              label={f.label}
              value={filters[f.filterKey] || ""}
              options={options}
              onChange={(v) => onChange(f.filterKey, v)}
            />
          );
        }
        return (
          <div key={f.filterKey} className="space-y-1 min-w-[140px] flex-1 max-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <Input
              value={filters[f.filterKey] || ""}
              onChange={(e) => onChange(f.filterKey, e.target.value)}
              placeholder={`Filtrar ${f.label.toLowerCase()}...`}
              className="h-8 text-xs"
            />
          </div>
        );
      })}
    </div>
  );
}

type FieldDef = {
  filterKey: keyof CollaboratorFilters;
  dbField: string;
  label: string;
  type: "text" | "select";
};

function getFieldsForCategory(cat: string): FieldDef[] {
  switch (cat) {
    case "notebooks":
      return [
        { filterKey: "asset_marca", dbField: "marca", label: "Marca", type: "select" },
        { filterKey: "asset_model", dbField: "model", label: "Modelo", type: "select" },
        { filterKey: "asset_contrato", dbField: "contrato", label: "Contrato", type: "select" },
        { filterKey: "asset_type", dbField: "asset_type", label: "Tipo", type: "select" },
      ];
    case "celulares":
      return [
        { filterKey: "asset_marca", dbField: "marca", label: "Marca", type: "select" },
        { filterKey: "asset_model", dbField: "model", label: "Modelo", type: "select" },
        { filterKey: "asset_contrato", dbField: "contrato", label: "Contrato", type: "select" },
      ];
    case "linhas":
      return [
        { filterKey: "asset_operadora", dbField: "operadora", label: "Operadora", type: "select" },
        { filterKey: "asset_gestor", dbField: "gestor", label: "Gestor", type: "select" },
        { filterKey: "asset_contrato", dbField: "contrato", label: "Contrato", type: "select" },
      ];
    case "tablets":
      return [
        { filterKey: "asset_marca", dbField: "marca", label: "Marca", type: "select" },
        { filterKey: "asset_model", dbField: "model", label: "Modelo", type: "select" },
        { filterKey: "asset_contrato", dbField: "contrato", label: "Contrato", type: "select" },
      ];
    case "perifericos":
      return [
        { filterKey: "asset_marca", dbField: "marca", label: "Marca", type: "select" },
        { filterKey: "asset_model", dbField: "model", label: "Modelo", type: "select" },
        { filterKey: "asset_type", dbField: "asset_type", label: "Tipo", type: "select" },
        { filterKey: "asset_contrato", dbField: "contrato", label: "Contrato", type: "select" },
      ];
    case "licencas":
      return [
        { filterKey: "asset_status", dbField: "status", label: "Status", type: "select" },
        { filterKey: "asset_gestor", dbField: "gestor", label: "Gestor", type: "select" },
        { filterKey: "asset_contrato", dbField: "contrato", label: "Contrato", type: "select" },
      ];
    default:
      return [];
  }
}
