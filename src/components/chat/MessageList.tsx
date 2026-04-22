import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Pin, Pencil, Trash2, Smile, Check, CheckCheck } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MentionText } from "@/components/shared/MentionText";
import {
  ChatMessage,
  ChannelMember,
  useChannelMessages,
  useChannelReactions,
  useDeleteMessage,
  useEditMessage,
  useToggleReaction,
  useTogglePin,
  useMarkChannelRead,
} from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🚀", "👀", "✅", "🙏"];

// Email to ignore from read receipts (test account)
const BOT_USER_ID = "00000000-0000-0000-0000-000000000b07";
const IGNORED_EMAILS_USER_IDS = new Set<string>();

interface MemberProfile {
  id: string;
  full_name: string;
}

interface Props {
  channelId: string;
  memberNames: string[];
  members: ChannelMember[];
  memberProfiles: MemberProfile[];
}

export function MessageList({ channelId, memberNames, members, memberProfiles }: Props) {
  const { user } = useAuth();
  const { data: messages = [] } = useChannelMessages(channelId);
  const { data: reactions = [] } = useChannelReactions(channelId);
  const editMut = useEditMessage();
  const delMut = useDeleteMessage();
  const reactMut = useToggleReaction();
  const pinMut = useTogglePin();
  const markRead = useMarkChannelRead();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Mark as read when channel opens
  useEffect(() => {
    if (channelId) markRead.mutate(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const reactionsByMsg = useMemo(() => {
    const map: Record<string, Record<string, { count: number; me: boolean; users: string[] }>> = {};
    reactions.forEach((r) => {
      if (!map[r.message_id]) map[r.message_id] = {};
      if (!map[r.message_id][r.emoji])
        map[r.message_id][r.emoji] = { count: 0, me: false, users: [] };
      map[r.message_id][r.emoji].count++;
      map[r.message_id][r.emoji].users.push(r.user_name);
      if (r.user_id === user?.id) map[r.message_id][r.emoji].me = true;
    });
    return map;
  }, [reactions, user]);

  // Fetch ignored user id for test account
  const { data: ignoredUserIds } = useQuery({
    queryKey: ["chat-ignored-test-users"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_emails");
      const ignored = (data || [])
        .filter((u: any) => u.email === "adm.tisp@grupoorion.com.br")
        .map((u: any) => u.user_id);
      return new Set<string>(ignored);
    },
    staleTime: 300_000,
  });

  // Compute read status for own messages — exclude self and test account
  const otherMembers = useMemo(
    () => {
      if (!user) return [];
      return members.filter((m) => {
        if (m.user_id === user.id) return false;
        if (ignoredUserIds?.has(m.user_id)) return false;
        return true;
      });
    },
    [members, user, ignoredUserIds]
  );

  // Build a map userId -> name for tooltips
  const profileNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    memberProfiles.forEach((p) => { map[p.id] = p.full_name; });
    return map;
  }, [memberProfiles]);

  const pinned = messages.filter((m) => m.pinned);

  return (
    <div className="flex flex-col h-full">
      {pinned.length > 0 && (
        <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Pin className="h-3 w-3" />
          <span>{pinned.length} mensagem(ns) fixada(s)</span>
        </div>
      )}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <p className="text-sm">Nenhuma mensagem ainda. Comece a conversa! 👋</p>
            </div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDate =
              !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
            const compact =
              prev &&
              prev.author_id === m.author_id &&
              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000 &&
              !showDate;
            return (
              <div key={m.id}>
                {showDate && <DateDivider date={m.created_at} />}
                <MessageRow
                  message={m}
                  compact={!!compact}
                  isOwn={m.author_id === user?.id}
                  memberNames={memberNames}
                  reactions={reactionsByMsg[m.id] || {}}
                  otherMembers={otherMembers}
                  profileNameMap={profileNameMap}
                  editingId={editingId}
                  editValue={editValue}
                  onStartEdit={(msg) => {
                    setEditingId(msg.id);
                    setEditValue(msg.content);
                  }}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={(id) => {
                    editMut.mutate({ id, content: editValue });
                    setEditingId(null);
                  }}
                  onEditChange={setEditValue}
                  onDelete={(id) => delMut.mutate(id)}
                  onReact={(id, emoji) => reactMut.mutate({ messageId: id, emoji })}
                  onPin={(id, pinned) => pinMut.mutate({ id, pinned: !pinned })}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function DateDivider({ date }: { date: string }) {
  const d = new Date(date);
  const label = isToday(d) ? "Hoje" : isYesterday(d) ? "Ontem" : format(d, "d 'de' MMMM", { locale: ptBR });
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function ReadReceipt({ message, otherMembers, profileNameMap }: { message: ChatMessage; otherMembers: ChannelMember[]; profileNameMap: Record<string, string> }) {
  if (otherMembers.length === 0) {
    return <Check className="h-3.5 w-3.5 text-muted-foreground/50" />;
  }

  const msgTime = new Date(message.created_at).getTime();
  const readBy = otherMembers.filter(
    (m) => new Date(m.last_read_at).getTime() >= msgTime
  );
  const readNames = readBy.map((m) => profileNameMap[m.user_id] || "Usuário").sort();
  const unreadMembers = otherMembers.filter(
    (m) => new Date(m.last_read_at).getTime() < msgTime
  );
  const unreadNames = unreadMembers.map((m) => profileNameMap[m.user_id] || "Usuário").sort();
  const allRead = readBy.length === otherMembers.length;
  const someRead = readBy.length > 0;

  const buildTooltip = () => {
    const lines: string[] = [];
    if (readNames.length > 0) {
      lines.push(`✓ Lida por: ${readNames.join(", ")}`);
    }
    if (unreadNames.length > 0) {
      lines.push(`○ Não lida: ${unreadNames.join(", ")}`);
    }
    return lines;
  };

  if (allRead) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <CheckCheck className="h-3.5 w-3.5 text-primary" />
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-[250px]">
          <div className="space-y-0.5">
            {buildTooltip().map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (someRead) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/60" />
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-[250px]">
          <div className="space-y-0.5">
            {buildTooltip().map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/40" />
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs max-w-[250px]">
        <div className="space-y-0.5">
          {buildTooltip().map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function MessageRow({
  message,
  compact,
  isOwn,
  memberNames,
  reactions,
  otherMembers,
  profileNameMap,
  editingId,
  editValue,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditChange,
  onDelete,
  onReact,
  onPin,
}: {
  message: ChatMessage;
  compact: boolean;
  isOwn: boolean;
  memberNames: string[];
  reactions: Record<string, { count: number; me: boolean; users: string[] }>;
  otherMembers: ChannelMember[];
  profileNameMap: Record<string, string>;
  editingId: string | null;
  editValue: string;
  onStartEdit: (m: ChatMessage) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onEditChange: (v: string) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onPin: (id: string, pinned: boolean) => void;
}) {
  const isEditing = editingId === message.id;
  const time = format(new Date(message.created_at), "HH:mm");

  return (
    <div className={cn("group flex gap-3 hover:bg-muted/30 -mx-4 px-4 py-1 rounded relative", compact && "py-0.5")}>
      <div className="w-9 shrink-0">
        {!compact && <UserAvatar name={message.author_name} avatarUrl={message.avatar_url} userId={message.author_id} className="h-9 w-9" />}
        {compact && (
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 mt-1 block text-right">
            {time}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm">{message.author_name}</span>
            <span className="text-xs text-muted-foreground">{time}</span>
            {message.pinned && <Pin className="h-3 w-3 text-primary" />}
          </div>
        )}
        {isEditing ? (
          <div className="flex gap-1 mt-1">
            <Input
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit(message.id);
                if (e.key === "Escape") onCancelEdit();
              }}
              autoFocus
              className="h-8"
            />
            <Button size="sm" onClick={() => onSaveEdit(message.id)}>
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5">
            <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              <MentionText text={message.content} memberNames={memberNames} />
              {message.edited_at && <span className="text-[10px] text-muted-foreground ml-1">(editada)</span>}
            </div>
            {isOwn && (
              <span className="shrink-0 mb-0.5">
                <ReadReceipt message={message} otherMembers={otherMembers} profileNameMap={profileNameMap} />
              </span>
            )}
          </div>
        )}
        {Object.keys(reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactions).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                title={data.users.join(", ")}
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-xs border flex items-center gap-1 transition-colors",
                  data.me
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted border-border hover:bg-accent"
                )}
              >
                <span>{emoji}</span>
                <span className="font-medium">{data.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {!isEditing && (
        <div className="absolute right-4 top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-background border rounded-md shadow-sm flex items-center transition-opacity">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Reagir">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1" align="end">
              <div className="flex gap-1">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => onReact(message.id, e)}
                    className="text-lg hover:bg-accent rounded px-1.5 py-0.5"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onPin(message.id, message.pinned)}
            title={message.pinned ? "Desafixar" : "Fixar"}
          >
            <Pin className={cn("h-4 w-4", message.pinned && "fill-current text-primary")} />
          </Button>
          {isOwn && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onStartEdit(message)} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => onDelete(message.id)}
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
