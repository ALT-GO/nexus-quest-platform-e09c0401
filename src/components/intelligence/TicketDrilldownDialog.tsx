import { useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  category: string;
  priority: string;
  assignee: string | null;
  created_at: string;
  completed_at: string | null;
  sla_deadline: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tickets: Ticket[];
}

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/20 text-warning",
  high: "bg-destructive/20 text-destructive",
};

export function TicketDrilldownDialog({ open, onOpenChange, title, tickets }: Props) {
  const navigate = useNavigate();

  const handleOpenTicket = (ticketId: string) => {
    onOpenChange(false);
    navigate(`/ti/service-desk?ticket=${ticketId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title} ({tickets.length})</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {tickets.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum chamado encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Nº</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => handleOpenTicket(t.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.ticket_number}</TableCell>
                    <TableCell className="font-medium max-w-[220px] truncate">{t.title}</TableCell>
                    <TableCell className="text-xs">{t.category}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={priorityColors[t.priority] || ""}>
                        {t.priority === "high" ? "Alta" : t.priority === "medium" ? "Média" : "Baixa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.assignee || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={t.completed_at ? "default" : "outline"}>
                        {t.completed_at ? "Concluído" : "Aberto"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
