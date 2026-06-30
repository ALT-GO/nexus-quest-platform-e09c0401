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
