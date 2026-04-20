import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollaborators, Collaborator } from "@/hooks/use-collaborators";
import { CollaboratorProfile } from "@/components/collaborators/CollaboratorProfile";
import { StockTab } from "@/components/collaborators/StockTab";
import { SortDropdown, usePersistentSort, applySorting } from "@/components/ui/sort-dropdown";
import {
  Loader2, Search, Users, Laptop, Smartphone, Phone, FileText, Package,
  LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown, Tablet, Mouse,
} from "lucide-react";
import { DeleteCollaboratorDialog } from "@/components/collaborators/DeleteCollaboratorDialog";
import { NewCollaboratorDialog } from "@/components/collaborators/NewCollaboratorDialog";
import {
  CollaboratorAdvancedFilters, CollaboratorFilters, emptyFilters,
} from "@/components/collaborators/CollaboratorAdvancedFilters";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const catConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  notebooks: { label: "Notebook", icon: Laptop, color: "bg-blue-500/15 text-blue-700 border-blue-300" },
  celulares: { label: "Celular", icon: Smartphone, color: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  linhas: { label: "Linha Telefônica", icon: Phone, color: "bg-purple-500/15 text-purple-700 border-purple-300" },
  licencas: { label: "Licença", icon: FileText, color: "bg-yellow-500/15 text-yellow-700 border-yellow-300" },
  hardware: { label: "Notebook", icon: Laptop, color: "bg-blue-500/15 text-blue-700 border-blue-300" },
  telecom: { label: "Linha Telefônica", icon: Phone, color: "bg-purple-500/15 text-purple-700 border-purple-300" },
  licenses: { label: "Licença", icon: FileText, color: "bg-yellow-500/15 text-yellow-700 border-yellow-300" },
};

type SortKey = "name" | "cargo" | "sector" | "assetCount";
type SortDir = "asc" | "desc";

const collabSortOptions = [
  { value: "name", label: "Nome" },
  { value: "cargo", label: "Cargo" },
  { value: "sector", label: "Departamento" },
  { value: "assetCount", label: "Qtd. ativos" },
];

function useViewPreference() {
  const [view, setView] = useState<"cards" | "list">(() => {
    try { return (localStorage.getItem("collab-view") as "cards" | "list") || "list"; } catch { return "list"; }
  });
  const set = useCallback((v: "cards" | "list") => {
    setView(v);
    try { localStorage.setItem("collab-view", v); } catch {}
  }, []);
  return [view, set] as const;
}

function InlineNameEditor({ name, onRename }: { name: string; onRename: (newName: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  useEffect(() => { setValue(name); }, [name]);

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:underline hover:decoration-dotted"
        onDoubleClick={() => setEditing(true)}
        title="Clique duas vezes para editar"
      >
        {name}
      </span>
    );
  }

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  return (
    <Input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setValue(name); setEditing(false); }
      }}
      className="h-7 w-48 text-sm"
    />
  );
}

function CategoryBadges({ categories }: { categories: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((cat) => {
        const cfg = catConfig[cat];
        return (
          <Badge key={cat} variant="outline" className={cn("gap-1 text-xs", cfg?.color)}>
            {cfg?.icon && <cfg.icon className="h-3 w-3" />}
            {cfg?.label || cat}
          </Badge>
        );
      })}
    </div>
  );
}

async function deleteCollaborator(_name: string, _refetch: () => void) {
  // Legacy - now handled by DeleteCollaboratorDialog
}

async function renameCollaborator(oldName: string, newName: string, refetch: () => void) {
  const { error } = await supabase.from("inventory").update({
    collaborator: newName, updated_at: new Date().toISOString(),
  }).eq("collaborator", oldName);
  if (error) {
    toast.error("Erro ao renomear colaborador");
  } else {
    toast.success(`"${oldName}" renomeado para "${newName}"`);
    refetch();
  }
}

export default function Colaboradores() {
  const { collaborators, loading, refetch } = useCollaborators();
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useViewPreference();
  const { sortKey, sortDir, setSort } = usePersistentSort("collab-sort", "name");
  const [inventoryMatchNames, setInventoryMatchNames] = useState<Set<string>>(new Set());
  const [inventorySearching, setInventorySearching] = useState(false);
  const [advFilters, setAdvFilters] = useState<CollaboratorFilters>({ ...emptyFilters });
  const [advFilteredNames, setAdvFilteredNames] = useState<Set<string> | null>(null);

  // Apply advanced asset-level filters via inventory query
  useEffect(() => {
    const hasAssetFilter = advFilters.hasCategory || advFilters.asset_marca || advFilters.asset_model ||
      advFilters.asset_contrato || advFilters.asset_type || advFilters.asset_operadora ||
      advFilters.asset_gestor || advFilters.asset_status;

    if (!hasAssetFilter) {
      setAdvFilteredNames(null);
      return;
    }

    const timer = setTimeout(async () => {
      let query = supabase
        .from("inventory")
        .select("collaborator")
        .not("collaborator", "is", null)
        .neq("collaborator", "");

      if (advFilters.hasCategory) query = query.eq("category", advFilters.hasCategory);
      if (advFilters.asset_marca) query = query.ilike("marca", `%${advFilters.asset_marca}%`);
      if (advFilters.asset_model) query = query.ilike("model", `%${advFilters.asset_model}%`);
      if (advFilters.asset_contrato) query = query.ilike("contrato", `%${advFilters.asset_contrato}%`);
      if (advFilters.asset_type) query = query.eq("asset_type", advFilters.asset_type);
      if (advFilters.asset_operadora) query = query.eq("operadora", advFilters.asset_operadora);
      if (advFilters.asset_gestor) query = query.ilike("gestor", `%${advFilters.asset_gestor}%`);
      if (advFilters.asset_status) query = query.eq("status", advFilters.asset_status);

      const { data } = await query;
      if (data) {
        setAdvFilteredNames(new Set(data.map((r: any) => (r.collaborator as string).trim()).filter(Boolean)));
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [advFilters]);

  // Search inventory items when query changes
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) {
      setInventoryMatchNames(new Set());
      return;
    }

    const timer = setTimeout(async () => {
      setInventorySearching(true);
      const searchPattern = `%${q}%`;
      const { data } = await supabase
        .from("inventory")
        .select("collaborator")
        .not("collaborator", "is", null)
        .neq("collaborator", "")
        .or([
          `model.ilike.${searchPattern}`,
          `asset_code.ilike.${searchPattern}`,
          `service_tag.ilike.${searchPattern}`,
          `service_tag_2.ilike.${searchPattern}`,
          `marca.ilike.${searchPattern}`,
          `numero.ilike.${searchPattern}`,
          `operadora.ilike.${searchPattern}`,
          `licenca.ilike.${searchPattern}`,
          `contrato.ilike.${searchPattern}`,
          `imei1.ilike.${searchPattern}`,
          `imei2.ilike.${searchPattern}`,
          `asset_type.ilike.${searchPattern}`,
          `email_address.ilike.${searchPattern}`,
        ].join(","));

      if (data) {
        const names = new Set(data.map((r: any) => (r.collaborator as string).trim()).filter(Boolean));
        setInventoryMatchNames(names);
      }
      setInventorySearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const toggleSort = (key: SortKey) => {
    setSort(key);
  };

  const filtered = applySorting(
    collaborators.filter((c) => {
      // Text search
      const q = search.toLowerCase();
      if (q) {
        const textMatch = c.name.toLowerCase().includes(q) ||
          c.cargo?.toLowerCase().includes(q) ||
          c.sector?.toLowerCase().includes(q) ||
          inventoryMatchNames.has(c.name);
        if (!textMatch) return false;
      }

      // Collaborator-level filters
      if (advFilters.cargo && c.cargo !== advFilters.cargo) return false;
      if (advFilters.sector && c.sector !== advFilters.sector) return false;
      if (advFilters.cost_center && c.cost_center !== advFilters.cost_center) return false;

      // Category filter
      if (advFilters.hasCategory && !c.categories.includes(advFilters.hasCategory)) return false;

      // Asset-level filter results
      if (advFilteredNames !== null && !advFilteredNames.has(c.name)) return false;

      return true;
    }),
    sortKey,
    sortDir as "asc" | "desc",
  );

  if (selectedName) {
    return (
      <AppLayout>
        <CollaboratorProfile
          name={selectedName}
          onBack={() => { setSelectedName(null); refetch(); }}
          onNameChange={(newName) => { setSelectedName(newName); refetch(); }}
        />
      </AppLayout>
    );
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <PageHeader
          title="Colaboradores"
          description="Gestão de inventário e ativos por colaborador"
        />
        <NewCollaboratorDialog onCreated={refetch} />
      </div>

      <Tabs defaultValue="colaboradores" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
          <TabsTrigger value="colaboradores" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" />
            <span>Colaboradores</span>
          </TabsTrigger>
          <TabsTrigger value="estoque" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Package className="h-4 w-4" />
            <span>Estoque / Itens sem dono</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores">
          <div className="space-y-4">
            {/* Search + View Toggle */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative max-w-md flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por colaborador, modelo, service tag, linha, licença..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <SortDropdown
                  options={collabSortOptions}
                  sortKey={sortKey}
                  sortDir={sortDir as "asc" | "desc"}
                  onSort={(k, d) => setSort(k, d)}
                />
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(v) => { if (v) setViewMode(v as "cards" | "list"); }}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="cards" aria-label="Visualização em cards">
                    <LayoutGrid className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="Visualização em lista">
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Advanced Filters */}
            <CollaboratorAdvancedFilters filters={advFilters} onChange={setAdvFilters} />

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Users className="mb-3 h-10 w-10" />
                  <p>Nenhum colaborador encontrado</p>
                </CardContent>
              </Card>
            ) : viewMode === "cards" ? (
              /* ========== CARD VIEW ========== */
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((c) => (
                  <Card
                    key={c.name}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 min-h-[120px]"
                    onClick={() => setSelectedName(c.name)}
                  >
                    <CardContent className="p-4 h-full flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary flex-shrink-0 mt-0.5">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "font-medium leading-snug break-words whitespace-normal",
                                c.name.length > 40 && "text-[0.8rem] sm:text-sm"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <InlineNameEditor name={c.name} onRename={(n) => renameCollaborator(c.name, n, refetch)} />
                            </div>
                            {(c.cargo || c.sector) && (
                              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                                {[c.cargo, c.sector].filter(Boolean).join(" · ")}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">{c.assetCount} ativo(s)</p>
                          </div>
                        </div>
                        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <DeleteCollaboratorDialog
                            collaboratorName={c.name}
                            onDone={refetch}
                          />
                        </div>
                      </div>
                      <div className="mt-auto pt-3">
                        <CategoryBadges categories={c.categories} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* ========== LIST VIEW ========== */
              <Card>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {([
                          ["name", "Nome"],
                          ["cargo", "Cargo"],
                          ["sector", "Departamento"],
                          ["assetCount", "Ativos"],
                        ] as [SortKey, string][]).map(([key, label]) => (
                          <TableHead
                            key={key}
                            className="cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                            onClick={() => toggleSort(key)}
                          >
                            <span className="inline-flex items-center">
                              {label}
                              <SortIcon col={key} />
                            </span>
                          </TableHead>
                        ))}
                        <TableHead className="w-[80px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c) => (
                        <TableRow
                          key={c.name}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedName(c.name)}
                        >
                          <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                            <InlineNameEditor name={c.name} onRename={(n) => renameCollaborator(c.name, n, refetch)} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.cargo || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{c.sector || "—"}</TableCell>
                          <TableCell>
                            <CategoryBadges categories={c.categories} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DeleteCollaboratorDialog
                              collaboratorName={c.name}
                              onDone={refetch}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="estoque">
          <StockTab onAssigned={refetch} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
