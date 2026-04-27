import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const TATIANA_ID = "2d600ede-ace5-4ebf-ac3f-bd80c325d8d2";
    const TATIANA_NAME = "Tatiana Kussano";
    const FIRST_STAGE_ID = "e983de36-66a0-4151-8247-a0c062b56722";

    // Get all events that have ended (end_date <= now)
    const { data: events, error: eventsError } = await supabase
      .from("marketing_events")
      .select("id, name, end_date")
      .lte("end_date", new Date().toISOString());

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ message: "No ended events found", created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing tasks that already match this pattern (to avoid duplicates)
    const eventIds = events.map((e: any) => e.id);
    const { data: existingLinks } = await supabase
      .from("marketing_task_links")
      .select("linked_event_id, task_id")
      .in("linked_event_id", eventIds)
      .eq("link_type", "event_cost_update");

    const alreadyLinkedEventIds = new Set(
      (existingLinks ?? []).map((l: any) => l.linked_event_id)
    );

    let created = 0;
    for (const event of events) {
      if (alreadyLinkedEventIds.has(event.id)) continue;

      const dueDate = addBusinessDays(new Date(event.end_date), 3);

      // Create the task
      const { data: task, error: taskError } = await supabase
        .from("marketing_tasks")
        .insert({
          title: `${event.name} — Preencher leads gerados e valor total gasto`,
          description: `Pós-evento: atualize no card do evento "${event.name}" os campos de leads gerados e valor total gasto (custo real).`,
          assignee_id: TATIANA_ID,
          assignee_name: TATIANA_NAME,
          requester_name: "Sistema",
          stage_id: FIRST_STAGE_ID,
          priority: "medium",
          due_date: dueDate.toISOString(),
          progress: "Não iniciado",
          event_id: event.id,
        })
        .select("id")
        .single();

      if (taskError) {
        console.error(`Error creating task for event ${event.name}:`, taskError);
        continue;
      }

      // Create the link
      await supabase.from("marketing_task_links").insert({
        task_id: task.id,
        linked_event_id: event.id,
        link_type: "event_cost_update",
      });

      created++;
    }

    return new Response(
      JSON.stringify({ message: `Created ${created} tasks`, created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
