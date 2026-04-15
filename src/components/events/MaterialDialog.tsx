import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MarketingMaterial, useCreateMaterial, useUpdateMaterial } from "@/hooks/use-materials";
import { MarketingEvent } from "@/hooks/use-events";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MarketingMaterial | null;
  events: MarketingEvent[];
}

export function MaterialDialog({ open, onOpenChange, material, events }: Props) {
  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial();
  const isEdit = !!material;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>();
  const [budget, setBudget] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("planning");
  const [notes, setNotes] = useState("");
  const [linkedEventId, setLinkedEventId] = useState<string>("none");

  useEffect(() => {
    if (material) {
      setName(material.name);
      setDescription(material.description || "");
      setPurchaseDate(material.purchase_date ? new Date(material.purchase_date) : undefined);
      setBudget(material.budget > 0 ? String(material.budget) : "");
      setPriority(material.priority);
      setStatus(material.status);
      setNotes(material.notes || "");
      setLinkedEventId(material.linked_event_id || "none");
    } else {
      setName(""); setDescription(""); setPurchaseDate(undefined);
      setBudget(""); setPriority("medium"); setStatus("planning"); setNotes("");
      setLinkedEventId("none");
    }
  }, [material, open]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      description,
      purchase_date: purchaseDate ? purchaseDate.toISOString() : null,
      budget: parseFloat(budget) || 0,
      priority,
      status,
      notes,
      linked_event_id: linkedEventId === "none" ? null : linkedEventId,
      checklist: material?.checklist ?? [],
    };

    if (isEdit) {
      updateMaterial.mutate({ id: material.id, ...payload } as any, { onSuccess: () => onOpenChange(false) });
    } else {
      createMaterial.mutate(payload as any, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Material" : "Novo Brinde / Material"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Brindes para evento X" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes do material..." rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data da Compra</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !purchaseDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {purchaseDate ? format(purchaseDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={purchaseDate} onSelect={setPurchaseDate} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Evento Vinculado</Label>
              <Select value={linkedEventId} onValueChange={setLinkedEventId}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {events.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Budget (R$)</Label>
              <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0,00" min="0" step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planejamento</SelectItem>
                  <SelectItem value="purchasing">Compra</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="distributed">Distribuído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {isEdit ? "Salvar" : "Criar Material"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
