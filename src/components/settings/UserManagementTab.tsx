import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, UserPermissions, DEFAULT_PERMISSIONS, AppRole } from "@/hooks/use-auth";
import { logAuditEvent } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  UserPlus,
  Copy,
  Check,
  Users,
  Clock,
  Shield,
  Pencil,
  Search,
  Trash2,
  UserCog,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

interface UserWithRole {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  avatar_url: string | null;
  permissions: UserPermissions;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  accepted_at: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  ti: "Técnico TI",
  marketing: "Marketing",
  colaborador: "Colaborador",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "destructive",
  ti: "default",
  marketing: "secondary",
  colaborador: "outline",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Acesso total ao sistema, pode gerenciar equipes e configurações",
  ti: "Acesso ao Service Desk, gestão de ativos e módulos de TI",
  marketing: "Acesso ao Kanban, eventos, metas e módulos de marketing",
  colaborador: "Acesso básico para abrir chamados e visualizar informações",
};

interface PermissionCategory {
  label: string;
  description: string;
  keys: { key: keyof UserPermissions; label: string; description: string }[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    label: "Service Desk (TI)",
    description: "Permissões relacionadas ao módulo de chamados e suporte técnico",
    keys: [
      { key: "criar_chamados", label: "Criar Chamados", description: "Permite abrir novos chamados de suporte" },
      { key: "atender_chamados", label: "Atender Chamados", description: "Permite assumir e resolver chamados como analista" },
    ],
  },
  {
    label: "Inventário & Ativos",
    description: "Permissões de gestão de equipamentos e estoque",
    keys: [
      { key: "gerenciar_estoque", label: "Gerenciar Estoque", description: "Permite criar, editar e mover ativos entre colaboradores" },
    ],
  },
  {
    label: "Financeiro",
    description: "Permissões de visualização de dados financeiros",
    keys: [
      { key: "ver_custos_faturas", label: "Ver Custos e Faturas", description: "Permite visualizar custos de ativos e faturas" },
      { key: "ver_dashboard_financeiro", label: "Dashboard Financeiro", description: "Acesso à central de inteligência e indicadores financeiros" },
    ],
  },
  {
    label: "Marketing",
    description: "Permissões do módulo de marketing e eventos",
    keys: [
      { key: "acessar_kanban_marketing", label: "Kanban de Marketing", description: "Permite visualizar e gerenciar tarefas no Kanban" },
    ],
  },
  {
    label: "Segurança & Admin",
    description: "Permissões de alto nível e segurança",
    keys: [
      { key: "acessar_cofre_senhas", label: "Cofre de Senhas", description: "Permite acessar e gerenciar credenciais no cofre" },
      { key: "acesso_admin_global", label: "Acesso Admin Global", description: "Concede privilégios de administrador sem alterar a equipe" },
    ],
  },
];

export function UserManagementTab() {
  const { isAdmin, hasRole, user: currentUser } = useAuth();
  const canView = isAdmin || hasRole("ti");
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("colaborador");
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  // Permission editing
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editPerms, setEditPerms] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [editRole, setEditRole] = useState<AppRole>("colaborador");
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, permissions, avatar_url");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: emailRows } = await supabase.rpc("get_user_emails") as { data: { user_id: string; email: string }[] | null };

    const emailMap = new Map<string, string>();
    (emailRows || []).forEach((r) => emailMap.set(r.user_id, r.email));

    if (profiles && roles) {
      const roleMap = new Map<string, string>();
      roles.forEach((r) => roleMap.set(r.user_id, r.role));

      const userList: UserWithRole[] = profiles.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: emailMap.get(p.id) || "",
        role: (roleMap.get(p.id) || "colaborador") as AppRole,
        avatar_url: p.avatar_url ?? null,
        permissions: { ...DEFAULT_PERMISSIONS, ...((p as any).permissions as Record<string, boolean> || {}) },
      }));
      setUsers(userList);
    }

    const { data: inviteData } = await supabase
      .from("user_invites")
      .select("*")
      .order("created_at", { ascending: false });

    if (inviteData) setInvites(inviteData as Invite[]);
    setLoading(false);
  };

  useEffect(() => {
    if (canView) fetchData();
  }, [canView]);

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error("Informe o e-mail.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("user_invites").insert({
      email: inviteEmail.toLowerCase().trim(),
      role: inviteRole as any,
      invited_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "Este e-mail já possui um convite." : error.message);
      return;
    }
    toast.success("Convite criado com sucesso!");
    logAuditEvent({
      action: "Convite criado",
      entityType: "invite",
      details: `Convidou ${inviteEmail} como ${ROLE_LABELS[inviteRole]}`,
    });
    setInviteEmail("");
    setInviteRole("colaborador");
    setDialogOpen(false);
    fetchData();
  };

  const handleDeleteInvite = async (id: string, email: string) => {
    const { error } = await supabase.from("user_invites").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao revogar convite.");
      return;
    }
    toast.success("Convite revogado!");
    logAuditEvent({ action: "Convite revogado", entityType: "invite", details: `Revogou convite de ${email}` });
    fetchData();
  };

  const copyInviteLink = (email: string, id: string) => {
    const url = `${window.location.origin}/signup?email=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openPermEditor = (u: UserWithRole) => {
    setEditingUser(u);
    setEditPerms({ ...u.permissions });
    setEditRole(u.role);
    setPermDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    setSavingPerms(true);

    // Update permissions on profile
    const { error: permError } = await supabase
      .from("profiles")
      .update({ permissions: editPerms as any, updated_at: new Date().toISOString() })
      .eq("id", editingUser.id);

    if (permError) {
      toast.error("Erro ao salvar permissões.");
      setSavingPerms(false);
      return;
    }

    // Update role if changed (admin only)
    if (isAdmin && editRole !== editingUser.role) {
      // Delete old role
      await supabase.from("user_roles").delete().eq("user_id", editingUser.id);
      // Insert new role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: editingUser.id, role: editRole });

      if (roleError) {
        toast.error("Erro ao alterar equipe.");
        setSavingPerms(false);
        return;
      }

      logAuditEvent({
        action: "Alteração de equipe",
        entityType: "user",
        entityId: editingUser.id,
        details: `Alterou a equipe de "${editingUser.full_name}" de ${ROLE_LABELS[editingUser.role]} para ${ROLE_LABELS[editRole]}`,
      });
    }

    logAuditEvent({
      action: "Alteração de permissões",
      entityType: "user",
      entityId: editingUser.id,
      details: `Atualizou permissões de "${editingUser.full_name}"`,
    });

    toast.success("Configurações salvas!");
    setSavingPerms(false);
    setPermDialogOpen(false);
    fetchData();
  };

  const togglePerm = (key: keyof UserPermissions) => {
    setEditPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyRolePreset = (role: AppRole) => {
    const presets: Record<AppRole, UserPermissions> = {
      admin: {
        criar_chamados: true,
        atender_chamados: true,
        gerenciar_estoque: true,
        ver_custos_faturas: true,
        ver_dashboard_financeiro: true,
        acessar_kanban_marketing: true,
        acessar_cofre_senhas: true,
        acesso_admin_global: true,
      },
      ti: {
        criar_chamados: true,
        atender_chamados: true,
        gerenciar_estoque: true,
        ver_custos_faturas: true,
        ver_dashboard_financeiro: true,
        acessar_kanban_marketing: false,
        acessar_cofre_senhas: true,
        acesso_admin_global: false,
      },
      marketing: {
        criar_chamados: true,
        atender_chamados: false,
        gerenciar_estoque: false,
        ver_custos_faturas: false,
        ver_dashboard_financeiro: false,
        acessar_kanban_marketing: true,
        acessar_cofre_senhas: false,
        acesso_admin_global: false,
      },
      colaborador: { ...DEFAULT_PERMISSIONS },
    };
    setEditPerms(presets[role]);
  };

  // Filtering
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      !searchQuery ||
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const pendingInvites = invites.filter((i) => !i.accepted_at);

  // Stats
  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  if (!canView) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Apenas administradores e técnicos de TI podem visualizar a equipe.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["admin", "ti", "marketing", "colaborador"] as const).map((role) => (
          <Card
            key={role}
            className={`cursor-pointer transition-colors ${filterRole === role ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilterRole(filterRole === role ? "all" : role)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{roleCounts[role] || 0}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
                </div>
                <Badge variant={ROLE_COLORS[role] as any} className="text-[10px]">
                  {role.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Membros ({users.length})
          </TabsTrigger>
          <TabsTrigger value="invites" className="gap-2">
            <Mail className="h-4 w-4" />
            Convites ({pendingInvites.length})
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Equipe</CardTitle>
                  <CardDescription>Gerencie membros, equipes e permissões de acesso</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou e-mail..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {isAdmin && (
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-2 shrink-0">
                          <UserPlus className="h-4 w-4" />
                          Convidar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Convidar Novo Usuário</DialogTitle>
                          <DialogDescription>
                            O usuário receberá um link de cadastro vinculado à equipe selecionada.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="invite-email">E-mail *</Label>
                            <Input
                              id="invite-email"
                              type="email"
                              placeholder="usuario@empresa.com"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Equipe</Label>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="ti">Técnico TI</SelectItem>
                                <SelectItem value="marketing">Marketing</SelectItem>
                                <SelectItem value="colaborador">Colaborador</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {ROLE_DESCRIPTIONS[inviteRole]}
                            </p>
                          </div>
                          <Button onClick={handleInvite} disabled={saving} className="w-full">
                            {saving ? "Criando..." : "Criar Convite"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Membro</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead className="hidden md:table-cell">Permissões Ativas</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => {
                      const activePerms = Object.entries(u.permissions).filter(([, v]) => v).length;
                      const totalPerms = Object.keys(u.permissions).length;
                      const isSelf = u.id === currentUser?.id;

                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                name={u.full_name || "?"}
                                avatarUrl={u.avatar_url}
                                className="h-8 w-8"
                                fallbackClassName="bg-primary/10 text-primary text-xs"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {u.full_name || "Sem nome"}
                                  {isSelf && (
                                    <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ROLE_COLORS[u.role] as any}>
                              {ROLE_LABELS[u.role] || u.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 max-w-24 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${(activePerms / totalPerms) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{activePerms}/{totalPerms}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {isAdmin && !isSelf && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => openPermEditor(u)}
                              >
                                <UserCog className="h-3.5 w-3.5" />
                                Gerenciar
                              </Button>
                            )}
                            {isSelf && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Nenhum membro encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invites Tab */}
        <TabsContent value="invites" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Convites Pendentes</CardTitle>
                  <CardDescription>Convites aguardando aceite para ingressar no sistema</CardDescription>
                </div>
                {isAdmin && (
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <UserPlus className="h-4 w-4" />
                        Novo Convite
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Convidar Novo Usuário</DialogTitle>
                        <DialogDescription>
                          O usuário receberá um link de cadastro vinculado à equipe selecionada.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="invite-email-2">E-mail *</Label>
                          <Input
                            id="invite-email-2"
                            type="email"
                            placeholder="usuario@empresa.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Equipe</Label>
                          <Select value={inviteRole} onValueChange={setInviteRole}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="ti">Técnico TI</SelectItem>
                              <SelectItem value="marketing">Marketing</SelectItem>
                              <SelectItem value="colaborador">Colaborador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleInvite} disabled={saving} className="w-full">
                          {saving ? "Criando..." : "Criar Convite"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvites.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.email}</TableCell>
                        <TableCell>
                          <Badge variant={ROLE_COLORS[inv.role] as any}>
                            {ROLE_LABELS[inv.role] || inv.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => copyInviteLink(inv.email, inv.id)}
                            >
                              {copiedId === inv.id ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              Copiar
                            </Button>
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteInvite(inv.id, inv.email)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pendingInvites.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Nenhum convite pendente.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Permission & Role Editor Dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Gerenciar — {editingUser?.full_name || "Usuário"}
            </DialogTitle>
            <DialogDescription>
              Defina a equipe e as permissões de acesso deste membro
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Role / Team Section */}
            {isAdmin && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Equipe
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {(["admin", "ti", "marketing", "colaborador"] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => {
                        setEditRole(role);
                        applyRolePreset(role);
                      }}
                      className={`flex flex-col items-start rounded-lg border p-3 transition-colors text-left ${
                        editRole === role
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={ROLE_COLORS[role] as any} className="text-[10px]">
                          {ROLE_LABELS[role]}
                        </Badge>
                        {editRole === role && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">
                        {ROLE_DESCRIPTIONS[role]}
                      </p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao trocar a equipe, as permissões serão ajustadas para o padrão daquela equipe. Você pode personalizar abaixo.
                </p>
              </div>
            )}

            <Separator />

            {/* Permissions Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissões Detalhadas
              </h4>

              {PERMISSION_CATEGORIES.map((cat) => (
                <div key={cat.label} className="rounded-lg border p-4 space-y-3">
                  <div>
                    <h5 className="text-sm font-medium">{cat.label}</h5>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                  <div className="space-y-2.5">
                    {cat.keys.map(({ key, label, description }) => (
                      <div
                        key={key}
                        className="flex items-start justify-between gap-3 py-1"
                      >
                        <div className="space-y-0.5">
                          <Label htmlFor={key} className="cursor-pointer text-sm font-normal">
                            {label}
                          </Label>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            {description}
                          </p>
                        </div>
                        <Switch
                          id={key}
                          checked={editPerms[key]}
                          onCheckedChange={() => togglePerm(key)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleSavePermissions}
              disabled={savingPerms}
              className="w-full"
            >
              {savingPerms ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
