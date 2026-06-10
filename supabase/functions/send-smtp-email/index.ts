// Outlook/Office365 SMTP sender — uses nodemailer (npm) for reliable STARTTLS.
// Public function (no JWT) so it can be invoked from the public ticket form.
import nodemailer from "npm:nodemailer@6.9.14";

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

    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // upgrade later with STARTTLS
      requireTLS: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: {
        ciphers: "TLSv1.2",
        minVersion: "TLSv1.2",
      },
    });

    const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
    const ccList = payload.cc ? (Array.isArray(payload.cc) ? payload.cc : [payload.cc]) : undefined;
    const bccList = payload.bcc ? (Array.isArray(payload.bcc) ? payload.bcc : [payload.bcc]) : undefined;

    const info = await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
      to: toList,
      cc: ccList,
      bcc: bccList,
      replyTo: payload.replyTo ?? SMTP_USER,
      subject: payload.subject,
      text: payload.text ?? "Este e-mail requer um cliente que suporte HTML.",
      html: payload.html,
    });

    console.log("[send-smtp-email] sent:", info.messageId, "to:", toList.join(","), "cc:", (ccList ?? []).join(","));

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
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
