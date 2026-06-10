import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const BodySchema = z.object({
  ticketId: z.string().uuid(),
  baseUrl: z.string().url().optional(),
});

function firstName(name: string | null) {
  return (name ?? '').trim().split(' ')[0] || 'colaborador';
}

function buildSurveyUrl(baseUrl: string | undefined, ticket: { ticket_number: string; email: string; requester: string }) {
  if (!baseUrl) return undefined;
  const normalized = baseUrl.replace(/\/$/, '');
  return `${normalized}/pesquisa-satisfacao?ticket=${encodeURIComponent(ticket.ticket_number)}&email=${encodeURIComponent(ticket.email)}&name=${encodeURIComponent(ticket.requester)}`;
}

function buildSurveyHtml(ticket: { ticket_number: string; title: string; requester: string; email: string }, surveyUrl?: string) {
  const name = firstName(ticket.requester);
  const ctaBlock = surveyUrl
    ? `<div style="margin-top:24px;"><a href="${surveyUrl}" style="display:inline-block; background:hsl(262, 83%, 58%); color:#fff; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:500; font-size:14px;">Responder Pesquisa de Satisfação</a></div>`
    : '';
  const fallbackBlock = surveyUrl
    ? `<p style="margin-top:18px; font-size:12px; color:#888;">Se o botão não funcionar, acesse pelo link:<br/><a href="${surveyUrl}" style="color:hsl(262,83%,58%); word-break:break-all;">${surveyUrl}</a></p>`
    : '';

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background:#f5f5f7; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="background:hsl(262, 83%, 58%); padding:20px 28px;">
        <h1 style="color:#ffffff; margin:0; font-size:18px; font-weight:600;">Suporte TI — Grupo Orion</h1>
      </div>
      <div style="padding:28px; color:#444; font-size:14px; line-height:1.6;">
        <h2 style="margin:0 0 16px; color:#111; font-size:20px;">Pesquisa de Satisfação — Chamado #${ticket.ticket_number}</h2>
        <p>Olá, <strong>${name}</strong>, tudo bem?</p>
        <p>O seu chamado técnico <strong>#${ticket.ticket_number}</strong> (${ticket.title}) foi encerrado pela nossa equipe de TI.</p>
        <p>Para garantirmos a qualidade do nosso atendimento e buscarmos melhorias contínuas, gostaríamos de saber como foi a sua experiência. Leva menos de 1 minutinho.</p>
        <p>Por favor, clique no botão abaixo para responder à nossa rápida pesquisa de satisfação:</p>
        ${ctaBlock}
        ${fallbackBlock}
        <p style="margin-top:22px;">Agradecemos desde já pela sua participação!</p>
        <p style="margin:18px 0 0; color:#555;">Atenciosamente,<br/><strong>Equipe de TI | Grupo Orion</strong></p>
      </div>
      <div style="background:#fafafa; padding:14px 28px; color:#888; font-size:11px; text-align:center;">
        Este é um e-mail automático. Para dúvidas, responda esta mensagem.
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Backend credentials are not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { ticketId, baseUrl } = parsed.data;
    const ticketLink = `/ti/service-desk?ticket=${ticketId}`;

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, ticket_number, title, requester, email, completed_at')
      .eq('id', ticketId)
      .maybeSingle();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: 'Chamado não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!ticket.completed_at) {
      return new Response(JSON.stringify({ skipped: true, reason: 'ticket_not_completed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!ticket.email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'ticket_without_email' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dedupeSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: recentNotification } = await supabase
      .from('notifications')
      .select('id, title, created_at')
      .eq('link', ticketLink)
      .in('title', ['Pesquisa de satisfação acionada', 'Pesquisa de satisfação enviada'])
      .gte('created_at', dedupeSince)
      .limit(1)
      .maybeSingle();

    if (recentNotification) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'already_processed_recently' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userIds } = await supabase.rpc('get_ti_admin_user_ids');
    const notificationRecipients = Array.isArray(userIds) ? userIds : [];

    if (notificationRecipients.length > 0) {
      await supabase.from('notifications').insert(
        notificationRecipients.map((userId: string) => ({
          user_id: userId,
          title: 'Pesquisa de satisfação acionada',
          message: `Tentando enviar e-mail para ${ticket.requester} <${ticket.email}> (cc adm.tisp@grupoorion.com.br) — chamado ${ticket.ticket_number}.`,
          type: 'info',
          link: ticketLink,
          scope: 'ti',
        })),
      );
    }

    const surveyUrl = buildSurveyUrl(baseUrl, {
      ticket_number: ticket.ticket_number,
      email: ticket.email,
      requester: ticket.requester,
    });

    const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        to: ticket.email,
        cc: 'adm.tisp@grupoorion.com.br',
        from: '"Pesquisa de Satisfação TI - Grupo Orion" <satisfacaosp@grupoorion.eng.br>',
        replyTo: 'satisfacaosp@grupoorion.eng.br',
        subject: 'PESQUISA DE SATISFAÇÃO - T.I',
        html: buildSurveyHtml({
          ticket_number: ticket.ticket_number,
          title: ticket.title,
          requester: ticket.requester,
          email: ticket.email,
        }, surveyUrl),
      }),
    });

    const sendText = await sendResponse.text();
    const ok = sendResponse.ok;

    if (notificationRecipients.length > 0) {
      await supabase.from('notifications').insert(
        notificationRecipients.map((userId: string) => ({
          user_id: userId,
          title: ok ? 'Pesquisa de satisfação enviada' : 'Falha ao enviar pesquisa de satisfação',
          message: `${ok ? 'E-mail enviado para' : 'Não foi possível enviar e-mail para'} ${ticket.requester} <${ticket.email}> (cc adm.tisp@grupoorion.com.br) — chamado ${ticket.ticket_number}.`,
          type: ok ? 'success' : 'warning',
          link: ticketLink,
          scope: 'ti',
        })),
      );
    }

    return new Response(JSON.stringify({ success: ok, details: sendText }), {
      status: ok ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[dispatch-satisfaction-survey] error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});