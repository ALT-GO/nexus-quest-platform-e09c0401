import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelList } from "@/components/chat/ChannelList";
import { MessageList } from "@/components/chat/MessageList";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { NewChannelDialog } from "@/components/chat/NewChannelDialog";
import { useChannelMembers, useChatChannels } from "@/hooks/use-chat";
import { Hash, Users, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialChannel = searchParams.get("canal");
  const { data: channels = [] } = useChatChannels();
  const [activeId, setActiveId] = useState<string | null>(initialChannel);
  const [newChannelOpen, setNewChannelOpen] = useState(false);

  // Auto-select first channel if none active
  useEffect(() => {
    if (!activeId && channels.length > 0) {
      setActiveId(channels[0].id);
    }
  }, [channels, activeId]);

  // Sync URL
  useEffect(() => {
    if (activeId) setSearchParams({ canal: activeId }, { replace: true });
  }, [activeId, setSearchParams]);

  const active = channels.find((c) => c.id === activeId) || null;
  const { data: members = [] } = useChannelMembers(activeId);

  // Pull profile names for members
  const memberIds = members.map((m) => m.user_id);
  const { data: profiles = [] } = useQuery({
    queryKey: ["chat-profiles", memberIds.sort().join(",")],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds);
      return data || [];
    },
  });

  const memberObjs = useMemo(
    () => profiles.map((p) => ({ id: p.id, full_name: p.full_name })),
    [profiles]
  );
  const memberNames = useMemo(() => memberObjs.map((m) => m.full_name).filter(Boolean), [memberObjs]);

  return (
    <AppLayout>
      <div className="h-[calc(100vh-7rem)] -m-3 sm:-m-5 lg:-m-7 flex border rounded-lg overflow-hidden bg-background">
        <div className="w-64 shrink-0">
          <ChannelList
            activeChannelId={activeId}
            onSelect={setActiveId}
            onNewChannel={() => setNewChannelOpen(true)}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          {active ? (
            <>
              <header className="border-b px-4 py-3 flex items-center justify-between bg-background">
                <div className="flex items-center gap-2 min-w-0">
                  <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
                  <h1 className="font-semibold truncate">{active.name}</h1>
                  {active.description && (
                    <>
                      <span className="text-muted-foreground">|</span>
                      <p className="text-sm text-muted-foreground truncate">{active.description}</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {members.length}
                  </Badge>
                </div>
              </header>
              <MessageList channelId={active.id} memberNames={memberNames} />
              <MessageComposer channelId={active.id} channelName={active.name} members={memberObjs} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selecione um canal para começar
            </div>
          )}
        </div>
      </div>
      <NewChannelDialog
        open={newChannelOpen}
        onOpenChange={setNewChannelOpen}
        onCreated={(id) => setActiveId(id)}
      />
    </AppLayout>
  );
}
