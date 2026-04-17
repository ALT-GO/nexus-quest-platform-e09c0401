import { supabase } from "@/integrations/supabase/client";

/**
 * Posts a system message as "Sr. Bot" via secure edge function.
 * The edge function looks up `bot_settings` by `event_key` to decide
 * whether to post and to which channel — fully admin-configurable.
 */
async function postBotEvent(event_key: string, content: string, attachments: any[] = []) {
  try {
    const { error } = await supabase.functions.invoke("bot-post-message", {
      body: { event_key, content, attachments },
    });
    if (error) console.warn("[chat-suporte-ti] bot-post-message error:", error);
  } catch (e) {
    console.warn("[chat-suporte-ti] Failed to post:", e);
  }
}

export const BOT_EVENT_KEYS = {
  ticketCreated: "ticket_created",
  slaNear: "sla_near",
  slaExpired: "sla_expired",
  ticketCompleted: "ticket_completed",
} as const;

export const ChatSuporteTI = {
  ticketCreated: (ticket: { ticket_number: string; title: string; category: string; requester: string; priority: string }) =>
    postBotEvent(
      BOT_EVENT_KEYS.ticketCreated,
      `🆕 **Novo chamado** \`${ticket.ticket_number}\` — ${ticket.title}\n` +
        `📂 Categoria: ${ticket.category} • 🎯 Prioridade: ${ticket.priority} • 👤 Solicitante: ${ticket.requester}`
    ),

  slaExpired: (ticket: { ticket_number: string; title: string; sla_hours: number; assignee?: string | null }) =>
    postBotEvent(
      BOT_EVENT_KEYS.slaExpired,
      `🚨 **SLA VENCIDO** \`${ticket.ticket_number}\` — ${ticket.title}\n` +
        `⏰ Prazo de ${ticket.sla_hours}h ultrapassado.${ticket.assignee ? ` Responsável: ${ticket.assignee}` : " Sem responsável atribuído."}`
    ),

  slaNear: (ticket: { ticket_number: string; title: string; minutesLeft: number }) =>
    postBotEvent(
      BOT_EVENT_KEYS.slaNear,
      `⚠️ **SLA próximo do vencimento** \`${ticket.ticket_number}\` — ${ticket.title}\n` +
        `⏳ Faltam ~${ticket.minutesLeft} minutos.`
    ),

  ticketCompleted: (ticket: { ticket_number: string; title: string; assignee?: string | null }) =>
    postBotEvent(
      BOT_EVENT_KEYS.ticketCompleted,
      `✅ **Chamado concluído** \`${ticket.ticket_number}\` — ${ticket.title}` +
        (ticket.assignee ? `\n👤 Por: ${ticket.assignee}` : "")
    ),
};
