import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Save } from "lucide-react";
import { useSlaSettings } from "@/hooks/use-sla-settings";
import { SlaCategorySettings } from "./SlaCategorySettings";
import { toast } from "sonner";

const WEEKDAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export function SlaSettingsSection() {
  const { settings, loading, saveSettings } = useSlaSettings();
  const [businessStart, setBusinessStart] = useState("08:00");
  const [businessEnd, setBusinessEnd] = useState("18:00");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setBusinessStart(settings.businessStart);
      setBusinessEnd(settings.businessEnd);
      setWorkingDays(settings.workingDays);
      setBusinessHoursOnly(settings.businessHoursOnly);
    }
  }, [loading, settings]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveSettings({ businessStart, businessEnd, workingDays, businessHoursOnly });
    setSaving(false);
    if (ok) toast.success("Configurações de SLA salvas!");
    else toast.error("Erro ao salvar configurações");
  };

  const toggleDay = (day: number) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Horário Comercial & SLA</CardTitle>
        <CardDescription>
          Defina o horário de trabalho e dias úteis usados para cálculo de prazos de SLA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business-start">Início do Expediente</Label>
            <Input id="business-start" type="time" value={businessStart} onChange={(e) => setBusinessStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-end">Fim do Expediente</Label>
            <Input id="business-end" type="time" value={businessEnd} onChange={(e) => setBusinessEnd(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Dias Úteis</Label>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((day) => (
              <label key={day.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={workingDays.includes(day.value)} onCheckedChange={() => toggleDay(day.value)} />
                <span className="text-sm">{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Contar apenas horas úteis</p>
            <p className="text-sm text-muted-foreground">Excluir madrugadas e finais de semana do cálculo de SLA</p>
          </div>
          <Switch checked={businessHoursOnly} onCheckedChange={setBusinessHoursOnly} />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
    <SlaCategorySettings />
    </div>
  );
}
