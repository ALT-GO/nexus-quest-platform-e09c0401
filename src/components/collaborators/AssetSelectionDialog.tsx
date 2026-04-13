import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import type { CollaboratorAsset } from "@/hooks/use-collaborators";

const catLabel: Record<string, string> = {
  notebooks: "Notebook", celulares: "Celular", tablets: "Tablet",
  perifericos: "Periférico", linhas: "Linha", licencas: "Licença",
  hardware: "Notebook", telecom: "Linha", licenses: "Licença",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: CollaboratorAsset[];
  type: "responsabilidade" | "devolucao";
  onConfirm: (selected: CollaboratorAsset[]) => void;
}

export function AssetSelectionDialog({ open, onOpenChange, assets, type, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assets.map((a) => a.id)));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === assets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(assets.map((a) => a.id)));
    }
  };

  // Reset selection when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setSelected(new Set(assets.map((a) => a.id)));
    onOpenChange(v);
  };

  const label = (a: CollaboratorAsset) =>
    a.asset_code + " — " + (a.model || a.licenca || a.numero || a.service_tag || "Sem descrição");

  const title = type === "devolucao" ? "Termo de Devolução" : "Termo de Responsabilidade";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col p-4 sm:p-6 gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title} — Selecionar Itens
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Selecione os itens que deseja incluir no termo.
          </p>
        </DialogHeader>

        {assets.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">Nenhum ativo vinculado.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 shrink-0">
              <Checkbox
                checked={selected.size === assets.length}
                onCheckedChange={toggleAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-xs font-medium text-muted-foreground cursor-pointer">
                {selected.size === assets.length ? "Desmarcar todos" : "Selecionar todos"}
              </label>
              <span className="ml-auto text-xs text-muted-foreground">
                {selected.size} de {assets.length} selecionado(s)
              </span>
            </div>

            <div className="flex-1 min-h-0 max-h-[400px] overflow-y-auto border rounded-lg divide-y scrollbar-thin scrollbar-thumb-border">
              {assets.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selected.has(a.id)}
                    onCheckedChange={() => toggle(a.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{label(a)}</p>
                    <Badge variant="outline" className="text-[10px] mt-0.5">
                      {catLabel[a.category] || a.category}
                    </Badge>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const selectedAssets = assets.filter((a) => selected.has(a.id));
              onConfirm(selectedAssets);
              onOpenChange(false);
            }}
            disabled={selected.size === 0}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" />
            Gerar Termo ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
