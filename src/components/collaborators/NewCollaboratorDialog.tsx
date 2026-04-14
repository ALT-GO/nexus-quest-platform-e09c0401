import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Laptop, Smartphone, Phone, FileText, Search, ChevronsUpDown, X } from "lucide-react";
import { getConditionLabel } from "@/components/collaborators/StockTab";
import { cn } from "@/lib/utils";

interface AvailableAsset {
  id: string;
  asset_code: string;
  model: string | null;
  service_tag: string | null;
  service_tag_2: string | null;
  numero: string | null;
  licenca: string | null;
  marca: string | null;
  condition: string | null;
  contrato: string | null;
}

const ASSET_CATEGORIES = [
  { key: "notebooks", label: "Notebook", icon: Laptop },
  { key: "celulares", label: "Celular", icon: Smartphone },
  { key: "linhas", label: "Linha", icon: Phone },
  { key: "licencas", label: "Licença", icon: FileText },
] as const;

interface Props {
  onCreated: () => void;
}

export function NewCollaboratorDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Basic fields
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [gestor, setGestor] = useState("");

  // Selected asset IDs per category
  const [selectedAssets, setSelectedAssets] = useState<Record<string, string>>({});

  // Available assets per category
  const [availableAssets, setAvailableAssets] = useState<Record<string, AvailableAsset[]>>({});
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Search per category popover
  const [categorySearch, setCategorySearch] = useState<Record<string, string>>({});
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

  const fetchAvailable = useCallback(async () => {
    setLoadingAssets(true);
    const results: Record<string, AvailableAsset[]> = {};

    const promises = ASSET_CATEGORIES.map(async (cat) => {
      const statusFilter = cat.key === "licencas" ? "Ativo" : "Disponível";
      const { data } = await supabase
        .from("inventory")
        .select("id, asset_code, model, service_tag, service_tag_2, numero, licenca, marca, condition, contrato")
        .eq("category", cat.key)
        .eq("status", statusFilter)
        .or("collaborator.eq.,collaborator.is.null")
        .order("asset_code");

      results[cat.key] = (data || []) as AvailableAsset[];
    });

    await Promise.all(promises);
    setAvailableAssets(results);
    setLoadingAssets(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchAvailable();
      setNome("");
      setCargo("");
      setDepartamento("");
      setGestor("");
      setSelectedAssets({});
      setCategorySearch({});
      setOpenPopovers({});
    }
  }, [open, fetchAvailable]);

  const getSelectedAssetLabel = (catKey: string) => {
    const assetId = selectedAssets[catKey];
    if (!assetId) return "Nenhum selecionado";
    const assets = availableAssets[catKey] || [];
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return "Nenhum selecionado";
    const parts: string[] = [];
    if (catKey === "linhas" && asset.numero) parts.push(asset.numero);
    else if (catKey === "licencas" && asset.licenca) parts.push(asset.licenca);
    else {
      if (asset.marca) parts.push(asset.marca);
      if (asset.model) parts.push(asset.model);
      if (asset.service_tag) parts.push(`ST: ${asset.service_tag}`);
    }
    return parts.length > 0 ? parts.join(" — ") : asset.id.slice(0, 8);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome do colaborador é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const assetIds = Object.values(selectedAssets).filter(Boolean);
      if (assetIds.length === 0) {
        // Create a placeholder entry so the collaborator appears in the list
        const { error } = await supabase.from("inventory").insert({
          asset_code: `TEMP-${Date.now()}`,
          category: "notebooks",
          collaborator: nome.trim(),
          status: "Em uso",
          condition: "ready",
          cargo: cargo.trim() || null,
          gestor: gestor.trim() || null,
          sector: departamento.trim() || null,
        });
        if (error) throw error;
      } else {
        const updates = assetIds.map((assetId) => {
          const cat = Object.entries(selectedAssets).find(([, v]) => v === assetId)?.[0];
          const newStatus = cat === "licencas" ? "Ativo" : "Em uso";
          return supabase.from("inventory").update({
            collaborator: nome.trim(),
            cargo: cargo.trim() || null,
            gestor: gestor.trim() || null,
            sector: departamento.trim() || null,
            status: newStatus,
            updated_at: new Date().toISOString(),
          }).eq("id", assetId);
        });

        const results = await Promise.all(updates);
        const hasError = results.some((r) => r.error);
        if (hasError) throw new Error("Erro ao vincular ativos");
      }

      toast.success(`Colaborador "${nome.trim()}" cadastrado com sucesso`);
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar colaborador");
    } finally {
      setSaving(false);
    }
  };

  const isHardwareCategory = (key: string) => key === "notebooks" || key === "celulares";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Colaborador
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Colaborador</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Basic fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Analista" />
            </div>
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Input value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder="Ex: TI" />
            </div>
            <div className="space-y-1.5">
              <Label>Gestor</Label>
              <Input value={gestor} onChange={(e) => setGestor(e.target.value)} placeholder="Nome do gestor" />
            </div>
          </div>

          {/* Asset linking */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Vincular Ativos (opcional)</Label>
            {loadingAssets ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando estoque...
              </div>
            ) : (
              ASSET_CATEGORIES.map((cat) => {
                const assets = availableAssets[cat.key] || [];
                const Icon = cat.icon;
                const search = categorySearch[cat.key] || "";
                const isOpen = openPopovers[cat.key] || false;
                const selected = selectedAssets[cat.key];

                const filtered = assets.filter((item) => {
                  if (!search) return true;
                  const q = search.toLowerCase();
                  return [item.marca, item.model, item.service_tag, item.service_tag_2, item.numero, item.licenca, item.contrato]
                    .filter(Boolean).join(" ").toLowerCase().includes(q);
                });

                return (
                  <div key={cat.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {cat.label}
                      <span className="text-muted-foreground/60">({assets.length} disponíveis)</span>
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Popover
                        open={isOpen}
                        onOpenChange={(v) => setOpenPopovers((prev) => ({ ...prev, [cat.key]: v }))}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between text-sm font-normal h-9"
                          >
                            <span className="truncate">{getSelectedAssetLabel(cat.key)}</span>
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <div className="p-2">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="Buscar por marca, modelo, service tag..."
                                value={search}
                                onChange={(e) => setCategorySearch((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                                className="pl-8 h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="max-h-[250px] overflow-y-auto divide-y border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAssets((prev) => ({ ...prev, [cat.key]: "" }));
                                setOpenPopovers((prev) => ({ ...prev, [cat.key]: false }));
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent",
                                !selected ? "bg-primary/10 font-medium" : ""
                              )}
                            >
                              Nenhum
                            </button>
                            {filtered.length === 0 ? (
                              <p className="text-center text-xs text-muted-foreground py-4">
                                Nenhum item encontrado.
                              </p>
                            ) : (
                              filtered.map((item) => {
                                const cond = getConditionLabel((item as any).condition || "ready");
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedAssets((prev) => ({ ...prev, [cat.key]: item.id }));
                                      setOpenPopovers((prev) => ({ ...prev, [cat.key]: false }));
                                    }}
                                    className={cn(
                                      "w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-accent",
                                      selected === item.id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                                    )}
                                  >
                                    {isHardwareCategory(cat.key) && (
                                      <div className="mb-1.5">
                                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cond.color)}>
                                          {cond.label}
                                        </span>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                      {item.marca && (
                                        <div>
                                          <span className="text-muted-foreground">Marca: </span>
                                          <span className="font-medium">{item.marca}</span>
                                        </div>
                                      )}
                                      {item.model && (
                                        <div>
                                          <span className="text-muted-foreground">Modelo: </span>
                                          <span className="font-medium">{item.model}</span>
                                        </div>
                                      )}
                                      {item.service_tag && (
                                        <div>
                                          <span className="text-muted-foreground">ST: </span>
                                          <span className="font-medium">{item.service_tag}</span>
                                        </div>
                                      )}
                                      {item.service_tag_2 && (
                                        <div>
                                          <span className="text-muted-foreground">ST 2: </span>
                                          <span className="font-medium">{item.service_tag_2}</span>
                                        </div>
                                      )}
                                      {item.numero && (
                                        <div>
                                          <span className="text-muted-foreground">Número: </span>
                                          <span className="font-medium">{item.numero}</span>
                                        </div>
                                      )}
                                      {item.licenca && (
                                        <div>
                                          <span className="text-muted-foreground">Licença: </span>
                                          <span className="font-medium">{item.licenca}</span>
                                        </div>
                                      )}
                                      {item.contrato && (
                                        <div>
                                          <span className="text-muted-foreground">Contrato: </span>
                                          <span className="font-medium">{item.contrato}</span>
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {selected && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => setSelectedAssets((prev) => ({ ...prev, [cat.key]: "" }))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !nome.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
