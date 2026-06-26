import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { format, parseISO } from "date-fns";

type SortKey = "sc_number" | "pc_number" | "cost_center" | "description" | "opening_date" | "status" | "finalization_date" | "insumo";
type SortDir = "asc" | "desc";

export interface PurchaseOrder {
  id: string;
  department: string;
  sc_number: string | null;
  pc_number: string | null;
  cost_center: string | null;
  description: string;
  opening_date: string | null;
  status: string | null;
  finalization_date: string | null;
  finalization_note: string | null;
  insumo: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  "Aguardando gerar Pedido de Compra",
  "Aguardando Aprovação do Pedido de Compra",
  "Aguardando NF",
  "Finalizado",
  "Cancelado",
];

const STATUS_COLORS: Record<string, string> = {
  "Aguardando gerar Pedido de Compra": "bg-amber-100 text-amber-800 border-amber-200",
  "Aguardando Aprovação do Pedido de Compra": "bg-blue-100 text-blue-800 border-blue-200",
  "Aguardando NF": "bg-purple-100 text-purple-800 border-purple-200",
  "Finalizado": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Cancelado": "bg-rose-100 text-rose-800 border-rose-200",
};

interface Props {
  department: "TI" | "Marketing";
}

type FormState = Omit<PurchaseOrder, "id" | "created_at" | "department">;

const emptyForm: FormState = {
  sc_number: "",
  pc_number: "",
  cost_center: "",
  description: "",
  opening_date: new Date().toISOString().slice(0, 10),
  status: "Aguardando gerar Pedido de Compra",
  finalization_date: null,
  finalization_note: "",
  insumo: "",
};

function fmtDate(v: string | null) {
  if (!v) return "—";
  try { return format(parseISO(v), "dd/MM/yyyy"); } catch { return v; }
}

function SortableHead({ label, k, sortKey, sortDir, onClick, className }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; onClick: (k: SortKey) => void; className?: string;
}) {
  const active = sortKey === k;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? "opacity-100" : "opacity-50"}`} />
      </button>
    </TableHead>
  );
}

export function PurchaseOrdersBoard({ department }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("opening_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "opening_date" || key === "finalization_date" ? "desc" : "asc");
    }
  }

  const { data = [], isLoading } = useQuery({
    queryKey: ["purchase_orders", department],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("purchase_orders")
        .select("*")
        .eq("department", department)
        .order("opening_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PurchaseOrder[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = data.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.sc_number, r.pc_number, r.cost_center, r.description, r.insumo, r.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    const isDate = sortKey === "opening_date" || sortKey === "finalization_date";
    const sign = sortDir === "asc" ? 1 : -1;
    return [...result].sort((a, b) => {
      const va = (a as any)[sortKey];
      const vb = (b as any)[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (isDate) return (new Date(va).getTime() - new Date(vb).getTime()) * sign;
      return String(va).localeCompare(String(vb), "pt-BR", { numeric: true }) * sign;
    });
  }, [data, search, statusFilter, sortKey, sortDir]);


  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }
  function openEdit(row: PurchaseOrder) {
    setEditing(row);
    setForm({
      sc_number: row.sc_number ?? "",
      pc_number: row.pc_number ?? "",
      cost_center: row.cost_center ?? "",
      description: row.description ?? "",
      opening_date: row.opening_date,
      status: row.status ?? "Aguardando gerar Pedido de Compra",
      finalization_date: row.finalization_date,
      finalization_note: row.finalization_note ?? "",
      insumo: row.insumo ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.description?.trim()) {
      toast.error("Informe a descrição do pedido");
      return;
    }
    setSaving(true);
    const payload: any = {
      ...form,
      department,
      sc_number: form.sc_number || null,
      pc_number: form.pc_number || null,
      cost_center: form.cost_center || null,
      opening_date: form.opening_date || null,
      finalization_date: form.finalization_date || null,
      finalization_note: form.finalization_note || null,
      insumo: form.insumo || null,
    };
    let error;
    if (editing) {
      ({ error } = await (supabase as any).from("purchase_orders").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await (supabase as any).from("purchase_orders").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(editing ? "Pedido atualizado" : "Pedido criado");
    setDialogOpen(false);
    qc.invalidateQueries({ queryKey: ["purchase_orders", department] });
  }

  async function handleDelete(row: PurchaseOrder) {
    const { error } = await (supabase as any).from("purchase_orders").delete().eq("id", row.id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Pedido excluído");
    qc.invalidateQueries({ queryKey: ["purchase_orders", department] });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: data.length };
    for (const s of STATUS_OPTIONS) c[s] = data.filter((r) => r.status === s).length;
    return c;
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-semibold">{counts.total}</p>
        </Card>
        {STATUS_OPTIONS.map((s) => (
          <Card key={s} className="p-3">
            <p className="text-xs text-muted-foreground truncate" title={s}>{s}</p>
            <p className="text-xl font-semibold">{counts[s] || 0}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por SC, PC, centro de custo, descrição..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Novo Pedido
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Nº SC" k="sc_number" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableHead label="Nº PC" k="pc_number" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableHead label="Centro de Custo" k="cost_center" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableHead label="Descrição" k="description" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="min-w-[280px]" />
              <SortableHead label="Abertura" k="opening_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableHead label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableHead label="Finalização" k="finalization_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableHead label="Insumo" k="insumo" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <TableHead className="w-[100px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
            ) : filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.sc_number || "—"}</TableCell>
                <TableCell>{row.pc_number || "—"}</TableCell>
                <TableCell className="whitespace-pre-line text-xs">{row.cost_center || "—"}</TableCell>
                <TableCell className="whitespace-pre-line">{row.description}</TableCell>
                <TableCell>{fmtDate(row.opening_date)}</TableCell>
                <TableCell>
                  {row.status ? (
                    <Badge variant="outline" className={STATUS_COLORS[row.status] || ""}>{row.status}</Badge>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {fmtDate(row.finalization_date)}
                  {row.finalization_note && (
                    <div className="text-[11px] text-muted-foreground">{row.finalization_note}</div>
                  )}
                </TableCell>
                <TableCell>{row.insumo || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                    <ConfirmDeleteDialog
                      onConfirm={() => handleDelete(row)}
                      title="Excluir pedido"
                      description={`Confirma a exclusão do pedido "${row.description}"?`}
                    />

                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Pedido" : "Novo Pedido"} — {department}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nº Solicitação de Compra</Label>
              <Input value={form.sc_number ?? ""} onChange={(e) => setForm({ ...form, sc_number: e.target.value })} />
            </div>
            <div>
              <Label>Nº Pedido de Compra</Label>
              <Input value={form.pc_number ?? ""} onChange={(e) => setForm({ ...form, pc_number: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Centro de Custo</Label>
              <Textarea rows={2} value={form.cost_center ?? ""} onChange={(e) => setForm({ ...form, cost_center: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Descrição *</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Data de Abertura da SC</Label>
              <Input type="date" value={form.opening_date ?? ""} onChange={(e) => setForm({ ...form, opening_date: e.target.value || null })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? ""} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Finalização</Label>
              <Input type="date" value={form.finalization_date ?? ""} onChange={(e) => setForm({ ...form, finalization_date: e.target.value || null })} />
            </div>
            <div>
              <Label>Observação Finalização</Label>
              <Input value={form.finalization_note ?? ""} onChange={(e) => setForm({ ...form, finalization_note: e.target.value })} placeholder="ex.: CONTAS MENSAIS" />
            </div>
            <div className="col-span-2">
              <Label>Insumo</Label>
              <Input value={form.insumo ?? ""} onChange={(e) => setForm({ ...form, insumo: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

