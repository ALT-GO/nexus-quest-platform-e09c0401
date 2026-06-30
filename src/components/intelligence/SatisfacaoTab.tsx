import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Smile, Loader2, MessageSquare, Star, Download, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BIStatCard } from "./bi/BIStatCard";
import { BIChartCard } from "./bi/BIChartCard";
import { BI_SEMANTIC, BI_TOOLTIP_STYLE } from "./bi/bi-theme";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useAuth } from "@/hooks/use-auth";

interface SurveyRow {
  id: string;
  ticket_number: string | null;
  user_name: string;
  user_email: string;
  rating_response_time: number;
  rating_communication: number;
  rating_resolution: number;
  rating_ease_of_use: number;
  comment: string | null;
  created_at: string;
}

interface Props {
  dateRange: { start: Date; end: Date };
  /** Compact mode for overview embedding. */
  compact?: boolean;
}

const CRITERIA = [
  { key: "rating_response_time" as const, label: "Tempo de Resposta", color: BI_SEMANTIC.created },
  { key: "rating_communication" as const, label: "Comunicação", color: BI_SEMANTIC.primary },
  { key: "rating_resolution" as const, label: "Resolução", color: BI_SEMANTIC.completed },
  { key: "rating_ease_of_use" as const, label: "Facilidade", color: BI_SEMANTIC.pending },
];

export function SatisfacaoTab({ dateRange, compact = false }: Props) {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("satisfaction_surveys" as any)
        .select("*")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (error) console.warn("satisfaction_surveys fetch error", error);
        setRows(((data as any) || []) as SurveyRow[]);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel("satisfaction-surveys-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "satisfaction_surveys" },
        () => {
          supabase
            .from("satisfaction_surveys" as any)
            .select("*")
            .gte("created_at", dateRange.start.toISOString())
            .lte("created_at", dateRange.end.toISOString())
            .order("created_at", { ascending: false })
            .then(({ data }) => setRows(((data as any) || []) as SurveyRow[]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [dateRange.start, dateRange.end]);

  const averages = useMemo(() => {
    if (!rows.length) return CRITERIA.map((c) => ({ ...c, avg: 0 }));
    return CRITERIA.map((c) => ({
      ...c,
      avg: rows.reduce((s, r) => s + (r[c.key] || 0), 0) / rows.length,
    }));
  }, [rows]);

  const overallAvg = useMemo(() => {
    if (!averages.length) return 0;
    return averages.reduce((s, a) => s + a.avg, 0) / averages.length;
  }, [averages]);

  const handleExportExcel = () => {
    if (!rows.length) {
      toast.error("Nenhuma resposta para exportar");
      return;
    }
    const sheetData = rows.map((r) => ({
      Data: format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      Chamado: r.ticket_number || "—",
      Nome: r.user_name,
      "E-mail": r.user_email,
      "Tempo de Resposta": r.rating_response_time,
      Comunicação: r.rating_communication,
      Resolução: r.rating_resolution,
      Facilidade: r.rating_ease_of_use,
      "Média": (
        (r.rating_response_time + r.rating_communication + r.rating_resolution + r.rating_ease_of_use) /
        4
      ).toFixed(2),
      Comentário: r.comment || "",
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 28 },
      { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 50 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Satisfação");
    XLSX.writeFile(wb, `pesquisa-satisfacao-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Planilha exportada!");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("satisfaction_surveys" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir resposta");
      console.error(error);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Resposta excluída");
  };

  const fmtPct = (v: number) => (v ? `${(v * 10).toFixed(1)}%` : "—");
  const overallPct = overallAvg * 10;
  const GOAL_PCT = 90;

  // Monthly evolution (last 6 months including current)
  const monthlySeries = useMemo(() => {
    const months: { key: string; label: string; year: number; month: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: format(d, "MMM", { locale: ptBR }).replace(".", ""),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return months.map((m) => {
      const monthRows = rows.filter((r) => {
        const d = new Date(r.created_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const avg = monthRows.length
        ? monthRows.reduce(
            (s, r) =>
              s +
              (r.rating_response_time + r.rating_communication + r.rating_resolution + r.rating_ease_of_use) / 4,
            0,
          ) / monthRows.length
        : 0;
      return { month: m.label, pct: avg ? Number((avg * 10).toFixed(2)) : 0, hasData: monthRows.length > 0 };
    });
  }, [rows]);

  // Gauge data (semi-circle)
  const gaugeData = useMemo(() => {
    const v = Math.max(0, Math.min(100, overallPct));
    return [
      { name: "filled", value: v },
      { name: "rest", value: 100 - v },
    ];
  }, [overallPct]);

  const gaugeColor = overallPct >= 90 ? "hsl(var(--success))" : overallPct >= 70 ? "hsl(var(--warning))" : overallPct ? "hsl(var(--destructive))" : "hsl(var(--muted))";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BIStatCard
          title="Respostas no período"
          value={rows.length}
          icon={MessageSquare}
          tone="info"
        />

        {/* Custom Nota Geral card with gauge + monthly trend */}
        <div className="lg:col-span-2 rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/40 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nota Geral</p>
              <p className="text-xs text-muted-foreground mt-0.5">Meta: {GOAL_PCT}%</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <Star className="h-5 w-5" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Gauge */}
            <div className="relative h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gaugeData}
                    cx="50%"
                    cy="85%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={gaugeColor} />
                    <Cell fill="hsl(var(--muted))" fillOpacity={0.35} />
                  </Pie>
                  {/* Goal tick: render as a thin pie slice */}
                  <Pie
                    data={[
                      { value: GOAL_PCT - 0.6 },
                      { value: 1.2 },
                      { value: Math.max(0, 100 - GOAL_PCT - 0.6) },
                    ]}
                    cx="50%"
                    cy="85%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={66}
                    outerRadius={104}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={false}
                  >
                    <Cell fill="transparent" />
                    <Cell fill="hsl(var(--foreground))" />
                    <Cell fill="transparent" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-2">
                <span className="text-3xl font-bold tabular-nums tracking-tight" style={{ color: gaugeColor }}>
                  {overallPct ? `${overallPct.toFixed(1)}%` : "—"}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Média global</span>
              </div>
            </div>
            {/* Monthly evolution */}
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySeries} margin={{ top: 18, right: 10, bottom: 4, left: -20 }}>
                  <defs>
                    <linearGradient id="satFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={gaugeColor} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={gaugeColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={BI_TOOLTIP_STYLE}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, "Satisfação"]}
                  />
                  <ReferenceLine y={GOAL_PCT} stroke="hsl(var(--foreground))" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `Meta ${GOAL_PCT}%`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Area type="monotone" dataKey="pct" stroke={gaugeColor} strokeWidth={2.5} fill="url(#satFill)" dot={{ r: 3, fill: gaugeColor }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Criteria KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {averages.map((a) => {
          const pct = a.avg * 10;
          return (
            <BIStatCard
              key={a.key}
              title={a.label}
              value={a.avg ? `${pct.toFixed(1)}%` : "—"}
              icon={Smile}
              tone={pct >= 80 ? "success" : pct >= 60 ? "warning" : a.avg ? "destructive" : "info"}
              description="Satisfação (0–100%)"
            />
          );
        })}
      </div>

      {/* Chart: average per criterion */}
      <BIChartCard title="Média por critério" icon={Smile} iconColor="text-primary">
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={averages} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={BI_TOOLTIP_STYLE}
                formatter={(v: number) => [v.toFixed(2), "Média"]}
              />
              <Bar dataKey="avg" radius={[6, 6, 0, 0]} fill={BI_SEMANTIC.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </BIChartCard>

      {/* Responses table */}
      <BIChartCard
        title="Respostas recebidas"
        icon={MessageSquare}
        padded={false}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              disabled={!rows.length}
              className="gap-1.5"
              title="Pré-visualizar todas as respostas"
            >
              <Eye className="h-4 w-4" />
              Pré-visualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={!rows.length}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Nenhuma resposta de pesquisa de satisfação no período selecionado.
          </p>
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="text-center">Tempo Resp.</TableHead>
                  <TableHead className="text-center">Comunicação</TableHead>
                  <TableHead className="text-center">Resolução</TableHead>
                  <TableHead className="text-center">Facilidade</TableHead>
                  <TableHead>Comentário</TableHead>
                  {isAdmin && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(compact ? rows.slice(0, 10) : rows).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">{r.user_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.user_email}</TableCell>
                    <TableCell className="text-center font-medium tabular-nums">{r.rating_response_time}</TableCell>
                    <TableCell className="text-center font-medium tabular-nums">{r.rating_communication}</TableCell>
                    <TableCell className="text-center font-medium tabular-nums">{r.rating_resolution}</TableCell>
                    <TableCell className="text-center font-medium tabular-nums">{r.rating_ease_of_use}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={r.comment || ""}>
                      {r.comment || "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="w-10 text-right">
                        <ConfirmDeleteDialog
                          onConfirm={() => handleDelete(r.id)}
                          title="Excluir resposta"
                          description={`Tem certeza que deseja excluir esta resposta de ${r.user_name}? Esta ação não pode ser desfeita.`}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </BIChartCard>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Pré-visualização — Respostas de Satisfação ({rows.length})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-max min-w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-10 bg-background border-b">
                <tr>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground whitespace-nowrap">Data</th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground whitespace-nowrap">Chamado</th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground whitespace-nowrap">Nome</th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground whitespace-nowrap">E-mail</th>
                  <th className="h-11 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">Tempo Resp.</th>
                  <th className="h-11 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">Comunicação</th>
                  <th className="h-11 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">Resolução</th>
                  <th className="h-11 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">Facilidade</th>
                  <th className="h-11 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">Média</th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[400px]">Comentário / Observações</th>
                  {isAdmin && <th className="h-11 px-3 text-right font-medium text-muted-foreground whitespace-nowrap sticky right-0 bg-background">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const media = (
                    (r.rating_response_time + r.rating_communication + r.rating_resolution + r.rating_ease_of_use) / 4
                  ).toFixed(2);
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{r.ticket_number || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{r.user_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{r.user_email}</td>
                      <td className="px-3 py-2 text-center font-medium tabular-nums">{r.rating_response_time}</td>
                      <td className="px-3 py-2 text-center font-medium tabular-nums">{r.rating_communication}</td>
                      <td className="px-3 py-2 text-center font-medium tabular-nums">{r.rating_resolution}</td>
                      <td className="px-3 py-2 text-center font-medium tabular-nums">{r.rating_ease_of_use}</td>
                      <td className="px-3 py-2 text-center font-semibold tabular-nums">{media}</td>
                      <td className="px-3 py-2 text-sm min-w-[400px] whitespace-pre-wrap break-words">
                        {r.comment || <span className="text-muted-foreground italic">—</span>}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-right sticky right-0 bg-background">
                          <ConfirmDeleteDialog
                            onConfirm={() => handleDelete(r.id)}
                            title="Excluir resposta"
                            description={`Tem certeza que deseja excluir esta resposta de ${r.user_name}? Esta ação não pode ser desfeita.`}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 11 : 10} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      Nenhuma resposta no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
