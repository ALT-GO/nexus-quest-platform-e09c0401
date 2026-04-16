import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateChannel } from "@/hooks/use-chat";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (id: string) => void;
}

export function NewChannelDialog({ open, onOpenChange, onCreated }: Props) {
  const create = useCreateChannel();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"public" | "private">("public");

  const submit = async () => {
    const clean = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
    if (!clean) {
      toast.error("Nome inválido");
      return;
    }
    try {
      const c = await create.mutateAsync({ name: clean, description, type });
      toast.success("Canal criado");
      onCreated?.(c.id);
      setName("");
      setDescription("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar canal");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo canal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: projeto-x" />
            <p className="text-xs text-muted-foreground mt-1">Sem espaços, minúsculas, hífens permitidos.</p>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Para que serve este canal?"
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Público (todos os usuários)</SelectItem>
                <SelectItem value="private">Privado (somente membros convidados)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            Criar canal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
