import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useTickets } from "@/hooks/use-tickets";
import { useTotalUnread, useUnreadCounts, useChatChannels } from "@/hooks/use-chat";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/hooks/use-timesheet";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Ticket as TicketIcon,
  MessageSquare,
  AtSign,
  Bell,
  Timer,
  TrendingUp,
  CalendarCheck2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  format,
  isToday,
  isPast,
  differenceInHours,
  startOfDay,
  startOfWeek,
  endOfWeek,
  subDays,
  isAfter,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
} from "recharts";

interface MarketingTaskLite {
  id: string;
  title: string;
  assignee_id: string | null;
  assignee_name: string | null;
  progress: string;
  due_date: string | null;
  priority: string;
  completed_at: string | null;
  updated_at: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

export default function Inicio() {
  const { user, roles, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { tickets, loading: ticketsLoading } = useTickets();
  const totalUnreadChat = useTotalUnread();
  const { data: channels = [] } = useChatChannels();
  const { data: unreadMap = {} } = useUnreadCounts();

  const userId = user?.id || "";
  const userEmail = user?.email || "";
  const userName = user?.user_metadata?.full_name || userEmail.split("@")[0] || "Usuário";
  const firstName = userName.split(" ")[0];
  const avatarUrl = (user?.user_metadata as any)?.avatar_url || null;

  const [marketingTasks, setMarketingTasks] = useState<MarketingTaskLite[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [timesheetTodaySec, setTimesheetTodaySec] = useState(0);

  // Fetch marketing tasks assigned to me
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("marketing_tasks")
        .select("id,title,assignee_id,assignee_name,progress,due_date,priority,completed_at,updated_at")
        .eq("assignee_id", userId)
        .order("updated_at", { ascending: false })
        .limit(200);
      setMarketingTasks((data as MarketingTaskLite[]) || []);
    })();
  }, [userId]);

  // Fetch notifications
  useEffect(() => {
    if (!userId) return;
    const load = () =>
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30)
        .then(({ data }) => setNotifications((data as NotificationItem[]) || []));
    load();
    const ch = supabase
      .channel("inicio-notifs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  // Today's timesheet
  useEffect(() => {
    if (!userId) return;
    const todayStart = startOfDay(new Date()).toISOString();
    supabase
      .from("timesheet_logs")
      .select("start_time,end_time,duration_seconds,user_id")
      .eq("user_id", userId)
      .gte("start_time", todayStart)
      .then(({ data }) => {
        let total = 0;
        ((data as any[]) || []).forEach((row) => {
          if (row.end_time) total += row.duration_seconds || 0;
          else total += Math.floor((Date.now() - new Date(row.start_time).getTime()) / 1000);
        });
        setTimesheetTodaySec(total);
      });
  }, [userId]);

  // -------- Derived data --------
  const myTickets = useMemo(
    () =>
      tickets.filter(
        (t) => t.assignee === userName || t.email === userEmail || t.requester === userName
      ),
    [tickets, userName, userEmail]
  );

  const myOpenTickets = useMemo(() => myTickets.filter((t) => !t.completed_at), [myTickets]);
  const myOpenMarketing = useMemo(
    () => marketingTasks.filter((m) => !m.completed_at),
    [marketingTasks]
  );

  const overdueCount = useMemo(() => {
    const now = new Date();
    const ticketsOverdue = myOpenTickets.filter((t) => isPast(new Date(t.sla_deadline)));
    const mktOverdue = myOpenMarketing.filter(
      (m) => m.due_date && isPast(new Date(m.due_date))
    );
    return ticketsOverdue.length + mktOverdue.length;
  }, [myOpenTickets, myOpenMarketing]);

  const completedThisWeek = useMemo(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const we = endOfWeek(new Date(), { weekStartsOn: 1 });
    const t = myTickets.filter(
      (x) =>
        x.completed_at &&
        new Date(x.completed_at) >= ws &&
        new Date(x.completed_at) <= we
    ).length;
    const m = marketingTasks.filter(
      (x) =>
        x.completed_at &&
        new Date(x.completed_at) >= ws &&
        new Date(x.completed_at) <= we
    ).length;
    return t + m;
  }, [myTickets, marketingTasks]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read),
    [notifications]
  );

  const mentions = useMemo(
    () =>
      unreadNotifications.filter(
        (n) =>
          n.title?.toLowerCase().includes("menc") ||
          n.message?.toLowerCase().includes("menc")
      ),
    [unreadNotifications]
  );

  // Productivity series: last 7 days completed counts
  const productivitySeries = useMemo(() => {
    const days: { label: string; date: Date; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      days.push({ label: format(d, "EEE", { locale: ptBR }), date: d, total: 0 });
    }
    myTickets.forEach((t) => {
      if (!t.completed_at) return;
      const c = new Date(t.completed_at);
      const day = days.find((d) => isSameDay(d.date, c));
      if (day) day.total++;
    });
    marketingTasks.forEach((m) => {
      if (!m.completed_at) return;
      const c = new Date(m.completed_at);
      const day = days.find((d) => isSameDay(d.date, c));
      if (day) day.total++;
    });
    return days;
  }, [myTickets, marketingTasks]);

  // Today's & upcoming tasks (combined, sorted by deadline)
  const upcomingTasks = useMemo(() => {
    const items: {
      id: string;
      title: string;
      due: Date | null;
      priority: string;
      type: "ticket" | "marketing";
      link: string;
      progress: string;
    }[] = [];
    myOpenTickets.forEach((t) =>
      items.push({
        id: t.id,
        title: t.title,
        due: new Date(t.sla_deadline),
        priority: t.priority,
        type: "ticket",
        link: "/ti/service-desk",
        progress: t.progress,
      })
    );
    myOpenMarketing.forEach((m) =>
      items.push({
        id: m.id,
        title: m.title,
        due: m.due_date ? new Date(m.due_date) : null,
        priority: m.priority,
        type: "marketing",
        link: "/marketing/solicitacoes",
        progress: m.progress,
      })
    );
    return items
      .sort((a, b) => {
        const av = a.due ? a.due.getTime() : Infinity;
        const bv = b.due ? b.due.getTime() : Infinity;
        return av - bv;
      })
      .slice(0, 8);
  }, [myOpenTickets, myOpenMarketing]);

  const completionRate = useMemo(() => {
    const total = myTickets.length + marketingTasks.length;
    if (total === 0) return 0;
    const done =
      myTickets.filter((t) => t.completed_at).length +
      marketingTasks.filter((m) => m.completed_at).length;
    return Math.round((done / total) * 100);
  }, [myTickets, marketingTasks]);

  const unreadChannels = useMemo(
    () =>
      (channels || [])
        .filter((c: any) => (c.unread_count || 0) > 0)
        .slice(0, 6),
    [channels]
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const roleLabel = isAdmin
    ? "Administrador"
    : roles.includes("ti")
    ? "Time de TI"
    : roles.includes("marketing")
    ? "Time de Marketing"
    : "Colaborador";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Hero greeting */}
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <UserAvatar name={userName} avatarUrl={avatarUrl} userId={userId} size="lg" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-primary">
                  {roleLabel}
                </p>
                <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
                  {greeting}, {firstName}!
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  {" · "}
                  Você tem{" "}
                  <span className="font-medium text-foreground">
                    {myOpenTickets.length + myOpenMarketing.length}
                  </span>{" "}
                  tarefas em aberto.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/ti/service-desk")}>
                <TicketIcon className="mr-2 h-4 w-4" />
                Meus chamados
              </Button>
              <Button size="sm" onClick={() => navigate("/marketing/solicitacoes")}>
                <Sparkles className="mr-2 h-4 w-4" />
                Minhas tarefas
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stat grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat
            label="Em aberto"
            value={myOpenTickets.length + myOpenMarketing.length}
            icon={TicketIcon}
            tone="primary"
            hint={`${myOpenTickets.length} chamados · ${myOpenMarketing.length} tarefas`}
          />
          <SummaryStat
            label="Atrasadas"
            value={overdueCount}
            icon={AlertTriangle}
            tone={overdueCount > 0 ? "destructive" : "muted"}
            hint="Vencidas ou em atraso"
          />
          <SummaryStat
            label="Concluídas na semana"
            value={completedThisWeek}
            icon={CheckCircle2}
            tone="success"
            hint="Esta semana"
          />
          <SummaryStat
            label="Tempo registrado hoje"
            value={formatDuration(timesheetTodaySec)}
            icon={Timer}
            tone="primary"
            hint="Timesheet"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT: Today task + Productivity */}
          <div className="space-y-6 lg:col-span-2">
            {/* Today / Upcoming tasks */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <CalendarCheck2 className="h-4 w-4 text-primary" />
                  Próximas tarefas
                </CardTitle>
                <Badge variant="secondary" className="font-normal">
                  {upcomingTasks.length} pendentes
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                {ticketsLoading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
                ) : upcomingTasks.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <CheckCircle2 className="mb-2 h-8 w-8 text-success" />
                    <p className="text-sm font-medium">Tudo em dia!</p>
                    <p className="text-xs text-muted-foreground">
                      Você não tem tarefas pendentes no momento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingTasks.map((t) => {
                      const overdue = t.due && isPast(t.due);
                      const hoursLeft = t.due ? differenceInHours(t.due, new Date()) : null;
                      return (
                        <Link
                          key={`${t.type}-${t.id}`}
                          to={t.link}
                          className="group flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-all hover:border-primary/40 hover:bg-muted/40"
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                              t.type === "ticket"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-pink-500/10 text-pink-600 dark:text-pink-400"
                            )}
                          >
                            {t.type === "ticket" ? "TI" : "MK"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{t.title}</p>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <PriorityDot priority={t.priority} />
                              <span className="capitalize">
                                {t.priority === "high"
                                  ? "Alta"
                                  : t.priority === "medium"
                                  ? "Média"
                                  : "Baixa"}
                              </span>
                              {t.due && (
                                <>
                                  <span>•</span>
                                  <span
                                    className={cn(
                                      overdue
                                        ? "font-medium text-destructive"
                                        : hoursLeft !== null && hoursLeft <= 8
                                        ? "font-medium text-amber-600 dark:text-amber-400"
                                        : ""
                                    )}
                                  >
                                    {overdue
                                      ? "Atrasada"
                                      : isToday(t.due)
                                      ? `Hoje · ${format(t.due, "HH:mm")}`
                                      : format(t.due, "dd MMM", { locale: ptBR })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Productivity chart */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Produtividade · últimos 7 dias
                </CardTitle>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Taxa de conclusão</p>
                  <p className="text-lg font-semibold text-primary">{completionRate}%</p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productivitySeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <RTooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                        formatter={(value: any) => [`${value} concluídas`, ""]}
                        labelFormatter={(l) => `Dia: ${l}`}
                      />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Notifications + chat + mentions */}
          <div className="space-y-6">
            {/* Unread chat */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Mensagens não lidas
                </CardTitle>
                {totalUnreadChat > 0 && (
                  <Badge className="bg-primary text-primary-foreground">{totalUnreadChat}</Badge>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {unreadChannels.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhuma mensagem pendente.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {unreadChannels.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => window.dispatchEvent(new CustomEvent("open-chat", { detail: { channelId: c.id } }))}
                        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.name || "Canal"}</p>
                          {c.last_message_preview && (
                            <p className="truncate text-xs text-muted-foreground">
                              {c.last_message_preview}
                            </p>
                          )}
                        </div>
                        <Badge className="ml-2 bg-primary text-primary-foreground">
                          {c.unread_count}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mentions */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <AtSign className="h-4 w-4 text-primary" />
                  Você foi mencionado
                </CardTitle>
                {mentions.length > 0 && (
                  <Badge variant="secondary" className="font-normal">
                    {mentions.length}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {mentions.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhuma menção nova.
                  </p>
                ) : (
                  <ScrollArea className="max-h-[260px] pr-3">
                    <div className="space-y-2">
                      {mentions.slice(0, 8).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => m.link && navigate(m.link)}
                          className="block w-full rounded-md border border-border/60 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                        >
                          <p className="text-xs font-medium text-foreground">{m.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {m.message}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {format(new Date(m.created_at), "dd/MM HH:mm")}
                          </p>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Other notifications */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Bell className="h-4 w-4 text-primary" />
                  Notificações recentes
                </CardTitle>
                {unreadNotifications.length > 0 && (
                  <Badge variant="secondary" className="font-normal">
                    {unreadNotifications.length} novas
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {notifications.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Sem notificações.
                  </p>
                ) : (
                  <ScrollArea className="max-h-[260px] pr-3">
                    <div className="space-y-1.5">
                      {notifications.slice(0, 10).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => n.link && navigate(n.link)}
                          className={cn(
                            "block w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted/60",
                            !n.read && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {!n.read && (
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{n.title}</p>
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                {n.message}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {format(new Date(n.created_at), "dd/MM HH:mm")}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ---------- helpers ----------

function SummaryStat({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  icon: any;
  tone: "primary" | "success" | "destructive" | "muted";
  hint?: string;
}) {
  const toneClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="border-border/60 transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold leading-tight text-foreground">{value}</p>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "high"
      ? "bg-destructive"
      : priority === "medium"
      ? "bg-amber-500"
      : "bg-emerald-500";
  return <span className={cn("h-2 w-2 rounded-full", color)} />;
}
