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
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  children?: { title: string; href: string }[];
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, roles, hasPermission, signOut } = useAuth();

  const hasAnyRole = (...r: string[]) => r.some((role) => roles.includes(role as any));
  const isPrivileged = isAdmin || hasAnyRole("ti", "marketing");

  // Build TI children based on permissions
  const tiChildren: { title: string; href: string }[] = [];
  if (hasPermission("criar_chamados") || hasPermission("atender_chamados")) {
    tiChildren.push({ title: "Service Desk", href: "/ti/service-desk" });
  }
  if (hasPermission("gerenciar_estoque") || hasAnyRole("admin", "ti")) {
    tiChildren.push({ title: "Colaboradores", href: "/ti/colaboradores" });
  }
  if (hasPermission("ver_custos_faturas")) {
    tiChildren.push({ title: "Gestão de Custos", href: "/ti/faturas" });
  }
  if (hasPermission("acessar_cofre_senhas")) {
    tiChildren.push({ title: "Cofre de Senhas", href: "/ti/cofre-senhas" });
  }

  // Build marketing children
  const marketingChildren: { title: string; href: string }[] = [];
  if (hasPermission("acessar_kanban_marketing") || hasAnyRole("admin", "marketing")) {
    marketingChildren.push({ title: "Projetos", href: "/marketing/projetos" });
    marketingChildren.push({ title: "Solicitações", href: "/marketing/solicitacoes" });
    marketingChildren.push({ title: "Metas", href: "/marketing/metas" });
  }

  const navigation: NavItem[] = [
    // Collaborators see Dashboard; privileged users land on Torre de Controle
    ...(!isPrivileged ? [{
      title: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    } as NavItem] : []),
    // Torre de Controle visible for admin/ti or users with dashboard permission
    ...(hasAnyRole("admin", "ti") || hasPermission("ver_dashboard_financeiro") ? [{
      title: "Dashboard",
      href: "/central-inteligencia",
      icon: Brain,
    } as NavItem] : []),
    ...(marketingChildren.length > 0 ? [{
      title: "Marketing",
      icon: Megaphone,
      children: marketingChildren,
    } as NavItem] : []),
    ...(tiChildren.length > 0 ? [{
      title: "TI",
      icon: Monitor,
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
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Monitor className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-sidebar-foreground">ERP System</span>
          <span className="text-xs text-sidebar-muted">Marketing & TI</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4 scrollbar-thin">
        {navigation.map((item) => (
          <div key={item.title}>
            {item.href ? (
              <Link
                to={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </Link>
            ) : (
              <>
                <button
                  onClick={() => toggleExpanded(item.title)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isParentActive(item.children)
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.title}
                  <span className="ml-auto">
                    {expandedItems.includes(item.title) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>
                </button>
                {expandedItems.includes(item.title) && item.children && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-4">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          "flex items-center rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive(child.href)
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <UserAvatar
            name={userName}
            avatarUrl={avatarUrl}
            className="h-8 w-8"
            fallbackClassName="bg-sidebar-accent text-sidebar-foreground text-sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
            <p className="text-xs text-sidebar-muted">{roleLabel}</p>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <Link
            to="/configuracoes"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Settings className="h-4 w-4" />
            Config
          </Link>
          <button
            onClick={handleSignOut}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
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
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 transition-transform lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
