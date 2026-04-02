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
          scope: 'marketing',
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

    // ── 2. Events past end_date — auto-create tasks for leads + actual_cost ──
    const { data: endedEvents } = await supabase
      .from('marketing_events')
      .select('id, name, end_date, leads_gerados, actual_cost')
      .lt('end_date', nowIso)
      .in('status', ['active', 'completed']);

    // Helper: get existing linked tasks for an event
    async function getLinkedTaskTitles(eventId: string): Promise<string[]> {
      const { data: links } = await supabase
        .from('marketing_task_links')
        .select('task_id')
        .eq('linked_event_id', eventId);
      if (!links || links.length === 0) return [];
      const ids = links.map((l: any) => l.task_id);
      const { data: tasks } = await supabase
        .from('marketing_tasks')
        .select('title')
        .in('id', ids);
      return (tasks || []).map((t: any) => t.title.toLowerCase());
    }

    // Get first "todo" stage (cached)
    const { data: stagesData } = await supabase
      .from('marketing_stages')
      .select('id, meta_status')
      .order('order_index', { ascending: true });
    const todoStage = (stagesData || []).find((s: any) => s.meta_status === 'todo');

    async function createAutoTask(title: string, description: string, eventId: string) {
      const { data: newTask } = await supabase
        .from('marketing_tasks')
        .insert({
          title,
          description,
          priority: 'high',
          progress: 'Não iniciado',
          requester_name: 'Sistema',
          stage_id: todoStage?.id || null,
          event_id: eventId,
        } as any)
        .select('id')
        .single();

      if (newTask) {
        await supabase
          .from('marketing_task_links')
          .insert({
            task_id: (newTask as any).id,
            linked_event_id: eventId,
            link_type: 'related',
          } as any);

        // Notify all marketing/admin users about the new task
        const notifTitle = `Nova tarefa automática`;
        const notifMsg = `Tarefa "${title}" criada automaticamente.`;
        if (!wasNotified(notifTitle, notifMsg)) {
          for (const userId of allMarketingIds) {
            notifications.push({
              user_id: userId,
              title: notifTitle,
              message: notifMsg,
              type: 'info',
              link: '/marketing/solicitacoes',
            });
          }
        }
      }
    }

    for (const evt of (endedEvents || [])) {
      const existingTitles = await getLinkedTaskTitles(evt.id);

      // Auto-create task for leads_gerados if empty
      if (evt.leads_gerados == null) {
        const keyword = 'leads gerados';
        if (!existingTitles.some(t => t.includes(keyword))) {
          await createAutoTask(
            `Preencher leads gerados — ${evt.name}`,
            `O evento "${evt.name}" já terminou. Por favor, preencha a quantidade de leads gerados.`,
            evt.id
          );
        }
      }

      // Auto-create task for actual_cost if empty
      if (evt.actual_cost == null) {
        const keyword = 'valor real gasto';
        if (!existingTitles.some(t => t.includes(keyword))) {
          await createAutoTask(
            `Definir valor real gasto — ${evt.name}`,
            `O evento "${evt.name}" chegou à data limite. Por favor, defina o valor real gasto no evento.`,
            evt.id
          );
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
