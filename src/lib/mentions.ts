import { supabase } from "@/integrations/supabase/client";

export interface MentionableMember {
  id: string;
  name: string;
}

/**
 * Extract @mentioned member IDs from a comment by greedy-matching the
 * longest member name that appears after each "@".
 */
export function extractMentionedIds(
  text: string,
  members: MentionableMember[]
): string[] {
  if (!text || !members.length) return [];
  const found = new Set<string>();
  // Sort by name length desc so "@João Silva" matches before "@João"
  const sorted = [...members].sort((a, b) => b.name.length - a.name.length);
  for (const m of sorted) {
    const needle = `@${m.name}`;
    if (text.includes(needle)) found.add(m.id);
  }
  return Array.from(found);
}

/**
 * Send a "mention" notification to each user_id in the list.
 * Silent on error to avoid breaking comment posting.
 */
export async function notifyMentions(params: {
  userIds: string[];
  authorName: string;
  contextTitle: string;
  contextType: "ticket" | "marketing";
  link?: string;
  excludeUserId?: string;
}) {
  const { userIds, authorName, contextTitle, contextType, link, excludeUserId } =
    params;
  const targets = userIds.filter((id) => id && id !== excludeUserId);
  if (targets.length === 0) return;

  const scope = contextType === "ticket" ? "ti" : "marketing";
  const label =
    contextType === "ticket" ? "chamado" : "tarefa";

  try {
    const rows = targets.map((uid) => ({
      user_id: uid,
      title: "Você foi mencionado",
      message: `${authorName} mencionou você em um comentário no ${label} "${contextTitle}"`,
      type: "info",
      link: link || null,
      scope,
    }));
    await supabase.from("notifications" as any).insert(rows);
  } catch {
    // silent
  }
}
