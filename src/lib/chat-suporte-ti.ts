import { supabase } from "@/integrations/supabase/client";

const SUPORTE_TI_CHANNEL_NAME = "suporte-ti";

/**
 * Posts a system message as "Sr. Bot" via secure edge function.
 * Bypasses RLS membership requirements — works for anon (public ticket form)
 * and any authenticated user, regardless of channel membership.
 */
export async function postToSuporteTI(content: string, attachments: any[] = []) {
  try {
    const { error } = await supabase.functions.invoke("bot-post-message", {
      body: {
        channel_name: SUPORTE_TI_CHANNEL_NAME,
        content,
        attachments,
      },
    });
    if (error) console.warn("[chat-suporte-ti] bot-post-message error:", error);
  } catch (e) {
    console.warn("[chat-suporte-ti] Failed to post:", e);
  }
}

export const ChatSuporteTI = {
  ticketCreated: (ticket: { ticket_number: string; title: string; category: string; requester: string; priority: string }) =>
    postToSuporteTI(
      `🆕 **Novo chamado** \`${ticket.ticket_number}\` — ${ticket.title}\n` +
        `📂 Categoria: ${ticket.category} • 🎯 Prioridade: ${ticket.priority} • 👤 Solicitante: ${ticket.requester}`
    ),

  slaExpired: (ticket: { ticket_number: string; title: string; sla_hours: number; assignee?: string | null }) =>
    postToSuporteTI(
      `🚨 **SLA VENCIDO** \`${ticket.ticket_number}\` — ${ticket.title}\n` +
        `⏰ Prazo de ${ticket.sla_hours}h ultrapassado.${ticket.assignee ? ` Responsável: ${ticket.assignee}` : " Sem responsável atribuído."}`
    ),

  slaNear: (ticket: { ticket_number: string; title: string; minutesLeft: number }) =>
    postToSuporteTI(
      `⚠️ **SLA próximo do vencimento** \`${ticket.ticket_number}\` — ${ticket.title}\n` +
        `⏳ Faltam ~${ticket.minutesLeft} minutos.`
    ),

  ticketCompleted: (ticket: { ticket_number: string; title: string; assignee?: string | null }) =>
    postToSuporteTI(
      `✅ **Chamado concluído** \`${ticket.ticket_number}\` — ${ticket.title}` +
        (ticket.assignee ? `\n👤 Por: ${ticket.assignee}` : "")
    ),
};
