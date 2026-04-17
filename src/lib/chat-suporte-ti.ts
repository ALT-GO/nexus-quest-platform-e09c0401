import { supabase } from "@/integrations/supabase/client";

const SUPORTE_TI_CHANNEL_NAME = "suporte-ti";

let cachedChannelId: string | null = null;

async function getSuporteTIChannelId(): Promise<string | null> {
  if (cachedChannelId) return cachedChannelId;
  const { data } = await supabase
    .from("chat_channels")
    .select("id")
    .eq("name", SUPORTE_TI_CHANNEL_NAME)
    .eq("archived", false)
    .maybeSingle();
  if (data?.id) {
    cachedChannelId = data.id;
    return data.id;
  }
  return null;
}

/**
 * Posts a system message to the #suporte-ti channel.
 * Uses the current authenticated user as author (RLS requires membership).
 * Silently fails if channel does not exist or user is not a member.
 */
export async function postToSuporteTI(content: string, attachments: any[] = []) {
  try {
    const channelId = await getSuporteTIChannelId();
    if (!channelId) return;

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    await supabase.from("chat_messages").insert({
      channel_id: channelId,
      author_id: user.id,
      author_name: profile?.full_name || user.email || "Sistema",
      avatar_url: profile?.avatar_url || null,
      content,
      attachments,
    });
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
