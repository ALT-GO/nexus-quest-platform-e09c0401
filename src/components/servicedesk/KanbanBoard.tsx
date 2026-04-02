import { useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { StatusCustom } from "@/hooks/use-custom-status";
import { HardwareAsset } from "@/hooks/use-assets";
import { SlaIndicator } from "@/components/sla/SlaIndicator";
import { AssetLinkerCompact } from "@/components/servicedesk/AssetLinker";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SlaInfo } from "@/hooks/use-sla";
import {
  GripVertical,
  CheckCircle2,
  Circle,
  Flag,
  CalendarIcon,
  User,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface KanbanTicket {
  id: string;
  title: string;
  category: string;
  statusId: string;
  priority: "low" | "medium" | "high";
  requester: string;
  assignee?: string;
  assigneeAvatarUrl?: string;
  createdAt: string;
  completedAt?: string;
  ativoId?: string;
  subtaskAssetIds?: string[];
  orderIndex?: number;
}

interface KanbanBoardProps {
  tickets: KanbanTicket[];
  statuses: StatusCustom[];
  getSlaInfo: (createdAt: string, category: string, isCompleted: boolean) => SlaInfo;
  isFinalStatus: (statusId: string) => boolean;
  onStatusChange: (ticketId: string, newStatusId: string) => void;
  onQuickComplete: (ticketId: string) => void;
  getAvailableForCategory: (category: string) => HardwareAsset[];
  getAsset: (id: string) => HardwareAsset | undefined;
  onLinkAsset: (ticketId: string, assetId: string) => void;
  onTicketClick?: (ticketId: string) => void;
  onDelete?: (ticketId: string) => void;
  onReorder?: (ticketId: string, statusId: string, newIndex: number) => void;
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "text-destructive" },
  medium: { label: "Média", color: "text-warning" },
  low: { label: "Baixa", color: "text-muted-foreground" },
};

const statusTypeIcons: Record<string, typeof Circle> = {
  todo: Circle,
  in_progress: Loader2,
  done: CheckCircle2,
};

const statusTypeBadgeClassFallback: Record<string, string> = {
  todo: "border-border",
  in_progress: "border-primary",
  done: "border-success",
};

export function KanbanBoard({
  tickets,
  statuses,
  getSlaInfo,
  isFinalStatus,
  onStatusChange,
  onQuickComplete,
  getAvailableForCategory,
  getAsset,
  onLinkAsset,
  onTicketClick,
  onDelete,
  onReorder,
}: KanbanBoardProps) {
  const getColumnTickets = useCallback(
    (statusId: string) =>
      tickets
        .filter((t) => t.statusId === statusId)
        .sort((a, b) => {
          const ac = a.completedAt ? 1 : 0;
          const bc = b.completedAt ? 1 : 0;
          if (ac !== bc) return ac - bc;
          return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
        }),
    [tickets]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;
      const sourceColumnId = source.droppableId;
      const destColumnId = destination.droppableId;
      if (sourceColumnId !== destColumnId) onStatusChange(draggableId, destColumnId);
      if (onReorder) onReorder(draggableId, destColumnId, destination.index);
    },
    [onStatusChange, onReorder]
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div
        className="overflow-x-auto pb-4 -mx-2 px-2 h-[calc(100vh-220px)]"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="flex gap-4 min-w-max h-full">
          {statuses.map((status) => {
            const columnTickets = getColumnTickets(status.id);
            const StatusIcon = statusTypeIcons[status.statusType] || Circle;

            return (
              <div
                key={status.id}
                className="w-[300px] shrink-0 flex flex-col h-full rounded-xl border bg-muted/30"
              >
                {/* Column Header — minimal pill badge */}
                <div className="flex items-center gap-2.5 px-3 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide border"
                    style={{
                      backgroundColor: `hsl(${status.cor})`,
                      borderColor: `hsl(${status.cor})`,
                      color: "white",
                    }}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status.nome}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium tabular-nums">
                    {columnTickets.length}
                  </span>
                </div>

                {/* Droppable Column */}
                <Droppable droppableId={status.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 overflow-y-auto space-y-2.5 px-2.5 pb-2.5 transition-colors min-h-[80px]",
                        snapshot.isDraggingOver ? "bg-accent/30" : ""
                      )}
                    >
                      {columnTickets.map((ticket, index) => {
                        const isCompleted = !!ticket.completedAt;
                        const sla = getSlaInfo(ticket.createdAt, ticket.category, isCompleted);
                        const priority = priorityConfig[ticket.priority] || priorityConfig.medium;
                        const linkedAsset = ticket.ativoId ? getAsset(ticket.ativoId) : undefined;
                        const subtaskAssets = (ticket.subtaskAssetIds || []).map(getAsset).filter(Boolean) as HardwareAsset[];

                        return (
                          <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={cn(
                                  "group relative rounded-lg border bg-card shadow-sm transition-all hover:shadow-md cursor-pointer overflow-hidden",
                                  dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/20 rotate-[1deg]",
                                  isCompleted && "opacity-60"
                                )}
                                onClick={() => onTicketClick?.(ticket.id)}
                              >
                                <div className="p-3.5 space-y-3">
                                  {/* Title row */}
                                  <div className="flex items-start gap-1.5">
                                    <div
                                      {...dragProvided.dragHandleProps}
                                      className="mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(
                                        "text-sm font-semibold leading-snug break-words line-clamp-2",
                                        isCompleted && "line-through text-muted-foreground"
                                      )}>
                                        {ticket.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">{ticket.category}</p>
                                    </div>
                                  </div>

                                  {/* Property rows — ClickUp style */}
                                  <div className="space-y-1.5 text-muted-foreground">
                                    {/* Assignee row */}
                                    <div className="flex items-center gap-2 text-xs">
                                      {ticket.assignee ? (
                                        <>
                                          <UserAvatar name={ticket.assignee} className="h-5 w-5" fallbackClassName="text-[9px]" />
                                          <span className="text-foreground truncate">{ticket.assignee}</span>
                                        </>
                                      ) : (
                                        <>
                                          <User className="h-3.5 w-3.5 shrink-0" />
                                          <span>-</span>
                                        </>
                                      )}
                                    </div>

                                    {/* Date row */}
                                    <div className="flex items-center gap-2 text-xs">
                                      <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                                      <span className="text-foreground">{format(new Date(ticket.createdAt), "dd/MM/yyyy")}</span>
                                    </div>

                                    {/* Priority row */}
                                    <div className="flex items-center gap-2 text-xs">
                                      <Flag className={cn("h-3.5 w-3.5 shrink-0", priority.color)} />
                                      <span className={priority.color}>{priority.label || "-"}</span>
                                    </div>
                                  </div>

                                  {/* SLA */}
                                  {!isCompleted && (
                                    <div className="py-0.5">
                                      <SlaIndicator sla={sla} />
                                    </div>
                                  )}

                                  {/* Asset linker */}
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <AssetLinkerCompact
                                      ticketCategory={ticket.category}
                                      linkedAssetId={ticket.ativoId}
                                      linkedAsset={linkedAsset}
                                      availableCount={getAvailableForCategory(ticket.category).length}
                                    />
                                  </div>

                                  {/* Subtask assets */}
                                  {subtaskAssets.length > 0 && (
                                    <div className="space-y-1">
                                      {subtaskAssets.map((asset) => (
                                        <div key={asset.id} className="flex items-center gap-1.5 rounded bg-success/10 px-2 py-1 text-xs min-w-0">
                                          <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                                          <span className="font-medium text-success truncate max-w-[120px]">{asset.model}</span>
                                          <span className="text-muted-foreground truncate">({asset.type})</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Delete — hover */}
                                {onDelete && (
                                  <div
                                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ConfirmDeleteDialog onConfirm={() => onDelete(ticket.id)} />
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}

                      {columnTickets.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex min-h-[80px] items-center justify-center rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                          Arraste chamados aqui
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}
