import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slaByCategory } from "@/hooks/use-sla";
import { fetchSlaCategoryMap } from "@/hooks/use-sla-categories";
import { logAuditEvent } from "@/lib/audit";
import { toast } from "sonner";
import { sendNotification } from "@/lib/notifications";
import { ChatSuporteTI } from "@/lib/chat-suporte-ti";

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  category: string;
  description: string;
  status_id: string;
  priority: "low" | "medium" | "high";
  requester: string;
  email: string;
  department: string | null;
  assignee: string | null;
  asset_id: string | null;
  parent_ticket_id: string | null;
  sla_hours: number;
  sla_deadline: string;
  sla_expired: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  checklist: ChecklistItem[] | null;
  external_notes: string | null;
  bucket_name: string | null;
  progress: "not_started" | "in_progress" | "completed";
  order_index: number;
}

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tickets:", error);
      toast.error("Erro ao carregar chamados");
    } else {
      setTickets((data as unknown as Ticket[]) || []);
    }
    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newTicket = payload.new as unknown as Ticket;
            setTickets((prev) => {
              if (prev.some((t) => t.id === newTicket.id)) return prev;
              return [newTicket, ...prev];
            });
            toast.info(`Novo chamado: ${newTicket.ticket_number} - ${newTicket.title}`);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as unknown as Ticket;
            setTickets((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setTickets((prev) => prev.filter((t) => t.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateTicket = useCallback(
    async (id: string, updates: Partial<Omit<Ticket, "id" | "created_at">>) => {
      const dbUpdates: any = { ...updates, updated_at: new Date().toISOString() };
      if (dbUpdates.checklist && Array.isArray(dbUpdates.checklist)) {
        dbUpdates.checklist = JSON.stringify(dbUpdates.checklist);
      }
      const { error } = await supabase
        .from("tickets")
        .update(dbUpdates)
        .eq("id", id as any);

      if (error) {
        console.error("Error updating ticket:", error);
        toast.error("Erro ao atualizar chamado");
        return false;
      }
      // Update local state so UI reflects change immediately
      setTickets((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
        )
      );
      return true;
    },
    []
  );

  const deleteTicket = useCallback(
    async (id: string) => {
      const ticket = tickets.find((t) => t.id === id);
      const { error } = await supabase
        .from("tickets")
        .delete()
        .eq("id", id as any);

      if (error) {
        console.error("Error deleting ticket:", error);
        toast.error("Erro ao excluir chamado");
        return false;
      }
      setTickets((prev) => prev.filter((t) => t.id !== id));
      toast.success("Chamado excluído permanentemente");
      logAuditEvent({
        action: "Exclusão de chamado",
        entityType: "ticket",
        entityId: id,
        details: `Excluiu o chamado "${ticket?.title || id}"`,
      });
      return true;
    },
    [tickets]
  );

  return { tickets, loading, fetchTickets, updateTicket, deleteTicket };
}

// Category → Kanban column mapping
const categoryToColumnMap: Record<string, string> = {
  "Solicitação de novo Computador/Notebook": "Solicitações de Notebook",
  "Solicitação de novo Celular": "Solicitação de Celular",
  "Solicitação de nova Linha": "Solicitação de Linhas",
  "Solicitação de Tablet": "Solicitação de Tablet",
  "Contratação": "Contratações",
  "Desligamento": "Desligamentos",
};

const defaultColumnName = "Novos Chamados";

async function resolveStatusId(category: string): Promise<string> {
  const targetColumn = categoryToColumnMap[category] || defaultColumnName;

  // Check if the status column already exists
  const { data: existing } = await supabase
    .from("status_config")
    .select("id")
    .eq("nome", targetColumn)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  // Create the status column
  const id = `auto_${targetColumn.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
  const { data: allStatuses } = await supabase
    .from("status_config")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1);

  const maxOrdem = allStatuses && allStatuses.length > 0 ? (allStatuses[0] as any).ordem : 0;

  const { error } = await supabase.from("status_config").insert({
    id,
    nome: targetColumn,
    cor: "221 83% 53%",
    ordem: maxOrdem + 1,
    ativo: true,
    is_final: false,
    status_type: "todo",
  } as any);

  if (error) {
    console.error("Error creating status column:", error);
    return "pending";
  }

  console.log(`[TRIAGEM] Coluna "${targetColumn}" criada automaticamente.`);
  return id;
}

export async function createTicket(data: {
  title: string;
  category: string;
  description: string;
  requester: string;
  email: string;
  department?: string;
  priority?: "low" | "medium" | "high";
  parent_ticket_id?: string;
  sla_deadline_override?: string;
}): Promise<{ success: boolean; ticketNumber?: string; ticketId?: string }> {
  // Use SECURITY DEFINER RPC so anonymous users (public ticket form) can create tickets
  // without needing read access to status_config / sla_categories / tickets.
  const { data: rpcData, error } = await supabase.rpc("create_public_ticket" as any, {
    p_title: data.title || data.category,
    p_category: data.category,
    p_description: data.description,
    p_requester: data.requester,
    p_email: data.email,
    p_department: data.department || null,
    p_priority: data.priority || "medium",
  });

  if (error) {
    console.error("Error creating ticket:", error);
    return { success: false };
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;

  const ticketNumber = (result as any)?.ticket_number;
  const ticketTitle = data.title || data.category;

  // Notify all TI team members about the new ticket (may fail for anon users)
  try {
    const { notifyTITeam } = await import("@/lib/notifications");
    const newTicketId = (result as any)?.id;
    notifyTITeam({
      title: "Novo Chamado Aberto",
      message: `${ticketNumber} — ${ticketTitle} (${data.category}) aberto por ${data.requester}.`,
      type: "info",
      link: newTicketId ? `/ti/service-desk?ticket=${newTicketId}` : "/ti/service-desk",
    });
  } catch {}

  // Post to #suporte-ti chat channel (silent if not authenticated/member)
  try {
    await ChatSuporteTI.ticketCreated({
      ticket_number: ticketNumber,
      title: ticketTitle,
      category: data.category,
      requester: data.requester,
      priority: data.priority || "medium",
    });
  } catch {}

  return {
    success: true,
    ticketNumber,
    ticketId: (result as any)?.id,
  };
}

// Run automations for a newly created ticket
export async function runTicketCreatedAutomations(
  ticketId: string,
  category: string
) {
  // Fetch active automation rules for ticket_created trigger
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("is_active", true)
    .eq("trigger_type", "ticket_created");

  if (!rules || rules.length === 0) return;

  for (const rule of rules) {
    const config = rule.trigger_config as Record<string, any>;
    // Check if category matches
    if (config.category && config.category !== "__all__" && config.category !== category) continue;

    const actionConfig = rule.action_config as Record<string, any>;

    switch (rule.action_type) {
      case "move_to_status":
        if (actionConfig.status_id) {
          await supabase
            .from("tickets")
            .update({ status_id: actionConfig.status_id, updated_at: new Date().toISOString() } as any)
            .eq("id", ticketId as any);
          console.log(`[AUTOMAÇÃO] "${rule.name}": chamado movido para status ${actionConfig.status_id}`);
        }
        break;
      case "assign_to":
        if (actionConfig.assignee) {
          await supabase
            .from("tickets")
            .update({ assignee: actionConfig.assignee, updated_at: new Date().toISOString() } as any)
            .eq("id", ticketId as any);
          console.log(`[AUTOMAÇÃO] "${rule.name}": chamado atribuído a ${actionConfig.assignee}`);
          // Notify the assignee
          sendNotification({
            recipientName: actionConfig.assignee,
            title: "Nova Tarefa Atribuída",
            message: `Você foi atribuído automaticamente a um chamado na categoria "${category}".`,
            type: "task_assigned",
            link: `/ti/service-desk?ticket=${ticketId}`,
          });
        }
        break;
      case "change_priority":
        if (actionConfig.priority) {
          await supabase
            .from("tickets")
            .update({ priority: actionConfig.priority, updated_at: new Date().toISOString() } as any)
            .eq("id", ticketId as any);
          console.log(`[AUTOMAÇÃO] "${rule.name}": prioridade alterada para ${actionConfig.priority}`);
        }
        break;
      case "send_notification":
        console.log(`[AUTOMAÇÃO] "${rule.name}": notificação - ${actionConfig.message}`);
        break;
    }
  }
}
