import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProfileAvatars() {
  return useQuery({
    queryKey: ["profile-avatars"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url");
      const byId: Record<string, string | null> = {};
      const byName: Record<string, string | null> = {};
      (data || []).forEach((p) => {
        byId[p.id] = p.avatar_url;
        if (p.full_name) byName[p.full_name.toLowerCase()] = p.avatar_url;
      });
      return { byId, byName };
    },
    staleTime: 60_000,
  });
}
