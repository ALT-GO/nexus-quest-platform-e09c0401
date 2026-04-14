import { useState, useCallback, useRef } from "react";
import { ChecklistItem, ChecklistGroup } from "@/hooks/use-marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/user-avatar";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  User,
  ListPlus,
  Save,
  FileText,
  MoreHorizontal,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

// ── Constants ──
const TEMPLATE_STORAGE_KEY = "marketing_checklist_templates";

interface SavedTemplate {
  id: string;
  name: string;
  groups: ChecklistGroup[];
}

// ── Helpers ──
function flatCountItems(items: ChecklistItem[]): { total: number; completed: number } {
  let total = 0;
  let completed = 0;
  for (const item of items) {
    total++;
    if (item.completed) completed++;
    if (item.children?.length) {
      const sub = flatCountItems(item.children);
      total += sub.total;
      completed += sub.completed;
    }
  }
  return { total, completed };
}

function ensureGroups(raw: any): ChecklistGroup[] {
  if (!raw || !Array.isArray(raw)) return [];
  // Already grouped format
  if (raw.length > 0 && raw[0]?.title !== undefined && Array.isArray(raw[0]?.items)) {
    return raw as ChecklistGroup[];
  }
  // Legacy flat array — wrap in single group
  if (raw.length > 0 && raw[0]?.text !== undefined) {
    return [{ id: crypto.randomUUID(), title: "Checklist", items: raw as ChecklistItem[] }];
  }
  return [];
}

// ── Props ──
interface ChecklistEditorProps {
  value: any; // raw JSONB
  onChange: (groups: ChecklistGroup[]) => void;
  teamMembers: { id: string; name: string; avatar_url?: string | null }[];
}

export function ChecklistEditor({ value, onChange, teamMembers }: ChecklistEditorProps) {
  const groups = ensureGroups(value);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [dragItem, setDragItem] = useState<{ groupIdx: number; itemIdx: number } | null>(null);

  // ── Template management ──
  const getSavedTemplates = (): SavedTemplate[] => {
    try {
      return JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY) || "[]");
    } catch { return []; }
  };

  const saveAsTemplate = () => {
    if (!templateName.trim()) return;
    const templates = getSavedTemplates();
    const clearCompleted = (items: ChecklistItem[]): ChecklistItem[] =>
      items.map((i) => ({
        ...i,
        completed: false,
        children: i.children ? clearCompleted(i.children) : undefined,
      }));
    templates.push({
      id: crypto.randomUUID(),
      name: templateName.trim(),
      groups: groups.map((g) => ({ ...g, id: crypto.randomUUID(), items: clearCompleted(g.items) })),
    });
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    setTemplateName("");
    setSaveTemplateOpen(false);
  };

  const loadTemplate = (tpl: SavedTemplate) => {
    const newGroups = tpl.groups.map((g) => ({
      ...g,
      id: crypto.randomUUID(),
      items: g.items.map((i) => reassignIds(i)),
    }));
    onChange([...groups, ...newGroups]);
    setTemplateDialogOpen(false);
  };

  const deleteTemplate = (id: string) => {
    const templates = getSavedTemplates().filter((t) => t.id !== id);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  };

  const reassignIds = (item: ChecklistItem): ChecklistItem => ({
    ...item,
    id: crypto.randomUUID(),
    children: item.children?.map(reassignIds),
  });

  // ── Group CRUD ──
  const addGroup = () => {
    onChange([...groups, { id: crypto.randomUUID(), title: "Novo Checklist", items: [] }]);
  };

  const renameGroup = (gIdx: number, title: string) => {
    const updated = [...groups];
    updated[gIdx] = { ...updated[gIdx], title };
    onChange(updated);
  };

  const removeGroup = (gIdx: number) => {
    onChange(groups.filter((_, i) => i !== gIdx));
  };

  // ── Item CRUD ──
  const addItem = (gIdx: number, text: string) => {
    if (!text.trim()) return;
    const updated = [...groups];
    updated[gIdx] = {
      ...updated[gIdx],
      items: [...updated[gIdx].items, { id: crypto.randomUUID(), text: text.trim(), completed: false }],
    };
    onChange(updated);
  };

  const addSubItem = (gIdx: number, parentId: string, text: string) => {
    if (!text.trim()) return;
    const updated = [...groups];
    const addChild = (items: ChecklistItem[]): ChecklistItem[] =>
      items.map((i) => {
        if (i.id === parentId) {
          return {
            ...i,
            children: [...(i.children || []), { id: crypto.randomUUID(), text: text.trim(), completed: false }],
          };
        }
        if (i.children) return { ...i, children: addChild(i.children) };
        return i;
      });
    updated[gIdx] = { ...updated[gIdx], items: addChild(updated[gIdx].items) };
    onChange(updated);
  };

  const toggleItem = (gIdx: number, itemId: string) => {
    const updated = [...groups];
    const toggle = (items: ChecklistItem[]): ChecklistItem[] =>
      items.map((i) => {
        if (i.id === itemId) return { ...i, completed: !i.completed };
        if (i.children) return { ...i, children: toggle(i.children) };
        return i;
      });
    updated[gIdx] = { ...updated[gIdx], items: toggle(updated[gIdx].items) };
    onChange(updated);
  };

  const removeItem = (gIdx: number, itemId: string) => {
    const updated = [...groups];
    const remove = (items: ChecklistItem[]): ChecklistItem[] =>
      items
        .filter((i) => i.id !== itemId)
        .map((i) => (i.children ? { ...i, children: remove(i.children) } : i));
    updated[gIdx] = { ...updated[gIdx], items: remove(updated[gIdx].items) };
    onChange(updated);
  };

  const setItemAssignee = (gIdx: number, itemId: string, assigneeId: string | null) => {
    const updated = [...groups];
    const member = teamMembers.find((m) => m.id === assigneeId);
    const assign = (items: ChecklistItem[]): ChecklistItem[] =>
      items.map((i) => {
        if (i.id === itemId) return { ...i, assignee_id: assigneeId, assignee_name: member?.name ?? null };
        if (i.children) return { ...i, children: assign(i.children) };
        return i;
      });
    updated[gIdx] = { ...updated[gIdx], items: assign(updated[gIdx].items) };
    onChange(updated);
  };

  // ── DnD (simple swap) ──
  const handleDragStart = (gIdx: number, iIdx: number) => {
    setDragItem({ groupIdx: gIdx, itemIdx: iIdx });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (gIdx: number, iIdx: number) => {
    if (!dragItem || dragItem.groupIdx !== gIdx) { setDragItem(null); return; }
    const updated = [...groups];
    const items = [...updated[gIdx].items];
    const [moved] = items.splice(dragItem.itemIdx, 1);
    items.splice(iIdx, 0, moved);
    updated[gIdx] = { ...updated[gIdx], items };
    onChange(updated);
    setDragItem(null);
  };

  const toggleGroupCollapse = (gId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(gId) ? next.delete(gId) : next.add(gId);
      return next;
    });
  };

  const toggleItemCollapse = (iId: string) => {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      next.has(iId) ? next.delete(iId) : next.add(iId);
      return next;
    });
  };

  // If no groups yet, show quick-start
  if (groups.length === 0) {
    return (
      <div>
        <Label className="text-xs text-muted-foreground">Checklists</Label>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={addGroup}>
            <Plus className="h-3.5 w-3.5" /> Adicionar Checklist
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setTemplateDialogOpen(true)}
          >
            <FileText className="h-3.5 w-3.5" /> Usar Template
          </Button>
        </div>
        <TemplateDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          templates={getSavedTemplates()}
          onLoad={loadTemplate}
          onDelete={deleteTemplate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Checklists</Label>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs px-2" onClick={addGroup}>
            <FolderPlus className="h-3 w-3" /> Grupo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-xs px-2"
            onClick={() => setTemplateDialogOpen(true)}
          >
            <FileText className="h-3 w-3" /> Template
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-xs px-2"
            onClick={() => setSaveTemplateOpen(true)}
          >
            <Save className="h-3 w-3" /> Salvar
          </Button>
        </div>
      </div>

      {groups.map((group, gIdx) => {
        const { total, completed } = flatCountItems(group.items);
        const pct = total > 0 ? (completed / total) * 100 : 0;
        const isCollapsed = collapsedGroups.has(group.id);

        return (
          <div key={group.id} className="rounded-lg border bg-card">
            {/* Group header */}
            <div className="flex items-center gap-2 p-2 border-b">
              <button onClick={() => toggleGroupCollapse(group.id)} className="shrink-0">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <input
                className="flex-1 bg-transparent text-sm font-medium outline-none"
                value={group.title}
                onChange={(e) => renameGroup(gIdx, e.target.value)}
              />
              <span className="text-xs text-muted-foreground tabular-nums">
                {completed}/{total}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => removeGroup(gIdx)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {!isCollapsed && (
              <>
                <Progress value={pct} className="h-1.5 rounded-none" />
                <div className="p-2 space-y-0.5">
                  {group.items.map((item, iIdx) => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      depth={0}
                      gIdx={gIdx}
                      iIdx={iIdx}
                      teamMembers={teamMembers}
                      collapsedItems={collapsedItems}
                      onToggle={toggleItem}
                      onRemove={removeItem}
                      onAssign={setItemAssignee}
                      onAddSub={addSubItem}
                      onToggleCollapse={toggleItemCollapse}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    />
                  ))}
                  <AddItemInput onAdd={(text) => addItem(gIdx, text)} />
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Save template dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Salvar como Template</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome do template..."
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveAsTemplate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>Cancelar</Button>
            <Button onClick={saveAsTemplate} disabled={!templateName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load template dialog */}
      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        templates={getSavedTemplates()}
        onLoad={loadTemplate}
        onDelete={deleteTemplate}
      />
    </div>
  );
}

// ── Recursive item row ──
function ChecklistItemRow({
  item,
  depth,
  gIdx,
  iIdx,
  teamMembers,
  collapsedItems,
  onToggle,
  onRemove,
  onAssign,
  onAddSub,
  onToggleCollapse,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  item: ChecklistItem;
  depth: number;
  gIdx: number;
  iIdx: number;
  teamMembers: { id: string; name: string }[];
  collapsedItems: Set<string>;
  onToggle: (gIdx: number, id: string) => void;
  onRemove: (gIdx: number, id: string) => void;
  onAssign: (gIdx: number, id: string, assigneeId: string | null) => void;
  onAddSub: (gIdx: number, parentId: string, text: string) => void;
  onToggleCollapse: (id: string) => void;
  onDragStart: (gIdx: number, iIdx: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (gIdx: number, iIdx: number) => void;
}) {
  const [addingChild, setAddingChild] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const isCollapsed = collapsedItems.has(item.id);

  return (
    <div style={{ paddingLeft: depth * 20 }}>
      <div
        className="flex items-center gap-1.5 group rounded-md py-1 px-1 hover:bg-accent/50"
        draggable={depth === 0}
        onDragStart={() => depth === 0 && onDragStart(gIdx, iIdx)}
        onDragOver={onDragOver}
        onDrop={() => depth === 0 && onDrop(gIdx, iIdx)}
      >
        {depth === 0 && (
          <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
        )}
        {hasChildren ? (
          <button onClick={() => onToggleCollapse(item.id)} className="shrink-0">
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Checkbox
          checked={item.completed}
          onCheckedChange={() => onToggle(gIdx, item.id)}
          className="shrink-0"
        />
        <span
          className={cn(
            "flex-1 text-sm",
            item.completed && "line-through text-muted-foreground"
          )}
        >
          {item.text}
        </span>

        {/* Assignee avatar */}
        {item.assignee_id && (
          <UserAvatar
            name={item.assignee_name}
            className="h-5 w-5"
            fallbackClassName="text-[9px]"
          />
        )}

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setAddingChild(true)}>
              <ListPlus className="h-3.5 w-3.5 mr-2" /> Sub-item
            </DropdownMenuItem>
            {teamMembers.length > 0 && (
              <>
                {teamMembers.map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => onAssign(gIdx, item.id, m.id)}>
                    <User className="h-3.5 w-3.5 mr-2" /> {m.name}
                  </DropdownMenuItem>
                ))}
                {item.assignee_id && (
                  <DropdownMenuItem onClick={() => onAssign(gIdx, item.id, null)}>
                    <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Remover responsável
                  </DropdownMenuItem>
                )}
              </>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onRemove(gIdx, item.id)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <div>
          {item.children!.map((child, cIdx) => (
            <ChecklistItemRow
              key={child.id}
              item={child}
              depth={depth + 1}
              gIdx={gIdx}
              iIdx={cIdx}
              teamMembers={teamMembers}
              collapsedItems={collapsedItems}
              onToggle={onToggle}
              onRemove={onRemove}
              onAssign={onAssign}
              onAddSub={onAddSub}
              onToggleCollapse={onToggleCollapse}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}

      {/* Add child inline */}
      {addingChild && (
        <div style={{ paddingLeft: (depth + 1) * 20 }} className="py-1">
          <AddItemInput
            onAdd={(text) => {
              onAddSub(gIdx, item.id, text);
              setAddingChild(false);
            }}
            onCancel={() => setAddingChild(false)}
            autoFocus
            placeholder="Adicionar sub-item..."
          />
        </div>
      )}
    </div>
  );
}

// ── Add item input ──
function AddItemInput({
  onAdd,
  onCancel,
  autoFocus,
  placeholder = "Adicionar item...",
}: {
  onAdd: (text: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex gap-1.5 mt-1">
      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-xs"
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) {
            onAdd(text);
            setText("");
          }
          if (e.key === "Escape") onCancel?.();
        }}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2"
        onClick={() => {
          if (text.trim()) { onAdd(text); setText(""); }
        }}
        disabled={!text.trim()}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ── Template dialog ──
function TemplateDialog({
  open,
  onOpenChange,
  templates,
  onLoad,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templates: SavedTemplate[];
  onLoad: (t: SavedTemplate) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Templates de Checklist</DialogTitle>
        </DialogHeader>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum template salvo ainda.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between rounded-md border p-2.5 hover:bg-accent/50 cursor-pointer"
                onClick={() => onLoad(tpl)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{tpl.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(tpl.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
