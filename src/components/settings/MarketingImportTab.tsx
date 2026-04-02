import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronRight, User, Users } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

/* ── Types ── */
type ImportStep = "upload" | "preview" | "assignees" | "importing" | "done";

interface ParsedTask {
  rowIndex: number;
  title: string;
  description: string;
  bucket: string;
  progress: string;
  priority: string;
  assignees: string[];
  createdBy: string;
  createdAt: string;
  startDate: string;
  dueDate: string;
  isRecurring: boolean;
  isOverdue: boolean;
  completedAt: string;
  completedBy: string;
  checklistItems: string[];
  checklistCompleted: number;
  labels: string[];
}

interface AssigneeMapping {
  plannerName: string;
  action: "empty" | "map";
  userId: string | null;
  userName: string | null;
}

interface ImportResult {
  imported: number;
  stagesCreated: string[];
  tagsCreated: string[];
  errors: number;
  errorDetails: string[];
}

/* ── Helpers ── */
function parseDateBR(val: string): string | null {
  if (!val) return null;
  const parts = val.split(/[/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (c > 1000) {
      const d = new Date(c, b - 1, a);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    if (a > 1000) {
      const d = new Date(a, b - 1, c);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  const iso = Date.parse(val);
  if (!isNaN(iso)) return new Date(iso).toISOString();
  return null;
}

function mapPriority(val: string): string {
  const v = val.toLowerCase().trim();
  if (v === "urgente") return "urgent";
  if (v === "importante" || v === "alta") return "high";
  return "medium";
}

function mapProgress(val: string): string {
  const v = val.toLowerCase().trim();
  if (v === "concluída" || v === "concluido" || v === "concluído") return "Concluído";
  if (v === "em andamento" || v === "em progresso") return "Em andamento";
  return "Não iniciado";
}

function parseChecklist(itemsStr: string, completedStr: string): { items: any[]; completedCount: number } {
  if (!itemsStr) return { items: [], completedCount: 0 };
  const items = itemsStr.split(";").map(s => s.trim()).filter(Boolean);
  let completedCount = 0;
  if (completedStr) {
    const match = completedStr.match(/^(\d+)\//);
    if (match) completedCount = parseInt(match[1]);
  }
  return {
    items: items.map((text, i) => ({
      id: crypto.randomUUID(),
      text,
      completed: i < completedCount,
    })),
    completedCount,
  };
}

/* ── Main Component ── */
export function MarketingImportTab() {
  const qc = useQueryClient();
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Assignee resolution
  const [uniqueAssignees, setUniqueAssignees] = useState<string[]>([]);
  const [assigneeMappings, setAssigneeMappings] = useState<AssigneeMapping[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);

  /* ── File handling ── */
  const handleFile = useCallback(async (f: File) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      toast.error("Apenas arquivos Excel (.xlsx, .xls) são aceitos");
      return;
    }
    setFile(f);

    const buffer = await f.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (rows.length === 0) {
      toast.error("Planilha vazia");
      return;
    }

    const tasks: ParsedTask[] = rows.map((row, i) => {
      const assigneesRaw = (row["Atribuído a"] || "").toString();
      const assignees = assigneesRaw.split(";").map((s: string) => s.trim()).filter(Boolean);
      const checklistItemsStr = (row["Itens da lista de verificação"] || "").toString();
      const checklistCompletedStr = (row["Itens concluídos da lista de verificação"] || "").toString();
      const { items, completedCount } = parseChecklist(checklistItemsStr, checklistCompletedStr);
      const labelsRaw = (row["Rótulos"] || "").toString();
      const labels = labelsRaw.split(";").map((s: string) => s.trim()).filter(Boolean);

      return {
        rowIndex: i,
        title: (row["Nome da tarefa"] || "").toString(),
        description: (row["Descrição"] || "").toString(),
        bucket: (row["Nome do Bucket"] || "").toString(),
        progress: (row["Progresso"] || "").toString(),
        priority: (row["Prioridade"] || "").toString(),
        assignees,
        createdBy: (row["Criado por"] || "").toString(),
        createdAt: (row["Criado em"] || "").toString(),
        startDate: (row["Data de início"] || "").toString(),
        dueDate: (row["Data de conclusão"] || "").toString(),
        isRecurring: row["É Recorrente"] === true || row["É Recorrente"] === "true",
        isOverdue: row["Atrasados"] === true || row["Atrasados"] === "true",
        completedAt: (row["Concluído em"] || "").toString(),
        completedBy: (row["Concluída por"] || "").toString(),
        checklistItems: items,
        checklistCompleted: completedCount,
        labels,
      } as ParsedTask;
    });

    setParsedTasks(tasks);
    setStep("preview");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  /* ── Proceed to assignee resolution ── */
  const proceedToAssignees = async () => {
    // Collect unique assignee names
    const allNames = new Set<string>();
    parsedTasks.forEach(t => {
      t.assignees.forEach(a => allNames.add(a));
    });
    const uniqueNames = Array.from(allNames).sort();
    setUniqueAssignees(uniqueNames);

    // Fetch team members
    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const members = (profiles || []).map((p: any) => ({ id: p.id, name: p.full_name }));
    setTeamMembers(members);

    // Auto-map by name similarity
    const mappings: AssigneeMapping[] = uniqueNames.map(name => {
      const exactMatch = members.find((m: any) => m.name.toLowerCase().trim() === name.toLowerCase().trim());
      if (exactMatch) {
        return { plannerName: name, action: "map" as const, userId: exactMatch.id, userName: exactMatch.name };
      }
      return { plannerName: name, action: "empty" as const, userId: null, userName: null };
    });
    setAssigneeMappings(mappings);
    setStep("assignees");
  };

  const updateAssigneeMapping = (index: number, action: "empty" | "map", userId?: string) => {
    setAssigneeMappings(prev => prev.map((m, i) => {
      if (i !== index) return m;
      if (action === "empty") return { ...m, action: "empty", userId: null, userName: null };
      const member = teamMembers.find(t => t.id === userId);
      return { ...m, action: "map", userId: userId || null, userName: member?.name || null };
    }));
  };

  /* ── Import ── */
  const runImport = async () => {
    setStep("importing");
    setProgress(0);

    const stagesCreated: string[] = [];
    const tagsCreated: string[] = [];
    const errorDetails: string[] = [];
    let imported = 0;
    let errors = 0;

    // Build assignee lookup: planner name → { userId, userName }
    const assigneeLookup = new Map<string, { userId: string | null; userName: string | null }>();
    assigneeMappings.forEach(m => {
      assigneeLookup.set(m.plannerName, { userId: m.action === "map" ? m.userId : null, userName: m.action === "map" ? m.userName : null });
    });

    // 1. Ensure all buckets exist as stages
    const { data: existingStages } = await supabase.from("marketing_stages").select("*").order("order_index");
    const stageMap = new Map<string, string>();
    (existingStages || []).forEach((s: any) => stageMap.set(s.name, s.id));

    const uniqueBuckets = [...new Set(parsedTasks.map(t => t.bucket).filter(Boolean))];
    for (const bucket of uniqueBuckets) {
      if (!stageMap.has(bucket)) {
        const maxOrder = (existingStages || []).reduce((m: number, s: any) => Math.max(m, s.order_index), -1);
        const { data: newStage } = await supabase.from("marketing_stages")
          .insert({ name: bucket, order_index: maxOrder + 1, meta_status: "in_progress" } as any)
          .select().single();
        if (newStage) {
          stageMap.set(bucket, (newStage as any).id);
          stagesCreated.push(bucket);
        }
      }
    }

    // 2. Ensure all labels exist as tags
    const { data: existingTags } = await supabase.from("marketing_tags").select("*");
    const tagMap = new Map<string, string>();
    (existingTags || []).forEach((t: any) => tagMap.set(t.name, t.id));

    const uniqueLabels = [...new Set(parsedTasks.flatMap(t => t.labels))].filter(Boolean);
    for (const label of uniqueLabels) {
      if (!tagMap.has(label)) {
        const { data: newTag } = await supabase.from("marketing_tags")
          .insert({ name: label } as any)
          .select().single();
        if (newTag) {
          tagMap.set(label, (newTag as any).id);
          tagsCreated.push(label);
        }
      }
    }

    // 3. Import tasks
    const total = parsedTasks.length;
    for (let i = 0; i < total; i++) {
      const t = parsedTasks[i];
      try {
        // Resolve assignee (use first assignee)
        const primaryAssignee = t.assignees[0] || null;
        const mapped = primaryAssignee ? assigneeLookup.get(primaryAssignee) : null;

        const taskData: Record<string, any> = {
          title: t.title,
          description: t.description,
          stage_id: stageMap.get(t.bucket) || null,
          progress: mapProgress(t.progress),
          priority: mapPriority(t.priority),
          assignee_id: mapped?.userId || null,
          assignee_name: mapped?.userName || (mapped ? null : primaryAssignee) || null,
          requester_name: t.createdBy,
          created_at: parseDateBR(t.createdAt) || new Date().toISOString(),
          start_date: parseDateBR(t.startDate) || null,
          due_date: parseDateBR(t.dueDate) || null,
          is_recurring: t.isRecurring,
          completed_at: parseDateBR(t.completedAt) || null,
          completed_by: t.completedBy || null,
          checklist: t.checklistItems.length > 0 ? t.checklistItems : [],
          order_index: i,
        };

        const { data: insertedTask, error } = await supabase.from("marketing_tasks")
          .insert(taskData as any)
          .select()
          .single();

        if (error) throw error;

        // Link tags
        if (insertedTask && t.labels.length > 0) {
          const tagInserts = t.labels
            .map(label => ({ task_id: (insertedTask as any).id, tag_id: tagMap.get(label)! }))
            .filter(ti => ti.tag_id);
          if (tagInserts.length > 0) {
            await supabase.from("marketing_task_tags").insert(tagInserts as any);
          }
        }

        imported++;
      } catch (err: any) {
        errors++;
        errorDetails.push(`Linha ${i + 2}: ${t.title} — ${err.message}`);
      }
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setResult({ imported, stagesCreated, tagsCreated, errors, errorDetails });
    qc.invalidateQueries({ queryKey: ["marketing_tasks"] });
    qc.invalidateQueries({ queryKey: ["marketing_stages"] });
    setStep("done");
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setParsedTasks([]);
    setProgress(0);
    setResult(null);
    setUniqueAssignees([]);
    setAssigneeMappings([]);
  };

  /* ── Stats for preview ── */
  const bucketCounts = parsedTasks.reduce((acc, t) => {
    acc[t.bucket] = (acc[t.bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const withAssignee = parsedTasks.filter(t => t.assignees.length > 0).length;
  const withChecklist = parsedTasks.filter(t => t.checklistItems.length > 0).length;
  const withLabels = parsedTasks.filter(t => t.labels.length > 0).length;
  const completed = parsedTasks.filter(t => mapProgress(t.progress) === "Concluído").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Tarefas de Marketing
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Importe tarefas do Microsoft Planner (formato .xlsx). Etapas (Buckets) e rótulos serão criados automaticamente.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ── UPLOAD ── */}
        {step === "upload" && (
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Arraste o arquivo .xlsx ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">Exportação do Microsoft Planner</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">{file?.name}</p>
                <p className="text-xs text-muted-foreground">{parsedTasks.length} tarefas encontradas</p>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={reset}><X className="h-4 w-4" /></Button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{parsedTasks.length}</p>
                <p className="text-xs text-muted-foreground">Total de tarefas</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-success">{completed}</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{withAssignee}</p>
                <p className="text-xs text-muted-foreground">Com responsável</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{withChecklist}</p>
                <p className="text-xs text-muted-foreground">Com checklist</p>
              </div>
            </div>

            {/* Buckets summary */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Etapas (Buckets) encontradas:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(bucketCounts).map(([bucket, count]) => (
                  <Badge key={bucket} variant="secondary" className="text-xs">
                    {bucket} <span className="ml-1 opacity-70">({count})</span>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Labels summary */}
            {withLabels > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Rótulos encontrados:</p>
                <div className="flex flex-wrap gap-2">
                  {[...new Set(parsedTasks.flatMap(t => t.labels))].filter(Boolean).map(label => (
                    <Badge key={label} variant="outline" className="text-xs">{label}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sample rows */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight className="h-3.5 w-3.5" />
                Visualizar primeiras tarefas
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-lg border overflow-auto max-h-[300px]">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Título</th>
                        <th className="text-left p-2 font-medium">Bucket</th>
                        <th className="text-left p-2 font-medium">Status</th>
                        <th className="text-left p-2 font-medium">Responsável</th>
                        <th className="text-left p-2 font-medium">Prioridade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedTasks.slice(0, 15).map((t, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 max-w-[200px] truncate">{t.title}</td>
                          <td className="p-2">{t.bucket}</td>
                          <td className="p-2">{t.progress}</td>
                          <td className="p-2 max-w-[120px] truncate">{t.assignees.join(", ") || "—"}</td>
                          <td className="p-2">{t.priority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={proceedToAssignees}>
                <Users className="h-4 w-4 mr-2" /> Próximo: Resolver Responsáveis
              </Button>
            </div>
          </div>
        )}

        {/* ── ASSIGNEE RESOLUTION ── */}
        {step === "assignees" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-sm mb-1">Resolver Responsáveis</h3>
              <p className="text-xs text-muted-foreground">
                A planilha contém {uniqueAssignees.length} responsáveis. Para cada um, escolha se deseja deixar vazio ou vincular a um usuário do sistema.
              </p>
            </div>

            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {assigneeMappings.map((m, i) => {
                  const tasksWithThisAssignee = parsedTasks.filter(t => t.assignees.includes(m.plannerName)).length;
                  return (
                    <div key={m.plannerName} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.plannerName}</p>
                        <p className="text-xs text-muted-foreground">{tasksWithThisAssignee} tarefa(s)</p>
                      </div>
                      <Select
                        value={m.action}
                        onValueChange={(val) => updateAssigneeMapping(i, val as "empty" | "map")}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="empty">Deixar vazio</SelectItem>
                          <SelectItem value="map">Vincular usuário</SelectItem>
                        </SelectContent>
                      </Select>
                      {m.action === "map" && (
                        <Select
                          value={m.userId || ""}
                          onValueChange={(val) => updateAssigneeMapping(i, "map", val)}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs">
                            {m.userName ? (
                              <span className="flex items-center gap-1.5">
                                <User className="h-3 w-3" /> {m.userName}
                              </span>
                            ) : (
                              <SelectValue placeholder="Selecionar usuário" />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map(tm => (
                              <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {uniqueAssignees.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Nenhuma tarefa possui responsável atribuído. Todas serão importadas sem responsável.
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("preview")}>Voltar</Button>
              <Button onClick={runImport}>
                <Upload className="h-4 w-4 mr-2" /> Importar {parsedTasks.length} tarefas
              </Button>
            </div>
          </div>
        )}

        {/* ── IMPORTING ── */}
        {step === "importing" && (
          <div className="space-y-4 py-6">
            <div className="text-center">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-primary animate-pulse mb-3" />
              <p className="font-medium">Importando tarefas...</p>
              <p className="text-sm text-muted-foreground">{progress}%</p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && result && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-3" />
              <h3 className="text-lg font-bold">Importação concluída!</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-success">{result.imported}</p>
                <p className="text-xs text-muted-foreground">Importadas</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{result.errors}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            {result.stagesCreated.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Etapas criadas automaticamente:</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.stagesCreated.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                </div>
              </div>
            )}

            {result.tagsCreated.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Rótulos criados automaticamente:</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.tagsCreated.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                </div>
              </div>
            )}

            {result.errorDetails.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Ver erros ({result.errors})
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-1 max-h-[200px] overflow-auto text-xs">
                    {result.errorDetails.map((err, i) => (
                      <p key={i} className="text-destructive">{err}</p>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Button onClick={reset} className="w-full">Nova importação</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
