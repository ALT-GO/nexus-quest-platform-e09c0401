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

export async function dispatchTicketSatisfactionSurvey(ticketId: string, baseUrl?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("dispatch-satisfaction-survey", {
      body: { ticketId, baseUrl },
    });

    if (error) {
      console.warn("[email] dispatch-satisfaction-survey error:", error);
      return false;
    }

    return !!(data as { success?: boolean; skipped?: boolean } | null)?.success || !!(data as { skipped?: boolean } | null)?.skipped;
  } catch (e) {
    console.warn("[email] satisfaction dispatch failed:", e);
    return false;
  }
}

export function sendTicketCreatedEmail(opts: {
  email: string;
  requester: string;
  ticketNumber: string;
  title: string;
  category: string;
}) {
  const html = baseTemplate({
    title: `Recebemos seu chamado, ${opts.requester.split(" ")[0]}!`,
    bodyHtml: `
      <p>Seu chamado foi registrado com sucesso e nossa equipe já foi notificada.</p>
      <div style="background:#f5f5f7; border-radius:8px; padding:16px; margin:16px 0;">
        <p style="margin:0 0 6px;"><strong>Número:</strong> ${opts.ticketNumber}</p>
        <p style="margin:0 0 6px;"><strong>Assunto:</strong> ${opts.title}</p>
        <p style="margin:0;"><strong>Categoria:</strong> ${opts.category}</p>
      </div>
      <p>Você receberá uma nova notificação quando o atendimento for concluído.</p>
    `,
  });

  return sendEmail({
    to: opts.email,
    subject: `[${opts.ticketNumber}] Recebemos seu chamado`,
    html,
  });
}

export function sendTicketCompletedEmail(opts: {
  email: string;
  requester: string;
  ticketNumber: string;
  title: string;
  category?: string;
  surveyUrl?: string;
}) {
  const surveyUrl =
    opts.surveyUrl ??
    `${APP_BASE_URL}/pesquisa-satisfacao?ticket=${encodeURIComponent(opts.ticketNumber)}&email=${encodeURIComponent(opts.email)}&name=${encodeURIComponent(opts.requester)}`;

  const firstName = (opts.requester || "").split(" ")[0] || opts.requester;
  const html = baseTemplate({
    title: `Pesquisa de Satisfação — Chamado #${opts.ticketNumber}`,
    bodyHtml: `
      <p>Olá, <strong>${firstName}</strong>, tudo bem?</p>
      <p>O seu chamado técnico <strong>#${opts.ticketNumber}</strong> (${opts.title}) foi encerrado pela nossa equipe de TI.</p>
      <p>Para garantirmos a qualidade do nosso atendimento e buscarmos melhorias contínuas na nossa infraestrutura, gostaríamos de saber como foi a sua experiência. Leva menos de 1 minutinho!</p>
      <p>Por favor, clique no botão abaixo para responder à nossa rápida pesquisa de satisfação:</p>
      <p style="margin-top:18px; font-size:12px; color:#888;">Se o botão não funcionar, acesse pelo link:<br/><a href="${surveyUrl}" style="color:hsl(262,83%,58%); word-break:break-all;">${surveyUrl}</a></p>
      <p style="margin-top:22px;">Agradecemos desde já pela sua participação!</p>
      <p style="margin:18px 0 0; color:#555;">Atenciosamente,<br/><strong>Equipe de TI | Grupo Orion</strong></p>
    `,
    ctaUrl: surveyUrl,
    ctaLabel: "Responder Pesquisa de Satisfação",
  });

  return sendEmail({
    to: opts.email,
    cc: "adm.tisp@grupoorion.com.br",
    from: '"Pesquisa de Satisfação TI - Grupo Orion" <satisfacaosp@grupoorion.eng.br>',
    replyTo: "satisfacaosp@grupoorion.eng.br",
    subject: "PESQUISA DE SATISFAÇÃO - T.I",
    html,
  });
}

