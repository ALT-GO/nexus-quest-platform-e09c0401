import { useState, useEffect, useMemo } from "react";
import { ActiveTimersCard } from "@/components/dashboard/ActiveTimersCard";
import { supabase } from "@/integrations/supabase/client";
import { fetchTimesheetTotals, formatDuration } from "@/hooks/use-timesheet";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, TrendingUp, Target, DollarSign, Users, Clock, Timer } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { useTickets } from "@/hooks/use-tickets";

interface Event {
  id: string; name: string; investedValue: number; leadsGenerated: number; cpl: number; category: string; date: string;
}
interface Proposal {
  id: string; clientName: string; value: number; quantity: number; date: string;
}

const initialEvents: Event[] = [
  { id: "1", name: "Webinar Transformação Digital", investedValue: 5000, leadsGenerated: 120, cpl: 41.67, category: "Digital", date: "2024-11-01" },
  { id: "2", name: "Feira de Tecnologia 2024", investedValue: 25000, leadsGenerated: 350, cpl: 71.43, category: "Eventos Presenciais", date: "2024-10-15" },
  { id: "3", name: "Campanha LinkedIn Ads", investedValue: 8000, leadsGenerated: 95, cpl: 84.21, category: "Mídia Paga", date: "2024-11-05" },
];

const initialProposals: Proposal[] = [
  { id: "1", clientName: "Tech Solutions Ltda", value: 150000, quantity: 3, date: "2024-11-10" },
  { id: "2", clientName: "Indústria ABC", value: 85000, quantity: 1, date: "2024-11-08" },
  { id: "3", clientName: "Comércio XYZ", value: 45000, quantity: 2, date: "2024-11-05" },
];

const monthlyData = [
  { month: "Jan", investimento: 35000, leads: 280, propostas: 450000 },
  { month: "Fev", investimento: 42000, leads: 320, propostas: 520000 },
  { month: "Mar", investimento: 38000, leads: 295, propostas: 480000 },
  { month: "Abr", investimento: 55000, leads: 420, propostas: 680000 },
  { month: "Mai", investimento: 48000, leads: 380, propostas: 590000 },
  { month: "Jun", investimento: 52000, leads: 410, propostas: 720000 },
];

const eventCategories = ["Digital", "Mídia Paga", "Eventos Presenciais", "Conteúdo", "Branding", "Outros"];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

interface MarketingTabProps {
  dateRange: { start: Date; end: Date };
}

export function MarketingTab({ dateRange }: MarketingTabProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: "", investedValue: "", leadsGenerated: "", category: "", date: "" });
  const [newProposal, setNewProposal] = useState({ clientName: "", value: "", quantity: "", date: "" });

  // Timesheet data for marketing tasks
  const { tickets: allTickets } = useTickets();
  const [timesheetTotals, setTimesheetTotals] = useState<Record<string, number>>({});

  // Filter marketing-related tickets by department/category AND date range
  const marketingTickets = useMemo(() => {
    return allTickets.filter((t) => {
      const isMarketing = t.department?.toLowerCase().includes("marketing") || t.category?.toLowerCase().includes("marketing");
      if (!isMarketing) return false;
      const created = new Date(t.created_at);
      return created >= dateRange.start && created <= dateRange.end;
    });
  }, [allTickets, dateRange]);

  useEffect(() => {
    const ids = marketingTickets.map((t) => t.id);
    if (ids.length > 0) {
      fetchTimesheetTotals(ids).then(setTimesheetTotals);
    }
  }, [marketingTickets]);

  // Top 5 tarefas demoradas (marketing)
  const top5SlowTasks = useMemo(() => {
    return marketingTickets
      .filter((t) => timesheetTotals[t.id] && timesheetTotals[t.id] > 0)
      .map((t) => ({
        id: t.id,
        ticketNumber: t.ticket_number,
        title: t.title,
        assignee: t.assignee || "—",
        totalSeconds: timesheetTotals[t.id],
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 5);
  }, [marketingTickets, timesheetTotals]);

  // Horas por colaborador (marketing)
  const hoursByAssignee = useMemo(() => {
    const map: Record<string, number> = {};
    marketingTickets.forEach((t) => {
      const assignee = t.assignee || "Sem atribuição";
      const secs = timesheetTotals[t.id] || 0;
      if (secs > 0) {
        map[assignee] = (map[assignee] || 0) + secs;
      }
    });
    return Object.entries(map)
      .map(([name, seconds]) => ({ name, hours: Math.round((seconds / 3600) * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours);
  }, [marketingTickets, timesheetTotals]);

  // Filter static events/proposals by dateRange
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const d = new Date(e.date);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [events, dateRange]);

  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      const d = new Date(p.date);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [proposals, dateRange]);

  const totalInvestment = filteredEvents.reduce((sum, e) => sum + e.investedValue, 0);
  const totalLeads = filteredEvents.reduce((sum, e) => sum + e.leadsGenerated, 0);
  const averageCPL = totalInvestment / totalLeads || 0;
  const totalProposalValue = filteredProposals.reduce((sum, p) => sum + p.value, 0);

  const handleAddEvent = () => {
    if (!newEvent.name || !newEvent.investedValue || !newEvent.leadsGenerated) return;
    const investedValue = parseFloat(newEvent.investedValue);
    const leadsGenerated = parseInt(newEvent.leadsGenerated);
    setEvents([...events, { id: Date.now().toString(), name: newEvent.name, investedValue, leadsGenerated, cpl: investedValue / leadsGenerated, category: newEvent.category, date: newEvent.date }]);
    setNewEvent({ name: "", investedValue: "", leadsGenerated: "", category: "", date: "" });
    setIsEventDialogOpen(false);
  };

  const handleAddProposal = () => {
    if (!newProposal.clientName || !newProposal.value) return;
    setProposals([...proposals, { id: Date.now().toString(), clientName: newProposal.clientName, value: parseFloat(newProposal.value), quantity: parseInt(newProposal.quantity) || 1, date: newProposal.date }]);
    setNewProposal({ clientName: "", value: "", quantity: "", date: "" });
    setIsProposalDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <ActiveTimersCard />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Investimento Total" value={`R$ ${totalInvestment.toLocaleString("pt-BR")}`} icon={DollarSign} trend={{ value: 15, isPositive: true }} />
        <StatCard title="Leads Gerados" value={totalLeads} icon={Users} trend={{ value: 22, isPositive: true }} />
        <StatCard title="CPL Médio" value={`R$ ${averageCPL.toFixed(2)}`} description="Custo por Lead" icon={Target} trend={{ value: 8, isPositive: false }} />
        <StatCard title="Valor Propostas" value={`R$ ${(totalProposalValue / 1000).toFixed(0)}k`} icon={TrendingUp} trend={{ value: 18, isPositive: true }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Investimento vs Leads (Mensal)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar yAxisId="left" dataKey="investimento" name="Investimento (R$)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--success))" strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Valor de Propostas (Mensal)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
                  <Line type="monotone" dataKey="propostas" name="Propostas" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-4))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Timesheet Charts for Marketing */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Timer className="h-4 w-4 text-muted-foreground" />Horas Trabalhadas por Colaborador (Marketing)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hoursByAssignee.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Nenhum registro de timesheet em tarefas de marketing
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursByAssignee} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} unit="h" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value}h`} />
                    <Bar dataKey="hours" name="Horas" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Tarefas Demoradas - Marketing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />Top 5 Tarefas Demoradas (Marketing)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {top5SlowTasks.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Nenhum registro de timesheet em tarefas de marketing
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Chamado</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top5SlowTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{task.ticketNumber}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{task.title}</TableCell>
                      <TableCell>{task.assignee}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatDuration(task.totalSeconds)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Eventos e Campanhas</CardTitle>
          <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Novo Registro</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar Evento/Campanha</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Nome do Evento</Label><Input value={newEvent.name} onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })} placeholder="Nome da campanha ou evento" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Valor Investido (R$)</Label><Input type="number" value={newEvent.investedValue} onChange={(e) => setNewEvent({ ...newEvent, investedValue: e.target.value })} placeholder="0.00" /></div>
                  <div className="grid gap-2"><Label>Leads Gerados</Label><Input type="number" value={newEvent.leadsGenerated} onChange={(e) => setNewEvent({ ...newEvent, leadsGenerated: e.target.value })} placeholder="0" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Categoria</Label>
                    <Select value={newEvent.category} onValueChange={(v) => setNewEvent({ ...newEvent, category: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{eventCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Data</Label><Input type="date" value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} /></div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsEventDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddEvent}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento/Campanha</TableHead><TableHead>Categoria</TableHead>
                <TableHead className="text-right">Investido</TableHead><TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">CPL</TableHead><TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell><span className="rounded-full bg-secondary px-2 py-1 text-xs">{event.category}</span></TableCell>
                  <TableCell className="text-right">R$ {event.investedValue.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{event.leadsGenerated}</TableCell>
                  <TableCell className="text-right font-medium">R$ {event.cpl.toFixed(2)}</TableCell>
                  <TableCell>{new Date(event.date).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Proposals Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Registro de Propostas</CardTitle>
          <Dialog open={isProposalDialogOpen} onOpenChange={setIsProposalDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Nova Proposta</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar Proposta</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Nome do Cliente</Label><Input value={newProposal.clientName} onChange={(e) => setNewProposal({ ...newProposal, clientName: e.target.value })} placeholder="Nome da empresa" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Valor da Proposta (R$)</Label><Input type="number" value={newProposal.value} onChange={(e) => setNewProposal({ ...newProposal, value: e.target.value })} placeholder="0.00" /></div>
                  <div className="grid gap-2"><Label>Quantidade</Label><Input type="number" value={newProposal.quantity} onChange={(e) => setNewProposal({ ...newProposal, quantity: e.target.value })} placeholder="1" /></div>
                </div>
                <div className="grid gap-2"><Label>Data</Label><Input type="date" value={newProposal.date} onChange={(e) => setNewProposal({ ...newProposal, date: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsProposalDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddProposal}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead><TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Quantidade</TableHead><TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.clientName}</TableCell>
                  <TableCell className="text-right">R$ {p.value.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{p.quantity}</TableCell>
                  <TableCell>{new Date(p.date).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}