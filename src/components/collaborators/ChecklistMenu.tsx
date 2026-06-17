import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClipboardList, Printer, Download, Loader2 } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import celularAsset from "@/assets/checklists/celular.pdf.asset.json";
import notebookAsset from "@/assets/checklists/notebook.pdf.asset.json";
import tabletAsset from "@/assets/checklists/tablet.pdf.asset.json";
import orionLogo from "@/assets/logo_orion.png";

type Key = "celular" | "notebook" | "tablet";

interface Meta {
  key: Key;
  label: string;
  url: string;
  code: string;       // e.g. "CHK.001"
  title: string;      // e.g. "CHECKLIST - CELULAR"
}

const REVISION_DATE = "16/06/2026";

const OPTIONS: Meta[] = [
  { key: "celular",  label: "Celular",  url: celularAsset.url,  code: "CHK.001", title: "CHECKLIST - CELULAR" },
  { key: "tablet",   label: "Tablet",   url: tabletAsset.url,   code: "CHK.002", title: "CHECKLIST - TABLET" },
  { key: "notebook", label: "Notebook", url: notebookAsset.url, code: "CHK.003", title: "CHECKLIST - NOTEBOOK" },
];

interface Props {
  collaboratorName?: string;
}

async function buildChecklistPdf(meta: Meta, logoBytes: Uint8Array): Promise<Uint8Array> {
  const pdfBytes = await fetch(meta.url).then((r) => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const logoImage = await pdfDoc.embedPng(logoBytes);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const page = pages[pages.length - 1];
  const { width } = page.getSize();

  // Footer rectangle layout (mimics the FF.164 header style)
  const margin = 36;
  const rectW = width - margin * 2;
  const rectH = 56;
  const rectX = margin;
  const rectY = 28; // distance from bottom

  // Outer border
  page.drawRectangle({
    x: rectX, y: rectY, width: rectW, height: rectH,
    borderColor: rgb(0.55, 0.55, 0.55),
    borderWidth: 0.8,
    color: rgb(1, 1, 1),
  });

  // Three columns: logo | title | code+rev
  const col1W = 130;
  const col3W = 150;
  const col2W = rectW - col1W - col3W;

  // dividers
  page.drawLine({
    start: { x: rectX + col1W, y: rectY },
    end: { x: rectX + col1W, y: rectY + rectH },
    color: rgb(0.55, 0.55, 0.55), thickness: 0.8,
  });
  page.drawLine({
    start: { x: rectX + col1W + col2W, y: rectY },
    end: { x: rectX + col1W + col2W, y: rectY + rectH },
    color: rgb(0.55, 0.55, 0.55), thickness: 0.8,
  });

  // Logo (preserve aspect, fit in col1)
  const maxLogoW = col1W - 24;
  const maxLogoH = rectH - 16;
  const scale = Math.min(maxLogoW / logoImage.width, maxLogoH / logoImage.height);
  const lw = logoImage.width * scale;
  const lh = logoImage.height * scale;
  page.drawImage(logoImage, {
    x: rectX + (col1W - lw) / 2,
    y: rectY + (rectH - lh) / 2,
    width: lw, height: lh,
  });

  // Title (col 2, centered)
  const titleText = `${meta.code} - ${meta.title}`;
  const titleSize = 11;
  const titleW = fontBold.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: rectX + col1W + (col2W - titleW) / 2,
    y: rectY + rectH / 2 - titleSize / 2 + 2,
    size: titleSize, font: fontBold, color: rgb(0, 0, 0),
  });

  // Col 3: code (top) + revision date (bottom)
  const codeSize = 10;
  const revSize = 9;
  const codeW = fontBold.widthOfTextAtSize(meta.code, codeSize);
  page.drawText(meta.code, {
    x: rectX + col1W + col2W + (col3W - codeW) / 2,
    y: rectY + rectH * 0.62,
    size: codeSize, font: fontBold, color: rgb(0, 0, 0),
  });
  const revText = `Data de revisão: ${REVISION_DATE}`;
  const revW = fontReg.widthOfTextAtSize(revText, revSize);
  page.drawText(revText, {
    x: rectX + col1W + col2W + (col3W - revW) / 2,
    y: rectY + rectH * 0.22,
    size: revSize, font: fontReg, color: rgb(0, 0, 0),
  });

  return pdfDoc.save();
}

function filenameFor(meta: Meta, collaboratorName?: string) {
  const base = `${meta.code} - ${meta.title}`;
  const safeName = (collaboratorName || "").trim();
  return safeName ? `${base} - ${safeName}.pdf` : `${base}.pdf`;
}

export function ChecklistMenu({ collaboratorName }: Props = {}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<Key, boolean>>({
    celular: false, notebook: false, tablet: false,
  });

  const toggle = (k: Key) => setSelected((s) => ({ ...s, [k]: !s[k] }));
  const chosen = OPTIONS.filter((o) => selected[o.key]);

  const getLogoBytes = async () =>
    new Uint8Array(await (await fetch(orionLogo)).arrayBuffer());

  const handlePrint = async () => {
    setBusy(true);
    try {
      const logoBytes = await getLogoBytes();
      for (let i = 0; i < chosen.length; i++) {
        const o = chosen[i];
        const bytes = await buildChecklistPdf(o, logoBytes);
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (w) {
          w.addEventListener("load", () => {
            try { w.focus(); w.print(); } catch {}
          });
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const logoBytes = await getLogoBytes();
      for (const o of chosen) {
        const bytes = await buildChecklistPdf(o, logoBytes);
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filenameFor(o, collaboratorName);
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
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
              disabled={chosen.length === 0 || busy}
              onClick={handlePrint}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Imprimir
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              disabled={chosen.length === 0 || busy}
              onClick={handleDownload}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Baixar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
