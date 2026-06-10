// Generic SMTP sender via nodemailer. Configurable host/port for any provider (Locaweb, Office365, etc.).
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
  from?: string;
}

interface SmtpAttemptConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  label: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp.locaweb.com.br";
    const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "587");
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    const SMTP_FROM_NAME = Deno.env.get("SMTP_FROM_NAME") ?? "Pesquisa de Satisfação TI - Grupo Orion";

    if (!SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({ error: "SMTP credentials not configured (SMTP_USER/SMTP_PASS)" }),
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

    const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
    const ccList = payload.cc ? (Array.isArray(payload.cc) ? payload.cc : [payload.cc]) : undefined;
    const bccList = payload.bcc ? (Array.isArray(payload.bcc) ? payload.bcc : [payload.bcc]) : undefined;

    const fromAddress = payload.from ?? `"${SMTP_FROM_NAME}" <${SMTP_USER}>`;

    const fallbackAttempts: SmtpAttemptConfig[] = [
      {
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        requireTLS: SMTP_PORT !== 465,
        label: `primary:${SMTP_HOST}:${SMTP_PORT}`,
      },
    ];

    const addAttempt = (attempt: SmtpAttemptConfig) => {
      const exists = fallbackAttempts.some((item) => item.host === attempt.host && item.port === attempt.port && item.secure === attempt.secure);
      if (!exists) fallbackAttempts.push(attempt);
    };

    addAttempt({
      host: "smtp.locaweb.com.br",
      port: 587,
      secure: false,
      requireTLS: true,
      label: "fallback:smtp.locaweb.com.br:587:starttls",
    });

    addAttempt({
      host: "smtps.locaweb.com.br",
      port: 465,
      secure: true,
      requireTLS: false,
      label: "fallback:smtps.locaweb.com.br:465:ssl",
    });

    let info: Awaited<ReturnType<ReturnType<typeof nodemailer.createTransport>["sendMail"]>> | null = null;
    let lastError: Error | null = null;

    for (const attempt of fallbackAttempts) {
      try {
        console.log(`[send-smtp-email] trying ${attempt.label}`);

        const transporter = nodemailer.createTransport({
          host: attempt.host,
          port: attempt.port,
          secure: attempt.secure,
          requireTLS: attempt.requireTLS,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 10_000,
          tls: { minVersion: "TLSv1.2" },
        });

        info = await transporter.sendMail({
          from: fromAddress,
          to: toList,
          cc: ccList,
          bcc: bccList,
          replyTo: payload.replyTo ?? SMTP_USER,
          subject: payload.subject,
          text: payload.text ?? "Este e-mail requer um cliente que suporte HTML.",
          html: payload.html,
        });

        console.log(`[send-smtp-email] success via ${attempt.label}`);
        break;
      } catch (error) {
        lastError = error as Error;
        console.error(`[send-smtp-email] failed via ${attempt.label}:`, error);
      }
    }

    if (!info) {
      throw lastError ?? new Error("Unable to deliver email with configured SMTP attempts");
    }

    console.log(
      "[send-smtp-email] sent:",
      info.messageId,
      "to:", toList.join(","),
      "cc:", (ccList ?? []).join(","),
    );

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
