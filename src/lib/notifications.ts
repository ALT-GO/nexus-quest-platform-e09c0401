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
    });
  } catch {
    // Silent fail — notifications should never break the app
  }
}

/**
 * Send a notification to all users with TI or Admin roles.
 */
export async function notifyTITeam(params: {
  title: string;
  message: string;
  type?: "info" | "warning" | "success" | "task_assigned";
  link?: string;
  excludeUserId?: string;
}) {
  try {
    // Get all user IDs with 'ti' or 'admin' role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["ti", "admin"] as any[]);

    if (!roles || roles.length === 0) return;

    // Deduplicate user IDs
    const userIds = [...new Set(roles.map((r) => r.user_id))].filter(
      (id) => id !== params.excludeUserId
    );

    if (userIds.length === 0) return;

    const notifications = userIds.map((uid) => ({
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
