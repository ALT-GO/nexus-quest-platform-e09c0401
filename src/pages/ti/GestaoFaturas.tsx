import { useState, useMemo, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, FileDown, Calculator, DollarSign, Printer, Phone, FileText, ClipboardList, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { HeaderTimbrado } from "@/components/collaborators/HeaderTimbrado";
import { FooterTimbrado } from "@/components/collaborators/FooterTimbrado";
import { InlineCellEditor } from "@/components/assets/InlineCellEditor";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type Operadora = "Claro" | "Vivo" | "Salvy" | "Microsoft";

const operadoraCategories: Record<Operadora, string> = {
  Claro: "linhas",
  Vivo: "linhas",
  Salvy: "linhas",
  Microsoft: "licencas",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface CostCenterRow {
  code: string;
  type: "eng" | "man" | "none";
  sum: number;
  adjusted: number;
  items: number;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Mensalidade Tab (Linhas / Licenças) ───
function MensalidadeTab({ category }: { category: "linhas" | "licencas" }) {
  const queryClient = useQueryClient();
  const isLinhas = category === "linhas";

  // Filters
  const [filterStatus, setFilterStatus] = useState("todas");
  const [filterOperadora, setFilterOperadora] = useState("todas");
  const [filterCC, setFilterCC] = useState("");
  const [filterLicenca, setFilterLicenca] = useState("todas");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["mensalidade", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("category", category)
        .order("asset_code");
      if (error) throw error;
      return data || [];
    },
  });

  // Derive unique values for filter dropdowns
  const uniqueOperadoras = useMemo(() => {
    const set = new Set(items.map((i) => (i.operadora || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const uniqueLicencas = useMemo(() => {
    const set = new Set(items.map((i) => (i.licenca || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  // Apply filters
  const filteredItems = useMemo(() => {
    let result = items;

    if (isLinhas) {
      if (filterOperadora !== "todas") {
        result = result.filter((i) => (i.operadora || "").trim() === filterOperadora);
      }
      if (filterStatus !== "todas") {
        result = result.filter((i) => i.status === filterStatus);
      }
    } else {
      if (filterStatus !== "todas") {
        result = result.filter((i) => i.status === filterStatus);
      }
      if (filterLicenca !== "todas") {
        result = result.filter((i) => (i.licenca || "").trim() === filterLicenca);
      }
    }

    if (filterCC.trim()) {
      const cc = filterCC.trim().toLowerCase();
      result = result.filter(
        (i) =>
          (i.cost_center_eng || "").toLowerCase().includes(cc) ||
          (i.cost_center_man || "").toLowerCase().includes(cc)
      );
    }

    return result;
  }, [items, filterStatus, filterOperadora, filterCC, filterLicenca, isLinhas]);

  const activeFilterCount = [
    filterStatus !== "todas",
    isLinhas ? filterOperadora !== "todas" : filterLicenca !== "todas",
    filterCC.trim() !== "",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterStatus("todas");
    setFilterOperadora("todas");
    setFilterCC("");
    setFilterLicenca("todas");
  };

  const handleSaveValorMensal = async (id: string, rawValue: string) => {
    const cleaned = rawValue.replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return;
    const { error } = await supabase
      .from("inventory")
      .update({ valor_mensal: num, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar valor mensal");
    } else {
      toast.success("Valor mensal atualizado");
      queryClient.invalidateQueries({ queryKey: ["mensalidade", category] });
    }
  };

  const totalMensal = filteredItems.reduce((acc, item) => acc + ((item as any).valor_mensal ?? 0), 0);

  if (isLoading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  const statusLinhas = ["Em uso", "Disponível"];
  const statusLicencas = ["Ativo", "Desligado"];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          {isLinhas ? "Mensalidade de Linhas" : "Mensalidade de Licenças"}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({filteredItems.length} de {items.length} itens • Total: {formatBRL(totalMensal)}/mês)
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
              <X className="h-3 w-3" /> Limpar filtros
            </Button>
          )}
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-3" align="end">
              <p className="text-sm font-semibold">Filtros</p>

              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todos</SelectItem>
                    {(isLinhas ? statusLinhas : statusLicencas).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLinhas ? (
                <div>
                  <Label className="text-xs">Operadora</Label>
                  <Select value={filterOperadora} onValueChange={setFilterOperadora}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {uniqueOperadoras.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Tipo de Licença</Label>
                  <Select value={filterLicenca} onValueChange={setFilterLicenca}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {uniqueLicencas.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-xs">Centro de Custo</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Ex: 9018"
                  value={filterCC}
                  onChange={(e) => setFilterCC(e.target.value)}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">ID</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                {isLinhas ? (
                  <>
                    <TableHead className="whitespace-nowrap">Número</TableHead>
                    <TableHead className="whitespace-nowrap">Colaborador</TableHead>
                    <TableHead className="whitespace-nowrap">Operadora</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="whitespace-nowrap">E-mail</TableHead>
                    <TableHead className="whitespace-nowrap">Colaborador</TableHead>
                    <TableHead className="whitespace-nowrap">Licença</TableHead>
                  </>
                )}
                <TableHead className="whitespace-nowrap">CC - Eng</TableHead>
                <TableHead className="whitespace-nowrap">CC - Man</TableHead>
                <TableHead className="whitespace-nowrap text-right">Valor Mensal (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const valorMensal = (item as any).valor_mensal;
                const statusColor = item.status === "Ativo" || item.status === "Em uso"
                  ? "bg-emerald-500/15 text-emerald-700"
                  : item.status === "Desligado" || item.status === "Baixado"
                    ? "bg-red-500/15 text-red-700"
                    : "bg-muted text-muted-foreground";
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.asset_code}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                        {item.status}
                      </span>
                    </TableCell>
                    {isLinhas ? (
                      <>
                        <TableCell className="text-sm">{item.numero || <span className="text-muted-foreground italic">—</span>}</TableCell>
                        <TableCell className="text-sm">{item.collaborator || <span className="text-muted-foreground italic">—</span>}</TableCell>
                        <TableCell className="text-sm">{item.operadora || <span className="text-muted-foreground italic">—</span>}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-sm">{item.email_address || <span className="text-muted-foreground italic">—</span>}</TableCell>
                        <TableCell className="text-sm">{item.collaborator || <span className="text-muted-foreground italic">—</span>}</TableCell>
                        <TableCell className="text-sm">{item.licenca || <span className="text-muted-foreground italic">—</span>}</TableCell>
                      </>
                    )}
                    <TableCell className="text-sm">{item.cost_center_eng || <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell className="text-sm">{item.cost_center_man || <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell className="text-right">
                      <InlineCellEditor
                        value={valorMensal != null && valorMensal !== "" ? String(valorMensal) : ""}
                        onSave={(v) => handleSaveValorMensal(item.id, v)}
                        type="number"
                        displayRender={(v) => (
                          <span className="text-sm font-medium">
                            {v ? formatBRL(parseFloat(v)) : <span className="text-muted-foreground italic">—</span>}
                          </span>
                        )}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───
export default function GestaoFaturas() {
  type EmpresaFilter = "eng" | "man" | "ambas";

  // Report generator modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportOp, setReportOp] = useState<Operadora | "">("");
  const [reportMes, setReportMes] = useState(String(new Date().getMonth())); // 0-indexed
  const [reportAno, setReportAno] = useState(String(new Date().getFullYear()));
  const [reportEmpresa, setReportEmpresa] = useState<EmpresaFilter>("ambas");
  const [ajusteGlobal, setAjusteGlobal] = useState("");

  // Report data state (generated after clicking "Gerar")
  const [generated, setGenerated] = useState(false);
  const [generatedOp, setGeneratedOp] = useState<Operadora>("Claro");
  const [generatedMesAno, setGeneratedMesAno] = useState("");
  const [generatedEmpresa, setGeneratedEmpresa] = useState<EmpresaFilter>("ambas");
  const [reportItems, setReportItems] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  // PDF dialog
  const [pdfOpen, setPdfOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const handleGenerateReport = async () => {
    if (!reportOp) { toast.error("Selecione uma operadora"); return; }
    setReportLoading(true);

    const category = operadoraCategories[reportOp];
    let query = supabase.from("inventory").select("*").eq("category", category);
    if (category === "linhas") query = query.eq("operadora", reportOp);
    if (category === "licencas") query = query.eq("status", "Ativo");

    const { data, error } = await query;
    setReportLoading(false);

    if (error) { toast.error("Erro ao buscar dados"); return; }

    setReportItems(data || []);
    setGeneratedOp(reportOp);
    setGeneratedMesAno(`${MESES[parseInt(reportMes)]} de ${reportAno}`);
    setGenerated(true);
    setAjusteGlobal("");
    setReportModalOpen(false);
  };

  // Compute cost center rows from reportItems
  const rows = useMemo<CostCenterRow[]>(() => {
    if (!reportItems.length) return [];
    const map = new Map<string, { sum: number; items: number; type: "eng" | "man" | "none" }>();

    for (const item of reportItems) {
      const valor = (item as any).valor_mensal ?? 0;
      if (valor <= 0) continue;

      const eng = ((item as any).cost_center_eng || "").trim();
      const man = ((item as any).cost_center_man || "").trim();

      if (eng) {
        const existing = map.get(`eng:${eng}`) || { sum: 0, items: 0, type: "eng" as const };
        existing.sum += valor;
        existing.items += 1;
        map.set(`eng:${eng}`, existing);
      }
      if (man) {
        const existing = map.get(`man:${man}`) || { sum: 0, items: 0, type: "man" as const };
        existing.sum += valor;
        existing.items += 1;
        map.set(`man:${man}`, existing);
      }
      if (!eng && !man) {
        const existing = map.get(`none:9999`) || { sum: 0, items: 0, type: "none" as const };
        existing.sum += valor;
        existing.items += 1;
        map.set(`none:9999`, existing);
      }
    }

    return Array.from(map.entries()).map(([key, val]) => ({
      code: key.split(":")[1],
      type: val.type,
      sum: val.sum,
      adjusted: val.sum,
      items: val.items,
    }));
  }, [reportItems]);

  const totalBase = rows.reduce((acc, r) => acc + r.sum, 0);
  const ajusteNum = parseFloat((ajusteGlobal || "0").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;

  const adjustedRows = useMemo(() => {
    if (!ajusteNum || totalBase === 0) return rows.map((r) => ({ ...r, adjusted: r.sum }));
    return rows.map((r) => ({
      ...r,
      adjusted: r.sum + (r.sum / totalBase) * ajusteNum,
    }));
  }, [rows, ajusteNum, totalBase]);

  const totalAdjusted = adjustedRows.reduce((acc, r) => acc + r.adjusted, 0);

  const handleExportCSV = () => {
    if (!adjustedRows.length) return;
    const header = "Centro de Custo;Descrição;Qtd Itens;Valor Total do Rateio";
    const lines = adjustedRows.map(
      (r) => `${r.code};${r.code === "9999" ? "Sem CC (alerta)" : r.type === "eng" ? "Engenharia" : "Manutenção"};${r.items};${r.adjusted.toFixed(2)}`
    );
    const totalLine = `TOTAL;;${adjustedRows.reduce((a, r) => a + r.items, 0)};${totalAdjusted.toFixed(2)}`;
    const csv = [header, ...lines, totalLine].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rateio_${generatedOp}_${generatedMesAno.replace(/ /g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso");
  };

  const handlePrint = () => {
    setPdfOpen(true);
    setTimeout(() => window.print(), 400);
  };

  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <AppLayout>
      <PageHeader
        title="Gestão de Custos"
        description="Lançamento de mensalidades e fechamento de faturas"
      />

      <Tabs defaultValue="rateio" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
          <TabsTrigger value="rateio" className="gap-2 px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <DollarSign className="h-4 w-4" />
            <span>Rateio & PDF</span>
          </TabsTrigger>
          <TabsTrigger value="linhas" className="gap-2 px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Phone className="h-4 w-4" />
            <span>Mensalidade de Linhas</span>
          </TabsTrigger>
          <TabsTrigger value="licencas" className="gap-2 px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" />
            <span>Mensalidade de Licenças</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Rateio & PDF ─── */}
        <TabsContent value="rateio">
          <div className="space-y-6">
            {/* Action card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Fechamento de Fatura
                </CardTitle>
                <Button onClick={() => setReportModalOpen(true)}>
                  <DollarSign className="h-4 w-4 mr-1" />
                  Gerar Relatório de Rateio
                </Button>
              </CardHeader>
              {!generated && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Gerar Relatório de Rateio" para selecionar o mês, ano e operadora, e gerar o relatório de rateio por centro de custo.
                  </p>
                </CardContent>
              )}
            </Card>

            {/* Generated report results */}
            {generated && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Rateio — {generatedOp}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Competência: {generatedMesAno} • {reportItems.length} itens total •
                      {(() => {
                        const ignored = reportItems.filter((i) => !((i as any).valor_mensal > 0)).length;
                        return ignored > 0
                          ? <span className="text-destructive"> {ignored} ignorados (sem valor)</span>
                          : <span> todos com valor preenchido</span>;
                      })()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-end gap-2">
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <Calculator className="h-3 w-3" /> Ajuste Global (R$)
                        </Label>
                        <Input
                          className="h-8 w-40 text-sm"
                          placeholder="Ex: 50.00"
                          value={ajusteGlobal}
                          onChange={(e) => setAjusteGlobal(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handlePrint} disabled={!adjustedRows.length}>
                      <Printer className="h-4 w-4 mr-1" />
                      Gerar PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!adjustedRows.length}>
                      <FileDown className="h-4 w-4 mr-1" />
                      Exportar CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {adjustedRows.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      Nenhum item com Valor Mensal encontrado para esta operadora.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Centro de Custo</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Itens Inclusos</TableHead>
                            <TableHead className="text-right">Valor Base</TableHead>
                            {ajusteNum !== 0 && <TableHead className="text-right">Ajuste</TableHead>}
                            <TableHead className="text-right">Valor Total do Rateio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adjustedRows.map((row) => (
                            <TableRow key={`${row.type}:${row.code}`}>
                              <TableCell className="font-mono text-sm">{row.code}</TableCell>
                              <TableCell className="text-sm">
                                {row.code === "9999" ? <span className="text-destructive font-medium">⚠ Sem centro de custo</span> : row.type === "eng" ? "Engenharia" : "Manutenção"}
                              </TableCell>
                              <TableCell className="text-right text-sm">{row.items}</TableCell>
                              <TableCell className="text-right text-sm">{formatBRL(row.sum)}</TableCell>
                              {ajusteNum !== 0 && (
                                <TableCell className="text-right text-sm text-amber-600">
                                  {formatBRL(row.adjusted - row.sum)}
                                </TableCell>
                              )}
                              <TableCell className="text-right text-sm font-medium">{formatBRL(row.adjusted)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-semibold">
                            <TableCell>TOTAL</TableCell>
                            <TableCell />
                            <TableCell className="text-right">{adjustedRows.reduce((a, r) => a + r.items, 0)}</TableCell>
                            <TableCell className="text-right">{formatBRL(totalBase)}</TableCell>
                            {ajusteNum !== 0 && (
                              <TableCell className="text-right text-amber-600">{formatBRL(ajusteNum)}</TableCell>
                            )}
                            <TableCell className="text-right">{formatBRL(totalAdjusted)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {adjustedRows.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                      <div className="flex gap-6 text-sm">
                        <span>Total de itens com valor: <strong>{adjustedRows.reduce((a, r) => a + r.items, 0)}</strong></span>
                        <span>Valor Total da Fatura: <strong>{formatBRL(totalAdjusted)}</strong></span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ─── Tab: Mensalidade de Linhas ─── */}
        <TabsContent value="linhas">
          <MensalidadeTab category="linhas" />
        </TabsContent>

        {/* ─── Tab: Mensalidade de Licenças ─── */}
        <TabsContent value="licencas">
          <MensalidadeTab category="licencas" />
        </TabsContent>
      </Tabs>

      {/* ===== Modal: Selecionar Mês/Ano e Operadora ===== */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Relatório de Rateio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mês</Label>
                <Select value={reportMes} onValueChange={setReportMes}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Select value={reportAno} onValueChange={setReportAno}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Operadora / Serviço</Label>
              <Select value={reportOp} onValueChange={(v) => setReportOp(v as Operadora)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Claro">Claro</SelectItem>
                  <SelectItem value="Vivo">Vivo</SelectItem>
                  <SelectItem value="Salvy">Salvy</SelectItem>
                  <SelectItem value="Microsoft">Microsoft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReportModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleGenerateReport} disabled={reportLoading || !reportOp}>
                {reportLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ClipboardList className="h-4 w-4 mr-1" />}
                Gerar Relatório
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== PDF Document ===== */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-[900px] max-h-[95vh] overflow-y-auto print:!block">
          <DialogHeader className="print:hidden">
            <DialogTitle>Relatório de Rateio — {generatedOp}</DialogTitle>
          </DialogHeader>

          <div
            ref={printRef}
            className="print-page p-6 mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col relative"
            style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif", fontSize: "11pt", lineHeight: "1.4" }}
          >
            <div className="print-header-table">
              <HeaderTimbrado
                title="Relatório de Rateio de Custos"
                prefix={`Operadora: ${generatedOp}`}
                docCode="FF.RTC"
                revision="Rev. 01"
              />
            </div>

            <div className="flex-1 space-y-4 mt-2">
              <div className="text-sm">
                <p><strong>Operadora:</strong> {generatedOp}</p>
                <p><strong>Competência:</strong> {generatedMesAno}</p>
                <p><strong>Data de emissão:</strong> {today}</p>
                {ajusteNum !== 0 && (
                  <p><strong>Ajuste global aplicado:</strong> {formatBRL(ajusteNum)}</p>
                )}
              </div>

              <table className="w-full border-collapse text-sm" style={{ fontSize: "10pt" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <th className="border border-gray-400 px-3 py-2 text-left font-semibold">Centro de Custo</th>
                    <th className="border border-gray-400 px-3 py-2 text-left font-semibold">Descrição</th>
                    <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Qtd Itens</th>
                    <th className="border border-gray-400 px-3 py-2 text-right font-semibold">Valor Total do Rateio</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustedRows.map((row, i) => (
                    <tr key={i} style={{ pageBreakInside: "avoid" }}>
                      <td className="border border-gray-400 px-3 py-1.5 font-mono">{row.code}</td>
                      <td className="border border-gray-400 px-3 py-1.5">
                        {row.code === "9999" ? "⚠ Sem centro de custo" : row.type === "eng" ? "Engenharia" : "Manutenção"}
                      </td>
                      <td className="border border-gray-400 px-3 py-1.5 text-center">{row.items}</td>
                      <td className="border border-gray-400 px-3 py-1.5 text-right font-medium">{formatBRL(row.adjusted)}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#e5e7eb", fontWeight: 700 }}>
                    <td className="border border-gray-400 px-3 py-2" colSpan={2}>TOTAL GERAL DA FATURA</td>
                    <td className="border border-gray-400 px-3 py-2 text-center">
                      {adjustedRows.reduce((a, r) => a + r.items, 0)}
                    </td>
                    <td className="border border-gray-400 px-3 py-2 text-right text-base">{formatBRL(totalAdjusted)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="pt-8 mt-auto" style={{ pageBreakInside: "avoid" }}>
                <div className="flex justify-between gap-8">
                  <div className="flex-1 text-center">
                    <div className="border-t border-gray-600 pt-1 mt-12">
                      <p className="text-sm font-medium">Responsável TI</p>
                      <p className="text-xs text-gray-500">Data: ____/____/________</p>
                    </div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="border-t border-gray-600 pt-1 mt-12">
                      <p className="text-sm font-medium">Aprovação Financeiro</p>
                      <p className="text-xs text-gray-500">Data: ____/____/________</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="print-footer-container mt-auto pt-2">
              <FooterTimbrado />
            </div>
          </div>

          <div className="flex justify-end gap-2 print:hidden mt-4">
            <Button variant="outline" onClick={() => setPdfOpen(false)}>Fechar</Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
