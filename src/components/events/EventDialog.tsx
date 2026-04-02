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
import { MarketingEvent, useCreateEvent, useUpdateEvent } from "@/hooks/use-events";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: MarketingEvent | null;
}

export function EventDialog({ open, onOpenChange, event }: Props) {
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const isEdit = !!event;

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [budget, setBudget] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("planning");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (event) {
      setName(event.name);
      setLocation(event.location || "");
      setStartDate(new Date(event.start_date));
      setEndDate(new Date(event.end_date));
      setBudget(event.budget > 0 ? String(event.budget) : "");
      setPriority(event.priority);
      setStatus(event.status);
      setNotes(event.notes || "");
    } else {
      setName(""); setLocation(""); setStartDate(undefined); setEndDate(undefined);
      setBudget(""); setPriority("medium"); setStatus("planning"); setNotes("");
    }
  }, [event, open]);

  const handleSubmit = () => {
    if (!name.trim() || !startDate || !endDate) return;

    const payload = {
      name: name.trim(),
      location,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      budget: parseFloat(budget) || 0,
      priority,
      status,
      notes,
      checklist: event?.checklist ?? [],
    };

    if (isEdit) {
      updateEvent.mutate({ id: event.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createEvent.mutate(payload as any, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Evento" : "Novo Evento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nome do Evento *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Evento de lançamento" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Local</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: São Paulo - SP" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data de Início *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data de Término *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planejamento</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações sobre o evento..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !startDate || !endDate}>
            {isEdit ? "Salvar" : "Criar Evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
