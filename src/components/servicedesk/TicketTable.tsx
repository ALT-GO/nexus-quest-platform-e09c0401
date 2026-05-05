import { StatusCustom } from "@/hooks/use-custom-status";
import { HardwareAsset } from "@/hooks/use-assets";
import { SlaIndicator } from "@/components/sla/SlaIndicator";
import { AssetLinker } from "@/components/servicedesk/AssetLinker";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { SlaInfo } from "@/hooks/use-sla";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, ChevronDown, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TicketForTable {
  id: string;
  title: string;
  category: string;
  statusId: string;
  priority: "low" | "medium" | "high";
  requester: string;
  email: string;
  createdAt: string;
  completedAt?: string;
  slaVencido: boolean;
  slaDeadline?: string;
  assignee?: string;
  ativoId?: string;
  subtaskAssetIds?: string[];
}

interface TicketTableProps {
  tickets: TicketForTable[];
  statuses: StatusCustom[];
  getSlaInfo: (createdAt: string, category: string, isCompleted: boolean, deadlineOverride?: string | null) => SlaInfo;
  isFinalStatus: (statusId: string) => boolean;
  onQuickComplete: (ticketId: string) => void;
  getAvailableForCategory: (category: string) => HardwareAsset[];
  getAsset: (id: string) => HardwareAsset | undefined;
  onLinkAsset: (ticketId: string, assetId: string) => void;
  onTicketClick?: (ticketId: string) => void;
  onDelete?: (ticketId: string) => void;
}

export function TicketTable({
  tickets,
  statuses,
  getSlaInfo,
  isFinalStatus,
  onQuickComplete,
  getAvailableForCategory,
  getAsset,
  onLinkAsset,
  onTicketClick,
  onDelete,
}: TicketTableProps) {
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const getStatusDisplay = (statusId: string) => {
    const status = statuses.find((s) => s.id === statusId);
    if (!status) return { nome: statusId, cor: "215 16% 47%" };
    return status;
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-8"></TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => {
              const isCompleted = !!ticket.completedAt;
              const sla = getSlaInfo(ticket.createdAt, ticket.category, isCompleted, ticket.slaDeadline);
              const statusDisplay = getStatusDisplay(ticket.statusId);
              const isExpanded = expandedTicket === ticket.id;
              const availableAssets = getAvailableForCategory(ticket.category);
              const linkedAsset = ticket.ativoId ? getAsset(ticket.ativoId) : undefined;
              const hasAssetInfo = availableAssets.length > 0 || !!ticket.ativoId;
              const subtaskAssets = (ticket.subtaskAssetIds || []).map(getAsset).filter(Boolean) as HardwareAsset[];
              const hasSubtaskAssets = subtaskAssets.length > 0;
              return (
                <>
                  <TableRow
                    key={ticket.id}
                    className={cn(
                      sla.slaVencido && !isCompleted ? "bg-destructive/5" : undefined,
                      isCompleted ? "opacity-60" : undefined
                    )}
                  >
                    {/* Quick complete button */}
                    <TableCell className="w-10 px-2">
                      <button
                        onClick={() => !isCompleted && onQuickComplete(ticket.id)}
                        className={cn(
                          "transition-colors",
                          isCompleted
                            ? "text-emerald-500"
                            : "text-muted-foreground/40 hover:text-emerald-500"
                        )}
                        title={isCompleted ? "Concluído" : "Marcar como concluído"}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="w-8 px-2">
                      {hasAssetInfo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{ticket.id}</TableCell>
                    <TableCell className={cn("font-medium", isCompleted && "line-through")}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{ticket.title}</span>
                        {subtaskAssets.map((asset) => (
                          <Badge key={asset.id} variant="outline" className="bg-success/10 text-success border-success/20 text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {asset.model}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs">{ticket.category}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{ticket.requester}</p>
                        <p className="text-xs text-muted-foreground">{ticket.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{!isCompleted ? <SlaIndicator sla={sla} /> : <span className="text-xs text-success font-medium">Concluído</span>}</TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `hsl(${statusDisplay.cor} / 0.15)`,
                          color: `hsl(${statusDisplay.cor})`,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(${statusDisplay.cor})` }} />
                        {statusDisplay.nome}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ticket.priority === "high" ? "bg-destructive/15 text-destructive"
                        : ticket.priority === "medium" ? "bg-warning/15 text-warning"
                        : "bg-success/15 text-success"
                      }`}>
                        {ticket.priority === "high" ? "Alta" : ticket.priority === "medium" ? "Média" : "Baixa"}
                      </span>
                    </TableCell>
                    <TableCell>{ticket.assignee || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onTicketClick?.(ticket.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {onDelete && (
                          <ConfirmDeleteDialog onConfirm={() => onDelete(ticket.id)} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && hasAssetInfo && (
                    <TableRow key={`${ticket.id}-asset`}>
                      <TableCell colSpan={11} className="bg-muted/30 p-4">
                        <AssetLinker
                          ticketId={ticket.id}
                          ticketCategory={ticket.category}
                          linkedAssetId={ticket.ativoId}
                          linkedAsset={linkedAsset}
                          availableAssets={availableAssets}
                          onLink={(assetId) => onLinkAsset(ticket.id, assetId)}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
