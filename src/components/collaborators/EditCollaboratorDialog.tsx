import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  currentCargo: string;
  currentDepartamento: string;
  currentGestor: string;
  onSaved: (newName: string) => void;
}

export function EditCollaboratorDialog({
  open, onOpenChange, currentName, currentCargo, currentDepartamento, currentGestor, onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState(currentName);
  const [cargo, setCargo] = useState(currentCargo);
  const [departamento, setDepartamento] = useState(currentDepartamento);
  const [gestor, setGestor] = useState(currentGestor);

  useEffect(() => {
    if (open) {
      setNome(currentName);
      setCargo(currentCargo);
      setDepartamento(currentDepartamento);
      setGestor(currentGestor);
    }
  }, [open, currentName, currentCargo, currentDepartamento, currentGestor]);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome do colaborador é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (nome.trim() !== currentName) updates.collaborator = nome.trim();
      if (cargo.trim() !== currentCargo) updates.cargo = cargo.trim() || null;
      if (departamento.trim() !== currentDepartamento) updates.sector = departamento.trim() || null;
      if (gestor.trim() !== currentGestor) updates.gestor = gestor.trim() || null;

      // Update all inventory records for this collaborator
      const { error } = await supabase
        .from("inventory")
        .update(updates)
        .eq("collaborator", currentName);

      if (error) throw error;

      toast.success("Dados do colaborador atualizados");
      onOpenChange(false);
      onSaved(nome.trim());
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar colaborador");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Colaborador</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Analista" />
            </div>
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Input value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder="Ex: TI" />
            </div>
            <div className="space-y-1.5">
              <Label>Gestor</Label>
              <Input value={gestor} onChange={(e) => setGestor(e.target.value)} placeholder="Nome do gestor" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !nome.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
