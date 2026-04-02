import { supabase } from "@/integrations/supabase/client";

/**
 * Send a notification to a user by their profile name.
 * Resolves the name → user_id via profiles table.
 */
export async function sendNotification(params: {
  recipientName: string;
  title: string;
  message: string;
  type?: "info" | "warning" | "success" | "task_assigned";
  link?: string;
}) {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("full_name", params.recipientName)
      .single();

    if (!profile) return;

    await supabase.from("notifications" as any).insert({
      user_id: profile.id,
      title: params.title,
      message: params.message,
      type: params.type || "info",
      link: params.link || null,
      scope: "ti",
    });
  } catch {
    // Silent fail — notifications should never break the app
  }
}

/**
 * Send a notification to all users with TI or Admin roles
 * using a SECURITY DEFINER function to bypass RLS on user_roles.
 */
export async function notifyTITeam(params: {
  title: string;
  message: string;
  type?: "info" | "warning" | "success" | "task_assigned";
  link?: string;
  excludeUserId?: string;
}) {
  try {
    const { data: userIds } = await supabase.rpc("get_ti_admin_user_ids" as any);

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return;

    const filtered = params.excludeUserId
      ? userIds.filter((id: string) => id !== params.excludeUserId)
      : userIds;

    if (filtered.length === 0) return;

    const notifications = filtered.map((uid: string) => ({
      user_id: uid,
      title: params.title,
      message: params.message,
      type: params.type || "info",
      link: params.link || null,
    }));

    await supabase.from("notifications" as any).insert(notifications);
  } catch {
    // Silent fail
  }
}
