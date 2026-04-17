import { MessageCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useTotalUnread } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./ChatPanel";

export function ChatFloatingButton() {
  const { user } = useAuth();
  const total = useTotalUnread();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return null;
  if (
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/signup") ||
    location.pathname.startsWith("/forgot-password") ||
    location.pathname.startsWith("/reset-password") ||
    location.pathname.startsWith("/chamado-publico") ||
    location.pathname.startsWith("/solicitacao-marketing") ||
    location.pathname.startsWith("/evento")
  ) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-40 group",
          "h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg",
          "flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105",
          "border-2 border-background"
        )}
        title="Abrir chat"
      >
        <MessageCircle className="h-6 w-6" />
        {total > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-6 min-w-6 px-1.5 rounded-full text-[11px] font-bold border-2 border-background"
          >
            {total > 99 ? "99+" : total}
          </Badge>
        )}
        <span className="absolute right-full mr-3 bg-foreground text-background text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Chat
        </span>
      </button>
      <ChatPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
