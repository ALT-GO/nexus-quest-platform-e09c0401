import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useInventoryStatuses } from "@/hooks/use-inventory-statuses";

interface FieldDef {
  id: string;
  label: string;
  type: "text" | "select" | "date" | "autocomplete";
  options?: string[];
  dbColumn?: string;
  sanitize?: "digits" | "alphanumeric";
}

/* ── Sanitizers ────────────────────────────────────────────── */
function sanitizeDigits(v: string): string {
  return v.replace(/[^0-9]/g, "");
}

const fieldsByCategory: Record<string, FieldDef[]> = {
  notebooks: [
    { id: "service_tag", label: "Service tag", type: "text" },
    { id: "marca", label: "Marca", type: "autocomplete", dbColumn: "marca" },
    { id: "model", label: "Modelo", type: "autocomplete", dbColumn: "model" },
    { id: "cost_center", label: "Centro de custo", type: "text" },
    { id: "contrato", label: "Contrato", type: "autocomplete", dbColumn: "contrato" },
    { id: "asset_type", label: "Tipo", type: "select", options: ["Administrativo", "Campo"] },
    { id: "valor_pago", label: "Valor Pago (R$)", type: "text" },
    { id: "data_aquisicao", label: "Data de Aquisição", type: "date" },
    { id: "notes", label: "Notas", type: "text" },
    { id: "service_tag_2", label: "Service tag 2", type: "text" },
  ],
  celulares: [
    { id: "service_tag", label: "Service tag", type: "text" },
    { id: "marca", label: "Marca", type: "autocomplete", dbColumn: "marca" },
    { id: "model", label: "Modelo", type: "autocomplete", dbColumn: "model" },
    { id: "cost_center", label: "Centro de custo", type: "text" },
    { id: "contrato", label: "Contrato", type: "autocomplete", dbColumn: "contrato" },
    { id: "asset_type", label: "Tipo", type: "select", options: ["Administrativo", "Campo"] },
    { id: "valor_pago", label: "Valor Pago (R$)", type: "text" },
    { id: "data_aquisicao", label: "Data de Aquisição", type: "date" },
    { id: "notes", label: "Notas", type: "text" },
    { id: "imei1", label: "Imei 1", type: "text", sanitize: "digits" },
    { id: "imei2", label: "Imei 2", type: "text", sanitize: "digits" },
  ],
  tablets: [
    { id: "service_tag", label: "Service tag", type: "text" },
    { id: "marca", label: "Marca", type: "autocomplete", dbColumn: "marca" },
    { id: "model", label: "Modelo", type: "autocomplete", dbColumn: "model" },
    { id: "imei1", label: "IMEI / S/N", type: "text" },
    { id: "cost_center", label: "Centro de custo", type: "text" },
    { id: "contrato", label: "Contrato", type: "autocomplete", dbColumn: "contrato" },
    { id: "valor_pago", label: "Valor Pago (R$)", type: "text" },
    { id: "data_aquisicao", label: "Data de Aquisição", type: "date" },
    { id: "notes", label: "Notas", type: "text" },
  ],
  perifericos: [
    { id: "service_tag", label: "Service tag / P/N", type: "text" },
    { id: "marca", label: "Marca", type: "autocomplete", dbColumn: "marca" },
    { id: "model", label: "Modelo", type: "autocomplete", dbColumn: "model" },
    { id: "asset_type", label: "Tipo", type: "select", options: ["Mouse", "Teclado", "Carregador", "Monitor", "Headset", "Docking Station", "Outro"] },
    { id: "cost_center", label: "Centro de custo", type: "text" },
    { id: "contrato", label: "Contrato", type: "autocomplete", dbColumn: "contrato" },
    { id: "valor_pago", label: "Valor Pago (R$)", type: "text" },
    { id: "data_aquisicao", label: "Data de Aquisição", type: "date" },
    { id: "notes", label: "Notas", type: "text" },
  ],
  linhas: [
    { id: "numero", label: "Número", type: "text", sanitize: "digits" },
    { id: "asset_type", label: "Tipo", type: "select", options: ["Administrativo", "Campo"] },
    { id: "gestor", label: "Gestor", type: "autocomplete", dbColumn: "gestor" },
    { id: "operadora", label: "Operadora", type: "autocomplete", dbColumn: "operadora" },
    { id: "contrato", label: "Contrato", type: "autocomplete", dbColumn: "contrato" },
    { id: "cost_center_eng", label: "Centro de custo - Eng", type: "text" },
    { id: "cost_center_man", label: "Centro de custo - Man", type: "text" },
  ],
  licencas: [
    { id: "status", label: "Status", type: "select", options: ["Ativo", "Desligado"] },
    { id: "collaborator", label: "Colaborador", type: "text" },
    { id: "cargo", label: "Cargo", type: "text" },
    { id: "email_address", label: "E-mail", type: "text" },
    { id: "created_at", label: "Data criação", type: "date" },
    { id: "licenca", label: "Licença", type: "text" },
    { id: "gestor", label: "Gestor", type: "autocomplete", dbColumn: "gestor" },
    { id: "contrato", label: "Contrato", type: "autocomplete", dbColumn: "contrato" },
    { id: "cost_center_eng", label: "Centro de custo - Eng", type: "text" },
    { id: "cost_center_man", label: "Centro de custo - Man", type: "text" },
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

/* ── Generic autocomplete ──────────────────────────────────── */
function FieldAutocomplete({
  value,
  onChange,
  dbColumn,
  placeholder,
}: {
  value: string;
  onChange: (v: string, fromSuggestion?: boolean) => void;
  dbColumn: string;
  placeholder: string;
}) {
  const [allValues, setAllValues] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showList, setShowList] = useState(false);
  const [flash, setFlash] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (supabase.from("inventory").select(dbColumn) as any)
      .neq(dbColumn, "")
      .not(dbColumn, "is", null)
      .then(({ data }: { data: any[] | null }) => {
        if (data) {
          const unique = [...new Set(
            data.map((r: any) => (r[dbColumn] as string).trim())
              .filter((v: string) => v && v !== "-" && v !== "—")
          )].sort();
          setAllValues(unique);
        }
      });
  }, [dbColumn]);

  useEffect(() => {
    if (!value.trim()) { setSuggestions([]); return; }
    const q = value.toLowerCase();
    setSuggestions(allValues.filter((v) => v.toLowerCase().includes(q)).slice(0, 8));
  }, [value, allValues]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowList(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectSuggestion = (name: string) => {
    onChange(name, true);
    setShowList(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setShowList(true); }}
          onFocus={() => setShowList(true)}
          placeholder={placeholder}
          className={cn(
            "h-9 text-sm transition-all",
            flash && "ring-2 ring-success/60 border-success"
          )}
        />
        {flash && (
          <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-success animate-in fade-in zoom-in duration-200" />
        )}
      </div>
      {showList && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-[160px] overflow-y-auto">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent truncate"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Collaborator autocomplete ─────────────────────────────── */
function CollaboratorAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [allNames, setAllNames] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showList, setShowList] = useState(false);
  const [flash, setFlash] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("inventory")
      .select("collaborator")
      .neq("collaborator", "")
      .not("collaborator", "is", null)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(
            data.map((r: any) => (r.collaborator as string).trim())
              .filter((n) => n && n !== "-" && n !== "—")
          )].sort();
          setAllNames(unique);
        }
      });
  }, []);

  useEffect(() => {
    if (!value.trim()) { setSuggestions([]); return; }
    const q = value.toLowerCase();
    setSuggestions(allNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 8));
  }, [value, allNames]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowList(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectName = (name: string) => {
    onChange(name);
    setShowList(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setShowList(true); }}
          onFocus={() => setShowList(true)}
          placeholder="Colaborador"
          className={cn(
            "h-9 text-sm transition-all",
            flash && "ring-2 ring-success/60 border-success"
          )}
        />
        {flash && (
          <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-success animate-in fade-in zoom-in duration-200" />
        )}
      </div>
      {showList && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-[160px] overflow-y-auto">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent truncate"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectName(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Uniqueness validation rules ───────────────────────────── */
const uniqueFieldByCategory: Record<string, { field: string; label: string; dbColumn: string }[]> = {
  notebooks: [{ field: "service_tag", label: "Service tag", dbColumn: "service_tag" }],
  celulares: [
    { field: "service_tag", label: "Service tag", dbColumn: "service_tag" },
    { field: "imei1", label: "Imei 1", dbColumn: "imei1" },
  ],
  tablets: [{ field: "service_tag", label: "Service tag", dbColumn: "service_tag" }],
  perifericos: [{ field: "service_tag", label: "Service tag / P/N", dbColumn: "service_tag" }],
};

interface Props {
  category: string;
  onCreated: () => void;
}

export function AddStockItemDialog({ category, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dupErrors, setDupErrors] = useState<Record<string, string>>({});
  const { getStatusesForCategory } = useInventoryStatuses();

  const baseFields = fieldsByCategory[category] || [];
  // Inject dynamic statuses configured in /configuracoes
  const dynamicStatuses = getStatusesForCategory(category);
  const fields = baseFields.map((f) =>
    f.id === "status" && f.type === "select"
      ? { ...f, options: dynamicStatuses }
      : f
  );
  const label = categoryLabels[category] || "Item";
  const uniqueRules = uniqueFieldByCategory[category] || [];

  const resetForm = () => {
    const defaults: Record<string, string> = {};
    if (category === "licencas") {
      defaults.created_at = format(new Date(), "yyyy-MM-dd");
    }
    setValues(defaults);
    setDupErrors({});
  };

  const update = (id: string, val: string) => {
    const fieldDef = fields.find((f) => f.id === id);
    // valor_pago allows decimals, don't strip digits-only
    const sanitized = id === "valor_pago" ? val : (fieldDef?.sanitize === "digits" ? sanitizeDigits(val) : val);
    setValues((prev) => ({ ...prev, [id]: sanitized }));
    if (dupErrors[id]) setDupErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const checkAllUnique = useCallback(async (): Promise<boolean> => {
    if (uniqueRules.length === 0) return true;
    const errors: Record<string, string> = {};

    for (const rule of uniqueRules) {
      const val = (values[rule.field] || "").trim();
      if (!val) continue;

      const { data: existing } = await (supabase
        .from("inventory")
        .select("id") as any)
        .eq(rule.dbColumn, val)
        .limit(1);

      if (existing && existing.length > 0) {
        errors[rule.field] = `Este item já está cadastrado (${rule.label}: "${val}")`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setDupErrors(errors);
      return false;
    }
    return true;
  }, [values, uniqueRules]);

  const handleSave = async () => {
    setSaving(true);

    const isUnique = await checkAllUnique();
    if (!isUnique) { setSaving(false); return; }

    const collaborator = (values.collaborator || "").trim();
    const hasCollaborator = collaborator.length > 0;

    let status: string;
    if (category === "licencas") {
      status = values.status || (hasCollaborator ? "Ativo" : "Disponível");
    } else {
      status = "Disponível";
    }

    const payload: Record<string, any> = {
      category,
      asset_code: "TEMP",
      status,
      collaborator: category === "licencas" ? collaborator : "",
    };

    for (const f of fields) {
      if (f.id === "collaborator" || f.id === "status") continue;
      const raw = values[f.id];
      if (raw) {
        if (f.id === "created_at") {
          payload[f.id] = new Date(raw).toISOString();
        } else if (f.id === "valor_pago") {
          const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
          const num = parseFloat(cleaned);
          payload[f.id] = isNaN(num) ? null : num;
        } else {
          payload[f.id] = f.sanitize === "digits" ? sanitizeDigits(raw) : raw.trim();
        }
      }
    }

    const { error } = await supabase.from("inventory").insert(payload as any);
    if (error) {
      toast.error("Erro ao cadastrar item");
    } else {
      toast.success(`${label} cadastrado com sucesso`);
      resetForm();
      setOpen(false);
      onCreated();
    }
    setSaving(false);
  };

  const hasDupErr = (fieldId: string) => !!dupErrors[fieldId];
  const getDupErr = (fieldId: string) => dupErrors[fieldId] || "";
  const hasAnyDupError = Object.keys(dupErrors).length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Adicionar {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo {label}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          {fields.map((f) => {
            if (f.id === "collaborator") {
              return (
                <div key={f.id} className="space-y-1.5">
                  <label className="text-sm font-medium">{f.label}</label>
                  <CollaboratorAutocomplete
                    value={values[f.id] || ""}
                    onChange={(v) => update(f.id, v)}
                  />
                </div>
              );
            }

            if (f.type === "autocomplete" && f.dbColumn) {
              return (
                <div key={f.id} className="space-y-1.5">
                  <label className="text-sm font-medium">{f.label}</label>
                  <FieldAutocomplete
                    value={values[f.id] || ""}
                    onChange={(v) => update(f.id, v)}
                    dbColumn={f.dbColumn}
                    placeholder={f.label}
                  />
                </div>
              );
            }

            if (f.type === "select") {
              return (
                <div key={f.id} className="space-y-1.5">
                  <label className="text-sm font-medium">{f.label}</label>
                  <Select value={values[f.id] || ""} onValueChange={(v) => update(f.id, v)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={`Selecione ${f.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options?.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            if (f.type === "date") {
              return (
                <div key={f.id} className="space-y-1.5">
                  <label className="text-sm font-medium">{f.label}</label>
                  <Input
                    type="date"
                    value={values[f.id] || ""}
                    onChange={(e) => update(f.id, e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              );
            }

            return (
              <div key={f.id} className="space-y-1.5">
                <label className="text-sm font-medium">{f.label}</label>
                <Input
                  value={values[f.id] || ""}
                  onChange={(e) => update(f.id, e.target.value)}
                  placeholder={f.sanitize === "digits" ? "Somente números" : f.label}
                  className={cn("h-9 text-sm", hasDupErr(f.id) && "border-destructive ring-1 ring-destructive")}
                />
                {hasDupErr(f.id) && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getDupErr(f.id)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {hasAnyDupError && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Corrija os campos duplicados antes de cadastrar.
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
