import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fixed bot identity (must be a valid UUID; not tied to any auth user)
const BOT_USER_ID = "00000000-0000-0000-0000-000000000b07";
const BOT_NAME = "Sr. Bot";
const BOT_AVATAR_URL =
  "https://fxpvvcdtpvalamutozzn.supabase.co/storage/v1/object/public/chat-assets/sr-bot-avatar.png";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { channel_name, channel_id, content, attachments, event_key } = body as {
      channel_name?: string;
      channel_id?: string;
      content: string;
      attachments?: any[];
      event_key?: string;
    };

    if (!content) {
      return new Response(
        JSON.stringify({ error: "content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let resolvedChannelId: string | null = channel_id ?? null;

    // If event_key provided, look up bot_settings (admin-configurable)
    if (event_key) {
      const { data: setting, error: settingErr } = await supabase
        .from("bot_settings")
        .select("enabled, channel_id")
        .eq("event_key", event_key)
        .maybeSingle();

      if (settingErr) throw settingErr;
      if (!setting || !setting.enabled) {
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "event disabled or not configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedChannelId = setting.channel_id;
    }

    // Fallback: resolve channel by name when neither id nor event_key was provided
    if (!resolvedChannelId && channel_name) {
      const { data: channel, error: chErr } = await supabase
        .from("chat_channels")
        .select("id")
        .eq("name", channel_name)
        .eq("archived", false)
        .maybeSingle();
      if (chErr) throw chErr;
      if (!channel) {
        return new Response(
          JSON.stringify({ error: `Channel '${channel_name}' not found` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedChannelId = channel.id;
    }

    if (!resolvedChannelId) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "no channel configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insErr } = await supabase.from("chat_messages").insert({
      channel_id: resolvedChannelId,
      author_id: BOT_USER_ID,
      author_name: BOT_NAME,
      avatar_url: BOT_AVATAR_URL,
      content,
      attachments: attachments || [],
    });

    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[bot-post-message] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
