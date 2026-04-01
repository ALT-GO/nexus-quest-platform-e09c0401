import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, UserPermissions, DEFAULT_PERMISSIONS } from "@/hooks/use-auth";
import { logAuditEvent } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { UserPlus, Copy, Check, Users, Clock, Shield, Pencil } from "lucide-react";
import { toast } from "sonner";

interface UserWithRole {
  id: string;
  full_name: string;
  email: string;
  role: string;
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

interface PermissionCategory {
  label: string;
  keys: { key: keyof UserPermissions; label: string }[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    label: "Módulo TI",
    keys: [
      { key: "criar_chamados", label: "Criar Chamados (Padrão)" },
      { key: "atender_chamados", label: "Atender Chamados (Analista)" },
      { key: "gerenciar_estoque", label: "Gerenciar Estoque (Edição)" },
    ],
  },
  {
    label: "Módulo Financeiro",
    keys: [
      { key: "ver_custos_faturas", label: "Ver Custos e Faturas" },
      { key: "ver_dashboard_financeiro", label: "Ver Dashboard Financeiro" },
    ],
  },
  {
    label: "Módulo Marketing",
    keys: [
      { key: "acessar_kanban_marketing", label: "Acessar Kanban de Marketing" },
    ],
  },
  {
    label: "Segurança",
    keys: [
      { key: "acessar_cofre_senhas", label: "Acessar Cofre de Senhas" },
      { key: "acesso_admin_global", label: "Acesso Administrador Global" },
    ],
  },
];

export function UserManagementTab() {
  const { isAdmin, hasRole } = useAuth();
  const canView = isAdmin || hasRole("ti");
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("colaborador");
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Permission editing
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editPerms, setEditPerms] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    const { data: profiles } = await supabase.from("profiles").select("id, full_name, permissions");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    // Fetch emails via SECURITY DEFINER function
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
        role: roleMap.get(p.id) || "colaborador",
        permissions: { ...DEFAULT_PERMISSIONS, ...((p as any).permissions as Record<string, boolean> || {}) },
      }));
      setUsers(userList);
    }

    const { data: inviteData } = await supabase
      .from("user_invites")
      .select("*")
      .order("created_at", { ascending: false });

    if (inviteData) {
      setInvites(inviteData as Invite[]);
    }

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

    const { data: inserted, error } = await supabase.from("user_invites").insert({
      email: inviteEmail.toLowerCase().trim(),
      role: inviteRole as any,
      invited_by: user?.id ?? null,
    }).select();
    setSaving(false);
    if (error || !inserted?.length) {
      if (error?.code === "23505") {
        toast.error("Este e-mail já possui um convite.");
      } else {
        toast.error(error?.message || "Erro ao criar convite. Verifique suas permissões.");
      }
      return;
    }
    toast.success("Convite criado com sucesso!");
    setInviteEmail("");
    setInviteRole("colaborador");
    setDialogOpen(false);
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
    setPermDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    setSavingPerms(true);
    const { error } = await supabase
      .from("profiles")
      .update({ permissions: editPerms as any, updated_at: new Date().toISOString() })
      .eq("id", editingUser.id);
    setSavingPerms(false);
    if (error) {
      toast.error("Erro ao salvar permissões");
    } else {
      toast.success("Permissões atualizadas!");
      logAuditEvent({
        action: "Alteração de permissões",
        entityType: "user",
        entityId: editingUser.id,
        details: `Alterou as permissões de "${editingUser.full_name}"`,
      });
      setPermDialogOpen(false);
      fetchData();
    }
  };

  const togglePerm = (key: keyof UserPermissions) => {
    setEditPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const pendingInvites = invites.filter((i) => !i.accepted_at);

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
      {/* Users List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários ({users.length})
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Convidar Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Novo Usuário</DialogTitle>
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
                  <Label>Nível de Acesso</Label>
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
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead className="text-right">Permissões</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_COLORS[u.role] as any}>
                      {ROLE_LABELS[u.role] || u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => openPermEditor(u)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar Acessos
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permission Editor Dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissões — {editingUser?.full_name || "Usuário"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            {PERMISSION_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">{cat.label}</h4>
                <div className="space-y-3">
                  {cat.keys.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label htmlFor={key} className="cursor-pointer font-normal">
                        {label}
                      </Label>
                      <Switch
                        id={key}
                        checked={editPerms[key]}
                        onCheckedChange={() => togglePerm(key)}
                      />
                    </div>
                  ))}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
            <Button
              onClick={handleSavePermissions}
              disabled={savingPerms}
              className="w-full"
            >
              {savingPerms ? "Salvando..." : "Salvar Permissões"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Invites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Convites Pendentes ({pendingInvites.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Nível</TableHead>
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
                      Copiar Link
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {pendingInvites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum convite pendente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
