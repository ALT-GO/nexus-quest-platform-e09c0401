import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useAutomationRules,
  AutomationScope,
  TiTriggerType,
  TiActionType,
  MktTriggerType,
  MktActionType,
  tiTriggerLabels,
  tiActionLabels,
  mktTriggerLabels,
  mktActionLabels,
  tiTriggerIcons,
  tiActionIcons,
  mktTriggerIcons,
  mktActionIcons,
} from "@/hooks/use-automation-rules";
import { useCustomStatuses } from "@/hooks/use-custom-status";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Zap,
  Trash2,
  ArrowRight,
  Loader2,
  Play,
  Pause,
  Monitor,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailTemplatesSection } from "./EmailTemplatesSection";
import { AssignmentQueueSection } from "./AssignmentQueueSection";

const categories = [
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
  "Gerais/Outros",
];

const priorities = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

const mktProgressOptions = [
  { value: "Não iniciado", label: "Não iniciado" },
  { value: "Em andamento", label: "Em andamento" },
  { value: "Concluído", label: "Concluído" },
];

export function AutomationsTab() {
  const { rules, loading, addRule, deleteRule, toggleRule } = useAutomationRules();
  const { activeStatuses } = useCustomStatuses();
  const [scope, setScope] = useState<AutomationScope>("ti");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [technicians, setTechnicians] = useState<string[]>([]);
  const [mktStages, setMktStages] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("full_name").then(({ data }) => {
      setTechnicians(
        (data || []).map((p: any) => p.full_name).filter((n: string) => n.trim() !== "")
      );
    });
    supabase.from("marketing_stages").select("id, name").order("order_index").then(({ data }) => {
      setMktStages((data || []) as any);
    });
  }, []);

  const scopedRules = useMemo(
    () => rules.filter((r) => (r.scope || "ti") === scope),
    [rules, scope]
  );

  // ── Form state ──
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [actionType, setActionType] = useState("");
  const [actionConfig, setActionConfig] = useState<Record<string, any>>({});

  const resetForm = () => {
    setName("");
    setTriggerType("");
    setTriggerConfig({});
    setActionType("");
    setActionConfig({});
  };

  const openDialog = () => {
    resetForm();
    // Set defaults based on scope
    if (scope === "ti") {
      setTriggerType("ticket_created");
      setActionType("move_to_status");
    } else {
      setTriggerType("task_created");
      setActionType("move_to_stage");
    }
    setDialogOpen(true);
  };

  const isFormValid = () => {
    if (!name.trim() || !triggerType || !actionType) return false;
    // Validate action has required config
    if (actionType === "move_to_status") return !!actionConfig.status_id;
    if (actionType === "assign_to" || actionType === "assign_task") return !!actionConfig.assignee;
    if (actionType === "change_priority" || actionType === "change_task_priority") return !!actionConfig.priority;
    if (actionType === "send_notification") return !!actionConfig.message?.trim();
    if (actionType === "set_sla_hours") return !!actionConfig.sla_hours;
    if (actionType === "move_to_stage") return !!actionConfig.stage_id;
    if (actionType === "set_task_progress") return !!actionConfig.progress;
    return true;
  };

  const handleCreate = async () => {
    const success = await addRule({
      name: name.trim(),
      scope,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      action_type: actionType,
      action_config: actionConfig,
      is_active: true,
    });
    if (success) {
      resetForm();
      setDialogOpen(false);
    }
  };

  // ── Describe helpers ──
  const getStatusName = (id: string) => activeStatuses.find((s) => s.id === id)?.nome ?? id;
  const getStageName = (id: string) => mktStages.find((s) => s.id === id)?.name ?? id;

  const describeTrigger = (rule: (typeof rules)[0]) => {
    const allTriggerLabels = { ...tiTriggerLabels, ...mktTriggerLabels };
    let desc = allTriggerLabels[rule.trigger_type as keyof typeof allTriggerLabels] || rule.trigger_type;
    const cfg = rule.trigger_config || {};
    if (rule.trigger_type === "ticket_created" && cfg.category) desc += ` (${cfg.category})`;
    if (rule.trigger_type === "status_changed" && cfg.from_status) desc += ` (De: ${getStatusName(cfg.from_status)})`;
    if (rule.trigger_type === "task_stage_changed" && cfg.from_stage) desc += ` (De: ${getStageName(cfg.from_stage)})`;
    if (rule.trigger_type === "event_upcoming" && cfg.days_before) desc += ` (${cfg.days_before} dias antes)`;
    return desc;
  };

  const describeAction = (rule: (typeof rules)[0]) => {
    const cfg = rule.action_config || {};
    switch (rule.action_type) {
      case "move_to_status": return `Mover para "${getStatusName(cfg.status_id)}"`;
      case "assign_to": return `Atribuir a "${cfg.assignee}"`;
      case "change_priority": case "change_task_priority":
        return `Prioridade → "${priorities.find(p => p.value === cfg.priority)?.label || cfg.priority}"`;
      case "send_notification": return `Notificar: "${cfg.message}"`;
      case "set_sla_hours": return `SLA → ${cfg.sla_hours}h`;
      case "move_to_stage": return `Mover para "${getStageName(cfg.stage_id)}"`;
      case "assign_task": return `Atribuir a "${cfg.assignee}"`;
      case "set_task_progress": return `Progresso → "${cfg.progress}"`;
      default: return rule.action_type;
    }
  };

  const getTriggerIcon = (type: string) => {
    return { ...tiTriggerIcons, ...mktTriggerIcons }[type] || "⚙️";
  };
  const getActionIcon = (type: string) => {
    return { ...tiActionIcons, ...mktActionIcons }[type] || "⚙️";
  };

  // ── Current scope labels ──
  const currentTriggerLabels = scope === "ti" ? tiTriggerLabels : mktTriggerLabels;
  const currentActionLabels = scope === "ti" ? tiActionLabels : mktActionLabels;
  const currentTriggerIcons = scope === "ti" ? tiTriggerIcons : mktTriggerIcons;
  const currentActionIcons = scope === "ti" ? tiActionIcons : mktActionIcons;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const renderTriggerConfig = () => {
    if (scope === "ti") {
      switch (triggerType) {
        case "ticket_created":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Filtrar por categoria (opcional)</Label>
              <Select value={triggerConfig.category || ""} onValueChange={(v) => setTriggerConfig({ category: v === "__all__" ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Qualquer categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Qualquer categoria</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        case "status_changed":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quando sair do status (opcional)</Label>
              <Select value={triggerConfig.from_status || ""} onValueChange={(v) => setTriggerConfig({ from_status: v === "__all__" ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Qualquer status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Qualquer status</SelectItem>
                  {activeStatuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        case "priority_changed":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quando sair da prioridade (opcional)</Label>
              <Select value={triggerConfig.from_priority || ""} onValueChange={(v) => setTriggerConfig({ from_priority: v === "__all__" ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Qualquer prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Qualquer</SelectItem>
                  {priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        default:
          return null;
      }
    } else {
      // Marketing triggers
      switch (triggerType) {
        case "task_created":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Filtrar por prioridade (opcional)</Label>
              <Select value={triggerConfig.priority || ""} onValueChange={(v) => setTriggerConfig({ priority: v === "__all__" ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Qualquer prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Qualquer</SelectItem>
                  {priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        case "task_stage_changed":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quando sair da etapa (opcional)</Label>
              <Select value={triggerConfig.from_stage || ""} onValueChange={(v) => setTriggerConfig({ from_stage: v === "__all__" ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Qualquer etapa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Qualquer etapa</SelectItem>
                  {mktStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        case "event_upcoming":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quantos dias antes do evento?</Label>
              <Select value={String(triggerConfig.days_before || "7")} onValueChange={(v) => setTriggerConfig({ days_before: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia</SelectItem>
                  <SelectItem value="3">3 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        default:
          return null;
      }
    }
  };

  const renderActionConfig = () => {
    if (scope === "ti") {
      switch (actionType) {
        case "move_to_status":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Mover para o status</Label>
              <Select value={actionConfig.status_id || ""} onValueChange={(v) => setActionConfig({ status_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                <SelectContent>
                  {activeStatuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${s.cor})` }} />
                        {s.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        case "assign_to":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Atribuir ao técnico</Label>
              <Select value={actionConfig.assignee || ""} onValueChange={(v) => setActionConfig({ assignee: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        case "change_priority":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Alterar para</Label>
              <Select value={actionConfig.priority || ""} onValueChange={(v) => setActionConfig({ priority: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        case "send_notification":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Mensagem</Label>
              <Input value={actionConfig.message || ""} onChange={(e) => setActionConfig({ message: e.target.value })} placeholder="Ex: Chamado urgente recebido!" />
            </div>
          );
        case "set_sla_hours":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Horas de SLA</Label>
              <Input type="number" min={1} value={actionConfig.sla_hours || ""} onChange={(e) => setActionConfig({ sla_hours: Number(e.target.value) })} placeholder="Ex: 4" />
            </div>
          );
        default:
          return null;
      }
    } else {
      // Marketing actions
      switch (actionType) {
        case "move_to_stage":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Mover para a etapa</Label>
              <Select value={actionConfig.stage_id || ""} onValueChange={(v) => setActionConfig({ stage_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {mktStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        case "assign_task":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Atribuir a</Label>
              <Select value={actionConfig.assignee || ""} onValueChange={(v) => setActionConfig({ assignee: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        case "change_task_priority":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Alterar para</Label>
              <Select value={actionConfig.priority || ""} onValueChange={(v) => setActionConfig({ priority: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        case "send_notification":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Mensagem</Label>
              <Input value={actionConfig.message || ""} onChange={(e) => setActionConfig({ message: e.target.value })} placeholder="Ex: Tarefa atrasada!" />
            </div>
          );
        case "set_task_progress":
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Progresso</Label>
              <Select value={actionConfig.progress || ""} onValueChange={(v) => setActionConfig({ progress: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {mktProgressOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        default:
          return null;
      }
    }
  };

  const renderRulesList = () => {
    if (scopedRules.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Nenhuma regra criada</p>
          <p className="text-sm mt-1">
            Crie sua primeira regra de automação para {scope === "ti" ? "Service Desk" : "Marketing"}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {scopedRules.map((rule) => (
          <div
            key={rule.id}
            className={cn(
              "flex items-center gap-4 rounded-lg border p-4 transition-opacity",
              !rule.is_active && "opacity-50"
            )}
          >
            <Switch checked={rule.is_active} onCheckedChange={(checked) => toggleRule(rule.id, checked)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm truncate">{rule.name}</p>
                {rule.is_active ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                    <Play className="h-2.5 w-2.5" /> Ativa
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Pause className="h-2.5 w-2.5" /> Inativa
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600 font-medium">
                  {getTriggerIcon(rule.trigger_type)} {describeTrigger(rule)}
                </span>
                <ArrowRight className="h-3 w-3 flex-shrink-0" />
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 font-medium">
                  {getActionIcon(rule.action_type)} {describeAction(rule)}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive flex-shrink-0" onClick={() => deleteRule(rule.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  const tips = scope === "ti" ? [
    { title: "Triagem automática", desc: "Use \"Novo chamado criado\" + categoria para mover automaticamente para a coluna correta." },
    { title: "Atribuição por categoria", desc: "Atribua chamados de celular ao técnico especialista com \"Novo chamado criado\" + \"Atribuir ao técnico\"." },
    { title: "Escalonamento de SLA", desc: "Quando o SLA vencer, altere a prioridade para Alta automaticamente." },
    { title: "Notificação de conclusão", desc: "Envie uma notificação quando um chamado for concluído." },
  ] : [
    { title: "Workflow automático", desc: "Mova tarefas para a próxima etapa quando o progresso mudar." },
    { title: "Atribuição por tipo", desc: "Atribua novas tarefas automaticamente ao responsável do tipo de tarefa." },
    { title: "Alertas de atraso", desc: "Envie notificação quando uma tarefa passar da data de entrega." },
    { title: "Preparação de eventos", desc: "Notifique a equipe quando um evento estiver se aproximando." },
  ];

  return (
    <div className="space-y-6">
      <Tabs value={scope} onValueChange={(v) => setScope(v as AutomationScope)}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="ti" className="gap-2">
              <Monitor className="h-4 w-4" />
              Service Desk
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {rules.filter((r) => (r.scope || "ti") === "ti").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="marketing" className="gap-2">
              <Megaphone className="h-4 w-4" />
              Marketing
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {rules.filter((r) => r.scope === "marketing").length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  Nova Regra — {scope === "ti" ? "Service Desk" : "Marketing"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-2">
                <div className="space-y-2">
                  <Label>Nome da Regra</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Triagem automática de celulares" />
                </div>

                {/* Trigger */}
                <div className="space-y-3 rounded-lg border p-4">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-bold text-amber-600">QUANDO</span>
                    Gatilho
                  </Label>
                  <Select value={triggerType} onValueChange={(v) => { setTriggerType(v); setTriggerConfig({}); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(currentTriggerLabels).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {(currentTriggerIcons as any)[k]} {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {renderTriggerConfig()}
                </div>

                <div className="flex justify-center">
                  <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
                </div>

                {/* Action */}
                <div className="space-y-3 rounded-lg border p-4">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-bold text-emerald-600">ENTÃO</span>
                    Ação
                  </Label>
                  <Select value={actionType} onValueChange={(v) => { setActionType(v); setActionConfig({}); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(currentActionLabels).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {(currentActionIcons as any)[k]} {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {renderActionConfig()}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={!isFormValid()}>
                  <Zap className="mr-2 h-4 w-4" />
                  Criar Regra
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="ti">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Monitor className="h-5 w-5 text-primary" />
                Automações do Service Desk
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Regras automáticas para chamados de TI: triagem, atribuição, escalonamento e notificações.
              </p>
            </CardHeader>
            <CardContent>{renderRulesList()}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-5 w-5 text-primary" />
                Automações de Marketing
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Regras automáticas para tarefas, eventos e sprints de marketing.
              </p>
            </CardHeader>
            <CardContent>{renderRulesList()}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Queue (TI only) */}
      {scope === "ti" && <AssignmentQueueSection />}

      {/* Email Templates Editor */}
      {scope === "ti" && <EmailTemplatesSection />}

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">💡 Exemplos de Automação — {scope === "ti" ? "Service Desk" : "Marketing"}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          {tips.map((tip, i) => (
            <p key={i}>• <strong>{tip.title}:</strong> {tip.desc}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
