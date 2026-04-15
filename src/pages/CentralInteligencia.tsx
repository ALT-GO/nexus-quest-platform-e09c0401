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
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { OperacionalTITab } from "@/components/intelligence/OperacionalTITab";
import { MarketingTab } from "@/components/intelligence/MarketingTab";

type PeriodFilter = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "this_week", label: "Essa semana" },
  { value: "last_week", label: "Semana anterior" },
  { value: "this_month", label: "Esse mês" },
  { value: "last_month", label: "Mês anterior" },
  { value: "custom", label: "Personalizado" },
];

export type CostCenterFilter = "all" | "eng" | "man";

export default function CentralInteligencia() {
  const [activeTab, setActiveTab] = useState("ti");
  const [period, setPeriod] = useState<PeriodFilter>("this_month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [costCenter, setCostCenter] = useState<CostCenterFilter>("all");

  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case "this_week":
        start = startOfWeek(now, { weekStartsOn: 1, locale: ptBR });
        end = now;
        break;
      case "last_week": {
        const lastW = subWeeks(now, 1);
        start = startOfWeek(lastW, { weekStartsOn: 1, locale: ptBR });
        end = endOfWeek(lastW, { weekStartsOn: 1, locale: ptBR });
        break;
      }
      case "this_month":
        start = startOfMonth(now);
        end = now;
        break;
      case "last_month": {
        const lastM = subMonths(now, 1);
        start = startOfMonth(lastM);
        end = endOfMonth(lastM);
        break;
      }
      case "custom":
        start = customFrom || now;
        if (customTo) {
          end = new Date(customTo);
          end.setHours(23, 59, 59, 999);
        } else {
          end = now;
        }
        break;
      default:
        start = startOfMonth(now);
        end = now;
    }
    return { start, end };
  }, [period, customFrom, customTo]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Dashboard"
          description="Visão consolidada de métricas, KPIs e inteligência operacional"
        />

        {/* Global filters */}
        <div className="flex flex-wrap items-end gap-2">
          {/* Cost Center Filter */}
          <Select value={costCenter} onValueChange={(v) => setCostCenter(v as CostCenterFilter)}>
            <SelectTrigger className="w-full sm:w-[200px]">
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
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[170px]">
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
                  <Button variant="outline" className={cn("w-[calc(50%-4px)] sm:w-[130px] justify-start text-left font-normal", !customFrom && "text-muted-foreground")}>
                    {customFrom ? format(customFrom, "dd/MM/yyyy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[calc(50%-4px)] sm:w-[130px] justify-start text-left font-normal", !customTo && "text-muted-foreground")}>
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
          <MarketingTab dateRange={dateRange} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
