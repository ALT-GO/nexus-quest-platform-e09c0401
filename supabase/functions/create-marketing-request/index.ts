import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tag name → color mapping
const TAG_COLORS: Record<string, string> = {
  "Assinatura de e-mail": "262 83% 58%",
  "Capa de proposta/relatório": "25 95% 53%",
  "Criação de arte": "142 71% 45%",
  "Materiais impressos": "199 89% 48%",
  "Materiais digitais": "340 82% 52%",
  "Outros": "215 20% 65%",
};

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
    const { requester_name, request_type, description, extra_fields } = body;

    if (!requester_name || !request_type || !description) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build full description with extra fields
    let fullDescription = description;
    if (extra_fields && typeof extra_fields === "object") {
      const lines: string[] = [];
      if (extra_fields.nome_sobrenome) lines.push(`Nome e Sobrenome: ${extra_fields.nome_sobrenome}`);
      if (extra_fields.cargo) lines.push(`Cargo: ${extra_fields.cargo}`);
      if (extra_fields.email_corp) lines.push(`E-mail Corporativo: ${extra_fields.email_corp}`);
      if (extra_fields.telefone_corp) lines.push(`Telefone Corporativo: ${extra_fields.telefone_corp}`);
      if (extra_fields.nome_cliente) lines.push(`Nome do Cliente: ${extra_fields.nome_cliente}`);
      if (extra_fields.endereco) lines.push(`Endereço: ${extra_fields.endereco}`);
      if (lines.length > 0) {
        fullDescription = `${lines.join("\n")}\n\n${description}`;
      }
    }

    // Get first stage for new tasks
    const { data: stages } = await supabase
      .from("marketing_stages")
      .select("id")
      .order("order_index")
      .limit(1);

    const stageId = stages?.[0]?.id || null;

    // Get max order_index
    const { data: maxOrder } = await supabase
      .from("marketing_tasks")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1);

    const nextOrder = (maxOrder?.[0]?.order_index ?? -1) + 1;

    // Create the marketing task
    const { data: task, error: taskError } = await supabase
      .from("marketing_tasks")
      .insert({
        title: `[${request_type}] Solicitação de ${requester_name}`,
        description: fullDescription,
        requester_name: requester_name,
        stage_id: stageId,
        priority: "medium",
        progress: "Não iniciado",
        order_index: nextOrder,
      })
      .select("id")
      .single();

    if (taskError) throw taskError;

    // Ensure the tag exists and link it to the task
    const tagColor = TAG_COLORS[request_type] || "215 20% 65%";
    let { data: existingTag } = await supabase
      .from("marketing_tags")
      .select("id")
      .eq("name", request_type)
      .limit(1)
      .single();

    let tagId: string;
    if (existingTag) {
      tagId = existingTag.id;
    } else {
      const { data: newTag, error: tagErr } = await supabase
        .from("marketing_tags")
        .insert({ name: request_type, color: tagColor })
        .select("id")
        .single();
      if (tagErr) throw tagErr;
      tagId = newTag!.id;
    }

    // Link tag to task
    await supabase
      .from("marketing_task_tags")
      .insert({ task_id: task!.id, tag_id: tagId });

    // Notify marketing & admin team
    const { data: teamIds } = await supabase.rpc("get_ti_admin_user_ids");
    // Also get marketing role users
    const { data: mktRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "marketing");

    const allIds = new Set<string>([
      ...(teamIds || []),
      ...(mktRoles || []).map((r: any) => r.user_id),
    ]);

    const notifications = Array.from(allIds).map((uid) => ({
      user_id: uid,
      title: "Nova Solicitação ao Marketing",
      message: `${requester_name} enviou uma solicitação: ${request_type}`,
      type: "info",
      link: "/marketing/solicitacoes",
      scope: "marketing",
    }));

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }

    return new Response(
      JSON.stringify({ success: true, taskId: task!.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
