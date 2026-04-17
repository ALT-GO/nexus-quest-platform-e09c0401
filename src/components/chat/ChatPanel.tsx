import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChannelList } from "@/components/chat/ChannelList";
import { MessageList } from "@/components/chat/MessageList";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { NewChannelDialog } from "@/components/chat/NewChannelDialog";
import { ChannelSettingsDialog } from "@/components/chat/ChannelSettingsDialog";
import { useChannelMembers, useChatChannels } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { Hash, Users, Settings as SettingsIcon, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatPanel({ open, onOpenChange }: ChatPanelProps) {
  const { data: channels = [] } = useChatChannels();
  const { isAdmin } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Auto-select first channel when opening / when list arrives
  useEffect(() => {
    if (open && !activeId && channels.length > 0) {
      setActiveId(channels[0].id);
    }
  }, [open, channels, activeId]);

  // Listen to global event with optional channelId payload (e.g. from notifications)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { channelId?: string } | undefined;
      if (detail?.channelId) setActiveId(detail.channelId);
    };
    window.addEventListener("nexus:open-chat", handler);
    return () => window.removeEventListener("nexus:open-chat", handler);
  }, []);

  const active = channels.find((c) => c.id === activeId) || null;
  const { data: members = [] } = useChannelMembers(activeId);

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
  const memberNames = useMemo(
    () => memberObjs.map((m) => m.full_name).filter(Boolean),
    [memberObjs]
  );

  const handleSelectChannel = (id: string) => {
    setActiveId(id);
    // On narrow widths auto-collapse the channel list after selection
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="p-0 gap-0 w-full sm:w-[80vw] md:w-[60vw] lg:w-[50vw] sm:max-w-none flex flex-col"
        >
          <div className="flex flex-1 min-h-0 overflow-hidden bg-background">
            {/* Channel list (collapsible) */}
            <div
              className={cn(
                "shrink-0 border-r transition-[width] duration-200 overflow-hidden",
                sidebarOpen ? "w-56" : "w-0"
              )}
            >
              <div className="w-56 h-full">
                <ChannelList
                  activeChannelId={activeId}
                  onSelect={handleSelectChannel}
                  onNewChannel={() => setNewChannelOpen(true)}
                />
              </div>
            </div>

            {/* Conversation area */}
            <div className="flex-1 flex flex-col min-w-0">
              <header className="border-b px-3 py-2.5 flex items-center justify-between bg-background gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    title={sidebarOpen ? "Ocultar canais" : "Mostrar canais"}
                    onClick={() => setSidebarOpen((v) => !v)}
                  >
                    {sidebarOpen ? (
                      <PanelLeftClose className="h-4 w-4" />
                    ) : (
                      <PanelLeftOpen className="h-4 w-4" />
                    )}
                  </Button>
                  {active ? (
                    <>
                      <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                      <h2 className="font-semibold truncate text-sm">{active.name}</h2>
                      {active.description && (
                        <span className="hidden md:inline text-xs text-muted-foreground truncate">
                          — {active.description}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Chat</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {active && (
                    <Badge variant="secondary" className="gap-1 h-6">
                      <Users className="h-3 w-3" />
                      {members.length}
                    </Badge>
                  )}
                  {active && isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Configurações do canal"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <SettingsIcon className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Fechar"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </header>

              {active ? (
                <>
                  <div className="flex-1 min-h-0 flex flex-col">
                    <MessageList channelId={active.id} memberNames={memberNames} />
                  </div>
                  <MessageComposer
                    channelId={active.id}
                    channelName={active.name}
                    members={memberObjs}
                  />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  Selecione um canal para começar
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <NewChannelDialog
        open={newChannelOpen}
        onOpenChange={setNewChannelOpen}
        onCreated={(id) => setActiveId(id)}
      />
      {active && isAdmin && (
        <ChannelSettingsDialog
          channel={active}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onDeleted={() => setActiveId(null)}
        />
      )}
    </>
  );
}
