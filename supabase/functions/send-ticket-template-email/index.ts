import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function firstName(name: string | null) {
  return (name ?? '').trim().split(' ')[0] || 'colaborador';
}

function interpolate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}

function buildSurveyUrl(baseUrl: string | undefined, t: { ticket_number: string; email: string; requester: string }) {
  if (!baseUrl) return '';
  const n = baseUrl.replace(/\/$/, '');
  return `${n}/pesquisa-satisfacao?ticket=${encodeURIComponent(t.ticket_number)}&email=${encodeURIComponent(t.email)}&name=${encodeURIComponent(t.requester)}`;
}

function buildHtml(tpl: any, vars: Record<string, string>) {
  const heading = interpolate(tpl.heading_title || '', vars);
  const greeting = interpolate(tpl.greeting || '', vars);
  const body = interpolate(tpl.body_html || '', vars);
  const ctaLabel = interpolate(tpl.cta_label || '', vars);
  const surveyUrl = vars.survey_url || '';
  const primary = tpl.primary_color || 'hsl(262, 83%, 58%)';
  const font = tpl.font_family || 'Arial, sans-serif';
  const ctaBlock = ctaLabel && surveyUrl
    ? `<div style="margin-top:24px;"><a href="${surveyUrl}" style="display:inline-block; background:${primary}; color:#fff; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:500; font-size:14px;">${ctaLabel}</a></div>`
    : '';
  const fallback = ctaLabel && surveyUrl
    ? `<p style="margin-top:18px; font-size:12px; color:#888;">Se o botão não funcionar, acesse pelo link:<br/><a href="${surveyUrl}" style="color:${primary}; word-break:break-all;">${surveyUrl}</a></p>`
    : '';

  return `
  <div style="font-family:${font}; background:#f5f5f7; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="background:${primary}; padding:20px 28px;">
        <h1 style="color:#ffffff; margin:0; font-size:18px; font-weight:600;">${tpl.header_title || ''}</h1>
      </div>
      <div style="padding:28px; color:#444; font-size:14px; line-height:1.6;">
        ${heading ? `<h2 style="margin:0 0 16px; color:#111; font-size:20px;">${heading}</h2>` : ''}
        ${greeting ? `<p>${greeting}</p>` : ''}
        ${body}
        ${ctaBlock}
        ${fallback}
      </div>
      <div style="background:#fafafa; padding:14px 28px; color:#888; font-size:11px; text-align:center;">
        ${tpl.footer_text || ''}
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { ticketId, templateKey, baseUrl } = await req.json();
    if (!ticketId || !templateKey) {
      return new Response(JSON.stringify({ error: 'ticketId e templateKey são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: tpl, error: tplErr } = await supabase
      .from('email_templates').select('*').eq('template_key', templateKey).maybeSingle();
    if (tplErr || !tpl) {
      return new Response(JSON.stringify({ error: 'Template não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!tpl.enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: 'template_disabled' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: ticket, error: tErr } = await supabase
      .from('tickets').select('id, ticket_number, title, category, requester, email, completed_at, created_at, description')
      .eq('id', ticketId).maybeSingle();
    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: 'Chamado não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!ticket.email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'ticket_without_email' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (templateKey === 'ticket_completed' && !ticket.completed_at) {
      return new Response(JSON.stringify({ skipped: true, reason: 'ticket_not_completed' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const surveyUrl = buildSurveyUrl(baseUrl, {
      ticket_number: ticket.ticket_number, email: ticket.email, requester: ticket.requester,
    });
    const createdAtFmt = ticket.created_at
      ? new Date(ticket.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
      : '';
    const vars: Record<string, string> = {
      ticket_number: ticket.ticket_number,
      title: ticket.title || '',
      category: ticket.category || '',
      requester: ticket.requester || '',
      first_name: firstName(ticket.requester),
      email: ticket.email,
      survey_url: surveyUrl,
      created_at: createdAtFmt,
      description: ticket.description || '',
    };

    // Dedup notifications for satisfaction
    const ticketLink = `/ti/service-desk?ticket=${ticketId}`;
    if (templateKey === 'ticket_completed') {
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('notifications').select('id')
        .eq('link', ticketLink)
        .in('title', ['Pesquisa de satisfação acionada', 'Pesquisa de satisfação enviada'])
        .gte('created_at', since).limit(1).maybeSingle();
      if (recent) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'already_processed_recently' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const html = buildHtml(tpl, vars);
    const subject = interpolate(tpl.subject || '', vars);

    const payload: Record<string, unknown> = {
      to: ticket.email,
      subject,
      html,
    };
    if (tpl.cc) payload.cc = tpl.cc;
    if (tpl.from_address) payload.from = tpl.from_address;
    if (tpl.reply_to) payload.replyTo = tpl.reply_to;

    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify(payload),
    });
    const sendText = await sendRes.text();
    const ok = sendRes.ok;

    if (templateKey === 'ticket_completed') {
      const { data: userIds } = await supabase.rpc('get_ti_admin_user_ids');
      const recipients = Array.isArray(userIds) ? userIds : [];
      if (recipients.length > 0) {
        await supabase.from('notifications').insert(
          recipients.map((userId: string) => ({
            user_id: userId,
            title: ok ? 'Pesquisa de satisfação enviada' : 'Falha ao enviar pesquisa de satisfação',
            message: `${ok ? 'E-mail enviado para' : 'Não foi possível enviar e-mail para'} ${ticket.requester} <${ticket.email}> — chamado ${ticket.ticket_number}.`,
            type: ok ? 'success' : 'warning',
            link: ticketLink,
            scope: 'ti',
          })),
        );
      }
    }

    return new Response(JSON.stringify({ success: ok, details: sendText }), {
      status: ok ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[send-ticket-template-email]', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
