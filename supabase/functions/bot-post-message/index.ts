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
    const { channel_name, content, attachments } = body as {
      channel_name: string;
      content: string;
      attachments?: any[];
    };

    if (!channel_name || !content) {
      return new Response(
        JSON.stringify({ error: "channel_name and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve channel id from name
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

    const { error: insErr } = await supabase.from("chat_messages").insert({
      channel_id: channel.id,
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
