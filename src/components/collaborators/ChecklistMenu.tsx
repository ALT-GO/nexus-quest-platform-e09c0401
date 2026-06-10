import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClipboardList, Printer, Download } from "lucide-react";
import celularAsset from "@/assets/checklists/celular.pdf.asset.json";
import notebookAsset from "@/assets/checklists/notebook.pdf.asset.json";
import tabletAsset from "@/assets/checklists/tablet.pdf.asset.json";

type Key = "celular" | "notebook" | "tablet";

const OPTIONS: { key: Key; label: string; url: string; filename: string }[] = [
  { key: "celular", label: "Celular", url: celularAsset.url, filename: "CHECKLIST - CELULAR.pdf" },
  { key: "notebook", label: "Notebook", url: notebookAsset.url, filename: "CHECKLIST - PC.pdf" },
  { key: "tablet", label: "Tablet", url: tabletAsset.url, filename: "CHECKLIST - TABLET.pdf" },
];

export function ChecklistMenu() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<Key, boolean>>({
    celular: false, notebook: false, tablet: false,
  });

  const toggle = (k: Key) => setSelected((s) => ({ ...s, [k]: !s[k] }));
  const chosen = OPTIONS.filter((o) => selected[o.key]);

  const handlePrint = () => {
    chosen.forEach((o, i) => {
      setTimeout(() => {
        const w = window.open(o.url, "_blank");
        if (w) {
          w.addEventListener("load", () => {
            try { w.focus(); w.print(); } catch {}
          });
        }
      }, i * 300);
    });
    setOpen(false);
  };

  const handleDownload = async () => {
    for (const o of chosen) {
      try {
        const res = await fetch(o.url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = o.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        window.open(o.url, "_blank");
      }
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ClipboardList className="h-4 w-4" />
          Checklist
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-3">
          <p className="text-sm font-medium">Selecione os checklists</p>
          <div className="space-y-2">
            {OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={selected[o.key]}
                  onCheckedChange={() => toggle(o.key)}
                />
                {o.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5"
              disabled={chosen.length === 0}
              onClick={handlePrint}
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              disabled={chosen.length === 0}
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5" />
              Baixar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
