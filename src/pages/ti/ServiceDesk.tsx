import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { NewTicketDialog } from "@/components/servicedesk/NewTicketDialog";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  LayoutList,
  Kanban,
  Loader2,
} from "lucide-react";
import { useSlaTimer, slaByCategory } from "@/hooks/use-sla";
import { useCustomStatuses } from "@/hooks/use-custom-status";
import { useAssets, assetRequestCategories } from "@/hooks/use-assets";
import { useTickets } from "@/hooks/use-tickets";
import { StatusManagerDialog } from "@/components/servicedesk/StatusManagerDialog";
import { KanbanBoard } from "@/components/servicedesk/KanbanBoard";
import { TicketTable } from "@/components/servicedesk/TicketTable";
import { TicketDetailSheet } from "@/components/servicedesk/TicketDetailSheet";
import { toast } from "sonner";

const categories = [
  "Acesso e permissões",
  "Problemas com Computador/Notebook",
  "Problemas com Celular/Tablet",
  "Rede e Internet",
  "E-mail e Comunicação",
  "Serviços de Impressão",
  "Sistemas Corporativos",
  "Solicitação de novo Computador/Notebook",
  "Solicitação de novo Celular",
  "Solicitação de Tablet",
  "Gerais/Outros",
  "Contratação",
  "Desligamento",
];

type ViewMode = "list" | "kanban";

export default function ServiceDesk() {
  const { tickets, loading, fetchTickets, updateTicket, deleteTicket } = useTickets();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});

  // Fetch avatar URLs for all profiles
  useEffect(() => {
    supabase.from("profiles").select("full_name, avatar_url").then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((p) => {
          if (p.full_name && p.avatar_url) map[p.full_name] = p.avatar_url;
        });
        setAvatarMap(map);
      }
    });
  }, []);

  const { getSlaInfo, tick } = useSlaTimer();
  const {
    statuses,
    activeStatuses,
    isFinalStatus,
    getDoneStatusId,
    addStatus,
    updateStatus,
    reorderStatuses,
    logStatusChange,
  } = useCustomStatuses();

  const {
    assets,
    getAvailableForCategory,
    reserveAsset,
    deliverAsset,
    getAsset,
  } = useAssets();

  const loggedExpired = useRef<Set<string>>(new Set());

  // SLA expiry check — update in DB when expired
  useEffect(() => {
    tickets.forEach((ticket) => {
      if (isFinalStatus(ticket.status_id)) return;
      if (ticket.sla_expired) return;

      const sla = getSlaInfo(ticket.created_at, ticket.category, false);
      if (sla.slaVencido && !loggedExpired.current.has(ticket.id)) {
        loggedExpired.current.add(ticket.id);
        updateTicket(ticket.id, { sla_expired: true });
        toast.error(`SLA vencido: ${ticket.ticket_number} - ${ticket.title}`, {
          description: `O prazo de ${ticket.sla_hours}h foi ultrapassado.`,
          duration: 8000,
        });
      }
    });
  }, [tick, tickets, getSlaInfo, isFinalStatus, updateTicket]);

  // Link an asset to a ticket
  const handleLinkAsset = useCallback(
    async (ticketId: string, assetId: string) => {
      // Find the ticket by ticket_number or id
      const ticket = tickets.find((t) => t.ticket_number === ticketId || t.id === ticketId);
      if (!ticket) return;

      reserveAsset(assetId, ticket.ticket_number);
      await updateTicket(ticket.id, { asset_id: assetId });

      console.log(
        `[VINCULAÇÃO] ${new Date().toISOString()} | Ativo ${assetId} vinculado ao chamado ${ticket.ticket_number}`
      );
    },
    [tickets, reserveAsset, updateTicket]
  );

  // Handle status change
  const handleStatusChange = useCallback(
    async (ticketId: string, newStatusId: string) => {
      const ticket = tickets.find((t) => t.ticket_number === ticketId || t.id === ticketId);
      if (!ticket) return;

      const oldStatusId = ticket.status_id;
      if (oldStatusId === newStatusId) return;

      logStatusChange(ticket.ticket_number, oldStatusId, newStatusId);

      const oldName = statuses.find((s) => s.id === oldStatusId)?.nome ?? oldStatusId;
      const newName = statuses.find((s) => s.id === newStatusId)?.nome ?? newStatusId;
      toast.info(`${ticket.ticket_number}: ${oldName} → ${newName}`);

      const isFinal = isFinalStatus(newStatusId);
      const completedAt = isFinal ? new Date().toISOString() : null;

      await updateTicket(ticket.id, {
        status_id: newStatusId,
        completed_at: completedAt,
      });

      if (isFinal && ticket.asset_id) {
        deliverAsset(ticket.asset_id, ticket.ticket_number, ticket.requester);
        toast.success(
          `Ativo ${ticket.asset_id} entregue para ${ticket.requester}`,
          { description: "Status do ativo alterado para Em uso" }
        );
      }

      // Desligamento: set licenças to "Desligado" instead of removing collaborator
      if (isFinal && ticket.category === "Desligamento") {
        const { data: assets } = await supabase
          .from("inventory")
          .select("id, category")
          .eq("collaborator", ticket.requester);
        if (assets && assets.length > 0) {
          const licencas = assets.filter((a: any) => a.category === "licencas");
          const others = assets.filter((a: any) => a.category !== "licencas");
          // Licenças: change status to Desligado, keep collaborator name
          if (licencas.length > 0) {
            await supabase
              .from("inventory")
              .update({ status: "Desligado", updated_at: new Date().toISOString() })
              .in("id", licencas.map((a: any) => a.id));
          }
          // Other assets: set to Disponível and clear collaborator
          if (others.length > 0) {
            await supabase
              .from("inventory")
              .update({ status: "Disponível", collaborator: "", updated_at: new Date().toISOString() })
              .in("id", others.map((a: any) => a.id));
          }
          toast.success("Ativos do colaborador atualizados pelo desligamento");
        }
      }
    },
    [tickets, logStatusChange, isFinalStatus, statuses, deliverAsset, updateTicket]
  );

  // Quick complete - sets status to Done + completed_at, stays in same visual position until realtime updates
  const handleQuickComplete = useCallback(
    async (ticketIdOrNumber: string) => {
      const ticket = tickets.find((t) => t.ticket_number === ticketIdOrNumber || t.id === ticketIdOrNumber);
      if (!ticket) return;

      const isAlreadyCompleted = !!ticket.completed_at;

      if (isAlreadyCompleted) {
        // Un-complete: clear completed_at, revert status to first "todo" status
        const todoStatus = statuses.find((s) => s.statusType === "todo" && s.ativo);
        const success = await updateTicket(ticket.id, {
          completed_at: null,
          status_id: todoStatus?.id || "pending",
        });
        if (success) {
          toast.info(`${ticket.ticket_number}: marcado como não concluído`);
        }
      } else {
        // Complete: set completed_at + move status to done
        const doneStatusId = getDoneStatusId();
        const success = await updateTicket(ticket.id, {
          completed_at: new Date().toISOString(),
          status_id: doneStatusId,
        });
        if (success) {
          toast.success(`${ticket.ticket_number}: marcado como concluído`);
        }
      }
    },
    [tickets, updateTicket, getDoneStatusId, statuses]
  );

  // Handle reorder (same or cross-column)
  const handleReorder = useCallback(
    async (ticketIdOrNumber: string, statusId: string, newIndex: number) => {
      const ticket = tickets.find((t) => t.ticket_number === ticketIdOrNumber || t.id === ticketIdOrNumber);
      if (!ticket) return;

      // Get all non-subtask tickets in the DESTINATION column, sorted by order_index
      // Include the dragged ticket as if it already belongs to this column
      const columnTickets = tickets
        .filter((t) => !t.parent_ticket_id && (t.status_id === statusId || t.id === ticket.id))
        .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i) // dedupe
        .sort((a, b) => ((a as any).order_index ?? 0) - ((b as any).order_index ?? 0));

      // Remove dragged ticket and insert at new position
      const ordered = columnTickets.filter((t) => t.id !== ticket.id);
      ordered.splice(newIndex, 0, ticket);

      // Batch update order_index
      const updates = ordered.map((t, idx) => ({ id: t.id, order_index: idx }));
      for (const u of updates) {
        await supabase
          .from("tickets")
          .update({ order_index: u.order_index, updated_at: new Date().toISOString() } as any)
          .eq("id", u.id as any);
      }
    },
    [tickets]
  );

  // Open detail sheet
  const handleTicketClick = useCallback(
    (ticketIdOrNumber: string) => {
      const ticket = tickets.find((t) => t.ticket_number === ticketIdOrNumber || t.id === ticketIdOrNumber);
      if (ticket) {
        setSelectedTicketId(ticket.id);
        setDetailOpen(true);
      }
    },
    [tickets]
  );

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null;

  // Get subtasks for a parent ticket
  const getSubtasks = useCallback(
    (parentId: string) => tickets.filter((t) => t.parent_ticket_id === parentId),
    [tickets]
  );

  // Filters - exclude subtasks from main list
  const filteredTickets = tickets
    .filter((ticket) => {
      if (ticket.parent_ticket_id) return false;
      if (hideCompleted && !!ticket.completed_at) return false;
      const matchesSearch =
        ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        filterCategory === "all" || ticket.category === filterCategory;
      const matchesStatus =
        filterStatus === "all" || ticket.status_id === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    // Sort: completed tickets go to the bottom
    .sort((a, b) => {
      const aCompleted = !!a.completed_at ? 1 : 0;
      const bCompleted = !!b.completed_at ? 1 : 0;
      return aCompleted - bCompleted;
    });

  return (
    <AppLayout>
      <PageHeader
        title="Service Desk"
        description="Central de atendimento e suporte de TI"
      >
        <StatusManagerDialog
          statuses={statuses}
          onAdd={addStatus}
          onUpdate={updateStatus}
          onReorder={reorderStatuses}
        />
        <NewTicketDialog />
        
        <Button variant="outline" asChild>
          <a href="/chamado-publico" target="_blank">
            Ver Formulário Público
          </a>
        </Button>
      </PageHeader>

      {/* Filters + View Toggle */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID ou título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[250px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {activeStatuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="hide-completed"
              checked={hideCompleted}
              onCheckedChange={setHideCompleted}
            />
            <Label htmlFor="hide-completed" className="text-sm text-muted-foreground whitespace-nowrap cursor-pointer">
              Ocultar concluídos
            </Label>
          </div>
        </div>

        <div className="flex rounded-lg border bg-muted p-1">
          <Button
            variant={viewMode === "kanban" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("kanban")}
            className="gap-1.5"
          >
            <Kanban className="h-4 w-4" />
            <span className="hidden sm:inline">Kanban</span>
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-1.5"
          >
            <LayoutList className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          tickets={filteredTickets.map((t) => ({
            id: t.ticket_number,
            title: t.title,
            category: t.category,
            statusId: t.status_id,
            priority: t.priority,
            requester: t.requester,
            assignee: t.assignee ?? undefined,
            createdAt: t.created_at,
            completedAt: t.completed_at ?? undefined,
            ativoId: t.asset_id ?? undefined,
            subtaskAssetIds: getSubtasks(t.id).map((s) => s.asset_id).filter(Boolean) as string[],
            orderIndex: t.order_index ?? 0,
          }))}
          statuses={activeStatuses}
          getSlaInfo={getSlaInfo}
          isFinalStatus={isFinalStatus}
          onStatusChange={handleStatusChange}
          onQuickComplete={handleQuickComplete}
          getAvailableForCategory={getAvailableForCategory}
          getAsset={getAsset}
          onLinkAsset={handleLinkAsset}
          onTicketClick={handleTicketClick}
          onDelete={(ticketIdOrNumber) => {
            const t = tickets.find((tk) => tk.ticket_number === ticketIdOrNumber || tk.id === ticketIdOrNumber);
            if (t) deleteTicket(t.id);
          }}
          onReorder={handleReorder}
        />
      ) : (
        <TicketTable
          tickets={filteredTickets.map((t) => ({
            id: t.ticket_number,
            title: t.title,
            category: t.category,
            statusId: t.status_id,
            priority: t.priority,
            requester: t.requester,
            email: t.email,
            createdAt: t.created_at,
            completedAt: t.completed_at ?? undefined,
            slaVencido: t.sla_expired,
            assignee: t.assignee ?? undefined,
            ativoId: t.asset_id ?? undefined,
            subtaskAssetIds: getSubtasks(t.id).map((s) => s.asset_id).filter(Boolean) as string[],
          }))}
          statuses={activeStatuses}
          getSlaInfo={getSlaInfo}
          isFinalStatus={isFinalStatus}
          onQuickComplete={handleQuickComplete}
          getAvailableForCategory={getAvailableForCategory}
          getAsset={getAsset}
          onLinkAsset={handleLinkAsset}
          onTicketClick={handleTicketClick}
          onDelete={(ticketIdOrNumber) => {
            const t = tickets.find((tk) => tk.ticket_number === ticketIdOrNumber || tk.id === ticketIdOrNumber);
            if (t) deleteTicket(t.id);
          }}
        />
      )}

      <TicketDetailSheet
        ticket={selectedTicket}
        subtasks={selectedTicket ? getSubtasks(selectedTicket.id) : []}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        statuses={activeStatuses}
        isFinalStatus={isFinalStatus}
        getSlaInfo={getSlaInfo}
        getAvailableForCategory={getAvailableForCategory}
        getAsset={getAsset}
        onLinkAsset={handleLinkAsset}
        onStatusChange={handleStatusChange}
        onUpdateTicket={async (id, updates) => updateTicket(id, updates as any)}
      />
    </AppLayout>
  );
}
