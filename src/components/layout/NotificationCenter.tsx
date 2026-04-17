import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, CheckCheck, Info, AlertTriangle, CheckCircle2, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
  scope: string;
}

const typeIcons: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  task_assigned: UserPlus,
};

const typeColors: Record<string, string> = {
  info: "text-primary",
  warning: "text-amber-500",
  success: "text-emerald-500",
  task_assigned: "text-primary",
};

export function NotificationCenter() {
  const { user, isAdmin, roles } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) || []);
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Filter notifications by team scope
  const filteredNotifications = notifications.filter((n) => {
    if (isAdmin) return true; // Admin sees all
    const scope = (n as any).scope || "general";
    if (scope === "general") return true;
    if (scope === "ti" && roles.includes("ti")) return true;
    if (scope === "marketing" && roles.includes("marketing")) return true;
    // If user has no matching role and scope is team-specific, hide it
    if (scope === "ti" || scope === "marketing") return false;
    return true;
  });

  const unreadCount = filteredNotifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const hasUnread = filteredNotifications.some((n) => !n.read);
    if (!hasUnread) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    if (notifications.length === 0) return;
    setNotifications([]);
    toast.success("Todas as notificações foram removidas");
    await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);
  };

  const handleClick = async (notif: Notification) => {
    if (!notif.read) await markAsRead(notif.id);
    if (!notif.link) return;
    setOpen(false);

    // Special handling: chat links open the floating chat panel directly
    // Supported formats: "/chat", "/chat?canal=<channelId>", "/chat?channel=<channelId>"
    if (notif.link.startsWith("/chat")) {
      let channelId: string | undefined;
      try {
        const url = new URL(notif.link, window.location.origin);
        channelId = url.searchParams.get("canal") || url.searchParams.get("channel") || undefined;
      } catch {
        // ignore parse errors
      }
      window.dispatchEvent(
        new CustomEvent("nexus:open-chat", { detail: channelId ? { channelId } : {} })
      );
      return;
    }

    navigate(notif.link);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-lg transition-all",
            "text-muted-foreground hover:text-foreground hover:bg-accent",
            open && "bg-accent text-foreground"
          )}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[440px] p-0 rounded-xl shadow-lg border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30 rounded-t-xl">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            {unreadCount > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {unreadCount} não lida{unreadCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar lidas
              </Button>
            )}
            {filteredNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={clearAllNotifications}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="max-h-[60vh] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <Bell className="h-5 w-5 opacity-40" />
              </div>
              <p className="text-sm font-medium">Tudo limpo!</p>
              <p className="text-xs mt-0.5">Nenhuma notificação no momento</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((notif) => {
                const Icon = typeIcons[notif.type] || Info;
                const color = typeColors[notif.type] || "text-muted-foreground";
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/50",
                      !notif.read && "bg-primary/5"
                    )}
                  >
                    <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", 
                      !notif.read ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", !notif.read ? color : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm", !notif.read && "font-semibold")}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    {!notif.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif.id);
                        }}
                        title="Marcar como lida"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
