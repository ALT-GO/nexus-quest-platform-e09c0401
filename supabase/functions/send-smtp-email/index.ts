// Outlook SMTP sender — uses adm.tisp@grupoorion.com.br
// Public function (no JWT) so it can be invoked from the public ticket form.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendEmailPayload {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    const SMTP_FROM_NAME = Deno.env.get("SMTP_FROM_NAME") ?? "Suporte TI";

    if (!SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({ error: "SMTP credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = (await req.json()) as SendEmailPayload;
    if (!payload.to || !payload.subject || !payload.html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.office365.com",
        port: 587,
        tls: false, // STARTTLS upgrade
        auth: { username: SMTP_USER, password: SMTP_PASS },
      },
    });

    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];

    const cc = payload.cc ? (Array.isArray(payload.cc) ? payload.cc : [payload.cc]) : undefined;
    const bcc = payload.bcc ? (Array.isArray(payload.bcc) ? payload.bcc : [payload.bcc]) : undefined;

    await client.send({
      from: `${SMTP_FROM_NAME} <${SMTP_USER}>`,
      to: recipients,
      cc,
      bcc,
      replyTo: payload.replyTo ?? SMTP_USER,
      subject: payload.subject,
      content: payload.text ?? "Este e-mail requer um cliente que suporte HTML.",
      html: payload.html,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-smtp-email] error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
