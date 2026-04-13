import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, MapPin, Clock, DollarSign } from "lucide-react";
import { format, isSameMonth, isSameDay, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MarketingEvent } from "@/hooks/use-events";

interface Props {
  events: MarketingEvent[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground" },
  active: { label: "Ativo", color: "bg-primary/15 text-primary" },
  completed: { label: "Concluído", color: "bg-success/15 text-success" },
  cancelled: { label: "Cancelado", color: "bg-destructive/15 text-destructive" },
};

export function EventCalendarCard({ events }: Props) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Events in the selected month
  const monthEvents = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    return events
      .filter((e) => {
        const start = new Date(e.start_date);
        const end = new Date(e.end_date);
        // Event overlaps with the month
        return start <= monthEnd && end >= monthStart;
      })
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [events, selectedDate]);

  // Days that have events (for highlighting in calendar)
  const eventDays = useMemo(() => {
    const days = new Set<string>();
    events.filter(e => (e as any).event_type !== "campanha").forEach((e) => {
      const start = new Date(e.start_date);
      const end = new Date(e.end_date);
      const current = new Date(start);
      while (current <= end) {
        days.add(format(current, "yyyy-MM-dd"));
        current.setDate(current.getDate() + 1);
      }
    });
    return days;
  }, [events]);

  const modifiers = useMemo(() => {
    return {
      event: (date: Date) => eventDays.has(format(date, "yyyy-MM-dd")),
    };
  }, [eventDays]);

  const modifiersStyles = {
    event: {
      backgroundColor: "hsl(var(--primary) / 0.15)",
      borderRadius: "50%",
      fontWeight: "bold" as const,
      color: "hsl(var(--primary))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          Calendário de Eventos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Calendar */}
          <div className="shrink-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              month={selectedDate}
              onMonthChange={setSelectedDate}
              locale={ptBR}
              className="p-3 pointer-events-auto rounded-md border"
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
            />
          </div>

          {/* Event list for the month */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">
              Eventos em {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
            </h4>
            {monthEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum evento neste mês
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {monthEvents.map((event) => {
                  const st = statusLabels[event.status] || statusLabels.planning;
                  const startD = new Date(event.start_date);
                  const endD = new Date(event.end_date);
                  const isToday = isSameDay(new Date(), startD) || isWithinInterval(new Date(), { start: startD, end: endD });

                  return (
                    <div
                      key={event.id}
                      onClick={() => navigate(`/marketing/eventos?event=${event.id}`)}
                      className={cn(
                        "p-3 rounded-lg border space-y-1.5 transition-colors cursor-pointer hover:bg-accent/50",
                        isToday && "border-primary/50 bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{event.name}</span>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", st.color)}>
                          {st.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(startD, "dd MMM", { locale: ptBR })} — {format(endD, "dd MMM", { locale: ptBR })}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate max-w-[120px]">{event.location}</span>
                          </div>
                        )}
                      </div>
                      {(event.budget > 0 || event.actual_cost != null) && (
                        <div className="flex items-center gap-4 text-xs mt-1">
                          {event.budget > 0 && (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-muted-foreground font-medium">Orçamento</span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <DollarSign className="h-3 w-3" />
                                {event.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground font-medium">Valor Real</span>
                            <span className={cn("flex items-center gap-1", event.actual_cost != null ? "text-foreground font-medium" : "text-muted-foreground")}>
                              <DollarSign className="h-3 w-3" />
                              {event.actual_cost != null
                                ? event.actual_cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                : "—"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
