import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInventoryStatuses } from "@/hooks/use-inventory-statuses";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { CustomFieldDef } from "@/hooks/use-inventory";

interface NewAssetDialogProps {
  category: string;
  fields: CustomFieldDef[];
  onSave: (data: Record<string, string>, fieldValues: Record<string, string>) => Promise<void>;
}

interface FieldConfig {
  key: string;
  label: string;
  type?: "text" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

const tipoNotebook = ["Administrativo", "Campo"];

const fieldsByCategory: Record<string, FieldConfig[]> = {
  notebooks: [
    { key: "service_tag", label: "Service tag", placeholder: "Ex: ABC1234" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca", placeholder: "Ex: Dell" },
    { key: "model", label: "Modelo", required: true, placeholder: "Ex: Latitude 5520" },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "asset_type", label: "Tipo", type: "select", options: tipoNotebook },
    { key: "service_tag_2", label: "Service tag 2" },
    { key: "notes", label: "Notas", type: "textarea" },
  ],
  celulares: [
    { key: "service_tag", label: "Service tag" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca", placeholder: "Ex: Samsung" },
    { key: "model", label: "Modelo", required: true, placeholder: "Ex: Galaxy S24" },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "asset_type", label: "Tipo" },
    { key: "imei1", label: "Imei 1" },
    { key: "imei2", label: "Imei 2" },
    { key: "notes", label: "Notas", type: "textarea" },
  ],
  linhas: [
    { key: "numero", label: "Número", required: true, placeholder: "Ex: (11) 99999-0000" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "asset_type", label: "Tipo" },
    { key: "gestor", label: "Gestor" },
    { key: "operadora", label: "Operadora", placeholder: "Ex: Vivo" },
    { key: "contrato", label: "Contrato" },
    { key: "cost_center_eng", label: "Centro de custo - Eng" },
    { key: "cost_center_man", label: "Centro de custo - Man" },
  ],
  tablets: [
    { key: "service_tag", label: "Service tag", placeholder: "Ex: ABC1234" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca", placeholder: "Ex: Samsung" },
    { key: "model", label: "Modelo", required: true, placeholder: "Ex: Galaxy Tab S9" },
    { key: "imei1", label: "IMEI / S/N", placeholder: "IMEI ou número de série" },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "notes", label: "Notas", type: "textarea" },
  ],
  perifericos: [
    { key: "service_tag", label: "Service tag / P/N", placeholder: "P/N ou S/N" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca", placeholder: "Ex: Logitech" },
    { key: "model", label: "Modelo", required: true, placeholder: "Ex: MX Master 3" },
    { key: "asset_type", label: "Tipo", type: "select", options: ["Mouse", "Teclado", "Carregador", "Monitor", "Headset", "Docking Station", "Outro"] },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "notes", label: "Notas", type: "textarea" },
  ],
  licencas: [
    { key: "status", label: "Status", type: "select", options: [] },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "email_address", label: "E-mail", placeholder: "colaborador@empresa.com" },
    { key: "licenca", label: "Licença", required: true, placeholder: "Ex: Microsoft 365 E3" },
    { key: "gestor", label: "Gestor" },
    { key: "contrato", label: "Contrato" },
    { key: "cost_center_eng", label: "Centro de custo - Eng" },
    { key: "cost_center_man", label: "Centro de custo - Man" },
  ],
};

const categoryLabels: Record<string, string> = {
  notebooks: "Notebook",
  celulares: "Celular",
  tablets: "Tablet",
  perifericos: "Periférico",
  linhas: "Linha",
  licencas: "Licença",
};

export function NewAssetDialog({ category, fields, onSave }: NewAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const { getStatusesForCategory } = useInventoryStatuses();

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const catFields = (fieldsByCategory[category] || []).map((f) => {
    if (f.key === "status" && f.type === "select") {
      return { ...f, options: getStatusesForCategory(category) };
    }
    return f;
  });
  const requiredKey = catFields.find((f) => f.required)?.key || "model";

  const handleSave = async () => {
    if (!form[requiredKey]?.trim()) return;
    setSaving(true);
    await onSave(form, customValues);
    setSaving(false);
    setForm({});
    setCustomValues({});
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Novo ativo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo ativo — {categoryLabels[category] || category}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {catFields.map((field) => (
            <div key={field.key} className="grid gap-2">
              <Label>{field.label}{field.required ? " *" : ""}</Label>
              {field.type === "select" && field.options ? (
                <Select value={form[field.key] || ""} onValueChange={(v) => set(field.key, v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {field.options.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "textarea" ? (
                <Textarea
                  value={form[field.key] || ""}
                  onChange={(e) => set(field.key, e.target.value)}
                  rows={2}
                  placeholder={field.placeholder}
                />
              ) : (
                <Input
                  value={form[field.key] || ""}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}

          {/* Custom fields */}
          {fields.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold text-muted-foreground">Campos personalizados</Label>
              {fields.map((field) => (
                <div key={field.id} className="grid gap-1">
                  <Label className="text-sm">{field.name}</Label>
                  {field.field_type === "seleção" && field.options ? (
                    <Select value={customValues[field.id] || ""} onValueChange={(v) => setCustomValues((p) => ({ ...p, [field.id]: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {field.options.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.field_type === "número" ? "number" : field.field_type === "data" ? "date" : "text"}
                      value={customValues[field.id] || ""}
                      onChange={(e) => setCustomValues((p) => ({ ...p, [field.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form[requiredKey]?.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
