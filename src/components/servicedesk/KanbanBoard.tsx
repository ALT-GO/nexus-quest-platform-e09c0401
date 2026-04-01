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
import { GripVertical, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

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

const priorityConfig: Record<string, { label: string; dot: string }> = {
  high: { label: "Alta", dot: "bg-destructive" },
  medium: { label: "Média", dot: "bg-warning" },
  low: { label: "Baixa", dot: "bg-success" },
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

      // If moved to a different column, update status
      if (sourceColumnId !== destColumnId) {
        onStatusChange(draggableId, destColumnId);
      }

      // Always call reorder to persist position
      if (onReorder) {
        onReorder(draggableId, destColumnId, destination.index);
      }
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

            return (
              <div key={status.id} className="w-[300px] shrink-0 flex flex-col h-full">
                {/* Sticky Column Header */}
                <div
                  className="mb-3 flex items-center justify-between rounded-lg px-3 py-2.5 sticky top-0 z-10 bg-background"
                  style={{
                    backgroundColor: `hsl(${status.cor} / 0.15)`,
                    borderLeft: `3px solid hsl(${status.cor})`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: `hsl(${status.cor})` }}
                    />
                    <h3 className="text-sm font-semibold">{status.nome}</h3>
                    {status.statusType && (
                      <span
                        className={cn(
                          "text-[10px] rounded px-1.5 py-0.5 font-medium",
                          status.statusType === "todo"
                            ? "bg-muted text-muted-foreground"
                            : status.statusType === "in_progress"
                            ? "bg-primary/15 text-primary"
                            : "bg-success/15 text-success"
                        )}
                      >
                        {status.statusType === "todo"
                          ? "To Do"
                          : status.statusType === "in_progress"
                          ? "In Progress"
                          : "Done"}
                      </span>
                    )}
                  </div>
                  <span
                    className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium"
                    style={{
                      backgroundColor: `hsl(${status.cor} / 0.2)`,
                      color: `hsl(${status.cor})`,
                    }}
                  >
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
                        "space-y-2.5 flex-1 overflow-y-auto pr-1 rounded-lg transition-colors min-h-[80px]",
                        snapshot.isDraggingOver ? "bg-accent/30" : ""
                      )}
                    >
                      {columnTickets.map((ticket, index) => (
                        <Draggable
                          key={ticket.id}
                          draggableId={ticket.id}
                          index={index}
                        >
                          {(dragProvided, dragSnapshot) => {
                            const isCompleted = !!ticket.completedAt;
                            const sla = getSlaInfo(
                              ticket.createdAt,
                              ticket.category,
                              isCompleted
                            );
                            const priority = priorityConfig[ticket.priority];
                            const linkedAsset = ticket.ativoId
                              ? getAsset(ticket.ativoId)
                              : undefined;
                            const availableAssets = getAvailableForCategory(
                              ticket.category
                            );
                            const subtaskAssets = (ticket.subtaskAssetIds || [])
                              .map(getAsset)
                              .filter(Boolean) as HardwareAsset[];

                            return (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={cn(
                                  "group rounded-lg border bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md overflow-hidden",
                                  dragSnapshot.isDragging
                                    ? "shadow-lg ring-2 ring-primary/30 rotate-1"
                                    : "",
                                  isCompleted ? "opacity-60" : ""
                                )}
                              >
                                {/* Header with check button */}
                                <div className="mb-2 flex items-start gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isCompleted)
                                        onQuickComplete(ticket.id);
                                    }}
                                    className={cn(
                                      "mt-0.5 flex-shrink-0 transition-colors",
                                      isCompleted
                                        ? "text-emerald-500"
                                        : "text-muted-foreground/40 hover:text-emerald-500"
                                    )}
                                    title={
                                      isCompleted
                                        ? "Concluído"
                                        : "Marcar como concluído"
                                    }
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                      <Circle className="h-5 w-5 group-hover:hidden" />
                                    )}
                                    {!isCompleted && (
                                      <CheckCircle2 className="h-5 w-5 hidden group-hover:block" />
                                    )}
                                  </button>
                                  <div
                                    className="flex-1 min-w-0 cursor-pointer"
                                    onClick={() => onTicketClick?.(ticket.id)}
                                  >
                                    <p className="text-xs font-mono text-muted-foreground mb-1 truncate">
                                      {ticket.id}
                                    </p>
                                    <p
                                      className={cn(
                                        "font-medium text-sm leading-tight break-words whitespace-normal line-clamp-3",
                                        isCompleted && "line-through"
                                      )}
                                    >
                                      {ticket.title}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {onDelete && (
                                      <ConfirmDeleteDialog
                                        onConfirm={() => onDelete(ticket.id)}
                                      />
                                    )}
                                    <div
                                      {...dragProvided.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing"
                                    >
                                      <GripVertical className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground" />
                                    </div>
                                  </div>
                                </div>

                                {/* Category + details */}
                                <div
                                  onClick={() => onTicketClick?.(ticket.id)}
                                  className="cursor-pointer"
                                >
                                  <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground mb-2.5">
                                    {ticket.category}
                                  </span>

                                  <div className="mb-2">
                                    <AssetLinkerCompact
                                      ticketCategory={ticket.category}
                                      linkedAssetId={ticket.ativoId}
                                      linkedAsset={linkedAsset}
                                      availableCount={availableAssets.length}
                                    />
                                  </div>

                                  {subtaskAssets.length > 0 && (
                                    <div className="mb-2 space-y-1">
                                      {subtaskAssets.map((asset) => (
                                        <div
                                          key={asset.id}
                                          className="flex items-center gap-1.5 rounded bg-success/10 px-2 py-1 text-xs min-w-0 flex-wrap"
                                        >
                                          <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                                          <span className="font-medium text-success truncate max-w-[120px]">
                                            {asset.model}
                                          </span>
                                          <span className="text-muted-foreground truncate">
                                            ({asset.type})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {!isCompleted && (
                                    <div className="mb-2.5">
                                      <SlaIndicator sla={sla} />
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <div
                                        className={cn(
                                          "h-2 w-2 rounded-full",
                                          priority.dot
                                        )}
                                      />
                                      <span>{priority.label}</span>
                                    </div>
                                    {ticket.assignee ? (
                                      <div className="flex items-center gap-1.5">
                                        <UserAvatar
                                          name={ticket.assignee}
                                          className="h-5 w-5 text-[10px]"
                                        />
                                        <span className="truncate max-w-[100px]">
                                          {ticket.assignee}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="italic text-muted-foreground/60">
                                        Sem responsável
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        </Draggable>
                      ))}
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
