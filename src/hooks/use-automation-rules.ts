import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Scope ──
export type AutomationScope = "ti" | "marketing";

// ── TI Triggers & Actions ──
export type TiTriggerType =
  | "ticket_created"
  | "status_changed"
  | "priority_changed"
  | "sla_near"
  | "sla_expired"
  | "ticket_assigned"
  | "ticket_completed";

export type TiActionType =
  | "move_to_status"
  | "assign_to"
  | "change_priority"
  | "send_notification"
  | "set_sla_hours";

// ── Marketing Triggers & Actions ──
export type MktTriggerType =
  | "task_created"
  | "task_stage_changed"
  | "task_completed"
  | "task_overdue"
  | "event_upcoming"
  | "sprint_started";

export type MktActionType =
  | "move_to_stage"
  | "assign_task"
  | "change_task_priority"
  | "send_notification"
  | "set_task_progress";

export type TriggerType = TiTriggerType | MktTriggerType;
export type ActionType = TiActionType | MktActionType;

export interface AutomationRule {
  id: string;
  name: string;
  scope: AutomationScope;
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Labels ──
export const tiTriggerLabels: Record<TiTriggerType, string> = {
  ticket_created: "Novo chamado criado",
  status_changed: "Status do chamado alterado",
  priority_changed: "Prioridade do chamado alterada",
  sla_near: "SLA próximo do vencimento",
  sla_expired: "SLA vencido",
  ticket_assigned: "Chamado atribuído a técnico",
  ticket_completed: "Chamado concluído",
};

export const tiActionLabels: Record<TiActionType, string> = {
  move_to_status: "Mover para status",
  assign_to: "Atribuir ao técnico",
  change_priority: "Alterar prioridade",
  send_notification: "Enviar notificação",
  set_sla_hours: "Definir SLA personalizado (horas)",
};

export const mktTriggerLabels: Record<MktTriggerType, string> = {
  task_created: "Nova tarefa criada",
  task_stage_changed: "Etapa da tarefa alterada",
  task_completed: "Tarefa concluída",
  task_overdue: "Tarefa atrasada (passou da data)",
  event_upcoming: "Evento se aproximando",
  sprint_started: "Sprint iniciado",
};

export const mktActionLabels: Record<MktActionType, string> = {
  move_to_stage: "Mover para etapa",
  assign_task: "Atribuir tarefa a membro",
  change_task_priority: "Alterar prioridade da tarefa",
  send_notification: "Enviar notificação",
  set_task_progress: "Alterar progresso da tarefa",
};

export const tiTriggerIcons: Record<TiTriggerType, string> = {
  ticket_created: "📩",
  status_changed: "🔄",
  priority_changed: "⚡",
  sla_near: "⏰",
  sla_expired: "🚨",
  ticket_assigned: "👤",
  ticket_completed: "✅",
};

export const tiActionIcons: Record<TiActionType, string> = {
  move_to_status: "📋",
  assign_to: "👤",
  change_priority: "🔺",
  send_notification: "🔔",
  set_sla_hours: "⏱️",
};

export const mktTriggerIcons: Record<MktTriggerType, string> = {
  task_created: "📝",
  task_stage_changed: "🔄",
  task_completed: "✅",
  task_overdue: "⏰",
  event_upcoming: "📅",
  sprint_started: "🏃",
};

export const mktActionIcons: Record<MktActionType, string> = {
  move_to_stage: "📋",
  assign_task: "👤",
  change_task_priority: "🔺",
  send_notification: "🔔",
  set_task_progress: "📊",
};

// ── Backward compat aliases ──
export const triggerLabels = tiTriggerLabels as Record<string, string>;
export const actionLabels = tiActionLabels as Record<string, string>;

// ── Hook ──
export function useAutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching automation rules:", error);
      return;
    }
    setRules((data as unknown as AutomationRule[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  useEffect(() => {
    const channel = supabase
      .channel("automation-rules-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_rules" }, () => {
        fetchRules();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRules]);

  const addRule = useCallback(async (rule: Omit<AutomationRule, "id" | "created_at" | "updated_at">) => {
    const { error } = await supabase.from("automation_rules").insert({
      name: rule.name,
      scope: rule.scope,
      trigger_type: rule.trigger_type,
      trigger_config: rule.trigger_config,
      action_type: rule.action_type,
      action_config: rule.action_config,
      is_active: rule.is_active,
    } as any);

    if (error) {
      toast.error("Erro ao criar regra");
      return false;
    }
    toast.success(`Regra "${rule.name}" criada`);
    return true;
  }, []);

  const updateRule = useCallback(async (id: string, updates: Partial<AutomationRule>) => {
    const { error } = await supabase
      .from("automation_rules")
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", id as any);

    if (error) {
      toast.error("Erro ao atualizar regra");
      return false;
    }
    return true;
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("automation_rules")
      .delete()
      .eq("id", id as any);

    if (error) {
      toast.error("Erro ao excluir regra");
      return false;
    }
    toast.success("Regra excluída");
    return true;
  }, []);

  const toggleRule = useCallback(async (id: string, is_active: boolean) => {
    await updateRule(id, { is_active } as any);
  }, [updateRule]);

  const executeRules = useCallback(
    async (
      triggerType: string,
      context: { ticketId: string; category?: string; oldValue?: string; newValue?: string },
      callbacks: {
        onMoveToStatus?: (ticketId: string, statusId: string) => Promise<void>;
        onAssignTo?: (ticketId: string, assignee: string) => Promise<void>;
        onChangePriority?: (ticketId: string, priority: string) => Promise<void>;
      }
    ) => {
      const activeRules = rules.filter(r => r.is_active && r.trigger_type === triggerType);

      for (const rule of activeRules) {
        let shouldExecute = false;

        switch (triggerType) {
          case "ticket_created":
            shouldExecute = rule.trigger_config.category
              ? context.category === rule.trigger_config.category
              : true;
            break;
          case "status_changed":
            shouldExecute = rule.trigger_config.from_status
              ? context.oldValue === rule.trigger_config.from_status
              : true;
            break;
          case "priority_changed":
            shouldExecute = rule.trigger_config.from_priority
              ? context.oldValue === rule.trigger_config.from_priority
              : true;
            break;
          default:
            shouldExecute = true;
            break;
        }

        if (!shouldExecute) continue;

        switch (rule.action_type) {
          case "move_to_status":
            if (rule.action_config.status_id && callbacks.onMoveToStatus) {
              await callbacks.onMoveToStatus(context.ticketId, rule.action_config.status_id);
            }
            break;
          case "assign_to":
            if (rule.action_config.assignee && callbacks.onAssignTo) {
              await callbacks.onAssignTo(context.ticketId, rule.action_config.assignee);
            }
            break;
          case "change_priority":
            if (rule.action_config.priority && callbacks.onChangePriority) {
              await callbacks.onChangePriority(context.ticketId, rule.action_config.priority);
            }
            break;
          case "send_notification":
            toast.info(`🔔 ${rule.action_config.message || "Notificação de automação"}`);
            break;
        }
      }
    },
    [rules]
  );

  return {
    rules,
    loading,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    executeRules,
    refetch: fetchRules,
  };
}
