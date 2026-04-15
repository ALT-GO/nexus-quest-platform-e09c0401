import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Laptop, Smartphone, Phone, FileText, Tablet, Mouse } from "lucide-react";
import { CategoryTable } from "@/components/assets/CategoryTable";

export default function GestaoAtivos() {
  return (
    <AppLayout>
      <PageHeader
        title="Gestão de Ativos"
        description="Inventário de notebooks, celulares, linhas e licenças"
      />

      <Tabs defaultValue="notebooks" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1 w-full justify-start">
          <TabsTrigger value="notebooks" className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
            <Laptop className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Notebook</span>
            <span className="sm:hidden">NB</span>
          </TabsTrigger>
          <TabsTrigger value="celulares" className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            <Smartphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Celular</span>
            <span className="sm:hidden">Cel</span>
          </TabsTrigger>
          <TabsTrigger value="linhas" className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm">
            <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Linha Telefônica</span>
            <span className="sm:hidden">Linha</span>
          </TabsTrigger>
          <TabsTrigger value="tablets" className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-700 data-[state=active]:shadow-sm">
            <Tablet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Tablet</span>
          </TabsTrigger>
          <TabsTrigger value="perifericos" className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-700 data-[state=active]:shadow-sm">
            <Mouse className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Periférico</span>
            <span className="sm:hidden">Perif.</span>
          </TabsTrigger>
          <TabsTrigger value="licencas" className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-yellow-500/15 data-[state=active]:text-yellow-700 data-[state=active]:shadow-sm">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Licença</span>
            <span className="sm:hidden">Lic.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notebooks">
          <CategoryTable category="notebooks" label="Notebooks" />
        </TabsContent>
        <TabsContent value="celulares">
          <CategoryTable category="celulares" label="Celulares" />
        </TabsContent>
        <TabsContent value="tablets">
          <CategoryTable category="tablets" label="Tablets" />
        </TabsContent>
        <TabsContent value="perifericos">
          <CategoryTable category="perifericos" label="Periféricos" />
        </TabsContent>
        <TabsContent value="linhas">
          <CategoryTable category="linhas" label="Linhas telefônicas" />
        </TabsContent>
        <TabsContent value="licencas">
          <CategoryTable category="licencas" label="Licenças" />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
