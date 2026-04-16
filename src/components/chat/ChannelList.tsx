import { Hash, Lock, Megaphone, Monitor, LifeBuoy, Users, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChatChannel, useChatChannels, useUnreadCounts } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";

const ICONS: Record<string, any> = {
  hash: Hash,
  lock: Lock,
  megaphone: Megaphone,
  monitor: Monitor,
  "life-buoy": LifeBuoy,
  users: Users,
  message: MessageSquare,
};

interface Props {
  activeChannelId: string | null;
  onSelect: (id: string) => void;
  onNewChannel?: () => void;
}

export function ChannelList({ activeChannelId, onSelect, onNewChannel }: Props) {
  const { data: channels = [] } = useChatChannels();
  const { data: unread = {} } = useUnreadCounts();
  const { isAdmin } = useAuth();

  const grouped = {
    public: channels.filter((c) => c.type === "public"),
    private: channels.filter((c) => c.type === "private"),
    dm: channels.filter((c) => c.type === "dm" || c.type === "group"),
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 border-r">
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm">Conversas</h2>
        {isAdmin && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onNewChannel} title="Novo canal">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          <ChannelGroup
            label="Canais"
            channels={grouped.public}
            activeId={activeChannelId}
            unread={unread}
            onSelect={onSelect}
          />
          {grouped.private.length > 0 && (
            <ChannelGroup
              label="Privados"
              channels={grouped.private}
              activeId={activeChannelId}
              unread={unread}
              onSelect={onSelect}
            />
          )}
          {grouped.dm.length > 0 && (
            <ChannelGroup
              label="Mensagens diretas"
              channels={grouped.dm}
              activeId={activeChannelId}
              unread={unread}
              onSelect={onSelect}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ChannelGroup({
  label,
  channels,
  activeId,
  unread,
  onSelect,
}: {
  label: string;
  channels: ChatChannel[];
  activeId: string | null;
  unread: Record<string, number>;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">
        {label}
      </div>
      <div className="space-y-0.5">
        {channels.map((c) => {
          const Icon = ICONS[c.icon] || Hash;
          const count = unread[c.id] || 0;
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : count > 0
                  ? "text-foreground font-medium hover:bg-accent"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{c.name}</span>
              {count > 0 && (
                <Badge variant="default" className="h-5 px-1.5 text-[10px] bg-primary">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
