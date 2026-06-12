import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

interface QueueRow {
  id: string;
  user_id: string;
  full_name: string;
  position: number;
  is_active: boolean;
  last_assigned_at: string | null;
}

interface EligibleUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function AssignmentQueueSection() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [eligible, setEligible] = useState<EligibleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [queueRes, tiRes, adminRes] = await Promise.all([
      supabase
        .from("ticket_assignment_queue" as any)
        .select("*")
        .order("position", { ascending: true }),
      supabase.rpc("get_profiles_by_role", { _role: "ti" as any }),
      supabase.rpc("get_profiles_by_role", { _role: "admin" as any }),
    ]);
    if (queueRes.error) {
      console.error(queueRes.error);
      toast.error("Erro ao carregar fila");
    } else {
      setRows((queueRes.data as any) || []);
    }
    const merged: Record<string, EligibleUser> = {};
    for (const p of [...(tiRes.data || []), ...(adminRes.data || [])] as any[]) {
      if (p?.id) merged[p.id] = { id: p.id, full_name: p.full_name || "", avatar_url: p.avatar_url };
    }
    setEligible(Object.values(merged).sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const availableToAdd = eligible.filter((u) => !rows.some((r) => r.user_id === u.id));

  const handleAdd = async () => {
    if (!selectedToAdd) return;
    const user = eligible.find((u) => u.id === selectedToAdd);
    if (!user) return;
    setAdding(true);
    const maxPos = rows.reduce((m, r) => Math.max(m, r.position), -1);
    const { error } = await supabase.from("ticket_assignment_queue" as any).insert({
      user_id: user.id,
      full_name: user.full_name,
      position: maxPos + 1,
      is_active: true,
    } as any);
    setAdding(false);
    if (error) {
      toast.error("Erro ao adicionar à fila");
      console.error(error);
      return;
    }
    setSelectedToAdd("");
    toast.success(`${user.full_name} adicionado(a) à fila`);
    load();
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("ticket_assignment_queue" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Usuário removido da fila");
  };

  const handleToggle = async (row: QueueRow, active: boolean) => {
    const { error } = await supabase
      .from("ticket_assignment_queue" as any)
      .update({ is_active: active } as any)
      .eq("id", row.id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: active } : r)));
  };

  const swap = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index];
    const b = rows[target];
    const newRows = [...rows];
    newRows[index] = { ...b, position: a.position };
    newRows[target] = { ...a, position: b.position };
    setRows(newRows);
    const { error: e1 } = await supabase
      .from("ticket_assignment_queue" as any)
      .update({ position: b.position } as any)
      .eq("id", a.id);
    const { error: e2 } = await supabase
      .from("ticket_assignment_queue" as any)
      .update({ position: a.position } as any)
      .eq("id", b.id);
    if (e1 || e2) {
      toast.error("Erro ao reordenar");
      load();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-primary" />
          Fila de Atribuição de Chamados
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Quando a fila tem usuários ativos, novos chamados são distribuídos automaticamente em rodízio entre eles
          (sempre quem foi atribuído há mais tempo recebe o próximo). Se a fila estiver vazia, o sistema volta a usar
          o balanceamento por carga entre todos os usuários de TI/Admin.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedToAdd} onValueChange={setSelectedToAdd}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder={availableToAdd.length ? "Adicionar usuário à fila" : "Todos já estão na fila"} />
            </SelectTrigger>
            <SelectContent>
              {availableToAdd.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={!selectedToAdd || adding} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            Nenhum usuário na fila. Adicione pessoas para iniciar o rodízio automático.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => {
              const profile = eligible.find((e) => e.id === row.user_id);
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <UserAvatar
                    name={row.full_name}
                    avatarUrl={profile?.avatar_url}
                    userId={row.user_id}
                    className="h-8 w-8"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{row.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.last_assigned_at
                        ? `Último chamado: ${new Date(row.last_assigned_at).toLocaleString("pt-BR")}`
                        : "Ainda não recebeu chamados"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === 0}
                      onClick={() => swap(index, -1)}
                      title="Mover para cima"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === rows.length - 1}
                      onClick={() => swap(index, 1)}
                      title="Mover para baixo"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={(v) => handleToggle(row, v)}
                    title={row.is_active ? "Ativo na fila" : "Pausado"}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
