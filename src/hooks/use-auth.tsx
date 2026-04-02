import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "ti" | "marketing" | "colaborador";

export interface UserPermissions {
  // Pages - TI
  ver_dashboard: boolean;
  ver_central_inteligencia: boolean;
  ver_service_desk: boolean;
  ver_colaboradores: boolean;
  ver_gestao_custos: boolean;
  ver_cofre_senhas: boolean;
  // Pages - Marketing
  ver_solicitacoes_marketing: boolean;
  ver_eventos_marketing: boolean;
  ver_metas_marketing: boolean;
  // Actions - TI
  criar_chamados: boolean;
  atender_chamados: boolean;
  gerenciar_estoque: boolean;
  // Actions - Financeiro
  ver_custos_faturas: boolean;
  ver_dashboard_financeiro: boolean;
  // Actions - Marketing
  acessar_kanban_marketing: boolean;
  // Actions - Segurança
  acessar_cofre_senhas: boolean;
  acesso_admin_global: boolean;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  ver_dashboard: true,
  ver_central_inteligencia: false,
  ver_service_desk: true,
  ver_colaboradores: false,
  ver_gestao_custos: false,
  ver_cofre_senhas: false,
  ver_solicitacoes_marketing: false,
  ver_eventos_marketing: false,
  ver_metas_marketing: false,
  criar_chamados: true,
  atender_chamados: false,
  gerenciar_estoque: false,
  ver_custos_faturas: false,
  ver_dashboard_financeiro: false,
  acessar_kanban_marketing: false,
  acessar_cofre_senhas: false,
  acesso_admin_global: false,
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  permissions: UserPermissions;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasPermission: (key: keyof UserPermissions) => boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  roles: [],
  permissions: DEFAULT_PERMISSIONS,
  loading: true,
  hasRole: () => false,
  hasPermission: () => false,
  isAdmin: false,
  signOut: async () => {},
  refreshPermissions: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_roles");
    if (!error && data) {
      setRoles(data as AppRole[]);
    } else {
      setRoles([]);
    }
  }, []);

  const fetchPermissions = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("permissions")
      .eq("id", userId)
      .single();
    if (!error && data?.permissions) {
      setPermissions({ ...DEFAULT_PERMISSIONS, ...(data.permissions as Record<string, boolean>) });
    } else {
      setPermissions(DEFAULT_PERMISSIONS);
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (user) {
      await fetchPermissions(user.id);
    }
  }, [user, fetchPermissions]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchRoles();
            fetchPermissions(session.user.id);
          }, 0);
        } else {
          setRoles([]);
          setPermissions(DEFAULT_PERMISSIONS);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoles();
        fetchPermissions(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles, fetchPermissions]);

  const hasRole = useCallback(
    (role: AppRole) => roles.includes(role),
    [roles]
  );

  const isAdmin = roles.includes("admin");

  const hasPermission = useCallback(
    (key: keyof UserPermissions) => {
      if (isAdmin || permissions.acesso_admin_global) return true;
      return !!permissions[key];
    },
    [permissions, isAdmin]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
    setPermissions(DEFAULT_PERMISSIONS);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, session, roles, permissions, loading,
      hasRole, hasPermission, isAdmin, signOut, refreshPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
