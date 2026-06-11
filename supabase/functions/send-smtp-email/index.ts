// Email sender via Microsoft Graph API (Client Credentials flow).
// Keeps the existing function name so existing callers (dispatch-satisfaction-survey, etc.) keep working.

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
  from?: string; // ignored when sending via Graph (sender is fixed to MICROSOFT_SENDER_EMAIL)
}

function toRecipients(value?: string | string[]) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((addr) => addr?.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
}

async function getGraphAccessToken(tenantId: string, clientId: string, clientSecret: string) {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Graph token request failed (${res.status}): ${text}`);
  }
  const json = JSON.parse(text);
  if (!json.access_token) {
    throw new Error(`Graph token response missing access_token: ${text}`);
  }
  return json.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MS_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
    const MS_TENANT_ID = Deno.env.get("MICROSOFT_TENANT_ID");
    const MS_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    const MS_SENDER_EMAIL = Deno.env.get("MICROSOFT_SENDER_EMAIL");
    const MS_FROM_NAME =
      Deno.env.get("SMTP_FROM_NAME") ?? "Pesquisa de Satisfação TI - Grupo Orion";

    if (!MS_CLIENT_ID || !MS_TENANT_ID || !MS_CLIENT_SECRET || !MS_SENDER_EMAIL) {
      return new Response(
        JSON.stringify({
          error:
            "Microsoft Graph credentials not configured (MICROSOFT_CLIENT_ID/TENANT_ID/CLIENT_SECRET/SENDER_EMAIL)",
        }),
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

    const toRecip = toRecipients(payload.to);
    const ccRecip = toRecipients(payload.cc);
    const bccRecip = toRecipients(payload.bcc);

    if (toRecip.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid recipients in 'to'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[send-smtp-email] requesting Graph token");
    const accessToken = await getGraphAccessToken(MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET);

    const replyToAddress = payload.replyTo ?? MS_SENDER_EMAIL;

    const message: Record<string, unknown> = {
      subject: payload.subject,
      body: { contentType: "HTML", content: payload.html },
      toRecipients: toRecip,
      from: {
        emailAddress: { address: MS_SENDER_EMAIL, name: MS_FROM_NAME },
      },
      sender: {
        emailAddress: { address: MS_SENDER_EMAIL, name: MS_FROM_NAME },
      },
      replyTo: [{ emailAddress: { address: replyToAddress } }],
    };

    if (ccRecip.length) message.ccRecipients = ccRecip;
    if (bccRecip.length) message.bccRecipients = bccRecip;

    const sendUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_SENDER_EMAIL)}/sendMail`;

    console.log(
      "[send-smtp-email] sending via Graph as",
      MS_SENDER_EMAIL,
      "to:",
      toRecip.map((r) => r.emailAddress.address).join(","),
      "cc:",
      ccRecip.map((r) => r.emailAddress.address).join(","),
    );

    const sendRes = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        saveToSentItems: true,
      }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("[send-smtp-email] Graph sendMail failed:", sendRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Graph sendMail failed (${sendRes.status}): ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[send-smtp-email] sent successfully via Microsoft Graph");

    return new Response(JSON.stringify({ success: true, provider: "microsoft-graph" }), {
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
