import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, CalendarIcon, MapPin, Users, DollarSign,
  MoreVertical, Trash2, Pencil, AlertTriangle, CheckCircle2, Clock,
  Flag, Share2, Copy, LayoutGrid, CalendarDays, Package, Link2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMarketingEvents, MarketingEvent, useDeleteEvent } from "@/hooks/use-events";
import { useMarketingMaterials, MarketingMaterial, useDeleteMaterial } from "@/hooks/use-materials";
import { useMarketingTasks } from "@/hooks/use-marketing";
import { EventDialog } from "@/components/events/EventDialog";
import { EventDetailSheet } from "@/components/events/EventDetailSheet";
import { MaterialDialog } from "@/components/events/MaterialDialog";
import { MaterialDetailSheet } from "@/components/events/MaterialDetailSheet";
import { SortDropdown, usePersistentSort, applySorting, type SortOption } from "@/components/ui/sort-dropdown";

const eventSortOptions: SortOption[] = [
  { value: "start_date", label: "Data de Início" },
  { value: "name", label: "Nome" },
  { value: "priority", label: "Prioridade" },
  { value: "status", label: "Status" },
  { value: "budget", label: "Budget" },
];

const materialSortOptions: SortOption[] = [
  { value: "purchase_date", label: "Data da Compra" },
  { value: "name", label: "Nome" },
  { value: "priority", label: "Prioridade" },
  { value: "status", label: "Status" },
  { value: "budget", label: "Budget" },
];

const statusLabels: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground", icon: Clock },
  active: { label: "Ativo", color: "bg-primary/15 text-primary", icon: CheckCircle2 },
  completed: { label: "Concluído", color: "bg-success/15 text-success", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-destructive/15 text-destructive", icon: AlertTriangle },
};

const materialStatusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground" },
  purchasing: { label: "Compra", color: "bg-primary/15 text-primary" },
  delivered: { label: "Entregue", color: "bg-success/15 text-success" },
  distributed: { label: "Distribuído", color: "bg-chart-2/15 text-chart-2" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "text-destructive" },
  medium: { label: "Média", color: "text-warning" },
  low: { label: "Baixa", color: "text-muted-foreground" },
};

export default function Eventos() {
  const { data: events, isLoading: eventsLoading } = useMarketingEvents();
  const { data: materials, isLoading: materialsLoading } = useMarketingMaterials();
  const { data: allTasks } = useMarketingTasks();
  const deleteEvent = useDeleteEvent();
  const deleteMaterial = useDeleteMaterial();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("eventos");

  // Event state
  const [searchQuery, setSearchQuery] = useState("");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MarketingEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MarketingEvent | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "calendar">("cards");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const { sortKey: eventSortKey, sortDir: eventSortDir, setSort: setEventSort } = usePersistentSort("eventos-sort", "start_date", "asc");

  // Material state
  const [matSearchQuery, setMatSearchQuery] = useState("");
  const [matDialogOpen, setMatDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MarketingMaterial | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<MarketingMaterial | null>(null);
  const [matDetailOpen, setMatDetailOpen] = useState(false);
  const { sortKey: matSortKey, sortDir: matSortDir, setSort: setMatSort } = usePersistentSort("materiais-sort", "purchase_date", "desc");

  // Open event from URL query param
  useEffect(() => {
    const eventId = searchParams.get("event");
    if (eventId && events && !eventDetailOpen) {
      const found = events.find(e => e.id === eventId);
      if (found) {
        setSelectedEvent(found);
        setEventDetailOpen(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [events, searchParams]);

  useEffect(() => {
    if (selectedEvent && events) {
      const fresh = events.find(e => e.id === selectedEvent.id);
      if (fresh) setSelectedEvent(fresh);
    }
  }, [events]);

  useEffect(() => {
    if (selectedMaterial && materials) {
      const fresh = materials.find(m => m.id === selectedMaterial.id);
      if (fresh) setSelectedMaterial(fresh);
    }
  }, [materials]);

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const filteredEvents = useMemo(() => {
    let list = events ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
    }
    return applySorting(list, eventSortKey, eventSortDir, (item, key) => {
      if (key === "priority") return priorityOrder[item.priority] ?? 99;
      if (key === "budget") return item.budget ?? 0;
      return (item as any)[key] ?? "";
    });
  }, [events, searchQuery, eventSortKey, eventSortDir]);

  const filteredMaterials = useMemo(() => {
    let list = materials ?? [];
    if (matSearchQuery.trim()) {
      const q = matSearchQuery.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q));
    }
    return applySorting(list, matSortKey, matSortDir, (item, key) => {
      if (key === "priority") return priorityOrder[item.priority] ?? 99;
      if (key === "budget") return item.budget ?? 0;
      if (key === "purchase_date") return item.purchase_date ?? "";
      return (item as any)[key] ?? "";
    });
  }, [materials, matSearchQuery, matSortKey, matSortDir]);

  // Calendar dates
  const eventDates = useMemo(() => {
    if (!events) return [];
    // Campanhas não devem destacar dias no calendário (ex: campanha anual cobriria todo mês)
    return events
      .filter(e => (e as any).event_type !== "campanha")
      .map(e => parseISO(e.start_date));
  }, [events]);

  const eventBudgetInfo = useMemo(() => {
    const map: Record<string, { taskCount: number; invested: number }> = {};
    if (!allTasks) return map;
    allTasks.forEach((t: any) => {
      if (t.event_id) {
        if (!map[t.event_id]) map[t.event_id] = { taskCount: 0, invested: 0 };
        map[t.event_id].taskCount++;
      }
    });
    return map;
  }, [allTasks]);

  // Linked materials per event
  const materialsByEvent = useMemo(() => {
    const map: Record<string, MarketingMaterial[]> = {};
    (materials ?? []).forEach(m => {
      if (m.linked_event_id) {
        if (!map[m.linked_event_id]) map[m.linked_event_id] = [];
        map[m.linked_event_id].push(m);
      }
    });
    return map;
  }, [materials]);

  const handleEditEvent = (event: MarketingEvent) => {
    setEditingEvent(event);
    setEventDialogOpen(true);
  };

  const handleOpenEventDetail = (event: MarketingEvent) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  const handleEditMaterial = (material: MarketingMaterial) => {
    setEditingMaterial(material);
    setMatDialogOpen(true);
  };

  const handleOpenMaterialDetail = (material: MarketingMaterial) => {
    setSelectedMaterial(material);
    setMatDetailOpen(true);
  };

  const totalEventBudget = events?.reduce((sum, e) => sum + (e.budget || 0), 0) ?? 0;
  const activeEventCount = events?.filter(e => e.status === "active").length ?? 0;
  const totalMatBudget = materials?.reduce((sum, m) => sum + (m.budget || 0), 0) ?? 0;
  const totalMatActualCost = materials?.reduce((sum, m) => sum + (m.actual_cost || 0), 0) ?? 0;

  return (
    <AppLayout>
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Eventos & Materiais"
          description="Gerencie eventos, brindes e materiais de marketing"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="eventos" className="gap-1.5">
            <CalendarIcon className="h-4 w-4" />
            Eventos
          </TabsTrigger>
          <TabsTrigger value="materiais" className="gap-1.5">
            <Package className="h-4 w-4" />
            Brindes & Materiais
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ EVENTOS TAB ════════════════ */}
        <TabsContent value="eventos" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <p className="text-2xl font-bold">{activeEventCount}</p>
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
                    {totalEventBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-xs text-muted-foreground">Budget Total</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar eventos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <SortDropdown options={eventSortOptions} sortKey={eventSortKey} sortDir={eventSortDir} onSort={setEventSort} />
            <div className="flex items-center border rounded-md">
              <Button variant={viewMode === "cards" ? "default" : "ghost"} size="sm" className="h-9 rounded-r-none" onClick={() => setViewMode("cards")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "calendar" ? "default" : "ghost"} size="sm" className="h-9 rounded-l-none" onClick={() => setViewMode("calendar")}>
                <CalendarDays className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = `${window.location.origin}/eventos-publico`;
                  navigator.clipboard.writeText(url);
                  toast.success("Link público copiado!");
                }}
              >
                <Share2 className="h-4 w-4 mr-2" /> Compartilhar
              </Button>
              <Button onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo Evento
              </Button>
            </div>
          </div>

          {eventsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-52" />)}
            </div>
          ) : viewMode === "calendar" ? (
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
              <Card className="w-fit h-fit">
                <CardContent className="p-3">
                  <Calendar
                    mode="single"
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    locale={ptBR}
                    className="pointer-events-auto"
                    modifiers={{ hasEvent: eventDates }}
                    modifiersClassNames={{ hasEvent: "bg-primary/20 text-primary font-bold" }}
                    onDayClick={(day) => {
                      // Campanhas não contam para o click do dia (não devem aparecer como evento do dia)
                      const eventsOnDay = (events ?? []).filter(e => {
                        if ((e as any).event_type === "campanha") return false;
                        const start = parseISO(e.start_date);
                        const end = parseISO(e.end_date);
                        return day >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
                               day <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
                      });
                      if (eventsOnDay.length === 1) handleOpenEventDetail(eventsOnDay[0]);
                    }}
                  />
                </CardContent>
              </Card>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Eventos em {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
                </h3>
                {(() => {
                  const inMonth = filteredEvents.filter(e => {
                    const start = parseISO(e.start_date);
                    const end = parseISO(e.end_date);
                    return isSameMonth(start, calendarMonth) || isSameMonth(end, calendarMonth);
                  });
                  const monthEvents = inMonth.filter(e => e.event_type !== "campanha");
                  const monthCampaigns = inMonth.filter(e => e.event_type === "campanha");

                  if (monthEvents.length === 0 && monthCampaigns.length === 0) return (
                    <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento neste mês</p>
                  );

                  return (
                    <>
                      {monthEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum evento neste mês</p>
                      ) : monthEvents.map(event => {
                        const st = statusLabels[event.status] || statusLabels.planning;
                        return (
                          <Card key={event.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => handleOpenEventDetail(event)}>
                            <CardContent className="p-3 flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{event.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(parseISO(event.start_date), "dd MMM yyyy", { locale: ptBR })} — {format(parseISO(event.end_date), "dd MMM yyyy", { locale: ptBR })}
                                </p>
                              </div>
                              <Badge variant="outline" className={cn("text-[10px] shrink-0", st.color)}>{st.label}</Badge>
                            </CardContent>
                          </Card>
                        );
                      })}

                      {monthCampaigns.length > 0 && (
                        <div className="mt-4 pt-3 border-t">
                          <h4 className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wide mb-1.5">
                            Campanhas ativas no mês
                          </h4>
                          <ul className="space-y-0.5">
                            {monthCampaigns.map((c) => (
                              <li
                                key={c.id}
                                onClick={() => handleOpenEventDetail(c)}
                                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-2 py-0.5"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                                <span className="truncate">{c.name}</span>
                                <span className="text-muted-foreground/60 shrink-0">
                                  · {format(parseISO(c.start_date), "dd MMM", { locale: ptBR })} — {format(parseISO(c.end_date), "dd MMM yyyy", { locale: ptBR })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
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
                const linkedMats = materialsByEvent[event.id] ?? [];

                return (
                  <Card key={event.id} className="group cursor-pointer hover:shadow-md transition-all border" onClick={() => handleOpenEventDetail(event)}>
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteEvent.mutate(event.id); }}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-2">
                        {event.event_type === "campanha" && (
                          <Badge variant="outline" className="text-[10px] font-medium bg-accent text-accent-foreground">Campanha</Badge>
                        )}
                        <Badge variant="outline" className={cn("text-[10px] font-medium", st.color)}>{st.label}</Badge>
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
                            <span className="font-medium">{event.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{info?.taskCount ?? 0} tarefas</span>
                        </div>
                        {linkedMats.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            <span>{linkedMats.length} material(is)</span>
                          </div>
                        )}
                        {event.leads_gerados != null && (
                          <div className="flex items-center gap-1">
                            <Flag className="h-3 w-3" />
                            <span>{event.leads_gerados} leads</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ════════════════ MATERIAIS TAB ════════════════ */}
        <TabsContent value="materiais" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{materials?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Total de Materiais</p>
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
                    {totalMatBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-xs text-muted-foreground">Budget Total</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {totalMatActualCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-xs text-muted-foreground">Valor Real Gasto</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar materiais..."
                value={matSearchQuery}
                onChange={(e) => setMatSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <SortDropdown options={materialSortOptions} sortKey={matSortKey} sortDir={matSortDir} onSort={setMatSort} />
            <Button className="ml-auto" onClick={() => { setEditingMaterial(null); setMatDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo Material
            </Button>
          </div>

          {materialsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Nenhum material encontrado</p>
              <p className="text-sm">Crie seu primeiro brinde ou material para começar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMaterials.map((mat) => {
                const st = materialStatusLabels[mat.status] || materialStatusLabels.planning;
                const pri = priorityConfig[mat.priority] || priorityConfig.medium;
                const linkedEvent = events?.find(e => e.id === mat.linked_event_id);

                return (
                  <Card key={mat.id} className="group cursor-pointer hover:shadow-md transition-all border" onClick={() => handleOpenMaterialDetail(mat)}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{mat.name}</h3>
                          {mat.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{mat.description}</p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditMaterial(mat); }}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteMaterial.mutate(mat.id); }}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px] font-medium", st.color)}>{st.label}</Badge>
                        <div className="flex items-center gap-1">
                          <Flag className={cn("h-3 w-3", pri.color)} />
                          <span className={cn("text-[10px]", pri.color)}>{pri.label}</span>
                        </div>
                      </div>

                      {mat.purchase_date && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" />
                          <span>Compra: {format(new Date(mat.purchase_date), "dd MMM yyyy", { locale: ptBR })}</span>
                        </div>
                      )}

                      {linkedEvent && (
                        <div className="flex items-center gap-1.5 text-xs text-primary">
                          <Link2 className="h-3 w-3" />
                          <span className="truncate">{linkedEvent.name}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs pt-1 border-t">
                        <span className="text-muted-foreground">Budget</span>
                        <span className="font-medium">
                          {mat.budget > 0 ? mat.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                        </span>
                        {mat.actual_cost != null && (
                          <>
                            <span className="text-muted-foreground ml-2">Real</span>
                            <span className="font-medium">
                              {mat.actual_cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EventDialog
        open={eventDialogOpen}
        onOpenChange={(open) => { setEventDialogOpen(open); if (!open) setEditingEvent(null); }}
        event={editingEvent}
      />
      <EventDetailSheet
        event={selectedEvent}
        open={eventDetailOpen}
        onOpenChange={setEventDetailOpen}
      />
      <MaterialDialog
        open={matDialogOpen}
        onOpenChange={(open) => { setMatDialogOpen(open); if (!open) setEditingMaterial(null); }}
        material={editingMaterial}
        events={events ?? []}
      />
      <MaterialDetailSheet
        material={selectedMaterial}
        open={matDetailOpen}
        onOpenChange={setMatDetailOpen}
        events={events ?? []}
      />
    </AppLayout>
  );
}
