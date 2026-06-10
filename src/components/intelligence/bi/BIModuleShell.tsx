import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Users, Clock, Briefcase, Smile } from "lucide-react";

export type BISubTabKey = "overview" | "productivity" | "time" | "domain" | "satisfaction";

interface Props {
  value: BISubTabKey;
  onChange: (v: BISubTabKey) => void;
  domainLabel: string;
  insights?: ReactNode;
  filters?: ReactNode;
  overview: ReactNode;
  productivity: ReactNode;
  time: ReactNode;
  domain: ReactNode;
  /** Optional Satisfação tab content. Tab is only shown when this is provided. */
  satisfaction?: ReactNode;
}

export function BIModuleShell({
  value, onChange, domainLabel,
  insights, filters,
  overview, productivity, time, domain, satisfaction,
}: Props) {
  return (
    <div className="space-y-4">
      {insights}
      {filters && (
        <div className="rounded-xl border border-border/60 bg-card/50 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/40">
          {filters}
        </div>
      )}

      <Tabs value={value} onValueChange={(v) => onChange(v as BISubTabKey)}>
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="productivity" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-3.5 w-3.5" />
            Produtividade
          </TabsTrigger>
          <TabsTrigger value="time" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Clock className="h-3.5 w-3.5" />
            Tempo & Backlog
          </TabsTrigger>
          <TabsTrigger value="domain" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Briefcase className="h-3.5 w-3.5" />
            {domainLabel}
          </TabsTrigger>
          {satisfaction && (
            <TabsTrigger value="satisfaction" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Smile className="h-3.5 w-3.5" />
              Satisfação
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-5 focus-visible:outline-none">{overview}</TabsContent>
        <TabsContent value="productivity" className="mt-5 space-y-5 focus-visible:outline-none">{productivity}</TabsContent>
        <TabsContent value="time" className="mt-5 space-y-5 focus-visible:outline-none">{time}</TabsContent>
        <TabsContent value="domain" className="mt-5 space-y-5 focus-visible:outline-none">{domain}</TabsContent>
        {satisfaction && (
          <TabsContent value="satisfaction" className="mt-5 space-y-5 focus-visible:outline-none">{satisfaction}</TabsContent>
        )}
      </Tabs>
    </div>
  );
}
