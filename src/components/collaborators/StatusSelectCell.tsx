import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2 } from "lucide-react";
import { useInventoryStatuses } from "@/hooks/use-inventory-statuses";

const fallbackStyles: Record<string, string> = {
  Ativo: "bg-success/15 text-success",
  Inativo: "bg-muted text-muted-foreground",
};

function StatusBadgeInline({
  status,
  colorMap,
}: {
  status: string;
  colorMap: Record<string, string>;
}) {
  const hsl = colorMap[status];
  if (hsl) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `hsl(${hsl} / 0.15)`, color: `hsl(${hsl})` }}
      >
        {status || "—"}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        fallbackStyles[status] || "bg-secondary text-secondary-foreground"
      )}
    >
      {status || "—"}
    </span>
  );
}

interface StatusSelectCellProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  /** Asset category to determine which configured statuses to show. Defaults to "licencas" for backward compatibility. */
  category?: string;
}

export function StatusSelectCell({ value, onSave, category = "licencas" }: StatusSelectCellProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { getStatusesForCategory, statusColorMap } = useInventoryStatuses();
  const options = getStatusesForCategory(category);

  const handleChange = async (newValue: string) => {
    if (newValue === value) return;
    setSaving(true);
    setSaved(false);
    try {
      await onSave(newValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={value || ""} onValueChange={handleChange}>
        <SelectTrigger className="h-7 w-auto min-w-[100px] border-none bg-transparent p-0 shadow-none hover:bg-muted/50 focus:ring-0 [&>svg]:ml-1">
          <SelectValue>
            <StatusBadgeInline status={value} colorMap={statusColorMap} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Nenhum status configurado
            </div>
          ) : (
            options.map((opt) => {
              const hsl = statusColorMap[opt];
              return (
                <SelectItem key={opt} value={opt}>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={hsl ? { backgroundColor: `hsl(${hsl})` } : undefined}
                    />
                    {opt}
                  </span>
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {saved && <Check className="h-3 w-3 text-success" />}
    </div>
  );
}
