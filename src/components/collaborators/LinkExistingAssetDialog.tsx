import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, Loader2, Search } from "lucide-react";
import { CollaboratorAsset } from "@/hooks/use-collaborators";
import { getConditionLabel } from "@/components/collaborators/StockTab";
import { cn } from "@/lib/utils";

const categoryOptions = [
  { value: "notebooks", label: "Notebook" },
  { value: "celulares", label: "Celular" },
  { value: "linhas", label: "Linha" },
  { value: "licencas", label: "Licença" },
];

interface Props {
  collaboratorName: string;
  category: string;
  onLinked: () => void;
}

export function LinkExistingAssetDialog({ collaboratorName, category, onLinked }: Props) {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<CollaboratorAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId("");
    setSearch("");
    fetchAvailable();
  }, [open, category]);

  const fetchAvailable = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory")
      .select("*")
      .eq("category", category)
      .eq("status", "Disponível")
      .order("asset_code");
    setAvailable((data as unknown as CollaboratorAsset[]) || []);
    setLoading(false);
  };

  const filtered = available.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const searchable = [item.asset_code, item.marca, item.model, item.service_tag, item.numero, item.licenca]
      .filter(Boolean).join(" ").toLowerCase();
    return searchable.includes(q);
  });

  const handleLink = async () => {
    if (!selectedId) return;
    setSaving(true);
    const newStatus = category === "licencas" ? "Ativo" : "Em uso";
    const { error } = await supabase
      .from("inventory")
      .update({
        collaborator: collaboratorName,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedId);

    if (error) {
      toast.error("Erro ao vincular ativo");
    } else {
      toast.success("Ativo vinculado com sucesso");
      setOpen(false);
      onLinked();
    }
    setSaving(false);
  };

  const isNotebookOrCelular = category === "notebooks" || category === "celulares";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Link2 className="h-3.5 w-3.5" />
          Vincular ativo existente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular ativo existente</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Selecione um item disponível em <strong>{categoryOptions.find((c) => c.value === category)?.label}</strong> para vincular a <strong>{collaboratorName}</strong>.
        </p>

        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por marca, modelo, service tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              Nenhum item disponível nesta categoria.
            </p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto rounded-md border divide-y">
              {filtered.map((item) => {
                const cond = getConditionLabel((item as any).condition || "ready");
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "w-full text-left px-3 py-3 text-sm transition-colors hover:bg-accent",
                      selectedId === item.id
                        ? "bg-primary/10 border-l-2 border-l-primary"
                        : ""
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      {isNotebookOrCelular && (
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cond.color)}>
                          {cond.label}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
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
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleLink} disabled={saving || !selectedId}>
              {saving ? "Vinculando..." : "Vincular"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
