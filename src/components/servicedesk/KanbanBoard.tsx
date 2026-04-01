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
  Plus,
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

const priorityConfig: Record<string, { label: string; color: string; dot: string }> = {
  high: { label: "Alta", color: "text-destructive", dot: "bg-destructive" },
  medium: { label: "Média", color: "text-warning", dot: "bg-warning" },
  low: { label: "Baixa", color: "text-muted-foreground", dot: "bg-success" },
};

const statusTypeColors: Record<string, string> = {
  todo: "bg-muted-foreground/50",
  in_progress: "bg-primary",
  done: "bg-success",
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
        <div className="flex gap-3 min-w-max h-full">
          {statuses.map((status) => {
            const columnTickets = getColumnTickets(status.id);

            return (
              <div key={status.id} className="w-[280px] shrink-0 flex flex-col h-full">
                {/* Column Header — ClickUp style */}
                <div className="flex items-center gap-2 px-2 py-2.5 mb-1">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: `hsl(${status.cor})` }}
                  />
                  <h3 className="text-sm font-semibold truncate">{status.nome}</h3>
                  <span className="text-xs text-muted-foreground font-medium tabular-nums">
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
                        "flex-1 overflow-y-auto space-y-2 rounded-lg p-1.5 transition-colors min-h-[80px]",
                        snapshot.isDraggingOver ? "bg-accent/40" : ""
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
                                  "group relative rounded-lg border bg-card shadow-sm transition-all hover:shadow-md overflow-hidden cursor-pointer",
                                  dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/20 rotate-[1deg]",
                                  isCompleted && "opacity-60"
                                )}
                                onClick={() => onTicketClick?.(ticket.id)}
                              >
                                <div className="p-3 space-y-2">
                                  {/* Title row */}
                                  <div className="flex items-start gap-1.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isCompleted) onQuickComplete(ticket.id);
                                      }}
                                      className={cn(
                                        "mt-0.5 shrink-0 transition-colors",
                                        isCompleted
                                          ? "text-success"
                                          : "text-muted-foreground/30 hover:text-success"
                                      )}
                                    >
                                      {isCompleted ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                      ) : (
                                        <Circle className="h-4 w-4" />
                                      )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(
                                        "text-sm font-medium leading-snug break-words line-clamp-2",
                                        isCompleted && "line-through text-muted-foreground"
                                      )}>
                                        {ticket.title}
                                      </p>
                                    </div>
                                    <div
                                      {...dragProvided.dragHandleProps}
                                      className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                                    </div>
                                  </div>

                                  {/* Category tag */}
                                  <span className="inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                                    {ticket.category}
                                  </span>

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

                                  {/* SLA */}
                                  {!isCompleted && (
                                    <div className="py-0.5">
                                      <SlaIndicator sla={sla} />
                                    </div>
                                  )}

                                  {/* Bottom icon bar — ClickUp style */}
                                  <div className="flex items-center gap-2 flex-wrap text-muted-foreground pt-0.5">
                                    {/* Priority flag */}
                                    <Flag className={cn("h-3 w-3", priority.color)} />

                                    {/* Opened date */}
                                    <span className="flex items-center gap-0.5 text-[11px]">
                                      <CalendarIcon className="h-3 w-3" />
                                      {format(new Date(ticket.createdAt), "dd/MM")}
                                    </span>

                                    <div className="flex-1" />

                                    {/* Assignee */}
                                    {ticket.assignee ? (
                                      <UserAvatar
                                        name={ticket.assignee}
                                        avatarUrl={ticket.assigneeAvatarUrl}
                                        className="h-5 w-5"
                                        fallbackClassName="text-[9px]"
                                      />
                                    ) : (
                                      <span className="text-[10px] italic text-muted-foreground/50">
                                        Sem resp.
                                      </span>
                                    )}
                                  </div>
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
