import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Timer, Pause, ExternalLink } from "lucide-react";
import { useActiveTimers, formatDuration } from "@/hooks/use-timesheet";
import { useTickets, Ticket } from "@/hooks/use-tickets";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export function ActiveTimersCard() {
  const { tickets } = useTickets();
  const navigate = useNavigate();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const { activeTimers, loading, refetch } = useActiveTimers();
  const top5 = activeTimers.slice(0, 5);

  const handlePause = async (logId: string, startTime: string) => {
    const now = new Date();
    const durationSeconds = Math.floor(
      (now.getTime() - new Date(startTime).getTime()) / 1000
    );
    const { error } = await supabase
      .from("timesheet_logs")
      .update({
        end_time: now.toISOString(),
        duration_seconds: durationSeconds,
      } as any)
      .eq("id", logId as any);

    if (error) {
      toast.error("Erro ao pausar timer");
    } else {
      toast.success("Timer pausado");
      refetch();
    }
  };

  const handleOpenTicket = (ticketId: string) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket) {
      setSelectedTicket(ticket);
    }
  };

  if (top5.length === 0 && !loading) return null;

  return (
    <>
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Timer className="h-4 w-4 text-primary animate-pulse" />
            Timers Ativos
            {top5.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {activeTimers.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              Carregando...
            </p>
          ) : (
            top5.map((timer) => (
              <div
                key={timer.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => handleOpenTicket(timer.ticket_id)}
                    className="text-sm font-medium text-foreground hover:text-primary hover:underline text-left truncate block w-full"
                  >
                    {timer.ticket_title || "Sem título"}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {timer.ticket_number} {timer.ticket_assignee ? `· ${timer.ticket_assignee}` : ""}
                  </p>
                </div>

                <span className="font-mono text-sm font-semibold text-primary tabular-nums">
                  {formatDuration(timer.elapsed_seconds)}
                </span>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handlePause(timer.id, timer.start_time)}
                  title="Pausar timer"
                >
                  <Pause className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Mini detail sheet */}
      <Sheet
        open={!!selectedTicket}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
      >
        <SheetContent className="sm:max-w-md">
          {selectedTicket && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left pr-6">
                  {selectedTicket.title}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Número</p>
                    <p className="font-medium">{selectedTicket.ticket_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Prioridade</p>
                    <Badge
                      variant={
                        selectedTicket.priority === "high"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {selectedTicket.priority === "high"
                        ? "Alta"
                        : selectedTicket.priority === "medium"
                        ? "Média"
                        : "Baixa"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Categoria</p>
                    <p className="font-medium">{selectedTicket.category}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Responsável</p>
                    <p className="font-medium">
                      {selectedTicket.assignee || "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Criado em</p>
                    <p className="font-medium">
                      {format(
                        new Date(selectedTicket.created_at),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      )}
                    </p>
                  </div>
                </div>
                {selectedTicket.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Descrição
                    </p>
                    <p className="text-sm whitespace-pre-wrap rounded-md bg-muted p-3">
                      {selectedTicket.description}
                    </p>
                  </div>
                )}
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    setSelectedTicket(null);
                    navigate("/ti/service-desk");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir no Service Desk
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
