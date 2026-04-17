import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth, UserPermissions } from "@/hooks/use-auth";
import Dashboard from "./pages/Dashboard";

import Solicitacoes from "./pages/marketing/Solicitacoes";
import Metas from "./pages/marketing/Metas";
import Eventos from "./pages/marketing/Eventos";
import ServiceDesk from "./pages/ti/ServiceDesk";
import Colaboradores from "./pages/ti/Colaboradores";
import CentralInteligencia from "./pages/CentralInteligencia";
import ChamadoPublico from "./pages/ti/ChamadoPublico";
import SolicitacaoPublica from "./pages/marketing/SolicitacaoPublica";
import EventoPublico from "./pages/marketing/EventoPublico";
import EventosPublico from "./pages/marketing/EventosPublico";
import Configuracoes from "./pages/Configuracoes";
import GestaoFaturas from "./pages/ti/GestaoFaturas";
import CofreSenhas from "./pages/ti/CofreSenhas";

import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import { ChatFloatingButton } from "@/components/chat/ChatFloatingButton";
import { useChatNotifier } from "@/hooks/use-chat-notifier";
import { usePresence } from "@/hooks/use-chat";


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
}: {
  children: React.ReactNode;
  permission: keyof UserPermissions;
}) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function GlobalChatLayer() {
  // Initializes presence + notification side effects globally
  const { user } = useAuth();
  useChatNotifier();
  usePresence();
  if (!user) return null;
  return <ChatFloatingButton />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/chamado-publico" element={<ChamadoPublico />} />
        <Route path="/solicitacao-marketing" element={<SolicitacaoPublica />} />
        <Route path="/evento-publico" element={<EventoPublico />} />
        <Route path="/eventos-publico" element={<EventosPublico />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={loading ? <LoadingScreen /> : user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={loading ? <LoadingScreen /> : user ? <Navigate to="/" replace /> : <Signup />} />

        {/* Protected routes */}
        {loading ? (
          <Route path="*" element={<LoadingScreen />} />
        ) : (
          <>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/chat" element={<Navigate to="/" replace />} />

            <Route path="/marketing/solicitacoes" element={
              <PermissionRoute permission="ver_solicitacoes_marketing"><Solicitacoes /></PermissionRoute>
            } />
            <Route path="/marketing/metas" element={
              <PermissionRoute permission="ver_metas_marketing"><Metas /></PermissionRoute>
            } />
            <Route path="/marketing/eventos" element={
              <PermissionRoute permission="ver_eventos_marketing"><Eventos /></PermissionRoute>
            } />
            <Route path="/ti/service-desk" element={
              <PermissionRoute permission="ver_service_desk"><ServiceDesk /></PermissionRoute>
            } />
            <Route path="/ti/ativos" element={<Navigate to="/ti/colaboradores" replace />} />
            <Route path="/ti/colaboradores" element={
              <PermissionRoute permission="ver_colaboradores"><Colaboradores /></PermissionRoute>
            } />
            <Route path="/ti/faturas" element={
              <PermissionRoute permission="ver_gestao_custos"><GestaoFaturas /></PermissionRoute>
            } />
            <Route path="/ti/cofre-senhas" element={
              <PermissionRoute permission="ver_cofre_senhas"><CofreSenhas /></PermissionRoute>
            } />
            <Route path="/central-inteligencia" element={
              <PermissionRoute permission="ver_central_inteligencia"><CentralInteligencia /></PermissionRoute>
            } />

            <Route path="/ti/dashboard" element={<Navigate to="/central-inteligencia" replace />} />
            <Route path="/ti/financeiro" element={<Navigate to="/central-inteligencia" replace />} />

            <Route path="*" element={<NotFound />} />
          </>
        )}
      </Routes>
      <GlobalChatLayer />
    </>
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
