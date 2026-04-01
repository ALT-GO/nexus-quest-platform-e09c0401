const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();

    // Find overdue marketing tasks that are not completed
    const { data: overdueTasks, error } = await supabase
      .from('marketing_tasks')
      .select('id, title, assignee_id, assignee_name, due_date, progress')
      .not('due_date', 'is', null)
      .lt('due_date', now)
      .neq('progress', 'Concluído');

    if (error) throw error;

    if (!overdueTasks || overdueTasks.length === 0) {
      return new Response(JSON.stringify({ message: 'No overdue tasks' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check which tasks already have a recent overdue notification (last 24h)
    const taskIds = overdueTasks.map((t: any) => t.id);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentNotifs } = await supabase
      .from('notifications')
      .select('message')
      .gte('created_at', oneDayAgo)
      .like('title', 'Tarefa atrasada:%');

    const alreadyNotified = new Set(
      (recentNotifs || []).map((n: any) => n.message)
    );

    const notifications: any[] = [];

    for (const task of overdueTasks) {
      const msgKey = `A tarefa "${task.title}" está com o prazo vencido.`;
      if (alreadyNotified.has(msgKey)) continue;

      // Notify assignee if exists
      if (task.assignee_id) {
        notifications.push({
          user_id: task.assignee_id,
          title: `Tarefa atrasada: ${task.title}`,
          message: msgKey,
          type: 'warning',
          link: '/marketing/solicitacoes',
        });
      }

      // Also notify admins
      const { data: adminIds } = await supabase.rpc('get_ti_admin_user_ids');
      if (adminIds) {
        for (const adminId of adminIds) {
          if (adminId === task.assignee_id) continue;
          notifications.push({
            user_id: adminId,
            title: `Tarefa atrasada: ${task.title}`,
            message: msgKey,
            type: 'warning',
            link: '/marketing/solicitacoes',
          });
        }
      }
    }

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ notified: notifications.length }),
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