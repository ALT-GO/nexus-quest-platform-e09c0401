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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all events
    const { data: events, error: eventsError } = await supabase
      .from("marketing_events")
      .select("*")
      .order("start_date", { ascending: true });

    if (eventsError) throw eventsError;

    // Fetch tasks with event_id to compute stats
    const { data: tasks } = await supabase
      .from("marketing_tasks")
      .select("id, title, priority, progress, due_date, assignee_name, stage_id, completed_at, event_id, checklist")
      .not("event_id", "is", null)
      .order("order_index", { ascending: true });

    // Fetch stages for labels
    const { data: stages } = await supabase
      .from("marketing_stages")
      .select("id, name, color, meta_status");

    return new Response(
      JSON.stringify({ events: events ?? [], tasks: tasks ?? [], stages: stages ?? [] }),
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
