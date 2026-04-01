import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MarketingSprint,
  useCreateSprint,
  useUpdateSprint,
} from "@/hooks/use-sprints";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint?: MarketingSprint | null;
}

export function SprintDialog({ open, onOpenChange, sprint }: Props) {
  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();
  const isEditing = !!sprint;

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 14));
  const [status, setStatus] = useState<string>("planning");
  const [pointsGoal, setPointsGoal] = useState(0);

  useEffect(() => {
    if (sprint) {
      setName(sprint.name);
      setStartDate(new Date(sprint.start_date));
      setEndDate(new Date(sprint.end_date));
      setStatus(sprint.status);
      setPointsGoal(sprint.sprint_points_goal);
    } else {
      setName("");
      setStartDate(new Date());
      setEndDate(addDays(new Date(), 14));
      setStatus("planning");
      setPointsGoal(0);
    }
  }, [sprint, open]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      status,
      sprint_points_goal: pointsGoal,
    };

    if (isEditing) {
      updateSprint.mutate({ id: sprint.id, ...payload } as any, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      createSprint.mutate(payload as any, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Sprint" : "Nova Sprint"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {format(startDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                    locale={ptBR}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {format(endDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => d && setEndDate(d)}
                    locale={ptBR}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planejamento</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Meta de Pontos</Label>
              <Input
                type="number"
                min={0}
                value={pointsGoal || ""}
                onChange={(e) => setPointsGoal(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {isEditing ? "Salvar" : "Criar Sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
