import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Smile, Loader2, MessageSquare, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BIStatCard } from "./bi/BIStatCard";
import { BIChartCard } from "./bi/BIChartCard";
import { BI_SEMANTIC, BI_TOOLTIP_STYLE } from "./bi/bi-theme";

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
  const [rows, setRows] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <BIStatCard
          title="Respostas no período"
          value={rows.length}
          icon={MessageSquare}
          tone="info"
        />
        <BIStatCard
          title="Nota Geral"
          value={overallAvg ? overallAvg.toFixed(1) : "—"}
          icon={Star}
          tone={overallAvg >= 8 ? "success" : overallAvg >= 6 ? "warning" : overallAvg ? "destructive" : "info"}
          description="Média global (1 a 10)"
        />
        {averages.map((a) => (
          <BIStatCard
            key={a.key}
            title={a.label}
            value={a.avg ? a.avg.toFixed(1) : "—"}
            icon={Smile}
            tone={a.avg >= 8 ? "success" : a.avg >= 6 ? "warning" : a.avg ? "destructive" : "info"}
            description="Média (1 a 10)"
          />
        ))}
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
      <BIChartCard title="Respostas recebidas" icon={MessageSquare} padded={false}>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </BIChartCard>
    </div>
  );
}
