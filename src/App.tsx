import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, UserPermissions } from "@/hooks/use-auth";
import Dashboard from "./pages/Dashboard";

import Solicitacoes from "./pages/marketing/Solicitacoes";
import Metas from "./pages/marketing/Metas";
import Eventos from "./pages/marketing/Eventos";
import ServiceDesk from "./pages/ti/ServiceDesk";
import Colaboradores from "./pages/ti/Colaboradores";
import CentralInteligencia from "./pages/CentralInteligencia";
import ChamadoPublico from "./pages/ti/ChamadoPublico";
import Configuracoes from "./pages/Configuracoes";
import GestaoFaturas from "./pages/ti/GestaoFaturas";
import CofreSenhas from "./pages/ti/CofreSenhas";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";


const queryClient = new QueryClient();

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PermissionRoute({
  children,
  permission,
  fallbackRoles,
}: {
  children: React.ReactNode;
  permission: keyof UserPermissions;
  fallbackRoles?: string[];
}) {
  const { user, loading, hasPermission, roles, isAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  const hasAccess =
    isAdmin ||
    hasPermission(permission) ||
    (fallbackRoles && fallbackRoles.some((r) => roles.includes(r as any)));

  if (!hasAccess) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      {/* Public routes — never blocked by loading */}
      <Route path="/chamado-publico" element={<ChamadoPublico />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/login" element={loading ? <LoadingScreen /> : user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={loading ? <LoadingScreen /> : user ? <Navigate to="/" replace /> : <Signup />} />

      {/* Protected routes — wait for auth */}
      {loading ? (
        <Route path="*" element={<LoadingScreen />} />
      ) : (
        <>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />

          <Route path="/marketing/solicitacoes" element={
            <PermissionRoute permission="acessar_kanban_marketing" fallbackRoles={["admin", "marketing"]}>
              <Solicitacoes />
            </PermissionRoute>
          } />
          <Route path="/marketing/metas" element={
            <PermissionRoute permission="acessar_kanban_marketing" fallbackRoles={["admin", "marketing"]}>
              <Metas />
            </PermissionRoute>
          } />
          <Route path="/ti/service-desk" element={
            <PermissionRoute permission="criar_chamados" fallbackRoles={["admin", "ti"]}>
              <ServiceDesk />
            </PermissionRoute>
          } />
          <Route path="/ti/ativos" element={<Navigate to="/ti/colaboradores" replace />} />
          <Route path="/ti/colaboradores" element={
            <PermissionRoute permission="gerenciar_estoque" fallbackRoles={["admin", "ti"]}>
              <Colaboradores />
            </PermissionRoute>
          } />
          <Route path="/ti/faturas" element={
            <PermissionRoute permission="ver_custos_faturas" fallbackRoles={["admin", "ti"]}>
              <GestaoFaturas />
            </PermissionRoute>
          } />
          <Route path="/ti/cofre-senhas" element={
            <PermissionRoute permission="acessar_cofre_senhas" fallbackRoles={["admin", "ti"]}>
              <CofreSenhas />
            </PermissionRoute>
          } />
          <Route path="/central-inteligencia" element={
            <PermissionRoute permission="ver_dashboard_financeiro" fallbackRoles={["admin", "ti"]}>
              <CentralInteligencia />
            </PermissionRoute>
          } />

          <Route path="/ti/dashboard" element={<Navigate to="/central-inteligencia" replace />} />
          <Route path="/ti/financeiro" element={<Navigate to="/central-inteligencia" replace />} />

          <Route path="*" element={<NotFound />} />
        </>
      )}
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
