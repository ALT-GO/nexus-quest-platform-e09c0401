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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateGoal, useUpdateGoal, MarketingGoal } from "@/hooks/use-goals";

const TARGET_TYPES = [
  { value: "number", label: "Número" },
  { value: "percentage", label: "Porcentagem" },
  { value: "currency", label: "Monetário (R$)" },
  { value: "true_false", label: "Sim/Não" },
  { value: "task_completion", label: "Conclusão de tarefas" },
];

const STATUS_OPTIONS = [
  { value: "on_track", label: "No ritmo" },
  { value: "at_risk", label: "Em risco" },
  { value: "off_track", label: "Atrasado" },
  { value: "completed", label: "Concluído" },
];

const COLORS = [
  "221 83% 53%",
  "142 76% 36%",
  "38 92% 50%",
  "0 84% 60%",
  "280 67% 52%",
  "199 89% 48%",
  "326 78% 60%",
  "32 95% 44%",
];

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingGoal: MarketingGoal | null;
  existingFolders: string[];
}

export function GoalDialog({ open, onOpenChange, editingGoal, existingFolders }: GoalDialogProps) {
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState("number");
  const [targetValue, setTargetValue] = useState("100");
  const [currentValue, setCurrentValue] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("on_track");
  const [color, setColor] = useState(COLORS[0]);
  const [folder, setFolder] = useState("");
  const [newFolder, setNewFolder] = useState("");

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setDescription(editingGoal.description || "");
      setTargetType(editingGoal.target_type);
      setTargetValue(String(editingGoal.target_value));
      setCurrentValue(String(editingGoal.current_value));
      setDueDate(editingGoal.due_date ? editingGoal.due_date.split("T")[0] : "");
      setStatus(editingGoal.status);
      setColor(editingGoal.color);
      setFolder(editingGoal.folder || "");
      setNewFolder("");
    } else {
      setTitle(""); setDescription(""); setTargetType("number");
      setTargetValue("100"); setCurrentValue("0"); setDueDate("");
      setStatus("on_track"); setColor(COLORS[0]); setFolder(""); setNewFolder("");
    }
  }, [editingGoal, open]);

  const handleSave = () => {
    if (!title.trim()) return;
    const resolvedFolder = newFolder.trim() || folder;
    const payload = {
      title: title.trim(),
      description,
      target_type: targetType,
      target_value: parseFloat(targetValue) || 0,
      current_value: targetType === "task_completion" ? 0 : (parseFloat(currentValue) || 0),
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      status,
      color,
      folder: resolvedFolder,
    };

    if (editingGoal) {
      updateGoal.mutate({ id: editingGoal.id, ...payload });
    } else {
      createGoal.mutate(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Gerar 500 leads no Q1" />
          </div>

          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Detalhes da meta..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tipo de Target</Label>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {targetType !== "task_completion" && targetType !== "true_false" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor Atual</Label>
                <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Valor Alvo</Label>
                <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Prazo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Pasta</Label>
              {existingFolders.length > 0 ? (
                <Select value={folder} onValueChange={setFolder}>
                  <SelectTrigger><SelectValue placeholder="Selecionar pasta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem pasta</SelectItem>
                    {existingFolders.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Input
                placeholder="Ou criar nova pasta..."
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: `hsl(${c})` }}
                  onClick={() => setColor(c)}
                  type="button"
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            {editingGoal ? "Salvar" : "Criar Meta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
