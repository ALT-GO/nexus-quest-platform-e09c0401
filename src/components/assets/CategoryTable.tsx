import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useInventory } from "@/hooks/use-inventory";
import { useInventoryStatuses } from "@/hooks/use-inventory-statuses";
import { InlineCellEditor } from "@/components/assets/InlineCellEditor";
import { NewAssetDialog } from "@/components/assets/NewAssetDialog";
import { FieldManagerDialog } from "@/components/assets/FieldManagerDialog";
import { Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { calcDepreciation, formatBRL } from "@/lib/depreciation";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const defaultStatusColors: Record<string, string> = {
  "Disponível": "bg-emerald-500/15 text-emerald-600",
  "Em uso": "bg-blue-500/15 text-blue-600",
  "Manutenção": "bg-amber-500/15 text-amber-600",
  "Baixado": "bg-muted text-muted-foreground",
  "Reservado": "bg-muted text-muted-foreground",
  "Ativo": "bg-emerald-500/15 text-emerald-600",
  "Desligado": "bg-red-500/15 text-red-600",
};

function StatusBadge({ status, colorMap }: { status: string; colorMap?: Record<string, string> }) {
  // Try dynamic color from config, fall back to hardcoded
  const hslColor = colorMap?.[status];
  if (hslColor) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `hsl(${hslColor} / 0.15)`, color: `hsl(${hslColor})` }}
      >
        {status}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", defaultStatusColors[status] || "bg-secondary text-secondary-foreground")}>
      {status}
    </span>
  );
}

// Column definitions per category
interface ColDef {
  key: string;
  label: string;
  type?: "text" | "select" | "date" | "status" | "currency" | "readonly" | "computed";
  options?: string[];
  mono?: boolean;
}

const tipoNotebook = ["Administrativo", "Campo"];

const columnsByCategory: Record<string, ColDef[]> = {
  notebooks: [
    { key: "service_tag", label: "Service tag" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "asset_type", label: "Tipo", type: "select", options: tipoNotebook },
    { key: "valor_pago", label: "Valor Pago", type: "currency" },
    { key: "data_aquisicao", label: "Data Aquisição", type: "date" },
    { key: "delivered_at", label: "Data Assinatura", type: "date" },
    { key: "_valor_contabil", label: "Valor Contábil", type: "computed" },
    { key: "notes", label: "Notas" },
    { key: "service_tag_2", label: "Service tag 2" },
  ],
  celulares: [
    { key: "service_tag", label: "Service tag" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "asset_type", label: "Tipo" },
    { key: "valor_pago", label: "Valor Pago", type: "currency" },
    { key: "data_aquisicao", label: "Data Aquisição", type: "date" },
    { key: "delivered_at", label: "Data Assinatura", type: "date" },
    { key: "_valor_contabil", label: "Valor Contábil", type: "computed" },
    { key: "notes", label: "Notas" },
    { key: "imei1", label: "Imei 1" },
    { key: "imei2", label: "Imei 2" },
  ],
  linhas: [
    { key: "numero", label: "Número" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "asset_type", label: "Tipo" },
    { key: "gestor", label: "Gestor" },
    { key: "operadora", label: "Operadora" },
    { key: "contrato", label: "Contrato" },
    { key: "cost_center_eng", label: "Centro de custo - Eng" },
    { key: "cost_center_man", label: "Centro de custo - Man" },
    { key: "valor_mensal", label: "Valor Mensal (R$)", type: "currency" },
    { key: "notes", label: "Notas" },
  ],
  tablets: [
    { key: "service_tag", label: "Service tag" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "imei1", label: "IMEI / S/N" },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "valor_pago", label: "Valor Pago", type: "currency" },
    { key: "data_aquisicao", label: "Data Aquisição", type: "date" },
    { key: "delivered_at", label: "Data Assinatura", type: "date" },
    { key: "_valor_contabil", label: "Valor Contábil", type: "computed" },
    { key: "notes", label: "Notas" },
  ],
  perifericos: [
    { key: "service_tag", label: "Service tag / P/N" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "asset_type", label: "Tipo", type: "select", options: ["Mouse", "Teclado", "Carregador", "Monitor", "Headset", "Docking Station", "Outro"] },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "valor_pago", label: "Valor Pago", type: "currency" },
    { key: "data_aquisicao", label: "Data Aquisição", type: "date" },
    { key: "notes", label: "Notas" },
  ],
  licencas: [
    
    { key: "status", label: "Status", type: "status" },
    { key: "collaborator", label: "Colaborador" },
    { key: "cargo", label: "Cargo" },
    { key: "email_address", label: "E-mail" },
    { key: "created_at", label: "Data criação", type: "date" },
    { key: "licenca", label: "Licença" },
    { key: "gestor", label: "Gestor" },
    { key: "contrato", label: "Contrato" },
    { key: "cost_center_eng", label: "Centro de custo - Eng" },
    { key: "cost_center_man", label: "Centro de custo - Man" },
    { key: "valor_mensal", label: "Valor Mensal (R$)", type: "currency" },
  ],
};

interface Props {
  category: string;
  label: string;
}

export function CategoryTable({ category, label }: Props) {
  const {
    items, fields, loading,
    updateItem, deleteItem,
    addField, updateField, deleteField,
    getFieldValue, setFieldValue,
  } = useInventory(category);
  const { getStatusesForCategory, statusColorMap } = useInventoryStatuses();

  const columns = columnsByCategory[category] || [];

  // Bulk update dialog state
  const [bulkDialog, setBulkDialog] = useState<{
    open: boolean;
    model: string;
    value: string;
    dataAquisicao: string;
    count: number;
    itemId: string;
    field: "valor_pago" | "data_aquisicao" | "both";
  }>({ open: false, model: "", value: "", dataAquisicao: "", count: 0, itemId: "", field: "valor_pago" });

  const formatCurrency = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined || v === "") return "";
    const num = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(num)) return "";
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const checkBulkOffer = (item: any, field: "valor_pago" | "data_aquisicao", displayValue: string, dataAq?: string) => {
    const model = (item.model || "").trim();
    if (!model) return;
    const othersWithModel = items.filter(
      (i) => i.id !== item.id && (i.model || "").trim().toLowerCase() === model.toLowerCase()
    );
    if (othersWithModel.length > 0) {
      setBulkDialog({
        open: true,
        model,
        value: field === "valor_pago" ? displayValue : "",
        dataAquisicao: field === "data_aquisicao" ? displayValue : (dataAq || ""),
        count: othersWithModel.length,
        itemId: item.id,
        field,
      });
    }
  };

  const handleCurrencySave = async (item: any, field: string, rawValue: string) => {
    const cleaned = rawValue.replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return;
    await updateItem(item.id, { [field]: num } as any);
    if (field === "valor_pago") {
      checkBulkOffer(item, "valor_pago", formatCurrency(num));
    }
  };

  const handleDataAquisicaoSave = async (item: any, dateValue: string) => {
    if (!dateValue) return;
    await updateItem(item.id, { data_aquisicao: dateValue } as any);
    checkBulkOffer(item, "data_aquisicao", dateValue);
  };

  const handleBulkUpdate = async () => {
    const model = bulkDialog.model;
    const othersWithModel = items.filter(
      (i) => i.id !== bulkDialog.itemId && (i.model || "").trim().toLowerCase() === model.toLowerCase()
    );
    const ids = othersWithModel.map((i) => i.id);
    if (ids.length === 0) { setBulkDialog((prev) => ({ ...prev, open: false })); return; }

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (bulkDialog.field === "valor_pago" && bulkDialog.value) {
      const cleaned = bulkDialog.value.replace(/[^\d.,]/g, "").replace(",", ".");
      updatePayload.valor_pago = parseFloat(cleaned);
    }
    if (bulkDialog.field === "data_aquisicao" && bulkDialog.dataAquisicao) {
      updatePayload.data_aquisicao = bulkDialog.dataAquisicao;
    }

    const { error } = await supabase
      .from("inventory")
      .update(updatePayload as any)
      .in("id", ids);

    if (error) {
      toast.error("Erro ao atualizar em massa");
    } else {
      const label = bulkDialog.field === "valor_pago" ? "Valor Pago" : "Data de Aquisição";
      toast.success(`${label} atualizado para ${ids.length} itens do modelo "${model}"`);
    }
    setBulkDialog((prev) => ({ ...prev, open: false }));
  };

  const handleNewAsset = async (data: Record<string, string>, fieldVals: Record<string, string>) => {
    const payload: Record<string, any> = {
      category,
      asset_code: "TEMP",
    };
    for (const col of columns) {
      if (col.key === "asset_code" || col.key === "created_at") continue;
      if (col.type === "readonly") continue;
      if (data[col.key] !== undefined) {
        if (col.type === "currency") {
          const cleaned = data[col.key].replace(/[^\d.,]/g, "").replace(",", ".");
          const num = parseFloat(cleaned);
          payload[col.key] = isNaN(num) ? null : num;
        } else {
          payload[col.key] = data[col.key];
        }
      }
    }
    if (!payload.status) payload.status = category === "licencas" ? "Ativo" : "Disponível";

    const { data: inserted, error } = await supabase
      .from("inventory")
      .insert(payload as any)
      .select()
      .single();

    if (error || !inserted) return;

    const entries = Object.entries(fieldVals).filter(([, v]) => v.trim() !== "");
    if (entries.length > 0) {
      await supabase.from("custom_field_values").insert(
        entries.map(([fieldId, value]) => ({ asset_id: (inserted as any).id, field_id: fieldId, value }))
      );
    }
  };

  const getStatusOptions = () => getStatusesForCategory(category);

  const getCellValue = (item: any, key: string): string => {
    if (key === "created_at") {
      return item.created_at ? new Date(item.created_at).toLocaleDateString("pt-BR") : "—";
    }
    return item[key] ?? "";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">{label}</CardTitle>
        <div className="flex items-center gap-2">
          <FieldManagerDialog categoryLabel={label} fields={fields} onAdd={addField} onUpdate={updateField} onDelete={deleteField} />
          <NewAssetDialog category={category} fields={fields} onSave={handleNewAsset} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key} className="whitespace-nowrap">{col.label}</TableHead>
                ))}
                {fields.map((f) => (
                  <TableHead key={f.id} className="whitespace-nowrap">{f.name}</TableHead>
                ))}
                <TableHead className="w-[60px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  {columns.map((col) => {
                    // Editable date columns (delivered_at, data_aquisicao, created_at readonly)
                    if (col.type === "date" && (col.key === "delivered_at" || col.key === "data_aquisicao" || col.key === "created_at")) {
                      if (col.key === "created_at") {
                        return (
                          <TableCell key={col.key} className="text-sm">
                            {getCellValue(item, "created_at")}
                          </TableCell>
                        );
                      }
                      const dateVal = (item as any)[col.key];
                      return (
                        <TableCell key={col.key}>
                          <InlineCellEditor
                            value={dateVal ? (col.key === "data_aquisicao" ? dateVal : new Date(dateVal).toISOString().split("T")[0]) : ""}
                            onSave={(v) => {
                              if (col.key === "data_aquisicao") {
                                handleDataAquisicaoSave(item, v);
                              } else {
                                updateItem(item.id, { [col.key]: v ? new Date(v).toISOString() : null } as any);
                              }
                            }}
                            type="date"
                            displayRender={(v) => (
                              <span className="text-sm">{v ? new Date(v).toLocaleDateString("pt-BR") : <span className="text-muted-foreground italic">—</span>}</span>
                            )}
                          />
                        </TableCell>
                      );
                    }
                    // Computed depreciation column
                    if (col.type === "computed" && col.key === "_valor_contabil") {
                      const dep = calcDepreciation(
                        (item as any).valor_pago,
                        (item as any).data_aquisicao
                      );
                      return (
                        <TableCell key={col.key}>
                          {dep ? (
                            <span
                              className="text-sm font-medium cursor-help"
                              title={`Aquisição: ${formatBRL(dep.valorAquisicao)} | Residual (50%): ${formatBRL(dep.valorResidual)} | Dep. anual: ${formatBRL(dep.depreciacaoAnual)} | Anos de uso: ${dep.anosDeUso}`}
                            >
                              {formatBRL(dep.valorContabil)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-sm">—</span>
                          )}
                        </TableCell>
                      );
                    }
                    // Readonly (N/A for linhas/licencas)
                    if (col.type === "readonly") {
                      return (
                        <TableCell key={col.key} className="text-sm text-muted-foreground italic">
                          N/A
                        </TableCell>
                      );
                    }
                    // Currency column (valor_pago)
                    if (col.type === "currency") {
                      const raw = (item as any)[col.key];
                      const display = raw != null && raw !== "" ? formatCurrency(raw) : "";
                      return (
                        <TableCell key={col.key}>
                          <InlineCellEditor
                            value={raw != null && raw !== "" ? String(raw) : ""}
                            onSave={(v) => handleCurrencySave(item, col.key, v)}
                            type="number"
                            displayRender={(v) => (
                              <span className="text-sm">{v ? formatCurrency(v) : <span className="text-muted-foreground italic">—</span>}</span>
                            )}
                          />
                        </TableCell>
                      );
                    }
                    if (col.type === "status") {
                      return (
                        <TableCell key={col.key}>
                          <InlineCellEditor
                            value={(item as any)[col.key] || ""}
                            onSave={(v) => updateItem(item.id, { [col.key]: v } as any)}
                            type="select"
                            options={getStatusOptions()}
                            displayRender={(v) => <StatusBadge status={v} />}
                          />
                        </TableCell>
                      );
                    }
                    if (col.type === "select" && col.options) {
                      return (
                        <TableCell key={col.key}>
                          <InlineCellEditor
                            value={(item as any)[col.key] || ""}
                            onSave={(v) => updateItem(item.id, { [col.key]: v } as any)}
                            type="select"
                            options={col.options}
                          />
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={col.key} className={col.mono ? "font-mono text-xs" : ""}>
                        <InlineCellEditor
                          value={(item as any)[col.key] || ""}
                          onSave={(v) => updateItem(item.id, { [col.key]: v } as any)}
                        />
                      </TableCell>
                    );
                  })}
                  {fields.map((f) => (
                    <TableCell key={f.id}>
                      <InlineCellEditor
                        value={getFieldValue(item.id, f.id)}
                        onSave={(v) => setFieldValue(item.id, f.id, v)}
                        type={f.field_type === "seleção" ? "select" : f.field_type === "número" ? "number" : f.field_type === "data" ? "date" : "text"}
                        options={f.options || undefined}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + fields.length + 1} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado. Clique em "Novo ativo" para adicionar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <AlertDialog open={bulkDialog.open} onOpenChange={(v) => setBulkDialog((prev) => ({ ...prev, open: v }))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aplicar em massa?</AlertDialogTitle>
          <AlertDialogDescription>
            {bulkDialog.field === "valor_pago" ? (
              <>Deseja aplicar o valor de <strong>{bulkDialog.value}</strong> a todos os outros <strong>{bulkDialog.count}</strong> itens do modelo <strong>"{bulkDialog.model}"</strong>?</>
            ) : (
              <>Deseja aplicar a data de aquisição <strong>{bulkDialog.dataAquisicao ? new Date(bulkDialog.dataAquisicao).toLocaleDateString("pt-BR") : ""}</strong> a todos os outros <strong>{bulkDialog.count}</strong> itens do modelo <strong>"{bulkDialog.model}"</strong>?</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Não, apenas este</AlertDialogCancel>
          <AlertDialogAction onClick={handleBulkUpdate}>Sim, aplicar a todos</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
