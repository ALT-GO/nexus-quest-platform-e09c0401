import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Plus, Loader2, Send, Search, Package, CheckCircle2, AlertTriangle, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createTicket, runTicketCreatedAutomations } from "@/hooks/use-tickets";

const baseCategories = [
  "Acesso e permissões",
  "Problemas com Computador/Notebook",
  "Problemas com Celular/Tablet",
  "Rede e Internet",
  "E-mail e Comunicação",
  "Serviços de Impressão",
  "Sistemas Corporativos",
  "Solicitação de novo Computador/Notebook",
  "Solicitação de novo Celular",
  "Solicitação de Tablet",
  "Solicitação de nova Linha",
  "Gerais/Outros",
  "Desligamento",
  "Contratação",
];

interface InventoryAsset {
  id: string;
  asset_code: string;
  model: string | null;
  asset_type: string | null;
  category: string;
  status: string;
  service_tag: string | null;
  collaborator: string | null;
}

interface DesligamentoFields {
  colaborador: string;
  gestor: string;
  contrato: string;
  celular: boolean;
  chip: boolean;
  notebook: boolean;
  modem: boolean;
  email: boolean;
  dataDesligamento: string;
}

interface ContratacaoFields {
  colaborador: string;
  centroCusto: string;
  celular: boolean;
  chip: boolean;
  notebook: boolean;
  email: boolean;
  dataContratacao: string;
}

const defaultDesligamento: DesligamentoFields = {
  colaborador: "",
  gestor: "",
  contrato: "",
  celular: false,
  chip: false,
  notebook: false,
  modem: false,
  email: false,
  dataDesligamento: "",
};

const defaultContratacao: ContratacaoFields = {
  colaborador: "",
  centroCusto: "",
  celular: false,
  chip: false,
  notebook: false,
  email: false,
  dataContratacao: "",
};

const parseStoredDate = (value: string) => (value ? new Date(`${value}T12:00:00`) : undefined);
const toStoredDate = (value?: Date) => (value ? format(value, "yyyy-MM-dd") : "");

export function NewTicketDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState("");
  const [requester, setRequester] = useState("");
  const [emailField, setEmailField] = useState("");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [desligamento, setDesligamento] = useState<DesligamentoFields>(defaultDesligamento);
  const [contratacao, setContratacao] = useState<ContratacaoFields>(defaultContratacao);

  // Asset search state for Desligamento
  const [foundAssets, setFoundAssets] = useState<InventoryAsset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [searchingAssets, setSearchingAssets] = useState(false);

  // Collaborator autocomplete state
  const [allCollaborators, setAllCollaborators] = useState<string[]>([]);
  const [filteredCollaborators, setFilteredCollaborators] = useState<string[]>([]);
  const [showCollaboratorDropdown, setShowCollaboratorDropdown] = useState(false);
  const [collaboratorSelected, setCollaboratorSelected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Stock check state for Contratação
  const [stockNotebooks, setStockNotebooks] = useState<InventoryAsset[]>([]);
  const [stockCelulares, setStockCelulares] = useState<InventoryAsset[]>([]);
  const [checkingStock, setCheckingStock] = useState(false);

  const isDesligamento = category === "Desligamento";
  const isContratacao = category === "Contratação";

  // Fetch unique collaborators from inventory when entering Desligamento
  useEffect(() => {
    if (!isDesligamento) return;
    const fetchCollaborators = async () => {
      const { data } = await supabase
        .from("inventory")
        .select("collaborator")
        .neq("collaborator", "")
        .not("collaborator", "is", null);
      if (data) {
        const unique = [...new Set(data.map((d: any) => d.collaborator as string).filter(Boolean))].sort();
        setAllCollaborators(unique);
      }
    };
    fetchCollaborators();
  }, [isDesligamento]);

  // Filter collaborators based on typed input
  useEffect(() => {
    const q = desligamento.colaborador.trim().toLowerCase();
    if (!q || collaboratorSelected) {
      setFilteredCollaborators([]);
      return;
    }
    setFilteredCollaborators(allCollaborators.filter((c) => c.toLowerCase().includes(q)));
  }, [desligamento.colaborador, allCollaborators, collaboratorSelected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCollaboratorDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch exact assets when a collaborator is selected
  const fetchAssetsForCollaborator = useCallback(async (name: string) => {
    if (!name.trim()) {
      setFoundAssets([]);
      setSelectedAssetIds(new Set());
      return;
    }
    setSearchingAssets(true);
    const { data, error } = await supabase
      .from("inventory")
      .select("id, asset_code, model, asset_type, category, status, service_tag, collaborator")
      .eq("collaborator", name.trim());

    if (error) {
      console.error("Error searching assets:", error);
    } else {
      setFoundAssets((data as InventoryAsset[]) || []);
      setSelectedAssetIds(new Set((data || []).map((a: any) => a.id)));
    }
    setSearchingAssets(false);
  }, []);

  const handleSelectCollaborator = (name: string) => {
    setDesligamento((prev) => ({ ...prev, colaborador: name }));
    setCollaboratorSelected(true);
    setShowCollaboratorDropdown(false);
    fetchAssetsForCollaborator(name);
  };

  const handleCollaboratorInputChange = (value: string) => {
    setDesligamento((prev) => ({ ...prev, colaborador: value }));
    setCollaboratorSelected(false);
    setShowCollaboratorDropdown(true);
    if (value.trim().length < 2) {
      setFoundAssets([]);
      setSelectedAssetIds(new Set());
    }
  };

  // Stock check for Contratação when celular/notebook toggles change
  useEffect(() => {
    if (!isContratacao) {
      setStockNotebooks([]);
      setStockCelulares([]);
      return;
    }

    const checkStock = async () => {
      setCheckingStock(true);

      if (contratacao.notebook) {
        const { data } = await supabase
          .from("inventory")
          .select("id, asset_code, model, asset_type, category, status, service_tag, collaborator")
          .eq("status", "Disponível")
          .ilike("asset_type", "%notebook%");
        setStockNotebooks((data as InventoryAsset[]) || []);
      } else {
        setStockNotebooks([]);
      }

      if (contratacao.celular) {
        const { data } = await supabase
          .from("inventory")
          .select("id, asset_code, model, asset_type, category, status, service_tag, collaborator")
          .eq("status", "Disponível")
          .ilike("asset_type", "%celular%");
        setStockCelulares((data as InventoryAsset[]) || []);
      } else {
        setStockCelulares([]);
      }

      setCheckingStock(false);
    };

    checkStock();
  }, [isContratacao, contratacao.notebook, contratacao.celular]);

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const buildDescription = () => {
    if (isDesligamento) {
      const checkboxItems = [
        desligamento.celular && "Celular",
        desligamento.chip && "Chip",
        desligamento.notebook && "Notebook",
        desligamento.modem && "Modem",
        desligamento.email && "E-mail",
      ].filter(Boolean);

      const selectedAssets = foundAssets.filter((a) => selectedAssetIds.has(a.id));
      const assetLines = selectedAssets.map(
        (a) => `  - ${a.asset_code} | ${a.model || "Sem modelo"} (${a.asset_type || a.category}) [${a.status}]`
      );

      return [
        `Colaborador: ${desligamento.colaborador}`,
        `Gestor: ${desligamento.gestor}`,
        `Contrato: ${desligamento.contrato}`,
        `Itens para devolução: ${checkboxItems.length > 0 ? checkboxItems.join(", ") : "Nenhum"}`,
        `Data do Desligamento: ${desligamento.dataDesligamento}`,
        selectedAssets.length > 0
          ? `\nAtivos vinculados para devolução (${selectedAssets.length}):\n${assetLines.join("\n")}`
          : "",
        selectedAssets.length > 0
          ? `\n[ASSET_IDS_DEVOLUCAO:${selectedAssets.map((a) => a.id).join(",")}]`
          : "",
        description && `\nObservações: ${description}`,
      ].filter(Boolean).join("\n");
    }
    if (isContratacao) {
      const items = [
        `Celular: ${contratacao.celular ? "Sim" : "Não"}`,
        `Chip: ${contratacao.chip ? "Sim" : "Não"}`,
        `Notebook: ${contratacao.notebook ? "Sim" : "Não"}`,
        `E-mail: ${contratacao.email ? "Sim" : "Não"}`,
      ];

      const suggestions: string[] = [];
      if (contratacao.notebook && stockNotebooks.length > 0) {
        const nb = stockNotebooks[0];
        suggestions.push(`Notebook sugerido: ${nb.asset_code} - ${nb.model || "Sem modelo"} (ST: ${nb.service_tag || "N/A"})`);
      }
      if (contratacao.celular && stockCelulares.length > 0) {
        const cel = stockCelulares[0];
        suggestions.push(`Celular sugerido: ${cel.asset_code} - ${cel.model || "Sem modelo"} (ST: ${cel.service_tag || "N/A"})`);
      }

      return [
        `Colaborador: ${contratacao.colaborador}`,
        `Centro de Custo: ${contratacao.centroCusto}`,
        `Data da Contratação: ${contratacao.dataContratacao}`,
        ...items,
        suggestions.length > 0 ? `\nSugestões de estoque:\n${suggestions.map(s => `  - ${s}`).join("\n")}` : "",
        description && `\nObservações: ${description}`,
      ].filter(Boolean).join("\n");
    }
    return description;
  };

  const handleSubmit = async () => {
    if (!category) {
      toast.error("Selecione uma categoria.");
      return;
    }

    const finalRequester = isDesligamento
      ? desligamento.colaborador || requester
      : isContratacao
      ? contratacao.colaborador || requester
      : requester;

    if (!finalRequester) {
      toast.error("Informe o nome do solicitante/colaborador.");
      return;
    }

    const finalDescription = buildDescription();
    if (!finalDescription) {
      toast.error("Preencha a descrição ou os campos obrigatórios.");
      return;
    }

    if (isDesligamento && !desligamento.dataDesligamento) {
      toast.error("Informe a Data do Desligamento.");
      return;
    }
    if (isContratacao && !contratacao.dataContratacao) {
      toast.error("Informe a Data da Contratação.");
      return;
    }

    setSubmitting(true);

    // Always use the requester/collaborator name as the ticket title
    const collaboratorName = isContratacao ? contratacao.colaborador : isDesligamento ? desligamento.colaborador : "";
    const ticketTitle = collaboratorName || finalRequester;

    // Override SLA deadline with hiring/firing date when applicable
    let slaDeadlineOverride: string | undefined;
    const dateStr = isDesligamento ? desligamento.dataDesligamento : isContratacao ? contratacao.dataContratacao : "";
    if (dateStr) {
      // End-of-day local time so it covers the entire date
      const d = new Date(`${dateStr}T23:59:59`);
      if (!isNaN(d.getTime())) slaDeadlineOverride = d.toISOString();
    }

    const result = await createTicket({
      title: ticketTitle,
      category,
      description: finalDescription,
      requester: finalRequester,
      email: emailField || "interno@empresa.com",
      department: department || undefined,
      priority,
      sla_deadline_override: slaDeadlineOverride,
    });

    if (result.success) {
      if (result.ticketId) {
        await runTicketCreatedAutomations(result.ticketId, category);

        // Auto-create subtasks for Contratação
        if (isContratacao) {
          const subtasks: { category: string; title: string }[] = [];
          if (contratacao.notebook) subtasks.push({ category: "Solicitação de novo Computador/Notebook", title: "Solicitação de Notebook" });
          if (contratacao.celular) subtasks.push({ category: "Solicitação de novo Celular", title: "Solicitação de Celular" });

          for (const sub of subtasks) {
            const subResult = await createTicket({
              title: sub.title,
              category: sub.category,
              description: `Subtarefa automática da contratação de ${finalRequester}.\nChamado pai: ${result.ticketNumber}`,
              requester: finalRequester,
              email: emailField || "interno@empresa.com",
              department: department || undefined,
              priority,
              parent_ticket_id: result.ticketId,
            });
            if (subResult.success) {
              console.log(`[SUBTAREFA] ${subResult.ticketNumber} criada para ${sub.category}`);
            }
          }

          if (subtasks.length > 0) {
            toast.info(`${subtasks.length} subtarefa(s) criada(s) para vinculação de ativos`);
          }
        }
      }
      toast.success(`Chamado ${result.ticketNumber} criado com sucesso!`);
      resetForm();
      setOpen(false);
    } else {
      toast.error("Erro ao criar chamado.");
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setCategory("");
    setRequester("");
    setEmailField("");
    setDepartment("");
    setDescription("");
    setPriority("medium");
    setDesligamento(defaultDesligamento);
    setContratacao(defaultContratacao);
    setFoundAssets([]);
    setSelectedAssetIds(new Set());
    setStockNotebooks([]);
    setStockCelulares([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Em uso": return "bg-info/10 text-info border-info/20";
      case "Disponível": return "bg-success/10 text-success border-success/20";
      case "Reservado": return "bg-warning/10 text-warning border-warning/20";
      case "Manutenção": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Chamado Manual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo Chamado Manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Category */}
          <div className="space-y-2">
            <Label>Categoria <span className="text-destructive">*</span></Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {baseCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Desligamento ── */}
          {isDesligamento && (
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-semibold text-muted-foreground">Dados do Desligamento</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 relative" ref={dropdownRef}>
                  <Label>Nome do Colaborador <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={desligamento.colaborador}
                      onChange={(e) => handleCollaboratorInputChange(e.target.value)}
                      onFocus={() => { if (!collaboratorSelected && desligamento.colaborador.trim()) setShowCollaboratorDropdown(true); }}
                      placeholder="Buscar colaborador..."
                      className="pl-9"
                      autoComplete="off"
                    />
                  </div>
                  {showCollaboratorDropdown && filteredCollaborators.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                      {filteredCollaborators.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          onClick={() => handleSelectCollaborator(name)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Gestor</Label>
                  <Input
                    value={desligamento.gestor}
                    onChange={(e) => setDesligamento({ ...desligamento, gestor: e.target.value })}
                    placeholder="Nome do gestor"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Contrato</Label>
                  <Input
                    value={desligamento.contrato}
                    onChange={(e) => setDesligamento({ ...desligamento, contrato: e.target.value })}
                    placeholder="Tipo de contrato"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Data do Desligamento <span className="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !desligamento.dataDesligamento && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {desligamento.dataDesligamento
                            ? format(parseStoredDate(desligamento.dataDesligamento)!, "dd/MM/yyyy", { locale: ptBR })
                            : "Selecionar data"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseStoredDate(desligamento.dataDesligamento)}
                        onSelect={(date) => setDesligamento({ ...desligamento, dataDesligamento: toStoredDate(date) })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">Essa data será usada no vencimento do SLA.</p>
                </div>
              </div>

              {/* Found assets from inventory */}
              {collaboratorSelected && desligamento.colaborador.trim() && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Package className="h-4 w-4" />
                    Ativos Identificados
                    {foundAssets.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {foundAssets.length}
                      </Badge>
                    )}
                  </Label>

                  {searchingAssets ? (
                    <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando ativos...
                    </div>
                  ) : foundAssets.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Nenhum ativo encontrado para "{desligamento.colaborador}"
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-md border p-3">
                      {foundAssets.map((asset) => (
                        <label
                          key={asset.id}
                          className="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedAssetIds.has(asset.id)}
                            onCheckedChange={() => toggleAssetSelection(asset.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{asset.asset_code}</span>
                              <Badge variant="outline" className={`text-xs ${getStatusColor(asset.status)}`}>
                                {asset.status}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium truncate">
                              {asset.model || "Sem modelo"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {asset.asset_type || asset.category}
                              {asset.service_tag && ` • ST: ${asset.service_tag}`}
                            </p>
                          </div>
                        </label>
                      ))}
                      <p className="text-xs text-muted-foreground pt-1">
                        {selectedAssetIds.size} de {foundAssets.length} selecionado(s) para devolução
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">Itens adicionais para devolução</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(["celular", "chip", "notebook", "modem", "email"] as const).map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={desligamento[key]}
                        onCheckedChange={(v) => setDesligamento({ ...desligamento, [key]: !!v })}
                      />
                      {key === "email" ? "E-mail" : key.charAt(0).toUpperCase() + key.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Contratação ── */}
          {isContratacao && (
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-semibold text-muted-foreground">Dados da Contratação</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nome do Colaborador <span className="text-destructive">*</span></Label>
                  <Input
                    value={contratacao.colaborador}
                    onChange={(e) => setContratacao({ ...contratacao, colaborador: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Centro de Custo</Label>
                  <Input
                    value={contratacao.centroCusto}
                    onChange={(e) => setContratacao({ ...contratacao, centroCusto: e.target.value })}
                    placeholder="Ex: 1001"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Data da Contratação <span className="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !contratacao.dataContratacao && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {contratacao.dataContratacao
                            ? format(parseStoredDate(contratacao.dataContratacao)!, "dd/MM/yyyy", { locale: ptBR })
                            : "Selecionar data"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseStoredDate(contratacao.dataContratacao)}
                        onSelect={(date) => setContratacao({ ...contratacao, dataContratacao: toStoredDate(date) })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">Essa data será usada no vencimento do SLA.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Necessidades</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(["celular", "chip", "notebook", "email"] as const).map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={contratacao[key]}
                        onCheckedChange={(v) => setContratacao({ ...contratacao, [key]: !!v })}
                      />
                      {key === "email" ? "E-mail" : key.charAt(0).toUpperCase() + key.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Stock indicators */}
              {(contratacao.notebook || contratacao.celular) && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Package className="h-4 w-4" />
                    Verificação de Estoque
                  </Label>
                  {checkingStock ? (
                    <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verificando estoque...
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-md border p-3">
                      {contratacao.notebook && (
                        <div className="flex items-start gap-2">
                          {stockNotebooks.length > 0 ? (
                            <>
                              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                              <div>
                                <p className="text-sm font-medium text-success">
                                  Notebook disponível em estoque ({stockNotebooks.length})
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Sugestão: {stockNotebooks[0].asset_code} - {stockNotebooks[0].model || "Sem modelo"}
                                  {stockNotebooks[0].service_tag && ` (ST: ${stockNotebooks[0].service_tag})`}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                              <p className="text-sm font-medium text-warning">
                                Nenhum notebook disponível no momento
                              </p>
                            </>
                          )}
                        </div>
                      )}
                      {contratacao.celular && (
                        <div className="flex items-start gap-2">
                          {stockCelulares.length > 0 ? (
                            <>
                              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                              <div>
                                <p className="text-sm font-medium text-success">
                                  Celular disponível em estoque ({stockCelulares.length})
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Sugestão: {stockCelulares[0].asset_code} - {stockCelulares[0].model || "Sem modelo"}
                                  {stockCelulares[0].service_tag && ` (ST: ${stockCelulares[0].service_tag})`}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                              <p className="text-sm font-medium text-warning">
                                Nenhum celular disponível no momento
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Common fields for non-special categories */}
          {!isDesligamento && !isContratacao && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Solicitante <span className="text-destructive">*</span></Label>
                <Input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Nome" />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input value={emailField} onChange={(e) => setEmailField(e.target.value)} placeholder="email@empresa.com" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Departamento</Label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ex: RH, Financeiro..." />
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1">
            <Label>{isDesligamento || isContratacao ? "Observações" : "Descrição"} {!isDesligamento && !isContratacao && <span className="text-destructive">*</span>}</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isDesligamento || isContratacao ? "Observações adicionais..." : "Descreva o problema ou solicitação..."}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {submitting ? "Criando..." : "Criar Chamado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
