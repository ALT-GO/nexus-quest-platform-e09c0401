import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, AtSign, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSendMessage } from "@/hooks/use-chat";
import { extractMentionedIds, notifyMentions } from "@/lib/mentions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🚀", "👀", "✅", "🙏", "🔥", "💡", "🤔", "😎"];

interface Props {
  channelId: string;
  channelName: string;
  members: { id: string; full_name: string }[];
}

export function MessageComposer({ channelId, channelName, members }: Props) {
  const { user } = useAuth();
  const sendMut = useSendMessage();
  const [value, setValue] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Detect @ to open mention list
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const before = value.slice(0, caret);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setShowMentions(true);
      setMentionQuery(match[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  }, [value]);

  const send = async () => {
    const content = value.trim();
    if (!content || !user) return;
    await sendMut.mutateAsync({ channel_id: channelId, content });
    setValue("");

    // Notify mentions
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const mentionedIds = extractMentionedIds(
      content,
      members.map((m) => ({ id: m.id, name: m.full_name }))
    );
    await notifyMentions({
      userIds: mentionedIds,
      authorName: profile?.full_name || "Alguém",
      contextTitle: `#${channelName}`,
      contextType: "ticket",
      link: `/chat?canal=${channelId}`,
      excludeUserId: user.id,
    }).catch(() => {});
  };

  const insertAtCaret = (text: string) => {
    const ta = taRef.current;
    if (!ta) {
      setValue((v) => v + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = value.slice(0, start) + text + value.slice(end);
    setValue(newVal);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    }, 0);
  };

  const filteredMembers = members
    .filter((m) => m.full_name.toLowerCase().includes(mentionQuery))
    .slice(0, 6);

  const pickMention = (name: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const before = value.slice(0, caret).replace(/@\w*$/, `@${name} `);
    const after = value.slice(caret);
    setValue(before + after);
    setShowMentions(false);
    setTimeout(() => ta.focus(), 0);
  };

  return (
    <div className="border-t p-3 bg-background">
      <div className="relative">
        {showMentions && filteredMembers.length > 0 && (
          <div className="absolute bottom-full mb-2 left-0 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto z-10 min-w-[200px]">
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                onClick={() => pickMention(m.full_name)}
                className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm flex items-center gap-2"
              >
                <AtSign className="h-3 w-3 text-primary" />
                {m.full_name}
              </button>
            ))}
          </div>
        )}
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Mensagem em #${channelName}`}
          className="min-h-[60px] pr-24 resize-none"
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Mencionar"
            onClick={() => insertAtCaret("@")}
          >
            <AtSign className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Emoji">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1" align="end">
              <div className="flex gap-1 flex-wrap max-w-[200px]">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => insertAtCaret(e)}
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
            className="h-7 w-7"
            disabled={!value.trim() || sendMut.isPending}
            onClick={send}
            title="Enviar (Enter)"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        Enter para enviar • Shift+Enter para nova linha • @ para mencionar
      </p>
    </div>
  );
}
