import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Save, Check, ChevronsUpDown } from "lucide-react";
import { CollaboratorAsset } from "@/hooks/use-collaborators";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { getConditionLabel } from "./StockTab";
import { cn } from "@/lib/utils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useInventoryStatuses } from "@/hooks/use-inventory-statuses";

interface Props {
  asset: CollaboratorAsset;
  onUpdated: () => void;
}

interface EditableField {
  label: string;
  key: string;
  readOnly?: boolean;
}

function getFieldsForCategory(category: string): EditableField[] {
  const cat = (category || "").toLowerCase();
  const isHardware = ["notebooks", "celulares", "tablets", "perifericos", "hardware"].includes(cat);
  const isLinhas = cat === "linhas" || cat === "telecom";
  const isLicencas = cat === "licencas" || cat === "licenses";

  const base: EditableField[] = [
    { label: "Categoria", key: "category", readOnly: true },
  ];

  // Hardware uses "Condição"; Linhas/Licenças use "Status"
  if (isHardware) {
    base.push({ label: "Condição", key: "condition" });
  } else {
    base.push({ label: "Status", key: "status" });
  }

  base.push({ label: "Colaborador", key: "collaborator" });

  if (cat === "notebooks") {
    base.push(
      { label: "Marca", key: "marca" },
      { label: "Modelo", key: "model" },
      { label: "Service Tag", key: "service_tag" },
      { label: "Service Tag 2", key: "service_tag_2" },
      { label: "Tipo", key: "asset_type" },
      { label: "Centro de Custo", key: "cost_center" },
      { label: "Contrato", key: "contrato" },
      { label: "Valor Pago (R$)", key: "valor_pago" },
      { label: "Data de Aquisição", key: "data_aquisicao" },
    );
  } else if (cat === "celulares") {
    base.push(
      { label: "Marca", key: "marca" },
      { label: "Modelo", key: "model" },
      { label: "Service Tag", key: "service_tag" },
      { label: "IMEI 1", key: "imei1" },
      { label: "IMEI 2", key: "imei2" },
      { label: "Centro de Custo", key: "cost_center" },
      { label: "Contrato", key: "contrato" },
      { label: "Valor Pago (R$)", key: "valor_pago" },
      { label: "Data de Aquisição", key: "data_aquisicao" },
    );
  } else if (cat === "tablets" || cat === "perifericos") {
    base.push(
      { label: "Marca", key: "marca" },
      { label: "Modelo", key: "model" },
      { label: "Service Tag", key: "service_tag" },
      { label: "Tipo", key: "asset_type" },
      { label: "Centro de Custo", key: "cost_center" },
      { label: "Contrato", key: "contrato" },
      { label: "Valor Pago (R$)", key: "valor_pago" },
      { label: "Data de Aquisição", key: "data_aquisicao" },
    );
  } else if (isLinhas) {
    base.push(
      { label: "Número", key: "numero" },
      { label: "Operadora", key: "operadora" },
      { label: "Gestor", key: "gestor" },
      { label: "CC Eng", key: "cost_center_eng" },
      { label: "CC Man", key: "cost_center_man" },
      { label: "Contrato", key: "contrato" },
    );
  } else if (isLicencas) {
    base.push(
      { label: "E-mail", key: "email_address" },
      { label: "Licença", key: "licenca" },
      { label: "Gestor", key: "gestor" },
      { label: "CC Eng", key: "cost_center_eng" },
      { label: "CC Man", key: "cost_center_man" },
      { label: "Contrato", key: "contrato" },
      { label: "Data de Bloqueio", key: "data_bloqueio" },
    );
  }

  base.push({ label: "Criado em", key: "created_at", readOnly: true });

  return base;
}

/* ── Collaborator Combobox ─────────────────────────────────── */
function CollaboratorCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [allCollaborators, setAllCollaborators] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("inventory")
      .select("collaborator")
      .neq("collaborator", "")
      .not("collaborator", "is", null)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(
            data.map((d: any) => d.collaborator as string).filter(Boolean)
          )].sort();
          setAllCollaborators(unique);
        }
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allCollaborators;
    const q = search.toLowerCase();
    return allCollaborators.filter((c) => c.toLowerCase().includes(q));
  }, [search, allCollaborators]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between text-sm font-normal"
        >
          <span className="truncate">{value || "Selecionar colaborador..."}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar colaborador..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-48">
            <CommandEmpty>Nenhum encontrado</CommandEmpty>
            <CommandGroup>
              {search.trim() && !filtered.includes(search.trim()) && (
                <CommandItem
                  value={search.trim()}
                  onSelect={() => {
                    onChange(search.trim());
                    setOpen(false);
                  }}
                  className="text-sm"
                >
                  <span className="italic text-muted-foreground">Usar "{search.trim()}"</span>
                </CommandItem>
              )}
              {filtered.map((name) => (
                <CommandItem
                  key={name}
                  value={name}
                  onSelect={() => {
                    onChange(name);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="text-sm"
                >
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === name ? "opacity-100" : "opacity-0")} />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Main Dialog ───────────────────────────────────────────── */
export function StockDetailDialog({ asset, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { getStatusesForCategory, conditionOptions } = useInventoryStatuses();
  const statusOptions = getStatusesForCategory(asset.category);
  const conditionNames = conditionOptions.map((o) => o.name);

  useEffect(() => {
    if (open) {
      const fields = getFieldsForCategory(asset.category);
      const data: Record<string, string> = {};
      for (const f of fields) {
        const raw = (asset as any)[f.key];
        if (f.key === "created_at" && raw) {
          data[f.key] = format(new Date(raw), "dd/MM/yyyy HH:mm");
        } else if ((f.key === "data_bloqueio" || f.key === "data_aquisicao") && raw) {
          data[f.key] = format(new Date(raw), "yyyy-MM-dd");
        } else if (f.key === "valor_pago") {
          data[f.key] = raw != null ? String(raw) : "";
        } else {
          data[f.key] = raw ?? "";
        }
      }
      data.notes = asset.notes || (asset as any).comments || "";
      setFormData(data);
    }
  }, [open, asset]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    const fields = getFieldsForCategory(asset.category);

    for (const f of fields) {
      if (f.readOnly) continue;
      const val = formData[f.key] ?? "";
      if (f.key === "valor_pago") {
        updates[f.key] = val ? parseFloat(val) : null;
      } else {
        updates[f.key] = val || null;
      }
    }
    updates.notes = formData.notes || "";
    updates.comments = formData.notes || "";

    const { error } = await supabase
      .from("inventory")
      .update(updates as any)
      .eq("id", asset.id);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Alterações salvas com sucesso");
      onUpdated();
    }
    setSaving(false);
  };

  const fields = getFieldsForCategory(asset.category);
  const condition = getConditionLabel(asset.condition || "ready");

  return (
    <>
      <Button
        variant="ghost" size="sm"
        className="h-7 w-7 p-0"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="Ver detalhes"
      >
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {asset.model || asset.licenca || asset.numero || asset.category}
              {asset.condition && (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                  {condition.label}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
                    {f.label}
                  </label>
                  {f.readOnly ? (
                    <p className="text-sm py-1.5 px-2 bg-muted/50 rounded-md">
                      {formData[f.key] || "—"}
                    </p>
                  ) : f.key === "collaborator" ? (
                    <CollaboratorCombobox
                      value={formData[f.key] || ""}
                      onChange={(v) => handleChange(f.key, v)}
                    />
                  ) : f.key === "status" || f.key === "condition" ? (
                    <Select
                      value={formData[f.key] || ""}
                      onValueChange={(v) => handleChange(f.key, v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={f.key === "condition" ? "Selecione uma condição" : "Selecione um status"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.key === "condition" ? conditionNames : statusOptions).map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  
                  ) : f.key === "valor_pago" ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData[f.key] || ""}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                      className="h-8 text-sm"
                      placeholder="0.00"
                    />
                  ) : (f.key === "data_bloqueio" || f.key === "data_aquisicao") ? (
                    <Input
                      type="date"
                      value={formData[f.key] || ""}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                      className="h-8 text-sm"
                    />
                  ) : (
                    <Input
                      value={formData[f.key] || ""}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                      className="h-8 text-sm"
                      placeholder={`Preencher ${f.label.toLowerCase()}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-[11px] text-muted-foreground font-medium block">Notas</label>
              <Textarea
                value={formData.notes || ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Adicione notas sobre este item..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
