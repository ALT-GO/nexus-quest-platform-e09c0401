import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { TeamManagementTab } from "@/components/settings/TeamManagementTab";
import { SystemPreferencesTab } from "@/components/settings/SystemPreferencesTab";
import { CsvImportTab } from "@/components/settings/CsvImportTab";
import { TicketImportTab } from "@/components/settings/TicketImportTab";
import { MarketingWorkflowTab } from "@/components/settings/MarketingWorkflowTab";
import { useAuth } from "@/hooks/use-auth";
import { User, Users, Settings, Upload, Workflow } from "lucide-react";

export default function Configuracoes() {
  const { isAdmin, hasRole } = useAuth();
  const canImport = isAdmin || hasRole("ti");
  const canManageMarketing = isAdmin || hasRole("marketing");

  return (
    <AppLayout>
      <PageHeader
        title="Configurações"
        description="Gerencie as configurações do sistema"
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Meu Perfil
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Gestão de Equipe
            </TabsTrigger>
          )}
          <TabsTrigger value="preferences" className="gap-2">
            <Settings className="h-4 w-4" />
            Preferências do Sistema
          </TabsTrigger>
          {canImport && (
            <TabsTrigger value="imports" className="gap-2">
              <Upload className="h-4 w-4" />
              Importações
            </TabsTrigger>
          )}
          {canManageMarketing && (
            <TabsTrigger value="marketing-workflow" className="gap-2">
              <Workflow className="h-4 w-4" />
              Workflow de Marketing
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="team">
            <TeamManagementTab />
          </TabsContent>
        )}

        <TabsContent value="preferences">
          <SystemPreferencesTab />
        </TabsContent>

        {canImport && (
          <TabsContent value="imports" className="space-y-6">
            <CsvImportTab />
            <TicketImportTab />
          </TabsContent>
        )}

        {canManageMarketing && (
          <TabsContent value="marketing-workflow">
            <MarketingWorkflowTab />
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
