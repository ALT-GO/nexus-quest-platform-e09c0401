import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  parseRule,
  serializeCustom,
  describeRule,
  type CustomRecurrence,
  type RecurrenceUnit,
} from "@/lib/recurrence";

const PRESETS = [
  { value: "daily", label: "Diária" },
  { value: "weekdays", label: "Dias úteis (seg–sex)" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
  { value: "__custom__", label: "Personalizada…" },
] as const;

const UNIT_LABEL: Record<RecurrenceUnit, { singular: string; plural: string }> = {
  day: { singular: "dia", plural: "dias" },
  week: { singular: "semana", plural: "semanas" },
  month: { singular: "mês", plural: "meses" },
  year: { singular: "ano", plural: "anos" },
};

const WEEKDAYS = [
  { value: 0, label: "D" },
  { value: 1, label: "S" },
  { value: 2, label: "T" },
  { value: 3, label: "Q" },
  { value: 4, label: "Q" },
  { value: 5, label: "S" },
  { value: 6, label: "S" },
];

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  value: string;
  onChange: (rule: string) => void;
  /** Compact (inline) vs panel layout. Default: panel */
  layout?: "panel" | "inline";
}

export function RecurrenceSelector({ value, onChange, layout = "panel" }: Props) {
  const parsed = useMemo(() => parseRule(value), [value]);
  const [mode, setMode] = useState<string>(parsed.kind === "custom" ? "__custom__" : parsed.preset);
  const [custom, setCustom] = useState<CustomRecurrence>(
    parsed.kind === "custom" ? parsed.config : { interval: 1, unit: "week", weekdays: [new Date().getDay()] }
  );

  // Sync from external value
  useEffect(() => {
    const p = parseRule(value);
    if (p.kind === "preset") {
      setMode(p.preset);
    } else {
      setMode("__custom__");
      setCustom(p.config);
    }
  }, [value]);

  const handleModeChange = (next: string) => {
    setMode(next);
    if (next === "__custom__") {
      onChange(serializeCustom(custom));
    } else {
      onChange(next);
    }
  };

  const updateCustom = (patch: Partial<CustomRecurrence>) => {
    const merged: CustomRecurrence = { ...custom, ...patch };
    setCustom(merged);
    onChange(serializeCustom(merged));
  };

  const toggleWeekday = (d: number) => {
    const set = new Set(custom.weekdays || []);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    if (set.size === 0) return; // require at least one
    updateCustom({ weekdays: Array.from(set).sort() });
  };

  const isCustom = mode === "__custom__";

  return (
    <div className={layout === "panel" ? "space-y-3" : "space-y-2"}>
      <div className={layout === "inline" ? "flex items-center gap-2" : ""}>
        {layout === "panel" && <Label className="text-xs text-muted-foreground">Frequência</Label>}
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger className={layout === "inline" ? "h-7 w-auto border-none shadow-none px-0 text-sm" : "h-9"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isCustom && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          {/* Interval + unit */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">Repetir a cada</Label>
            <Input
              type="number"
              min={1}
              max={999}
              value={custom.interval}
              onChange={(e) => updateCustom({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
              className="h-8 w-16 text-sm"
            />
            <Select
              value={custom.unit}
              onValueChange={(v) => updateCustom({ unit: v as RecurrenceUnit })}
            >
              <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{custom.interval === 1 ? UNIT_LABEL.day.singular : UNIT_LABEL.day.plural}</SelectItem>
                <SelectItem value="week">{custom.interval === 1 ? UNIT_LABEL.week.singular : UNIT_LABEL.week.plural}</SelectItem>
                <SelectItem value="month">{custom.interval === 1 ? UNIT_LABEL.month.singular : UNIT_LABEL.month.plural}</SelectItem>
                <SelectItem value="year">{custom.interval === 1 ? UNIT_LABEL.year.singular : UNIT_LABEL.year.plural}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Weekly: weekday picker */}
          {custom.unit === "week" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dias da semana</Label>
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((d) => (
                  <Toggle
                    key={d.value}
                    size="sm"
                    pressed={custom.weekdays?.includes(d.value) ?? false}
                    onPressedChange={() => toggleWeekday(d.value)}
                    className="h-8 w-8 p-0 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    aria-label={`Dia ${d.value}`}
                  >
                    {d.label}
                  </Toggle>
                ))}
              </div>
            </div>
          )}

          {/* Monthly: day of month */}
          {custom.unit === "month" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">No dia</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={custom.monthDay ?? ""}
                placeholder="ex: 15"
                onChange={(e) => updateCustom({ monthDay: e.target.value ? Math.min(31, Math.max(1, parseInt(e.target.value))) : undefined })}
                className="h-8 w-20 text-sm"
              />
              <span className="text-xs text-muted-foreground">do mês (vazio = mesmo dia da tarefa)</span>
            </div>
          )}

          {/* Yearly: month + day */}
          {custom.unit === "year" && (
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Em</Label>
              <Select
                value={custom.yearMonth ? String(custom.yearMonth) : ""}
                onValueChange={(v) => updateCustom({ yearMonth: parseInt(v) })}
              >
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Mês" /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="text-xs text-muted-foreground shrink-0">dia</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={custom.monthDay ?? ""}
                placeholder="ex: 15"
                onChange={(e) => updateCustom({ monthDay: e.target.value ? Math.min(31, Math.max(1, parseInt(e.target.value))) : undefined })}
                className="h-8 w-20 text-sm"
              />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{describeRule(isCustom ? serializeCustom(custom) : mode)}</p>
    </div>
  );
}
