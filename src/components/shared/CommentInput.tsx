import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AtSign, Send, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface TeamMember {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface CommentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  teamMembers: TeamMember[];
  placeholder?: string;
}

export function CommentInput({
  value,
  onChange,
  onSend,
  disabled,
  teamMembers,
  placeholder = "Escreva um comentário...",
}: CommentInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const filteredMembers = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const pos = e.target.selectionStart ?? 0;
      onChange(val);

      // Check for @ trigger
      const textBefore = val.slice(0, pos);
      const atIndex = textBefore.lastIndexOf("@");
      if (atIndex >= 0) {
        const charBefore = atIndex > 0 ? textBefore[atIndex - 1] : " ";
        if (charBefore === " " || charBefore === "\n" || atIndex === 0) {
          const query = textBefore.slice(atIndex + 1);
          if (!query.includes(" ") && !query.includes("\n")) {
            setShowMentions(true);
            setMentionFilter(query);
            setMentionStartPos(atIndex);
            setMentionIndex(0);
            return;
          }
        }
      }
      setShowMentions(false);
    },
    [onChange]
  );

  const insertMention = useCallback(
    (member: TeamMember) => {
      if (mentionStartPos < 0) return;
      const before = value.slice(0, mentionStartPos);
      const cursorPos = textareaRef.current?.selectionStart ?? value.length;
      const after = value.slice(cursorPos);
      const newVal = `${before}@${member.name} ${after}`;
      onChange(newVal);
      setShowMentions(false);
      setMentionFilter("");
      setMentionStartPos(-1);

      // Restore focus
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          const newPos = before.length + member.name.length + 2;
          ta.focus();
          ta.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [value, mentionStartPos, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      onSend();
    }
  };

  const triggerMention = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? value.length;
    const charBefore = pos > 0 ? value[pos - 1] : " ";
    const needsSpace = charBefore && charBefore !== " " && charBefore !== "\n";
    const insertion = needsSpace ? " @" : "@";
    const newVal = value.slice(0, pos) + insertion + value.slice(pos);
    onChange(newVal);
    const newPos = pos + insertion.length;
    setShowMentions(true);
    setMentionFilter("");
    setMentionStartPos(newPos - 1);
    setMentionIndex(0);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleEmojiSelect = (emoji: any) => {
    const ta = textareaRef.current;
    const pos = ta?.selectionStart ?? value.length;
    const newVal = value.slice(0, pos) + emoji.native + value.slice(pos);
    onChange(newVal);
    setEmojiOpen(false);
    setTimeout(() => {
      if (ta) {
        const newPos = pos + emoji.native.length;
        ta.focus();
        ta.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Scroll active mention into view
  useEffect(() => {
    if (showMentions && mentionListRef.current) {
      const active = mentionListRef.current.querySelector("[data-active=true]");
      active?.scrollIntoView({ block: "nearest" });
    }
  }, [mentionIndex, showMentions]);

  return (
    <div className="relative">
      {/* Mention dropdown */}
      {showMentions && filteredMembers.length > 0 && (
        <div
          ref={mentionListRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto z-50"
        >
          {filteredMembers.map((m, i) => (
            <button
              key={m.id}
              data-active={i === mentionIndex}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                i === mentionIndex && "bg-accent"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(m);
              }}
            >
              <UserAvatar
                name={m.name}
                avatarUrl={m.avatar_url ?? undefined}
                className="h-5 w-5"
                fallbackClassName="text-[8px]"
              />
              <span>{m.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[50px] max-h-[120px] text-sm resize-none rounded-md border border-input bg-background px-3 py-2 pr-9 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            rows={2}
          />
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="absolute right-2 bottom-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Smile className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 border-none shadow-xl"
              side="top"
              align="end"
            >
              <Picker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="auto"
                locale="pt"
                previewPosition="none"
                skinTonePosition="search"
                maxFrequentRows={2}
              />
            </PopoverContent>
          </Popover>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={triggerMention}
          className="shrink-0 h-8 w-8"
          title="Mencionar usuário (@)"
        >
          <AtSign className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          onClick={onSend}
          disabled={disabled}
          className="shrink-0 h-8 w-8"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
