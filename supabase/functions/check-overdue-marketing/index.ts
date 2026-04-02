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

    const now = new Date();
    const nowIso = now.toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // ── Get marketing + admin user IDs ──
    const { data: adminIds } = await supabase.rpc('get_ti_admin_user_ids');
    const { data: marketingRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'marketing');

    const allMarketingIds = new Set<string>([
      ...(adminIds || []),
      ...(marketingRoles || []).map((r: any) => r.user_id),
    ]);

    const notifications: any[] = [];

    // ── Recent notifications check ──
    const { data: recentNotifs } = await supabase
      .from('notifications')
      .select('title, message')
      .gte('created_at', oneDayAgo)
      .or('title.like.Tarefa atrasada:%,title.like.Leads pendente:%,title.like.Lembrete de evento:%,title.like.Custo real pendente:%');

    const alreadyNotified = new Set(
      (recentNotifs || []).map((n: any) => `${n.title}|||${n.message}`)
    );

    function wasNotified(title: string, message: string) {
      return alreadyNotified.has(`${title}|||${message}`);
    }

    // ── 1. Overdue marketing tasks ──
    const { data: overdueTasks, error } = await supabase
      .from('marketing_tasks')
      .select('id, title, assignee_id, assignee_name, due_date, progress')
      .not('due_date', 'is', null)
      .lt('due_date', nowIso)
      .neq('progress', 'Concluído');

    if (error) throw error;

    for (const task of (overdueTasks || [])) {
      const msgKey = `A tarefa "${task.title}" está com o prazo vencido.`;
      const titleKey = `Tarefa atrasada: ${task.title}`;
      if (wasNotified(titleKey, msgKey)) continue;

      if (task.assignee_id) {
        notifications.push({
          user_id: task.assignee_id,
          title: titleKey,
          message: msgKey,
          type: 'warning',
          link: '/marketing/solicitacoes',
        });
      }

      for (const uid of allMarketingIds) {
        if (uid === task.assignee_id) continue;
        notifications.push({
          user_id: uid,
          title: titleKey,
          message: msgKey,
          type: 'warning',
          link: '/marketing/solicitacoes',
        });
      }
    }

    // ── 2. Events with empty leads_gerados after end_date ──
    const { data: endedEvents } = await supabase
      .from('marketing_events')
      .select('id, name, end_date, leads_gerados, actual_cost')
      .lt('end_date', nowIso)
      .in('status', ['active', 'completed']);

    for (const evt of (endedEvents || [])) {
      // Leads notification
      if (evt.leads_gerados == null) {
        const msgKey = `O evento "${evt.name}" já terminou e o campo de Leads Gerados está vazio. Por favor, preencha.`;
        const titleKey = `Leads pendente: ${evt.name}`;
        if (!wasNotified(titleKey, msgKey)) {
          for (const userId of allMarketingIds) {
            notifications.push({
              user_id: userId,
              title: titleKey,
              message: msgKey,
              type: 'warning',
              link: '/marketing/eventos',
            });
          }
        }
      }

      // ── Auto-create task for actual_cost when event ends and actual_cost is null ──
      if (evt.actual_cost == null) {
        // Check if a task already exists for this
        const { data: existingLinks } = await supabase
          .from('marketing_task_links')
          .select('id, task_id')
          .eq('linked_event_id', evt.id);

        // Check if any linked task has "valor real" in title
        let alreadyHasTask = false;
        if (existingLinks && existingLinks.length > 0) {
          const linkedTaskIds = existingLinks.map((l: any) => l.task_id);
          const { data: linkedTasks } = await supabase
            .from('marketing_tasks')
            .select('id, title')
            .in('id', linkedTaskIds);
          alreadyHasTask = (linkedTasks || []).some((t: any) =>
            t.title.toLowerCase().includes('valor real gasto')
          );
        }

        if (!alreadyHasTask) {
          // Get first "todo" stage
          const { data: stages } = await supabase
            .from('marketing_stages')
            .select('id, meta_status')
            .order('order_index', { ascending: true });

          const todoStage = (stages || []).find((s: any) => s.meta_status === 'todo');

          // Create the task
          const { data: newTask } = await supabase
            .from('marketing_tasks')
            .insert({
              title: `Definir valor real gasto — ${evt.name}`,
              description: `O evento "${evt.name}" chegou à data limite. Por favor, defina o valor real gasto no evento.`,
              priority: 'high',
              progress: 'Não iniciado',
              requester_name: 'Sistema',
              stage_id: todoStage?.id || null,
              event_id: evt.id,
            } as any)
            .select('id')
            .single();

          if (newTask) {
            // Link the task to the event
            await supabase
              .from('marketing_task_links')
              .insert({
                task_id: (newTask as any).id,
                linked_event_id: evt.id,
                link_type: 'related',
              } as any);

            // Notify
            const titleKey = `Custo real pendente: ${evt.name}`;
            const msgKey = `Uma tarefa foi criada automaticamente para definir o valor real gasto no evento "${evt.name}".`;
            if (!wasNotified(titleKey, msgKey)) {
              for (const userId of allMarketingIds) {
                notifications.push({
                  user_id: userId,
                  title: titleKey,
                  message: msgKey,
                  type: 'info',
                  link: '/marketing/solicitacoes',
                });
              }
            }
          }
        }
      }
    }

    // ── 3. Event reminders: 15 days, 7 days, 1 day before, and on the day ──
    const { data: upcomingEvents } = await supabase
      .from('marketing_events')
      .select('id, name, start_date, status')
      .in('status', ['planning', 'active'])
      .gte('start_date', nowIso);

    const reminderThresholds = [
      { days: 15, label: '15 dias' },
      { days: 7, label: '7 dias' },
      { days: 1, label: '1 dia' },
      { days: 0, label: 'Hoje' },
    ];

    for (const evt of (upcomingEvents || [])) {
      const startDate = new Date(evt.start_date);
      const diffMs = startDate.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      for (const threshold of reminderThresholds) {
        if (diffDays === threshold.days) {
          const titleKey = `Lembrete de evento: ${evt.name}`;
          const msgKey = threshold.days === 0
            ? `O evento "${evt.name}" começa hoje!`
            : `Faltam ${threshold.label} para o evento "${evt.name}".`;

          if (wasNotified(titleKey, msgKey)) continue;

          for (const userId of allMarketingIds) {
            notifications.push({
              user_id: userId,
              title: titleKey,
              message: msgKey,
              type: threshold.days <= 1 ? 'warning' : 'info',
              link: '/marketing/eventos',
            });
          }
          break;
        }
      }
    }

    // Also check events starting today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const { data: todayEvents } = await supabase
      .from('marketing_events')
      .select('id, name, start_date, status')
      .in('status', ['planning', 'active'])
      .gte('start_date', todayStart)
      .lte('start_date', todayEnd);

    for (const evt of (todayEvents || [])) {
      const titleKey = `Lembrete de evento: ${evt.name}`;
      const msgKey = `O evento "${evt.name}" começa hoje!`;
      if (wasNotified(titleKey, msgKey)) continue;

      for (const userId of allMarketingIds) {
        notifications.push({
          user_id: userId,
          title: titleKey,
          message: msgKey,
          type: 'warning',
          link: '/marketing/eventos',
        });
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
