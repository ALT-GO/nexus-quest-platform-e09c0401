import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/hooks/use-auth";
import { CollaboratorDashboard } from "@/components/dashboard/CollaboratorDashboard";

export default function Dashboard() {
  const { isAdmin, roles, hasPermission } = useAuth();
  const isPrivileged = isAdmin || roles.includes("ti") || roles.includes("marketing");

  // Only redirect if user actually has permission to see central-inteligencia
  if (isPrivileged && hasPermission("ver_central_inteligencia")) {
    return <Navigate to="/central-inteligencia" replace />;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        description="Sua visão pessoal"
      />
      <CollaboratorDashboard />
    </AppLayout>
  );
}
