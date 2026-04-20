import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function addInterval(date: Date, rule: string): Date {
  const next = new Date(date);
  switch (rule) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();

    // Find recurring tasks due for duplication
    const { data: recurringTasks, error } = await supabase
      .from('marketing_tasks')
      .select('*')
      .eq('is_recurring', true)
      .not('recurrence_rule', 'is', null)
      .not('next_recurrence_date', 'is', null)
      .lte('next_recurrence_date', now);

    if (error) throw error;

    if (!recurringTasks || recurringTasks.length === 0) {
      return new Response(JSON.stringify({ message: 'No recurring tasks due', created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let created = 0;

    for (const task of recurringTasks) {
      // Create duplicate with reset progress
      const { id, created_at, updated_at, next_recurrence_date, ...taskData } = task;

      const newNextDate = addInterval(new Date(next_recurrence_date), task.recurrence_rule);

      const { data: insertedTask, error: insertErr } = await supabase
        .from('marketing_tasks')
        .insert({
          ...taskData,
          progress: 'Não iniciado',
          checklist: '[]',
          order_index: 0,
          start_date: new Date().toISOString(),
          due_date: newNextDate.toISOString(),
          // The new task is also recurring with the next date
          is_recurring: true,
          recurrence_rule: task.recurrence_rule,
          next_recurrence_date: newNextDate.toISOString(),
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('Error creating recurring task:', insertErr);
        continue;
      }

      // Mark original as non-recurring (it spawned its next instance)
      await supabase
        .from('marketing_tasks')
        .update({ is_recurring: false, next_recurrence_date: null })
        .eq('id', id);

      created++;

      // Notify assignee
      if (task.assignee_id) {
        const newTaskId = (insertedTask as any)?.id;
        await supabase.from('notifications').insert({
          user_id: task.assignee_id,
          title: 'Tarefa recorrente criada',
          message: `Nova instância da tarefa "${task.title}" foi criada automaticamente.`,
          type: 'info',
          link: newTaskId ? `/marketing/solicitacoes?task=${newTaskId}` : '/marketing/solicitacoes',
        });
      }
    }

    return new Response(
      JSON.stringify({ created }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
