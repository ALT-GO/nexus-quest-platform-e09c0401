import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Monitor, Megaphone, Building2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { OperacionalTITab } from "@/components/intelligence/OperacionalTITab";
import { MarketingTab } from "@/components/intelligence/MarketingTab";

type PeriodFilter = "7d" | "30d" | "90d" | "custom";

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "custom", label: "Personalizado" },
];

export type CostCenterFilter = "all" | "eng" | "man";

export default function CentralInteligencia() {
  const [activeTab, setActiveTab] = useState("ti");
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [costCenter, setCostCenter] = useState<CostCenterFilter>("all");

  const dateRange = useMemo(() => {
    const end = new Date();
    let start: Date;
    if (period === "7d") {
      start = new Date(end.getTime() - 7 * 86400000);
    } else if (period === "90d") {
      start = new Date(end.getTime() - 90 * 86400000);
    } else if (period === "custom" && customFrom) {
      start = customFrom;
      if (customTo) {
        const customEnd = new Date(customTo);
        customEnd.setHours(23, 59, 59, 999);
        return { start, end: customEnd };
      }
    } else {
      start = new Date(end.getTime() - 30 * 86400000);
    }
    return { start: start!, end };
  }, [period, customFrom, customTo]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Dashboard"
          description="Visão consolidada de métricas, KPIs e inteligência operacional"
        />

        {/* Global filters */}
        <div className="flex flex-wrap items-end gap-2 shrink-0">
          {/* Cost Center Filter */}
          <Select value={costCenter} onValueChange={(v) => setCostCenter(v as CostCenterFilter)}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Centros</SelectItem>
              <SelectItem value="eng">Centro de Custo - ENG</SelectItem>
              <SelectItem value="man">Centro de Custo - MAN</SelectItem>
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[170px]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {period === "custom" && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !customFrom && "text-muted-foreground")}>
                    {customFrom ? format(customFrom, "dd/MM/yyyy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !customTo && "text-muted-foreground")}>
                    {customTo ? format(customTo, "dd/MM/yyyy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
          <TabsTrigger value="ti" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Monitor className="h-4 w-4" />
            T.I.
          </TabsTrigger>
          <TabsTrigger value="marketing" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Megaphone className="h-4 w-4" />
            Marketing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ti" className="mt-6">
          <OperacionalTITab dateRange={dateRange} costCenter={costCenter} />
        </TabsContent>
        <TabsContent value="marketing" className="mt-6">
          <MarketingTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
