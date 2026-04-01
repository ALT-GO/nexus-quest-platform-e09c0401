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
    const { data: userIds } = await supabase.rpc("get_ti_admin_user_ids" as any);

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return;

    const filtered = params.excludeUserId
      ? userIds.filter((id: string) => id !== params.excludeUserId)
      : userIds;

    if (filtered.length === 0) return;

    const notifications = filtered.map((uid: string) => ({
      user_id: uid,
      title: `Aprovação Pendente: ${params.taskTitle}`,
      message: `A tarefa "${params.taskTitle}" está aguardando aprovação.`,
      type: "warning",
      link: `/marketing/solicitacoes`,
    }));

    await supabase.from("notifications" as any).insert(notifications);
  } catch {
    // Silent fail
  }
}

/**
 * Notify the task creator about approval result.
 */
export async function notifyTaskCreator(params: {
  creatorId: string;
  taskTitle: string;
  approved: boolean;
  reason?: string;
}) {
  try {
    await supabase.from("notifications" as any).insert({
      user_id: params.creatorId,
      title: params.approved
        ? `Tarefa Aprovada: ${params.taskTitle}`
        : `Tarefa Reprovada: ${params.taskTitle}`,
      message: params.approved
        ? `A tarefa "${params.taskTitle}" foi aprovada e movida para a próxima etapa.`
        : `A tarefa "${params.taskTitle}" foi reprovada. Motivo: ${params.reason || "Não informado"}`,
      type: params.approved ? "success" : "warning",
      link: `/marketing/solicitacoes`,
    });
  } catch {
    // Silent fail
  }
}
