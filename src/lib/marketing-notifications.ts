import { supabase } from "@/integrations/supabase/client";

/**
 * Send a notification to all admin users for marketing approval.
 */
export async function notifyAdminsForApproval(params: {
  taskTitle: string;
  taskId: string;
  excludeUserId?: string;
}) {
  try {
    // Get admin user IDs via the existing RPC
    const { data: userIds, error: rpcError } = await supabase.rpc("get_ti_admin_user_ids");

    if (rpcError) {
      console.error("Error fetching admin user IDs:", rpcError);
      return;
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      console.warn("No admin users found for approval notification");
      return;
    }

    const filtered = params.excludeUserId
      ? userIds.filter((id: string) => id !== params.excludeUserId)
      : userIds;

    if (filtered.length === 0) return;

    const notifications = filtered.map((uid: string) => ({
      user_id: uid,
      title: `Aprovação Pendente: ${params.taskTitle}`,
      message: `A tarefa "${params.taskTitle}" está aguardando aprovação.`,
      type: "warning",
      link: `/marketing/solicitacoes?task=${params.taskId}`,
      scope: "marketing",
    }));

    const { error: insertError } = await supabase.from("notifications").insert(notifications);
    if (insertError) {
      console.error("Error inserting approval notifications:", insertError);
    }
  } catch (e) {
    console.error("notifyAdminsForApproval failed:", e);
  }
}

/**
 * Notify the task creator about approval result.
 */
export async function notifyTaskCreator(params: {
  creatorId: string;
  taskTitle: string;
  taskId: string;
  approved: boolean;
  reason?: string;
}) {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: params.creatorId,
      title: params.approved
        ? `Tarefa Aprovada: ${params.taskTitle}`
        : `Tarefa Reprovada: ${params.taskTitle}`,
      message: params.approved
        ? `A tarefa "${params.taskTitle}" foi aprovada e movida para a próxima etapa.`
        : `A tarefa "${params.taskTitle}" foi reprovada. Motivo: ${params.reason || "Não informado"}`,
      type: params.approved ? "success" : "warning",
      link: `/marketing/solicitacoes?task=${params.taskId}`,
      scope: "marketing",
    });
    if (error) console.error("Error notifying task creator:", error);
  } catch (e) {
    console.error("notifyTaskCreator failed:", e);
  }
}
