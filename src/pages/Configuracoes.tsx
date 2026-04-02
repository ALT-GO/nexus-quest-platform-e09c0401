import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { useAuth, AppRole } from "@/hooks/use-auth";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { UserManagementTab } from "@/components/settings/UserManagementTab";
import { StatusManagerTab } from "@/components/settings/StatusManagerTab";
import { AutomationsTab } from "@/components/settings/AutomationsTab";
import { MarketingWorkflowTab } from "@/components/settings/MarketingWorkflowTab";
import { TaskTypesManagerTab } from "@/components/settings/TaskTypesManagerTab";
import { CsvImportTab } from "@/components/settings/CsvImportTab";
import { TicketImportTab } from "@/components/settings/TicketImportTab";
import { MarketingImportTab } from "@/components/settings/MarketingImportTab";
import { IntegrityAuditorTab } from "@/components/settings/IntegrityAuditorTab";
import { DangerZoneTab } from "@/components/settings/DangerZoneTab";
import { SlaSettingsSection } from "@/components/settings/SlaSettingsSection";
import { AuditLogSection } from "@/components/settings/AuditLogSection";
import {
  User, Users, Upload,
  ListChecks, Zap, Clock, Shapes, ScrollText, Search, AlertTriangle, Megaphone, FileSpreadsheet,
} from "lucide-react";

type Section =
  | "profile"
  | "team"
  | "sd-status"
  | "sd-sla"
  | "sd-automations"
  | "mkt-workflow"
  | "mkt-types"
  | "import-assets"
  | "import-tickets"
  | "import-marketing"
  | "audit-log"
  | "integrity"
  | "danger";

interface NavItem {
  id: Section;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  roles?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Geral",
    items: [
      { id: "profile", label: "Meu Perfil", icon: User },
      { id: "team", label: "Gestão de Equipe", icon: Users, adminOnly: true },
    ],
  },
  {
    title: "Service Desk",
    items: [
      { id: "sd-status", label: "Status dos Chamados", icon: ListChecks, roles: ["admin", "ti"] },
      { id: "sd-sla", label: "Horário & SLA", icon: Clock, roles: ["admin", "ti"] },
      { id: "sd-automations", label: "Automações", icon: Zap, roles: ["admin", "ti"] },
    ],
  },
  {
    title: "Marketing",
    items: [
      { id: "mkt-workflow", label: "Etapas do Workflow", icon: Megaphone, roles: ["admin", "marketing"] },
      { id: "mkt-types", label: "Tipos de Tarefa", icon: Shapes, roles: ["admin", "marketing"] },
    ],
  },
  {
    title: "Dados",
    items: [
      { id: "import-assets", label: "Importar Ativos", icon: Upload, roles: ["admin", "ti"] },
      { id: "import-tickets", label: "Importar Chamados", icon: Upload, roles: ["admin", "ti"] },
    ],
  },
  {
    title: "Avançado",
    items: [
      { id: "audit-log", label: "Logs de Auditoria", icon: ScrollText, adminOnly: true },
      { id: "integrity", label: "Auditoria de Integridade", icon: Search, adminOnly: true },
      { id: "danger", label: "Zona de Perigo", icon: AlertTriangle, adminOnly: true },
    ],
  },
];

export default function Configuracoes() {
  const { isAdmin, hasRole } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>("profile");

  const isVisible = (item: NavItem) => {
    if (item.adminOnly) return isAdmin;
    if (item.roles) return item.roles.some((r) => r === "admin" ? isAdmin : hasRole(r as AppRole));
    return true;
  };

  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter(isVisible) }))
    .filter((g) => g.items.length > 0);

  // Ensure activeSection is valid
  const allVisibleIds = visibleGroups.flatMap((g) => g.items.map((i) => i.id));
  const currentSection = allVisibleIds.includes(activeSection) ? activeSection : allVisibleIds[0] || "profile";

  return (
    <AppLayout>
      <PageHeader title="Configurações" description="Gerencie as configurações do sistema" />

      <div className="flex gap-6 min-h-[600px]">
        {/* Sidebar */}
        <nav className="w-56 shrink-0 space-y-5 hidden md:block">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-3">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = currentSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        item.id === "danger" && "text-destructive hover:text-destructive"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", item.id === "danger" && !active && "text-destructive")} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Mobile select */}
        <div className="md:hidden w-full mb-4">
          <select
            value={currentSection}
            onChange={(e) => setActiveSection(e.target.value as Section)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {visibleGroups.map((g) =>
              g.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {g.title} — {item.label}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {currentSection === "profile" && <ProfileTab />}
          {currentSection === "team" && <UserManagementTab />}
          {currentSection === "sd-status" && <StatusManagerTab />}
          {currentSection === "sd-sla" && <SlaSettingsSection />}
          {currentSection === "sd-automations" && <AutomationsTab />}
          {currentSection === "mkt-workflow" && <MarketingWorkflowTab />}
          {currentSection === "mkt-types" && <TaskTypesManagerTab />}
          {currentSection === "import-assets" && <CsvImportTab />}
          {currentSection === "import-tickets" && <TicketImportTab />}
          {currentSection === "audit-log" && <AuditLogSection />}
          {currentSection === "integrity" && <IntegrityAuditorTab />}
          {currentSection === "danger" && <DangerZoneTab />}
        </div>
      </div>
    </AppLayout>
  );
}
