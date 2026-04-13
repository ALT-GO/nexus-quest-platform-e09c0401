import { useCollaboratorDetail, CollaboratorAsset } from "@/hooks/use-collaborators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { InlineCellEditor } from "@/components/assets/InlineCellEditor";
import { StatusSelectCell } from "@/components/collaborators/StatusSelectCell";
import { ArrowLeft, FileDown, Laptop, Smartphone, Phone, FileText, Loader2, FileUp, Eye, Tablet, Mouse, MoreHorizontal, Unlink } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PrintableTermDialog } from "@/components/collaborators/PrintableTermDialog";
import { AssetSelectionDialog } from "@/components/collaborators/AssetSelectionDialog";
import { LinkExistingAssetDialog } from "@/components/collaborators/LinkExistingAssetDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { StockDetailDialog } from "@/components/collaborators/StockDetailDialog";

interface Props {
  name: string;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  "Disponível": "bg-emerald-500/15 text-emerald-600",
  "Em uso": "bg-blue-500/15 text-blue-600",
  "Manutenção": "bg-amber-500/15 text-amber-600",
  "Baixado": "bg-muted text-muted-foreground",
  "Inativo": "bg-orange-500/15 text-orange-600",
  "Reservado": "bg-muted text-muted-foreground",
  "Ativo": "bg-emerald-500/15 text-emerald-600",
  "Desligado": "bg-red-500/15 text-red-600",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusColors[status] || "bg-secondary text-secondary-foreground")}>
      {status}
    </span>
  );
}

// Column definitions per category
interface ColDef {
  key: string;
  label: string;
  type?: "text" | "select" | "date" | "status";
  options?: string[];
  readOnly?: boolean;
}

const statusOptionsDefault = ["Disponível", "Em uso", "Manutenção", "Reservado", "Baixado"];
const statusOptionsLicenca = ["Ativo", "Inativo", "Desligado"];
const tipoNotebook = ["Administrativo", "Campo"];

const columnsByCategory: Record<string, ColDef[]> = {
  notebooks: [
    { key: "service_tag", label: "Service tag" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "asset_type", label: "Tipo", type: "select", options: tipoNotebook },
    { key: "valor_pago", label: "Valor Pago (R$)" },
    { key: "notes", label: "Notas" },
    { key: "service_tag_2", label: "Service tag 2" },
  ],
  celulares: [
    { key: "service_tag", label: "Service tag" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "asset_type", label: "Tipo" },
    { key: "valor_pago", label: "Valor Pago (R$)" },
    { key: "notes", label: "Notas" },
    { key: "imei1", label: "Imei 1" },
    { key: "imei2", label: "Imei 2" },
  ],
  linhas: [
    { key: "numero", label: "Número" },
    { key: "cargo", label: "Cargo" },
    { key: "asset_type", label: "Tipo" },
    { key: "gestor", label: "Gestor" },
    { key: "operadora", label: "Operadora" },
    { key: "contrato", label: "Contrato" },
    { key: "cost_center_eng", label: "Centro de custo - Eng" },
    { key: "cost_center_man", label: "Centro de custo - Man" },
  ],
  tablets: [
    { key: "service_tag", label: "Service tag" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "imei1", label: "IMEI / S/N" },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "valor_pago", label: "Valor Pago (R$)" },
    { key: "notes", label: "Notas" },
  ],
  perifericos: [
    { key: "service_tag", label: "Service tag / P/N" },
    { key: "cargo", label: "Cargo" },
    { key: "marca", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "asset_type", label: "Tipo", type: "select", options: ["Mouse", "Teclado", "Carregador", "Monitor", "Headset", "Docking Station", "Outro"] },
    { key: "cost_center", label: "Centro de custo" },
    { key: "contrato", label: "Contrato" },
    { key: "valor_pago", label: "Valor Pago (R$)" },
    { key: "notes", label: "Notas" },
  ],
  licencas: [
    { key: "status", label: "Status", type: "status" },
    { key: "cargo", label: "Cargo" },
    { key: "email_address", label: "E-mail" },
    { key: "created_at", label: "Data criação", readOnly: true },
    { key: "data_bloqueio", label: "Data de Bloqueio", type: "date" },
    { key: "licenca", label: "Licença" },
    { key: "gestor", label: "Gestor" },
    { key: "contrato", label: "Contrato" },
    { key: "cost_center_eng", label: "Centro de custo - Eng" },
    { key: "cost_center_man", label: "Centro de custo - Man" },
  ],
};

const categoryConfig: Record<string, { label: string; icon: React.ElementType }> = {
  notebooks: { label: "Notebooks", icon: Laptop },
  celulares: { label: "Celulares", icon: Smartphone },
  tablets: { label: "Tablets", icon: Tablet },
  perifericos: { label: "Periféricos", icon: Mouse },
  linhas: { label: "Linhas telefônicas", icon: Phone },
  licencas: { label: "Licenças", icon: FileText },
};

function AssetSection({
  category,
  assets,
  collaboratorName,
  onUpdate,
  onDelete,
  onUnlink,
  onRefetch,
}: {
  category: string;
  assets: CollaboratorAsset[];
  collaboratorName: string;
  onUpdate: (id: string, updates: Partial<CollaboratorAsset>) => void;
  onDelete: (id: string) => void;
  onUnlink: (id: string) => void;
  onRefetch: () => void;
}) {
  const [singleTermAsset, setSingleTermAsset] = useState<CollaboratorAsset | null>(null);
  const [singleTermType, setSingleTermType] = useState<"responsabilidade" | "devolucao">("responsabilidade");

  const config = categoryConfig[category];
  if (!config) return null;
  const Icon = config.icon;
  const columns = columnsByCategory[category] || [];

  const openSingleTerm = (asset: CollaboratorAsset, type: "responsabilidade" | "devolucao") => {
    setSingleTermAsset(asset);
    setSingleTermType(type);
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Icon className="h-5 w-5 text-muted-foreground" />
          {config.label}
          <Badge variant="secondary" className="ml-2">{assets.length}</Badge>
        </CardTitle>
        <LinkExistingAssetDialog
          collaboratorName={collaboratorName}
          category={category}
          onLinked={onRefetch}
        />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Id</TableHead>
                {columns.map((col) => (
                  <TableHead key={col.key} className="whitespace-nowrap">{col.label}</TableHead>
                ))}
                <TableHead className="w-[60px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.asset_code}</TableCell>
                  {columns.map((col) => {
                    if (col.key === "valor_pago") {
                      const val = (item as any).valor_pago;
                      return (
                        <TableCell key={col.key}>
                          <InlineCellEditor
                            value={val != null ? String(val) : ""}
                            onSave={(v) => onUpdate(item.id, { valor_pago: v ? parseFloat(v) : null } as any)}
                          />
                        </TableCell>
                      );
                    }
                    if (col.readOnly) {
                      const val = col.key === "created_at"
                        ? new Date(item.created_at).toLocaleDateString("pt-BR")
                        : (item as any)[col.key] || "—";
                      return <TableCell key={col.key} className="text-sm">{val}</TableCell>;
                    }
                    if (col.type === "status" && category === "licencas") {
                      return (
                        <TableCell key={col.key}>
                          <StatusSelectCell
                            value={(item as any)[col.key] || ""}
                            onSave={async (v) => onUpdate(item.id, { [col.key]: v } as any)}
                          />
                        </TableCell>
                      );
                    }
                    if (col.type === "status") {
                      return (
                        <TableCell key={col.key}>
                          <InlineCellEditor
                            value={(item as any)[col.key] || ""}
                            onSave={(v) => onUpdate(item.id, { [col.key]: v } as any)}
                            type="select"
                            options={statusOptionsDefault}
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
                            onSave={(v) => onUpdate(item.id, { [col.key]: v } as any)}
                            type="select"
                            options={col.options}
                          />
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={col.key}>
                        <InlineCellEditor
                          value={(item as any)[col.key] || ""}
                          onSave={(v) => onUpdate(item.id, { [col.key]: v } as any)}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StockDetailDialog asset={item} onUpdated={onRefetch} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openSingleTerm(item, "responsabilidade")} className="gap-2">
                            <FileDown className="h-3.5 w-3.5" />
                            Termo de Responsabilidade
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSingleTerm(item, "devolucao")} className="gap-2">
                            <FileUp className="h-3.5 w-3.5" />
                            Termo de Devolução
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onUnlink(item.id)} className="gap-2 text-orange-600">
                            <Unlink className="h-3.5 w-3.5" />
                            Desvincular
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ConfirmDeleteDialog onConfirm={() => onDelete(item.id)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {assets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 2} className="text-center py-6 text-muted-foreground">
                    Nenhum item nesta categoria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    {singleTermAsset && (
      <PrintableTermDialog
        open={!!singleTermAsset}
        onOpenChange={(v) => { if (!v) setSingleTermAsset(null); }}
        collaboratorName={collaboratorName}
        assets={[singleTermAsset]}
        type={singleTermType}
      />
    )}
    </>
  );
}

export function CollaboratorProfile({ name, onBack }: Props) {
  const { assets, loading, refetch, updateAsset, deleteAsset } = useCollaboratorDetail(name);
  const [termDialogOpen, setTermDialogOpen] = useState(false);
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [termType, setTermType] = useState<"responsabilidade" | "devolucao">("responsabilidade");
  const [termAssets, setTermAssets] = useState<CollaboratorAsset[]>([]);

  const notebooks = assets.filter((a) => a.category === "notebooks" || a.category === "hardware");
  const celulares = assets.filter((a) => a.category === "celulares");
  const tablets = assets.filter((a) => a.category === "tablets");
  const perifericos = assets.filter((a) => a.category === "perifericos");
  const linhas = assets.filter((a) => a.category === "linhas" || a.category === "telecom");
  const licencas = assets.filter((a) => a.category === "licencas" || a.category === "licenses");

  const openTermDialog = (type: "responsabilidade" | "devolucao") => {
    setTermType(type);
    setSelectionDialogOpen(true);
  };

  const handleSelectionConfirm = (selected: CollaboratorAsset[]) => {
    setTermAssets(selected);
    setTermDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteAsset(id);
    toast.success("Ativo excluído");
  };

  const handleUnlink = async (id: string) => {
    const asset = assets.find((a) => a.id === id);
    const category = asset?.category || "";

    const base: Record<string, any> = {
      collaborator: "",
      status: category === "licencas" || category === "licenses" ? "Inativo" : "Disponível",
      condition: "ready",
      updated_at: new Date().toISOString(),
    };

    if (category === "linhas" || category === "telecom") {
      base.asset_type = "";
      base.gestor = "";
      base.contrato = "";
    }

    // Licenças: only clear collaborator, keep everything else
    if (category === "licencas" || category === "licenses") {
      await supabase.from("inventory").update({
        collaborator: "",
        status: "Inativo",
        updated_at: new Date().toISOString(),
      }).eq("id", id);
    } else {
      await supabase.from("inventory").update(base).eq("id", id);
    }

    toast.success("Ativo desvinculado e devolvido ao estoque");
    refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">{name}</h2>
            <p className="text-sm text-muted-foreground">{assets.length} ativo(s) vinculado(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openTermDialog("devolucao")} className="gap-2">
            <FileUp className="h-4 w-4" />
            Termo de Devolução
          </Button>
          <Button onClick={() => openTermDialog("responsabilidade")} className="gap-2">
            <FileDown className="h-4 w-4" />
            Termo de Responsabilidade
          </Button>
        </div>
      </div>

      {assets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p>Nenhum ativo vinculado a este colaborador.</p>
            <p className="text-xs mt-1">Use o botão "Novo ativo" em cada seção para adicionar.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        <AssetSection category="notebooks" assets={notebooks} collaboratorName={name} onUpdate={updateAsset} onDelete={handleDelete} onUnlink={handleUnlink} onRefetch={refetch} />
        <AssetSection category="celulares" assets={celulares} collaboratorName={name} onUpdate={updateAsset} onDelete={handleDelete} onUnlink={handleUnlink} onRefetch={refetch} />
        <AssetSection category="tablets" assets={tablets} collaboratorName={name} onUpdate={updateAsset} onDelete={handleDelete} onUnlink={handleUnlink} onRefetch={refetch} />
        <AssetSection category="perifericos" assets={perifericos} collaboratorName={name} onUpdate={updateAsset} onDelete={handleDelete} onUnlink={handleUnlink} onRefetch={refetch} />
        <AssetSection category="linhas" assets={linhas} collaboratorName={name} onUpdate={updateAsset} onDelete={handleDelete} onUnlink={handleUnlink} onRefetch={refetch} />
        <AssetSection category="licencas" assets={licencas} collaboratorName={name} onUpdate={updateAsset} onDelete={handleDelete} onUnlink={handleUnlink} onRefetch={refetch} />
      </div>

      <AssetSelectionDialog
        open={selectionDialogOpen}
        onOpenChange={setSelectionDialogOpen}
        assets={assets}
        type={termType}
        onConfirm={handleSelectionConfirm}
      />

      <PrintableTermDialog 
        open={termDialogOpen} 
        onOpenChange={setTermDialogOpen} 
        collaboratorName={name}
        assets={termAssets}
        type={termType}
      />
    </div>
  );
}
