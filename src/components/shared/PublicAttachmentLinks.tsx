import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Plus, X } from "lucide-react";

interface PublicAttachmentLinksProps {
  links: string[];
  onChange: (links: string[]) => void;
}

export function PublicAttachmentLinks({ links, onChange }: PublicAttachmentLinksProps) {
  const [currentLink, setCurrentLink] = useState("");

  const addLink = () => {
    const trimmed = currentLink.trim();
    if (!trimmed) return;
    onChange([...links, trimmed]);
    setCurrentLink("");
  };

  const removeLink = (idx: number) => {
    onChange(links.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1.5">
        <Link2 className="h-4 w-4" />
        Links de Arquivos (OneDrive, Google Drive, etc.)
      </label>
      <div className="flex gap-2">
        <Input
          placeholder="Cole o link do arquivo aqui..."
          value={currentLink}
          onChange={(e) => setCurrentLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
          className="text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={addLink} disabled={!currentLink.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((link, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-xs">{link}</span>
              <button type="button" onClick={() => removeLink(idx)} className="shrink-0 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
