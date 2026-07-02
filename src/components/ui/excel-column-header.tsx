import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, Filter as FilterIcon, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc" | null;

interface Props {
  label: string;
  values: string[];               // all raw values (may repeat, may be empty)
  selected: string[] | null;      // null = all selected
  onChange: (next: string[] | null) => void;
  sortDir: SortDir;
  onSort: (dir: SortDir) => void;
  align?: "left" | "right";
}

const EMPTY_LABEL = "(Vazio)";
const EMPTY_KEY = "__EMPTY__";

export function ExcelColumnHeader({
  label, values, selected, onChange, sortDir, onSort, align = "left",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const unique = useMemo(() => {
    const set = new Set<string>();
    for (const v of values) {
      const norm = (v ?? "").toString().trim();
      set.add(norm === "" ? EMPTY_KEY : norm);
    }
    return Array.from(set).sort((a, b) => {
      if (a === EMPTY_KEY) return 1;
      if (b === EMPTY_KEY) return -1;
      return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
    });
  }, [values]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unique;
    return unique.filter((v) => (v === EMPTY_KEY ? EMPTY_LABEL : v).toLowerCase().includes(q));
  }, [unique, search]);

  const isSelected = (v: string) => selected === null || selected.includes(v);
  const allVisibleSelected = visible.length > 0 && visible.every(isSelected);
  const someVisibleSelected = visible.some(isSelected);
  const filterActive = selected !== null && selected.length !== unique.length;

  const toggle = (v: string) => {
    const base = selected ?? [...unique];
    const next = base.includes(v) ? base.filter((x) => x !== v) : [...base, v];
    if (next.length === unique.length) onChange(null);
    else onChange(next);
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      // remove visible from selection
      const base = selected ?? [...unique];
      const next = base.filter((v) => !visible.includes(v));
      onChange(next);
    } else {
      const base = new Set(selected ?? []);
      visible.forEach((v) => base.add(v));
      const arr = Array.from(base);
      onChange(arr.length === unique.length ? null : arr);
    }
  };

  const clearFilter = () => {
    onChange(null);
    onSort(null);
    setSearch("");
  };

  return (
    <div className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
      <span>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted transition-colors",
              (filterActive || sortDir) && "bg-primary/10 text-primary"
            )}
            aria-label={`Filtrar ${label}`}
          >
            {filterActive ? <FilterIcon className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="border-b p-1">
            <button
              onClick={() => { onSort("asc"); }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted",
                sortDir === "asc" && "bg-muted font-medium"
              )}
            >
              <ArrowDownAZ className="h-3.5 w-3.5" /> Ordenar de A a Z
            </button>
            <button
              onClick={() => { onSort("desc"); }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted",
                sortDir === "desc" && "bg-muted font-medium"
              )}
            >
              <ArrowUpAZ className="h-3.5 w-3.5" /> Ordenar de Z a A
            </button>
            {(filterActive || sortDir) && (
              <button
                onClick={clearFilter}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> Limpar filtro/ordenação
              </button>
            )}
          </div>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar..."
                className="h-7 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="p-1">
            <label className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted cursor-pointer font-medium">
              <Checkbox
                checked={allVisibleSelected ? true : (someVisibleSelected ? "indeterminate" : false)}
                onCheckedChange={toggleAll}
              />
              (Selecionar Tudo)
            </label>
            <ScrollArea className="h-56">
              <div className="pr-2">
                {visible.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground text-center">Sem resultados</p>
                )}
                {visible.map((v) => (
                  <label
                    key={v}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted cursor-pointer"
                  >
                    <Checkbox checked={isSelected(v)} onCheckedChange={() => toggle(v)} />
                    <span className="truncate" title={v === EMPTY_KEY ? EMPTY_LABEL : v}>
                      {v === EMPTY_KEY ? EMPTY_LABEL : v}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="flex justify-end gap-1 border-t p-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearFilter}>
              Limpar
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              OK
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Helper: given items and per-column selection map, filter them
export function applyColumnFilters<T>(
  items: T[],
  filters: Record<string, string[] | null>,
  getters: Record<string, (item: T) => string>,
): T[] {
  return items.filter((item) => {
    for (const key of Object.keys(filters)) {
      const sel = filters[key];
      if (sel === null || sel === undefined) continue;
      const raw = (getters[key](item) ?? "").toString().trim();
      const norm = raw === "" ? EMPTY_KEY : raw;
      if (!sel.includes(norm)) return false;
    }
    return true;
  });
}

export function applyColumnSort<T>(
  items: T[],
  sortKey: string | null,
  sortDir: SortDir,
  getters: Record<string, (item: T) => string>,
): T[] {
  if (!sortKey || !sortDir) return items;
  const getter = getters[sortKey];
  if (!getter) return items;
  const sign = sortDir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = (getter(a) ?? "").toString();
    const vb = (getter(b) ?? "").toString();
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return va.localeCompare(vb, "pt-BR", { numeric: true, sensitivity: "base" }) * sign;
  });
}

export { EMPTY_KEY };
