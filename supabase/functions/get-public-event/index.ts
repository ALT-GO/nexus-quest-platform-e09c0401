import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("id");

    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing event id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from("marketing_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tasks linked to this event
    const { data: tasks } = await supabase
      .from("marketing_tasks")
      .select("id, title, priority, progress, due_date, assignee_name, stage_id, completed_at, checklist")
      .eq("event_id", eventId)
      .order("order_index", { ascending: true });

    // Fetch stages for labels
    const { data: stages } = await supabase
      .from("marketing_stages")
      .select("id, name, color, meta_status");

    return new Response(
      JSON.stringify({ event, tasks: tasks ?? [], stages: stages ?? [] }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
