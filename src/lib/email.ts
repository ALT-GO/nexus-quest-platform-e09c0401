import { supabase } from "@/integrations/supabase/client";

interface SendEmailArgs {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
}

const BRAND_COLOR = "hsl(262, 83%, 58%)";
const APP_BASE_URL = (typeof window !== "undefined" && window.location?.origin) || "";

function baseTemplate(opts: { title: string; bodyHtml: string; ctaUrl?: string; ctaLabel?: string }) {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background:#f5f5f7; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="background:${BRAND_COLOR}; padding:20px 28px;">
        <h1 style="color:#ffffff; margin:0; font-size:18px; font-weight:600;">Suporte TI — Grupo Orion</h1>
      </div>
      <div style="padding:28px;">
        <h2 style="margin:0 0 16px; color:#111; font-size:20px;">${opts.title}</h2>
        <div style="color:#444; font-size:14px; line-height:1.6;">${opts.bodyHtml}</div>
        ${opts.ctaUrl ? `<div style="margin-top:24px;">
          <a href="${opts.ctaUrl}" style="display:inline-block; background:${BRAND_COLOR}; color:#fff; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:500; font-size:14px;">${opts.ctaLabel ?? "Acessar"}</a>
        </div>` : ""}
      </div>
      <div style="background:#fafafa; padding:14px 28px; color:#888; font-size:11px; text-align:center;">
        Este é um e-mail automático. Para dúvidas, responda esta mensagem.
      </div>
    </div>
  </div>`;
}

export async function sendEmail(args: SendEmailArgs): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("send-smtp-email", { body: args });
    if (error) {
      console.warn("[email] send-smtp-email error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[email] invoke failed:", e);
    return false;
  }
}

async function dispatchTicketTemplateEmail(ticketId: string, templateKey: string, baseUrl?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-ticket-template-email", {
      body: { ticketId, templateKey, baseUrl: baseUrl ?? APP_BASE_URL },
    });
    if (error) {
      console.warn(`[email] send-ticket-template-email (${templateKey}) error:`, error);
      return false;
    }
    const d = data as { success?: boolean; skipped?: boolean } | null;
    return !!d?.success || !!d?.skipped;
  } catch (e) {
    console.warn(`[email] template dispatch failed (${templateKey}):`, e);
    return false;
  }
}

export function dispatchTicketSatisfactionSurvey(ticketId: string, baseUrl?: string) {
  return dispatchTicketTemplateEmail(ticketId, "ticket_completed", baseUrl);
}

export function sendTicketCreatedEmail(opts: {
  ticketId?: string;
  email: string;
  requester: string;
  ticketNumber: string;
  title: string;
  category: string;
}) {
  if (opts.ticketId) {
    return dispatchTicketTemplateEmail(opts.ticketId, "ticket_created");
  }
  // Fallback: render minimal email when ticketId is unavailable.
  const html = baseTemplate({
    title: `Recebemos seu chamado, ${opts.requester.split(" ")[0]}!`,
    bodyHtml: `<p>Seu chamado <strong>${opts.ticketNumber}</strong> (${opts.title}) foi registrado.</p>`,
  });
  return sendEmail({ to: opts.email, subject: `[${opts.ticketNumber}] Recebemos seu chamado`, html });
}

