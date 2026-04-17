import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  LayoutDashboard,
  Megaphone,
  Monitor,
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  Menu,
  X,
  Brain,
  Target,
  FileText,
  Users,
  Receipt,
  KeyRound,
  Headphones,
  CalendarDays,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTotalUnread } from "@/hooks/use-chat";

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  color?: string;
  children?: { title: string; href: string; icon?: React.ElementType }[];
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, roles, hasPermission, signOut } = useAuth();

  // Build TI children based on page permissions
  const tiChildren: { title: string; href: string; icon?: React.ElementType }[] = [];
  if (hasPermission("ver_service_desk")) {
    tiChildren.push({ title: "Service Desk", href: "/ti/service-desk", icon: Headphones });
  }
  if (hasPermission("ver_colaboradores")) {
    tiChildren.push({ title: "Colaboradores", href: "/ti/colaboradores", icon: Users });
  }
  if (hasPermission("ver_gestao_custos")) {
    tiChildren.push({ title: "Gestão de Custos", href: "/ti/faturas", icon: Receipt });
  }
  if (hasPermission("ver_cofre_senhas")) {
    tiChildren.push({ title: "Cofre de Senhas", href: "/ti/cofre-senhas", icon: KeyRound });
  }

  // Build marketing children based on page permissions
  const marketingChildren: { title: string; href: string; icon?: React.ElementType }[] = [];
  if (hasPermission("ver_solicitacoes_marketing")) {
    marketingChildren.push({ title: "Solicitações", href: "/marketing/solicitacoes", icon: FileText });
  }
  if (hasPermission("ver_eventos_marketing")) {
    marketingChildren.push({ title: "Eventos", href: "/marketing/eventos", icon: CalendarDays });
  }
  if (hasPermission("ver_metas_marketing")) {
    marketingChildren.push({ title: "Metas", href: "/marketing/metas", icon: Target });
  }

  const totalUnreadChat = useTotalUnread();

  const navigation: NavItem[] = [
    ...(hasPermission("ver_dashboard") ? [{
      title: "Dashboard",
      href: hasPermission("ver_central_inteligencia") ? "/central-inteligencia" : "/",
      icon: hasPermission("ver_central_inteligencia") ? Brain : LayoutDashboard,
    } as NavItem] : []),
    {
      title: "Chat",
      href: "/chat",
      icon: MessageCircle,
    } as NavItem,
    ...(marketingChildren.length > 0 ? [{
      title: "Marketing",
      icon: Megaphone,
      color: "bg-pink-500",
      children: marketingChildren,
    } as NavItem] : []),
    ...(tiChildren.length > 0 ? [{
      title: "TI",
      icon: Monitor,
      color: "bg-blue-500",
      children: tiChildren,
    } as NavItem] : []),
  ];

  const [expandedItems, setExpandedItems] = useState<string[]>(["Marketing", "TI"]);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url, full_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [user]);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]
    );
  };

  const isActive = (href: string) => location.pathname === href;
  const isParentActive = (children?: { href: string }[]) =>
    children?.some((child) => location.pathname === child.href);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const roleLabel = isAdmin ? "Admin" : roles.includes("ti") ? "TI" : roles.includes("marketing") ? "Marketing" : "Colaborador";

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Monitor className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-bold text-foreground tracking-tight">Nexus ERP</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-2 scrollbar-thin">
        {navigation.map((item) => (
          <div key={item.title}>
            {item.href ? (
              item.title === "Chat" ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileOpen(false);
                    window.dispatchEvent(new CustomEvent("nexus:open-chat"));
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors relative",
                    "text-sidebar-foreground hover:bg-muted"
                  )}
                >
                  <span className="relative flex items-center justify-center">
                    <item.icon className="h-4 w-4" />
                    {totalUnreadChat > 0 && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar" />
                    )}
                  </span>
                  {item.title}
                  {totalUnreadChat > 0 && (
                    <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px] font-bold">
                      {totalUnreadChat > 99 ? "99+" : totalUnreadChat}
                    </Badge>
                  )}
                </button>
              ) : (
                <Link
                  to={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-sidebar-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              )
            ) : (
              <>
                <button
                  onClick={() => toggleExpanded(item.title)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isParentActive(item.children)
                      ? "text-foreground"
                      : "text-sidebar-foreground hover:bg-muted"
                  )}
                >
                  {item.color ? (
                    <div className={cn("flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white", item.color)}>
                      {item.title.charAt(0)}
                    </div>
                  ) : (
                    <item.icon className="h-4 w-4" />
                  )}
                  {item.title}
                  <span className="ml-auto">
                    {expandedItems.includes(item.title) ? (
                      <ChevronDown className="h-3.5 w-3.5 text-sidebar-muted" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-sidebar-muted" />
                    )}
                  </span>
                </button>
                {expandedItems.includes(item.title) && item.children && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                          isActive(child.href)
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-sidebar-muted hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {child.title}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
          <UserAvatar
            name={userName}
            avatarUrl={avatarUrl}
            className="h-7 w-7"
            fallbackClassName="bg-primary/10 text-primary text-xs"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{userName}</p>
            <p className="text-[11px] text-sidebar-muted">{roleLabel}</p>
          </div>
        </div>
        <div className="mt-1 flex gap-1">
          <Link
            to="/configuracoes"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-sidebar-muted transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
            Config
          </Link>
          <button
            onClick={handleSignOut}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-sidebar-muted transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-3 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-60 transition-transform lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
