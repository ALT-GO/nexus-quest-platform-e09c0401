import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, Search, CalendarIcon, MapPin, Users, DollarSign,
  MoreVertical, Trash2, Pencil, AlertTriangle, CheckCircle2, Clock,
  Flag,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMarketingEvents, MarketingEvent, useDeleteEvent } from "@/hooks/use-events";
import { useMarketingTasks } from "@/hooks/use-marketing";
import { EventDialog } from "@/components/events/EventDialog";
import { EventDetailSheet } from "@/components/events/EventDetailSheet";

const statusLabels: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground", icon: Clock },
  active: { label: "Ativo", color: "bg-primary/15 text-primary", icon: CheckCircle2 },
  completed: { label: "Concluído", color: "bg-success/15 text-success", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-destructive/15 text-destructive", icon: AlertTriangle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "text-destructive" },
  medium: { label: "Média", color: "text-warning" },
  low: { label: "Baixa", color: "text-muted-foreground" },
};

export default function Eventos() {
  const { data: events, isLoading } = useMarketingEvents();
  const { data: allTasks } = useMarketingTasks();
  const deleteEvent = useDeleteEvent();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MarketingEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MarketingEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (selectedEvent && events) {
      const fresh = events.find(e => e.id === selectedEvent.id);
      if (fresh) setSelectedEvent(fresh);
    }
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(e => e.name.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
  }, [events, searchQuery]);

  const eventBudgetInfo = useMemo(() => {
    const map: Record<string, { taskCount: number; invested: number }> = {};
    if (!allTasks) return map;
    allTasks.forEach((t: any) => {
      if (t.event_id) {
        if (!map[t.event_id]) map[t.event_id] = { taskCount: 0, invested: 0 };
        map[t.event_id].taskCount++;
        if (t.value) map[t.event_id].invested += Number(t.value);
      }
    });
    return map;
  }, [allTasks]);

  const handleEdit = (event: MarketingEvent) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleOpenDetail = (event: MarketingEvent) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  };

  const totalBudget = events?.reduce((sum, e) => sum + (e.budget || 0), 0) ?? 0;
  const activeCount = events?.filter(e => e.status === "active").length ?? 0;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title="Gestão de Eventos"
          description="Gerencie eventos de marketing, budget e tarefas associadas"
        />
        <Button onClick={() => { setEditingEvent(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Evento
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{events?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total de Eventos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Eventos Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {totalBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className="text-xs text-muted-foreground">Budget Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar eventos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhum evento encontrado</p>
          <p className="text-sm">Crie seu primeiro evento para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => {
            const st = statusLabels[event.status] || statusLabels.planning;
            const pri = priorityConfig[event.priority] || priorityConfig.medium;
            const info = eventBudgetInfo[event.id];
            const budgetUsed = info?.invested ?? 0;
            const budgetPercent = event.budget > 0 ? Math.min((budgetUsed / event.budget) * 100, 100) : 0;

            return (
              <Card
                key={event.id}
                className="group cursor-pointer hover:shadow-md transition-all border"
                onClick={() => handleOpenDetail(event)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{event.name}</h3>
                      {event.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(event); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteEvent.mutate(event.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px] font-medium", st.color)}>
                      {st.label}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Flag className={cn("h-3 w-3", pri.color)} />
                      <span className={cn("text-[10px]", pri.color)}>{pri.label}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarIcon className="h-3 w-3" />
                    <span>
                      {format(new Date(event.start_date), "dd MMM", { locale: ptBR })} — {format(new Date(event.end_date), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>

                  {event.budget > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Budget</span>
                        <span className="font-medium">
                          {event.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            budgetPercent > 90 ? "bg-destructive" : budgetPercent > 70 ? "bg-warning" : "bg-success"
                          )}
                          style={{ width: `${budgetPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{info?.taskCount ?? 0} tarefas</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingEvent(null); }}
        event={editingEvent}
      />

      <EventDetailSheet
        event={selectedEvent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </AppLayout>
  );
}
