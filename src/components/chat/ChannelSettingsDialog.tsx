import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  ChatChannel,
  useChannelMembers,
  useUpdateChannel,
  useDeleteChannel,
  useArchiveChannel,
  useAllUsers,
  useAddChannelMember,
  useRemoveChannelMember,
  useUpdateMemberRole,
} from "@/hooks/use-chat";
import { Hash, Lock, Megaphone, Monitor, LifeBuoy, Users, MessageSquare, Trash2, Crown, UserMinus, UserPlus, Archive } from "lucide-react";
import { toast } from "sonner";

const ICON_OPTIONS = [
  { value: "hash", label: "Hash", Icon: Hash },
  { value: "lock", label: "Privado", Icon: Lock },
  { value: "megaphone", label: "Anúncios", Icon: Megaphone },
  { value: "monitor", label: "TI", Icon: Monitor },
  { value: "life-buoy", label: "Suporte", Icon: LifeBuoy },
  { value: "users", label: "Equipe", Icon: Users },
  { value: "message", label: "Mensagem", Icon: MessageSquare },
];

interface Props {
  channel: ChatChannel;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDeleted?: () => void;
}

export function ChannelSettingsDialog({ channel, open, onOpenChange, onDeleted }: Props) {
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description);
  const [icon, setIcon] = useState(channel.icon);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [search, setSearch] = useState("");

  const updateChannel = useUpdateChannel();
  const archiveChannel = useArchiveChannel();
  const deleteChannel = useDeleteChannel();
  const { data: members = [] } = useChannelMembers(channel.id);
  const { data: allUsers = [] } = useAllUsers();
  const addMember = useAddChannelMember();
  const removeMember = useRemoveChannelMember();
  const updateRole = useUpdateMemberRole();

  const memberMap = useMemo(() => {
    const m = new Map(members.map((mm) => [mm.user_id, mm]));
    return m;
  }, [members]);

  const memberList = useMemo(
    () =>
      members
        .map((m) => ({
          ...m,
          user: allUsers.find((u) => u.id === m.user_id),
        }))
        .filter((m) => m.user)
        .sort((a, b) => (a.user!.full_name || "").localeCompare(b.user!.full_name || "")),
    [members, allUsers]
  );

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers
      .filter((u) => !memberMap.has(u.id))
      .filter((u) => !q || (u.full_name || "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [allUsers, memberMap, search]);

  const saveDetails = async () => {
    const clean = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
    if (!clean) {
      toast.error("Nome inválido");
      return;
    }
    try {
      await updateChannel.mutateAsync({
        id: channel.id,
        updates: { name: clean, description, icon },
      });
      toast.success("Canal atualizado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    }
  };

  const handleArchive = async () => {
    try {
      await archiveChannel.mutateAsync(channel.id);
      toast.success("Canal arquivado");
      onOpenChange(false);
      onDeleted?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao arquivar");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteChannel.mutateAsync(channel.id);
      toast.success("Canal excluído");
      onOpenChange(false);
      onDeleted?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurações do canal #{channel.name}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="members">Membros ({members.length})</TabsTrigger>
              <TabsTrigger value="danger">Avançado</TabsTrigger>
            </TabsList>

            {/* GENERAL */}
            <TabsContent value="general" className="space-y-3 mt-4">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>Ícone</Label>
                <Select value={icon} onValueChange={setIcon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(({ value, label, Icon }) => (
                      <SelectItem key={value} value={value}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground">
                Tipo: <Badge variant="secondary">{channel.type}</Badge>
              </div>
              <DialogFooter>
                <Button onClick={saveDetails} disabled={updateChannel.isPending}>
                  Salvar alterações
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* MEMBERS */}
            <TabsContent value="members" className="space-y-4 mt-4">
              <div>
                <Label className="mb-1 block">Adicionar membros</Label>
                <Input
                  placeholder="Buscar usuários..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <ScrollArea className="h-40 mt-2 border rounded-md">
                    <div className="p-2 space-y-1">
                      {candidates.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2">Nenhum usuário encontrado.</p>
                      )}
                      {candidates.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-accent"
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} className="h-7 w-7" />
                            <span className="text-sm">{u.full_name || "Sem nome"}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await addMember.mutateAsync({ channelId: channel.id, userId: u.id });
                                toast.success(`${u.full_name} adicionado`);
                              } catch (e: any) {
                                toast.error(e.message || "Erro ao adicionar");
                              }
                            }}
                          >
                            <UserPlus className="h-4 w-4 mr-1" /> Adicionar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div>
                <Label className="mb-1 block">Membros atuais</Label>
                <ScrollArea className="h-72 border rounded-md">
                  <div className="p-2 space-y-1">
                    {memberList.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">Nenhum membro.</p>
                    )}
                    {memberList.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-accent"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar name={m.user!.full_name} avatarUrl={m.user!.avatar_url} className="h-7 w-7" />
                          <div className="min-w-0">
                            <p className="text-sm truncate">{m.user!.full_name || "Sem nome"}</p>
                            {m.role === "admin" && (
                              <Badge variant="secondary" className="text-[10px] h-4 mt-0.5">
                                <Crown className="h-3 w-3 mr-1" /> Admin do canal
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            title={m.role === "admin" ? "Rebaixar para membro" : "Promover a admin do canal"}
                            onClick={async () => {
                              try {
                                await updateRole.mutateAsync({
                                  channelId: channel.id,
                                  userId: m.user_id,
                                  role: m.role === "admin" ? "member" : "admin",
                                });
                                toast.success("Permissão atualizada");
                              } catch (e: any) {
                                toast.error(e.message || "Erro");
                              }
                            }}
                          >
                            <Crown className={m.role === "admin" ? "h-4 w-4 text-primary" : "h-4 w-4"} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={async () => {
                              try {
                                await removeMember.mutateAsync({ channelId: channel.id, userId: m.user_id });
                                toast.success("Membro removido");
                              } catch (e: any) {
                                toast.error(e.message || "Erro ao remover");
                              }
                            }}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* DANGER */}
            <TabsContent value="danger" className="space-y-4 mt-4">
              <div className="border rounded-md p-4 space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Archive className="h-4 w-4" /> Arquivar canal
                </h4>
                <p className="text-sm text-muted-foreground">
                  O canal será ocultado da lista, mas as mensagens são preservadas.
                </p>
                <Button variant="outline" onClick={handleArchive} disabled={archiveChannel.isPending}>
                  Arquivar
                </Button>
              </div>
              <div className="border border-destructive/30 rounded-md p-4 space-y-2">
                <h4 className="font-semibold flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" /> Excluir canal
                </h4>
                <p className="text-sm text-muted-foreground">
                  Remove o canal e todas as mensagens permanentemente. Esta ação não pode ser desfeita.
                </p>
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                  Excluir permanentemente
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir canal?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as mensagens e membros do canal #{channel.name} serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
