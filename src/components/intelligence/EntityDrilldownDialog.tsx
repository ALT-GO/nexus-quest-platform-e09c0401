import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { formatDuration } from "@/hooks/use-timesheet";

export interface DrilldownEntity {
  id: string;
  reference?: string; // e.g. ticket_number
  title: string;
  assignee?: string | null;
  status?: string | null;
  totalSeconds?: number;
  onOpen?: () => void;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: DrilldownEntity[];
  entityNoun?: string;
}

export function EntityDrilldownDialog({
  open, onOpenChange, title, items, entityNoun = "item",
}: Props) {
  const totalSeconds = items.reduce((s, i) => s + (i.totalSeconds || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            <Badge variant="secondary" className="ml-1">{items.length}</Badge>
            {totalSeconds > 0 && (
              <span className="ml-auto text-xs font-mono font-normal text-muted-foreground">
                {formatDuration(totalSeconds)} no total
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum {entityNoun} encontrado.
            </p>
          ) : (
            <ul className="divide-y">
              {items
                .slice()
                .sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0))
                .map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-accent/50 -mx-2 px-2 rounded"
                    onClick={() => {
                      onOpenChange(false);
                      it.onOpen?.();
                    }}
                  >
                    {it.reference && (
                      <span className="font-mono text-xs text-muted-foreground shrink-0 w-16">
                        {it.reference}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{it.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {it.assignee && <span>{it.assignee}</span>}
                        {it.assignee && it.status && <span>·</span>}
                        {it.status && <span>{it.status}</span>}
                      </div>
                    </div>
                    {it.totalSeconds !== undefined && it.totalSeconds > 0 && (
                      <span className="font-mono text-xs text-primary shrink-0">
                        {formatDuration(it.totalSeconds)}
                      </span>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
