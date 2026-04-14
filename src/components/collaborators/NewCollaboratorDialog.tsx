import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Laptop, Smartphone, Phone, FileText } from "lucide-react";

interface AvailableAsset {
  id: string;
  asset_code: string;
  model: string | null;
  service_tag: string | null;
  numero: string | null;
  licenca: string | null;
  marca: string | null;
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

  const fetchAvailable = useCallback(async () => {
    setLoadingAssets(true);
    const results: Record<string, AvailableAsset[]> = {};

    const promises = ASSET_CATEGORIES.map(async (cat) => {
      const statusFilter = cat.key === "licencas" ? "Ativo" : "Disponível";
      const { data } = await supabase
        .from("inventory")
        .select("id, asset_code, model, service_tag, numero, licenca, marca")
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
    }
  }, [open, fetchAvailable]);

  const getAssetLabel = (asset: AvailableAsset, category: string) => {
    const parts: string[] = [];
    if (category === "linhas" && asset.numero) parts.push(asset.numero);
    else if (category === "licencas" && asset.licenca) parts.push(asset.licenca);
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
      const selectedIds = Object.values(selectedAssets).filter(Boolean);

      if (selectedIds.length === 0) {
        // Create a placeholder inventory record so collaborator appears in the list
        const { error } = await supabase.from("inventory").insert({
          asset_code: "TEMP",
          category: "notebooks",
          collaborator: nome.trim(),
          cargo: cargo.trim() || null,
          gestor: gestor.trim() || null,
          sector: departamento.trim() || null,
          status: "Em uso",
        } as any);
        if (error) throw error;
      } else {
        // Update each selected asset
        const updates = selectedIds.map((assetId) => {
          const category = Object.entries(selectedAssets).find(([, id]) => id === assetId)?.[0];
          const newStatus = category === "licencas" ? "Ativo" : "Em uso";

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
                return (
                  <div key={cat.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {cat.label}
                      <span className="text-muted-foreground/60">({assets.length} disponíveis)</span>
                    </Label>
                    <Select
                      value={selectedAssets[cat.key] || "none"}
                      onValueChange={(v) =>
                        setSelectedAssets((prev) => ({ ...prev, [cat.key]: v === "none" ? "" : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum selecionado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {getAssetLabel(asset, cat.key)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
