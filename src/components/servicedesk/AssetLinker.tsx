import { useState, useEffect } from "react";
import {
  HardwareAsset,
  assetRequestCategories,
  getAssetTypeForCategory,
} from "@/hooks/use-assets";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Link2, Package, CheckCircle2, Laptop, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const conditionLabels: Record<string, { label: string; color: string }> = {
  ready: { label: "Pronto para uso", color: "bg-success/15 text-success" },
  maintenance: { label: "Em manutenção", color: "bg-warning/15 text-warning" },
  blocked: { label: "Bloqueado", color: "bg-destructive/15 text-destructive" },
  scrap: { label: "Sucata", color: "bg-muted text-muted-foreground" },
};

interface AssetLinkerProps {
  ticketId: string;
  ticketCategory: string;
  linkedAssetId?: string;
  linkedAsset?: HardwareAsset;
  availableAssets: HardwareAsset[];
  onLink: (assetId: string) => void;
  requesterName?: string;
}

interface RequesterAsset {
  id: string;
  asset_code: string;
  category: string;
  model: string;
  service_tag: string;
  status: string;
  condition: string;
  marca: string;
  licenca: string;
  numero: string;
}

function RequesterAssetsSection({ requesterName }: { requesterName: string }) {
  const [assets, setAssets] = useState<RequesterAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requesterName) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("inventory")
        .select("id, asset_code, category, model, service_tag, status, condition, marca, licenca, numero")
        .eq("collaborator", requesterName);
      if (data) setAssets(data as RequesterAsset[]);
      setLoading(false);
    };
    fetch();
  }, [requesterName]);

  if (loading || assets.length === 0) return null;

  const catLabels: Record<string, string> = {
    notebooks: "Notebook",
    celulares: "Celular",
    linhas: "Linha",
    licencas: "Licença",
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <User className="h-3 w-3" /> Ativos do solicitante ({assets.length})
      </label>
      <div className="flex flex-wrap gap-1.5">
        {assets.map((a) => (
          <Badge key={a.id} variant="secondary" className="gap-1 text-xs">
            {catLabels[a.category] || a.category}: {a.model || a.licenca || a.numero || a.asset_code}
            {a.service_tag ? ` (${a.service_tag})` : ""}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function AssetLinker({
  ticketId,
  ticketCategory,
  linkedAssetId,
  linkedAsset,
  availableAssets,
  onLink,
  requesterName,
}: AssetLinkerProps) {
  const [open, setOpen] = useState(false);

  const isAssetRequest = assetRequestCategories.includes(ticketCategory);
  const assetType = getAssetTypeForCategory(ticketCategory);

  // Already linked
  if (isAssetRequest && linkedAssetId && linkedAsset) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <div className="flex-1">
            <span className="font-medium text-success">Ativo vinculado: </span>
            <span className="text-foreground">
              {linkedAsset.model} ({linkedAsset.serviceTag || linkedAsset.assetCode})
            </span>
            <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
              {linkedAsset.status}
            </span>
          </div>
        </div>
        {requesterName && <RequesterAssetsSection requesterName={requesterName} />}
      </div>
    );
  }

  // Asset request with available stock
  if (isAssetRequest) {
    return (
      <div className="space-y-3">
        {availableAssets.length > 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-info/30 bg-info/5 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-info" />
              <span>
                <span className="font-semibold text-info">
                  {availableAssets.length} {assetType}(s)
                </span>{" "}
                disponível(is) no estoque
              </span>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Vincular ativo
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl w-[95vw]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Laptop className="h-5 w-5" />
                    Selecionar {assetType} disponível
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Vincule um ativo ao chamado <strong>{ticketId}</strong>. O status será alterado para <strong>Reservado</strong>.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Id</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Service tag</TableHead>
                      <TableHead>Condição</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableAssets.map((asset) => {
                      const cond = conditionLabels[(asset as any).condition || "ready"] || conditionLabels.ready;
                      return (
                        <TableRow key={asset.id}>
                          <TableCell className="font-mono text-sm">{asset.assetCode || asset.id}</TableCell>
                          <TableCell className="font-medium">{asset.model}</TableCell>
                          <TableCell className="font-mono text-sm">{asset.serviceTag || "—"}</TableCell>
                          <TableCell>
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cond.color)}>
                              {cond.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => {
                                onLink(asset.id);
                                setOpen(false);
                                toast.success(
                                  `Ativo ${asset.assetCode || asset.id} vinculado ao chamado ${ticketId}`,
                                  { description: "Status alterado para Reservado" }
                                );
                              }}
                            >
                              <Link2 className="mr-1 h-3.5 w-3.5" />
                              Vincular
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
            <AlertCircle className="h-4 w-4 text-warning" />
            <span>
              Nenhum <strong>{assetType}</strong> disponível no estoque
            </span>
          </div>
        )}
        {requesterName && <RequesterAssetsSection requesterName={requesterName} />}
      </div>
    );
  }

  // Non-asset-request tickets: just show requester's assets
  if (requesterName) {
    return <RequesterAssetsSection requesterName={requesterName} />;
  }

  return null;
}

/** Compact inline version for Kanban cards */
export function AssetLinkerCompact({
  ticketCategory,
  linkedAssetId,
  linkedAsset,
  availableCount,
}: {
  ticketCategory: string;
  linkedAssetId?: string;
  linkedAsset?: HardwareAsset;
  availableCount: number;
}) {
  if (!assetRequestCategories.includes(ticketCategory)) return null;

  if (linkedAssetId && linkedAsset) {
    return (
      <div className="flex items-center gap-1.5 rounded bg-success/10 px-2 py-1 text-xs">
        <CheckCircle2 className="h-3 w-3 text-success" />
        <span className="font-medium text-success">{linkedAsset.model}</span>
      </div>
    );
  }

  if (availableCount > 0) {
    return (
      <div className="flex items-center gap-1.5 rounded bg-info/10 px-2 py-1 text-xs">
        <Package className="h-3 w-3 text-info" />
        <span className="text-info">{availableCount} disponível(is)</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded bg-warning/10 px-2 py-1 text-xs">
      <AlertCircle className="h-3 w-3 text-warning" />
      <span className="text-warning">Sem estoque</span>
    </div>
  );
}
